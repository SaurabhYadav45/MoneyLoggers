/**
 * Automated Test Suite: MoneyLogger Centralized Quota & External API Manager
 * Tests:
 * 1. Cache hit & TTL behavior
 * 2. In-flight single-flight request coalescing (prevents duplicate requests)
 * 3. Daily quota reservation & exhaustion rejection
 * 4. Atomic concurrent quota reservations
 * 5. Circuit breaker state transitions (CLOSED -> OPEN -> Fallback)
 * 6. Last-known-good cache preservation & stale fallback
 * 7. Bounded retries with backoff on 5xx vs immediate fail on 4xx
 * 8. Market session detection & adaptive TTL extension
 */

import test, { describe, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  executeWithQuota,
  reserveQuota,
  getQuotaStatus,
  resetQuotaManagerForTesting,
  QuotaExceededError,
  CircuitBreakerOpenError,
  getMarketSession,
  getAdaptiveTtl,
  PROVIDER_CONFIGS
} from '../src/lib/quotaManager';
import { clearMemoryCache, getCache, setCache, disconnectRedis } from '../src/lib/redis';

describe('Centralized Quota & Concurrency Manager', () => {
  beforeEach(() => {
    clearMemoryCache();
    resetQuotaManagerForTesting();
  });

  test('1. Cache Hit: Second call returns cached data without invoking fetcher or consuming quota', async () => {
    let fetchCount = 0;
    const fetcher = async () => {
      fetchCount++;
      return { nsePrice: 24500, time: Date.now() };
    };

    const firstResult = await executeWithQuota({
      provider: 'indianapi',
      cacheKey: 'test:cache:hit',
      ttlSeconds: 60,
      fetcher
    });

    assert.equal(fetchCount, 1, 'Fetcher must be called on first execution (cold cache)');
    assert.equal(firstResult.nsePrice, 24500);

    // Second call with same cacheKey
    const secondResult = await executeWithQuota({
      provider: 'indianapi',
      cacheKey: 'test:cache:hit',
      ttlSeconds: 60,
      fetcher
    });

    assert.equal(fetchCount, 1, 'Fetcher must NOT be called on second execution (cache hit)');
    assert.deepEqual(firstResult, secondResult);
  });

  test('2. In-Flight Single-Flight Coalescing: Concurrent requests on cold cache trigger exactly 1 upstream call', async () => {
    let upstreamCallCount = 0;
    const slowFetcher = async () => {
      upstreamCallCount++;
      await new Promise(r => setTimeout(r, 80)); // Simulate 80ms network latency
      return { benchmark: 'NIFTY 50', value: 24800 };
    };

    // 10 concurrent requests arrive simultaneously on cold cache
    const concurrentRequests = Array.from({ length: 10 }).map(() =>
      executeWithQuota({
        provider: 'indianapi',
        cacheKey: 'test:single:flight',
        ttlSeconds: 60,
        fetcher: slowFetcher
      })
    );

    const results = await Promise.all(concurrentRequests);

    assert.equal(upstreamCallCount, 1, 'Exact single-flight deduplication: 10 parallel callers must trigger only 1 upstream call');
    assert.equal(results.length, 10);
    for (const res of results) {
      assert.equal(res.value, 24800);
    }
  });

  test('3. Daily Quota Exhaustion: QuotaExceededError is thrown when limit is exceeded', async () => {
    const originalLimit = PROVIDER_CONFIGS.yahoo.dailyLimit;
    PROVIDER_CONFIGS.yahoo.dailyLimit = 3; // Set small limit for testing

    try {
      // Consume the 3 credits
      const res1 = await reserveQuota('yahoo');
      const res2 = await reserveQuota('yahoo');
      const res3 = await reserveQuota('yahoo');

      assert.equal(res1.allowed, true);
      assert.equal(res2.allowed, true);
      assert.equal(res3.allowed, true);

      // 4th credit must be rejected
      const res4 = await reserveQuota('yahoo');
      assert.equal(res4.allowed, false, 'Reservation past limit must be denied');

      // executeWithQuota must reject with QuotaExceededError when no stale cache exists
      let threwQuotaError = false;
      try {
        await executeWithQuota({
          provider: 'yahoo',
          cacheKey: 'test:quota:exhausted',
          ttlSeconds: 60,
          allowStaleOnFailure: false,
          fetcher: async () => ({ ipo: 'NewCo' })
        });
      } catch (err: any) {
        if (err instanceof QuotaExceededError || err.name === 'QuotaExceededError') {
          threwQuotaError = true;
        }
      }
      assert.equal(threwQuotaError, true, 'Should throw QuotaExceededError on exhaustion');
    } finally {
      PROVIDER_CONFIGS.yahoo.dailyLimit = originalLimit;
    }
  });

  test('4. Atomic Concurrent Reservations: Multiple parallel requests increment counter reliably without race conditions', async () => {
    const reservationPromises = Array.from({ length: 25 }).map(() => reserveQuota('yahoo'));
    const results = await Promise.all(reservationPromises);

    const usages = results.map(r => r.currentUsage);
    const uniqueUsages = new Set(usages);

    // Each reservation should receive an atomic unique integer step from 1 to 25
    assert.equal(uniqueUsages.size, 25, 'All 25 parallel reservations must have unique incremental counters');
    assert.equal(Math.max(...usages), 25);
  });

  test('5. Circuit Breaker: Consecutive failures trip circuit to OPEN and fast-fail subsequent calls', async () => {
    const originalThreshold = PROVIDER_CONFIGS.yahoo.circuitThreshold;
    PROVIDER_CONFIGS.yahoo.circuitThreshold = 2; // Trip after 2 failures

    let callAttempts = 0;
    const failingFetcher = async () => {
      callAttempts++;
      const err: any = new Error('Upstream server timeout (504 Gateway Timeout)');
      err.code = 'ETIMEDOUT';
      throw err;
    };

    try {
      // First failure (retried once by bounded retry)
      await assert.rejects(
        () => executeWithQuota({
          provider: 'yahoo',
          cacheKey: 'test:circuit:1',
          ttlSeconds: 60,
          allowStaleOnFailure: false,
          fetcher: failingFetcher
        })
      );

      // Second failure - trips circuit breaker to OPEN
      await assert.rejects(
        () => executeWithQuota({
          provider: 'yahoo',
          cacheKey: 'test:circuit:2',
          ttlSeconds: 60,
          allowStaleOnFailure: false,
          fetcher: failingFetcher
        })
      );

      const status = await getQuotaStatus('yahoo');
      assert.equal(status.circuitState, 'OPEN', 'Circuit breaker must be OPEN after threshold failures');

      const attemptsBeforeOpen = callAttempts;

      // Third call must fast-fail via CircuitBreakerOpenError WITHOUT calling the fetcher!
      await assert.rejects(
        () => executeWithQuota({
          provider: 'yahoo',
          cacheKey: 'test:circuit:3',
          ttlSeconds: 60,
          allowStaleOnFailure: false,
          fetcher: failingFetcher
        }),
        (err: any) => err instanceof CircuitBreakerOpenError || err.name === 'CircuitBreakerOpenError'
      );

      assert.equal(callAttempts, attemptsBeforeOpen, 'When circuit is OPEN, fetcher must NOT be invoked at all');
    } finally {
      PROVIDER_CONFIGS.yahoo.circuitThreshold = originalThreshold;
    }
  });

  test('6. Last-Known-Good Preservation: Serves stale snapshot if upstream call fails', async () => {
    const key = 'test:last:known:good';

    // 1. First fetch succeeds
    const goodData = { price: 100.5, timestamp: '2026-10-24T10:00:00Z' };
    await executeWithQuota({
      provider: 'indianapi',
      cacheKey: key,
      ttlSeconds: 60,
      fetcher: async () => goodData
    });

    // Invalidate main cache to force an upstream fetch
    await clearMemoryCache();

    // Re-prime the last-known-good key in memory cache to simulate persistent Redis/L1 snapshot
    await setCache(`${key}:last_known_good`, goodData, 604800);

    // 2. Upstream fetch fails with 500 error
    const resultOnFailure = await executeWithQuota({
      provider: 'indianapi',
      cacheKey: key,
      ttlSeconds: 60,
      allowStaleOnFailure: true,
      fetcher: async () => {
        throw new Error('500 Internal Server Error from upstream');
      }
    });

    assert.deepEqual(resultOnFailure, goodData, 'Must seamlessly serve last-known-good data on upstream failure');
  });

  test('7. Bounded Retries: Retries 5xx/network errors up to maxRetries, does NOT retry 400 Client Error', async () => {
    let callCount400 = 0;
    const clientErrorFetcher = async () => {
      callCount400++;
      const err: any = new Error('400 Bad Request');
      err.response = { status: 400 };
      throw err;
    };

    // Call with 400 error
    await assert.rejects(
      () => executeWithQuota({
        provider: 'indianapi',
        cacheKey: 'test:400:error',
        ttlSeconds: 60,
        allowStaleOnFailure: false,
        fetcher: clientErrorFetcher
      })
    );

    assert.equal(callCount400, 1, 'Client error 400 must never be retried');

    // Call with 503 error (transient service unavailable)
    let callCount503 = 0;
    const serverErrorFetcher = async () => {
      callCount503++;
      const err: any = new Error('503 Service Unavailable');
      err.response = { status: 503 };
      throw err;
    };

    await assert.rejects(
      () => executeWithQuota({
        provider: 'indianapi',
        cacheKey: 'test:503:error',
        ttlSeconds: 60,
        allowStaleOnFailure: false,
        fetcher: serverErrorFetcher
      })
    );

    assert.equal(callCount503, 2, 'Server error 503 must be retried exactly once (maxRetries = 1)');
  });

  test('8. Market Session & Adaptive TTL: Extends cache TTL when markets are closed', () => {
    const session = getMarketSession('NSE');
    assert.ok(session.session, 'Market session must return valid state');

    // Test adaptive TTL calculation: base 300s
    const adaptiveTtl = getAdaptiveTtl(300, 'NSE');
    if (!session.isOpen) {
      assert.ok(adaptiveTtl >= 900, 'Closed market TTL must be extended to save quota');
    } else {
      assert.equal(adaptiveTtl, 300, 'Open market TTL matches base TTL');
    }
  });

  after(async () => {
    await disconnectRedis();
  });
});
