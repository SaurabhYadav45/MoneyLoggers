/**
 * MoneyLogger Centralized Quota & External API Manager
 *
 * Enforces:
 * 1. Strict daily request quota per provider (e.g. IndianAPI max 1,000 req/day).
 * 2. In-flight single-flight request coalescing (prevents concurrent cache-miss bursts).
 * 3. Provider-level concurrency throttling (token bucket / semaphore).
 * 4. Circuit breaker protection against failing upstream providers.
 * 5. Bounded retries with backoff for transient 5xx errors (never on 4xx).
 * 6. Last-Known-Good preservation so users never see blank screens on failure.
 * 7. Market-session-aware adaptive TTLs (extends caching during closed market hours).
 */

import { getCache, setCache, incrCache, getCounter } from './redis';

export type ProviderId = 'indianapi' | 'upstox' | 'yahoo' | 'mfapi';

export interface ProviderConfig {
  dailyLimit: number;
  softCeiling: number; // Conservative warning threshold
  maxConcurrent: number;
  minIntervalMs: number;
  circuitThreshold: number; // Consecutive failures before opening circuit
  circuitResetMs: number; // Cooldown before trying half-open
  maxRetries: number;
  retryDelayMs: number;
  defaultTimeoutMs: number;
}

/**
 * Exact 8 scheduled execution times (Monday through Friday) in Asia/Kolkata (IST).
 * 10:00 through 17:00 IST at hourly intervals (10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00).
 */
export const IPO_SCHEDULED_TIMES_IST: Array<{ hour: number; minute: number }> = [
  { hour: 10, minute: 0 },
  { hour: 11, minute: 0 },
  { hour: 12, minute: 0 },
  { hour: 13, minute: 0 },
  { hour: 14, minute: 0 },
  { hour: 15, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 17, minute: 0 },
];

/**
 * Calculates remaining scheduled requests today for IndianAPI (4 calls per cycle).
 * Weekends = 0 calls. Weekdays = up to 32 calls (8 cycles * 4 endpoints).
 */
export const getRemainingScheduledRequestsToday = (now: Date = new Date()): number => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  const day = istDate.getUTCDay(); // 0 = Sun, 6 = Sat
  if (day === 0 || day === 6) {
    return 0;
  }

  const currentMinutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
  let remainingCycles = 0;
  for (const slot of IPO_SCHEDULED_TIMES_IST) {
    const slotMinutes = slot.hour * 60 + slot.minute;
    if (slotMinutes >= currentMinutes) {
      remainingCycles++;
    }
  }

  return remainingCycles * 4;
};

export const PROVIDER_CONFIGS: Record<ProviderId, ProviderConfig> = {
  indianapi: {
    dailyLimit: 1000,
    softCeiling: 920, // 80 request buffer reserved for emergency syncs
    maxConcurrent: 3,
    minIntervalMs: 150,
    circuitThreshold: 4,
    circuitResetMs: 60000, // 1 min cooldown
    maxRetries: 1,
    retryDelayMs: 400,
    defaultTimeoutMs: 10000
  },
  upstox: {
    dailyLimit: 5000,
    softCeiling: 4800,
    maxConcurrent: 5,
    minIntervalMs: 100,
    circuitThreshold: 5,
    circuitResetMs: 60000,
    maxRetries: 1,
    retryDelayMs: 500,
    defaultTimeoutMs: 8000
  },
  yahoo: {
    dailyLimit: 15000,
    softCeiling: 14000,
    maxConcurrent: 8,
    minIntervalMs: 50,
    circuitThreshold: 5,
    circuitResetMs: 60000,
    maxRetries: 1,
    retryDelayMs: 500,
    defaultTimeoutMs: 8000
  },
  mfapi: {
    dailyLimit: 25000,
    softCeiling: 24000,
    maxConcurrent: 10,
    minIntervalMs: 50,
    circuitThreshold: 5,
    circuitResetMs: 60000,
    maxRetries: 1,
    retryDelayMs: 300,
    defaultTimeoutMs: 8000
  }
};

interface CircuitState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  lastFailureTime: number;
  openedAt: number;
}

const circuitStates = new Map<ProviderId, CircuitState>();

const getCircuitState = (provider: ProviderId): CircuitState => {
  let state = circuitStates.get(provider);
  if (!state) {
    state = { state: 'CLOSED', failures: 0, lastFailureTime: 0, openedAt: 0 };
    circuitStates.set(provider, state);
  }
  return state;
};

// Active in-flight requests map (Key -> Promise) for single-flight deduplication
const inFlightRequests = new Map<string, Promise<any>>();

// Active concurrency counter per provider
const activeConcurrency = new Map<ProviderId, number>();

// Concurrency queue per provider
type QueueItem = () => void;
const concurrencyQueues = new Map<ProviderId, QueueItem[]>();

const acquireConcurrency = async (provider: ProviderId): Promise<void> => {
  const config = PROVIDER_CONFIGS[provider];
  const current = activeConcurrency.get(provider) || 0;

  if (current < config.maxConcurrent) {
    activeConcurrency.set(provider, current + 1);
    return;
  }

  return new Promise<void>((resolve) => {
    let queue = concurrencyQueues.get(provider);
    if (!queue) {
      queue = [];
      concurrencyQueues.set(provider, queue);
    }
    queue.push(() => {
      const active = activeConcurrency.get(provider) || 0;
      activeConcurrency.set(provider, active + 1);
      resolve();
    });
  });
};

const releaseConcurrency = (provider: ProviderId): void => {
  const current = activeConcurrency.get(provider) || 1;
  activeConcurrency.set(provider, Math.max(0, current - 1));

  const queue = concurrencyQueues.get(provider);
  if (queue && queue.length > 0) {
    const next = queue.shift();
    if (next) next();
  }
};

/**
 * Returns Indian Standard Time date string: YYYY-MM-DD
 */
export const getIstDateString = (): string => {
  const now = new Date();
  // UTC + 5:30 for Indian Standard Time
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  return istDate.toISOString().split('T')[0];
};

/**
 * Checks whether NSE/BSE or MCX market is currently in active trading hours
 */
export const getMarketSession = (exchange: 'NSE' | 'MCX' = 'NSE') => {
  const now = new Date();
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  const dayOfWeek = now.getUTCDay(); // 0 = Sun, 6 = Sat

  // Weekend: closed
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return { isOpen: false, session: 'WEEKEND_CLOSED', exchange };
  }

  if (exchange === 'NSE') {
    // NSE: 09:15 IST (03:45 UTC) to 15:30 IST (10:00 UTC)
    const nseOpenUtc = 3 * 60 + 45;
    const nseCloseUtc = 10 * 60;
    const isOpen = utcMinutes >= nseOpenUtc && utcMinutes <= nseCloseUtc;
    return {
      isOpen,
      session: isOpen ? 'REGULAR_TRADING' : utcMinutes < nseOpenUtc ? 'PRE_MARKET' : 'POST_MARKET',
      exchange
    };
  }

  // MCX: 09:00 IST (03:30 UTC) to 23:30 IST (18:00 UTC)
  const mcxOpenUtc = 3 * 60 + 30;
  const mcxCloseUtc = 18 * 60;
  const isOpen = utcMinutes >= mcxOpenUtc && utcMinutes <= mcxCloseUtc;
  return {
    isOpen,
    session: isOpen ? 'MCX_ACTIVE' : 'MCX_CLOSED',
    exchange
  };
};

/**
 * Calculates remaining seconds until the next trading day's market open (09:15 AM IST for NSE).
 * Skips weekends (Saturday/Sunday) and accounts for post-market hours.
 */
export const getSecondsUntilNextMarketOpen = (exchange: 'NSE' | 'MCX' = 'NSE', now: Date = new Date()): number => {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);

  const openHour = 9;
  const openMinute = exchange === 'NSE' ? 15 : 0;

  for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
    const candidateIst = new Date(istNow.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dayOfWeek = candidateIst.getUTCDay(); // 0 = Sun, 6 = Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue;
    }

    const targetIst = new Date(Date.UTC(
      candidateIst.getUTCFullYear(),
      candidateIst.getUTCMonth(),
      candidateIst.getUTCDate(),
      openHour,
      openMinute,
      0,
      0
    ));

    const diffMs = targetIst.getTime() - istNow.getTime();
    if (diffMs > 0) {
      return Math.floor(diffMs / 1000);
    }
  }

  return 43200; // 12h fallback
};

/**
 * Computes adaptive cache TTL based on market open/closed status.
 * When markets are closed, prices cannot change, so TTL extends until next market open (09:15 AM IST).
 */
export const getAdaptiveTtl = (baseTtlSeconds: number, exchange: 'NSE' | 'MCX' = 'NSE'): number => {
  const session = getMarketSession(exchange);
  if (!session.isOpen) {
    // When closed, price is static. Cache until next market open (at least 30 min, up to next 09:15 IST)
    const secondsUntilOpen = getSecondsUntilNextMarketOpen(exchange);
    return Math.max(baseTtlSeconds, Math.min(secondsUntilOpen, 259200)); // Capped at 3 days max (weekend)
  }
  return baseTtlSeconds;
};

/**
 * Atomically reserve a daily quota credit for a given provider.
 * Returns { allowed, currentUsage, limit, remaining, reservedForSchedule }
 */
export const reserveQuota = async (
  provider: ProviderId,
  isScheduled: boolean = false
): Promise<{
  allowed: boolean;
  currentUsage: number;
  limit: number;
  remaining: number;
  reservedForSchedule: number;
}> => {
  const config = PROVIDER_CONFIGS[provider];
  const todayKey = `quota:daily:${provider}:${getIstDateString()}`;

  // For IndianAPI, calculate quota reserved exclusively for remaining weekday scheduled cycles today
  const reservedForSchedule = provider === 'indianapi' ? getRemainingScheduledRequestsToday() : 0;

  // Atomic increment with 86400s (24h) TTL
  const currentUsage = await incrCache(todayKey, 86400);
  const remaining = Math.max(0, config.dailyLimit - currentUsage);

  // Scheduled calls can use the entire daily allowance.
  // Non-scheduled calls (admin sync, detail on-demand, user actions) cannot consume the reserved scheduled budget.
  const allowed = isScheduled
    ? currentUsage <= config.dailyLimit
    : (currentUsage + reservedForSchedule) <= config.dailyLimit;

  if (!allowed) {
    if (isScheduled) {
      console.warn(`🚨 [Quota Exceeded]: Provider "${provider}" hit daily limit (${currentUsage}/${config.dailyLimit}). Request rejected.`);
    } else {
      console.warn(
        `🚨 [Quota Reserved]: Provider "${provider}" non-scheduled request rejected. Current usage: ${currentUsage}, Reserved for scheduled cycles: ${reservedForSchedule}, Daily limit: ${config.dailyLimit}.`
      );
    }
  } else if (currentUsage >= config.softCeiling) {
    console.warn(`⚠️ [Quota Warning]: Provider "${provider}" reached ${currentUsage}/${config.dailyLimit} requests today.`);
  }

  return {
    allowed,
    currentUsage,
    limit: config.dailyLimit,
    remaining,
    reservedForSchedule,
  };
};

/**
 * Query current daily quota status without incrementing.
 */
export const getQuotaStatus = async (provider: ProviderId) => {
  const config = PROVIDER_CONFIGS[provider];
  const todayKey = `quota:daily:${provider}:${getIstDateString()}`;
  const currentUsage = await getCounter(todayKey);
  const circuit = getCircuitState(provider);
  const reservedForSchedule = provider === 'indianapi' ? getRemainingScheduledRequestsToday() : 0;
  const remaining = Math.max(0, config.dailyLimit - currentUsage);
  const availableForNonScheduled = Math.max(0, remaining - reservedForSchedule);

  return {
    provider,
    currentUsage,
    limit: config.dailyLimit,
    remaining,
    reservedForSchedule,
    availableForNonScheduled,
    circuitState: circuit.state,
    concurrencyActive: activeConcurrency.get(provider) || 0,
    inFlightCount: inFlightRequests.size,
    marketSession: getMarketSession()
  };
};

export class QuotaExceededError extends Error {
  public provider: ProviderId;
  constructor(provider: ProviderId, message?: string) {
    super(message || `Daily quota of ${PROVIDER_CONFIGS[provider].dailyLimit} requests for provider "${provider}" has been exhausted or reserved for scheduled operations.`);
    this.name = 'QuotaExceededError';
    this.provider = provider;
  }
}

export class CircuitBreakerOpenError extends Error {
  public provider: ProviderId;
  constructor(provider: ProviderId, message?: string) {
    super(message || `Circuit breaker is OPEN for provider "${provider}". Fast-failing upstream call.`);
    this.name = 'CircuitBreakerOpenError';
    this.provider = provider;
  }
}

export interface ExecuteOptions<T> {
  provider: ProviderId;
  cacheKey: string;
  ttlSeconds: number;
  fetcher: () => Promise<T>;
  allowStaleOnFailure?: boolean;
  fallbackValue?: T;
  skipCache?: boolean;
  exchange?: 'NSE' | 'MCX';
  isSyncOperation?: boolean;
  isScheduled?: boolean;
}

/**
 * Master execution wrapper.
 * Combines L1/L2 caching, single-flight coalescing, quota tracking, concurrency limits,
 * circuit breaker, and last-known-good fallback.
 */
export const executeWithQuota = async <T>(options: ExecuteOptions<T>): Promise<T> => {
  const {
    provider,
    cacheKey,
    ttlSeconds,
    fetcher,
    allowStaleOnFailure = true,
    fallbackValue,
    skipCache = false,
    exchange = 'NSE',
    isScheduled = false
  } = options;

  // 1. FAST SINGLE-FLIGHT ATTACH: If a task for this cacheKey is already in flight, join it immediately
  if (!skipCache) {
    const existingPromise = inFlightRequests.get(cacheKey);
    if (existingPromise) {
      return existingPromise as Promise<T>;
    }
  }

  const lastKnownGoodKey = `${cacheKey}:last_known_good`;
  const adaptiveTtl = getAdaptiveTtl(ttlSeconds, exchange);

  // 2. RUN TASK (handles cache check, circuit breaker, quota reservation, upstream execution & fallback)
  const runTask = async (): Promise<T> => {
    try {
      // Fast path: Check L1 / L2 Cache inside single-flight execution
      if (!skipCache) {
        const cached = await getCache<T>(cacheKey);
        if (cached !== null && cached !== undefined) {
          return cached;
        }
      }

      // Circuit Breaker check
      const circuit = getCircuitState(provider);
      const now = Date.now();
      const config = PROVIDER_CONFIGS[provider];

      if (circuit.state === 'OPEN') {
        if (now - circuit.openedAt > config.circuitResetMs) {
          circuit.state = 'HALF_OPEN';
          console.log(`[CircuitBreaker] Transitioning "${provider}" from OPEN to HALF_OPEN (probing).`);
        } else {
          // Fast-fail to last known good data or fallback
          if (allowStaleOnFailure) {
            const lastKnown = await getCache<T>(lastKnownGoodKey);
            if (lastKnown !== null && lastKnown !== undefined) {
              console.warn(`[CircuitBreaker] Provider "${provider}" circuit OPEN. Serving last-known-good cache for key: ${cacheKey}`);
              return lastKnown;
            }
          }
          if (fallbackValue !== undefined) return fallbackValue;
          throw new CircuitBreakerOpenError(provider);
        }
      }

      // Quota Reservation (initial attempt)
      const reservation = await reserveQuota(provider, isScheduled);
      if (!reservation.allowed) {
        if (allowStaleOnFailure) {
          const lastKnown = await getCache<T>(lastKnownGoodKey);
          if (lastKnown !== null && lastKnown !== undefined) {
            console.warn(`[QuotaExceeded] Serving last-known-good cache for key: ${cacheKey}`);
            return lastKnown;
          }
        }
        if (fallbackValue !== undefined) return fallbackValue;
        throw new QuotaExceededError(provider);
      }

      // Upstream Execution with Concurrency Throttling & Bounded Retries
      await acquireConcurrency(provider);
      try {
        let result: T;
        let lastError: any = null;
        const maxAttempts = config.maxRetries + 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            // If this is a retry attempt, reserve an additional quota credit for the retry
            if (attempt > 1) {
              const retryReservation = await reserveQuota(provider, isScheduled);
              if (!retryReservation.allowed) {
                console.warn(`[QuotaExceeded] Cannot retry upstream call for ${provider}: quota exceeded/reserved.`);
                break;
              }
            }

            if (config.minIntervalMs > 0) {
              await new Promise(r => setTimeout(r, config.minIntervalMs));
            }

            result = await fetcher();

            // Guard against caching API error payloads (e.g. { status: "error", code: "API_REQUEST_FAILED" })
            const isErrorPayload = Boolean(
              result && typeof result === 'object' && (
                (result as any).status === 'error' ||
                (result as any).code === 'API_REQUEST_FAILED' ||
                (result as any).error != null
              )
            );

            // Reset circuit breaker on success
            circuit.failures = 0;
            circuit.state = 'CLOSED';

            if (!isErrorPayload && result !== null && result !== undefined) {
              // Store in L1 Memory + L2 Redis with adaptive TTL
              await setCache(cacheKey, result, adaptiveTtl);

              // Store permanent snapshot as last known good (7 days = 604,800s)
              await setCache(lastKnownGoodKey, result, 604800);
            }

            return result;
          } catch (err: any) {
            lastError = err;
            const status = err?.response?.status;
            const isRetryable = !status || status >= 500 || err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT';

            // Never retry client errors (400, 401, 403, 404, 429)
            if (!isRetryable || attempt >= maxAttempts) {
              break;
            }

            const backoff = config.retryDelayMs * Math.pow(2, attempt - 1);
            await new Promise(r => setTimeout(r, backoff));
          }
        }

        // Handle upstream failure
        circuit.failures++;
        circuit.lastFailureTime = Date.now();
        if (circuit.failures >= config.circuitThreshold) {
          circuit.state = 'OPEN';
          circuit.openedAt = Date.now();
          console.warn(`🚨 [CircuitBreaker] "${provider}" tripped OPEN after ${circuit.failures} consecutive failures.`);
        }

        // Fallback to last known good
        if (allowStaleOnFailure) {
          const lastKnown = await getCache<T>(lastKnownGoodKey);
          if (lastKnown !== null && lastKnown !== undefined) {
            console.warn(`⚠️ [Fallback Served] Upstream "${provider}" failed (${lastError?.message}). Serving last-known-good cache for: ${cacheKey}`);
            return lastKnown;
          }
        }

        if (fallbackValue !== undefined) {
          return fallbackValue;
        }

        throw lastError;
      } finally {
        releaseConcurrency(provider);
      }
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  };

  const taskPromise = runTask();
  if (!skipCache) {
    inFlightRequests.set(cacheKey, taskPromise);
  }
  return taskPromise;
};

/**
 * Reset all in-memory circuit breakers, concurrency counters, and in-flight maps.
 * Useful for automated tests.
 */
export const resetQuotaManagerForTesting = (): void => {
  circuitStates.clear();
  inFlightRequests.clear();
  activeConcurrency.clear();
  concurrencyQueues.clear();
};
