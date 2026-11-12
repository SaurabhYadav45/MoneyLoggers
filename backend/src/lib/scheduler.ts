import { getCache, setCache } from './redis';
import { getIstDateString, IPO_SCHEDULED_TIMES_IST } from './quotaManager';
import { syncAllCuratedStocks } from '../services/stockSyncService';
import { syncIPOList } from '../services/ipoSyncService';
import { syncMarketNews } from '../services/newsService';
import { getUpstoxAccessToken } from '../services/upstoxService';
import { syncAllMutualFunds } from '../services/mutualFundService';

export interface ScheduledJobInfo {
  id: string;
  name: string;
  intervalDescription: string;
  lastRunAt: string | null;
  lastStatus: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  lastError: string | null;
  runCount: number;
}

const jobRegistry: Map<string, ScheduledJobInfo> = new Map();

/**
 * Register job metadata
 */
const registerJob = (id: string, name: string, intervalDescription: string) => {
  jobRegistry.set(id, {
    id,
    name,
    intervalDescription,
    lastRunAt: null,
    lastStatus: 'IDLE',
    lastError: null,
    runCount: 0
  });
};

// Initialize job definitions
registerJob('eod_stock_sync', 'EOD Curated Stock Sync', 'Daily at 16:00 IST (after NSE close)');
registerJob('ipo_pipeline_sync', 'IPO Pipeline & Data Synchronization', '8 weekday cycles: Mon-Fri 10:00 to 17:00 IST (hourly: 10, 11, 12, 13, 14, 15, 16, 17)');
registerJob('market_news_sync', 'Financial Market News Stream', 'Every 30 mins round-the-clock (:00 and :30)');
registerJob('upstox_token_check', 'Upstox Token Expiration Monitor', 'Daily at 03:45 AM IST');
registerJob('mutual_fund_eod_sync', 'Daily Mutual Fund EOD NAV Sync', 'Daily at 23:00 IST (after AMC declaration)');

/**
 * Executes a job safely with distributed Redis lock to prevent concurrent multi-instance execution
 */
export const runScheduledJob = async (
  jobId: string,
  task: () => Promise<any>,
  lockTtlSeconds = 600,
  lockSuffix?: string
): Promise<boolean> => {
  const job = jobRegistry.get(jobId);
  if (!job) return false;

  const todayIst = getIstDateString();
  const lockKey = lockSuffix
    ? `lock:scheduler:${jobId}:${lockSuffix}:${todayIst}`
    : `lock:scheduler:${jobId}:${todayIst}`;

  // Acquire distributed lock
  const existingLock = await getCache<string>(lockKey);
  if (existingLock) {
    return false; // Already executed or running on another worker today
  }

  // Set lock
  await setCache(lockKey, 'LOCKED', lockTtlSeconds);

  job.lastRunAt = new Date().toISOString();
  job.lastStatus = 'RUNNING';
  job.lastError = null;

  try {
    console.log(`⏱️ [Scheduler]: Starting job "${job.name}"...`);
    await task();
    job.lastStatus = 'SUCCESS';
    job.runCount++;
    console.log(`✅ [Scheduler]: Finished job "${job.name}" successfully.`);
    return true;
  } catch (err: any) {
    job.lastStatus = 'FAILED';
    job.lastError = err?.message || String(err);
    console.error(`❌ [Scheduler]: Job "${job.name}" failed:`, job.lastError);
    return false;
  }
};

/**
 * Returns current scheduler status for health monitoring
 */
export const getSchedulerStatus = () => {
  return Array.from(jobRegistry.values());
};

/**
 * Internal tick loop checking IST schedule every 60 seconds
 */
let schedulerInterval: NodeJS.Timeout | null = null;

export const initScheduler = (): void => {
  if (schedulerInterval) return; // Already running

  console.log('🗓️ [Scheduler]: MoneyLogger Background Scheduler initialized.');

  // Run tick every 60 seconds
  schedulerInterval = setInterval(async () => {
    try {
      const now = new Date();
      // Calculate IST time (UTC + 5:30)
      const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
      const istDate = new Date(istMs);
      const hours = istDate.getUTCHours();
      const minutes = istDate.getUTCMinutes();
      const day = istDate.getUTCDay(); // 0 = Sun, 6 = Sat
      const isWeekday = day >= 1 && day <= 5;

      // 1. EOD Stock Sync (Weekdays at 16:00 IST)
      if (isWeekday && hours === 16 && minutes === 0) {
        await runScheduledJob('eod_stock_sync', async () => {
          await syncAllCuratedStocks(undefined, true);
        }, 1800);
      }

      // 2. IPO Pipeline Sync (Exact 8 weekday cycles: hourly 10:00 through 17:00 IST EOD)
      // Skips weekends and strictly does NOT run at 18:00
      if (isWeekday) {
        const isScheduledSlot = IPO_SCHEDULED_TIMES_IST.some(
          (slot) => slot.hour === hours && slot.minute === minutes
        );
        if (isScheduledSlot) {
          const slotSuffix = `slot_${String(hours).padStart(2, '0')}_${String(minutes).padStart(2, '0')}`;
          await runScheduledJob(
            'ipo_pipeline_sync',
            async () => {
              await syncIPOList('SCHEDULED', 'SYSTEM_SCHEDULER');
            },
            600, // 10-min distributed lock prevents duplicate executions across instances
            slotSuffix
          );
        }
      }

      // 3. News Ingestion (Every 30 mins: at :00 and :30)
      if (minutes === 0 || minutes === 30) {
        const timeKey = `news_${hours}_${minutes}`;
        await runScheduledJob('market_news_sync', async () => {
          await syncMarketNews(true);
        }, 1500, timeKey);
      }

      // 4. Upstox Token Check (Every morning at 03:45 AM IST)
      if (hours === 3 && minutes === 45) {
        await runScheduledJob('upstox_token_check', async () => {
          const token = await getUpstoxAccessToken();
          if (!token) {
            console.warn('⚠️ [Scheduler]: Upstox token is expired for today. Please visit /api/v1/stocks/upstox/auth-url to renew.');
          } else {
            console.log('✅ [Scheduler]: Upstox token is present.');
          }
        }, 3600);
      }

      // 5. Daily Mutual Fund EOD NAV Sync (Daily at 23:00 IST after AMCs declare closing NAVs)
      if (hours === 23 && minutes === 0) {
        await runScheduledJob('mutual_fund_eod_sync', async () => {
          await syncAllMutualFunds(true);
        }, 3600);
      }
    } catch (tickErr: any) {
      console.error('⚠️ [Scheduler Tick Error]:', tickErr?.message);
    }
  }, 60000);

  // Unref timer so it does not block graceful process exit
  if (schedulerInterval.unref) {
    schedulerInterval.unref();
  }
};

/**
 * Clean shutdown hook
 */
export const stopScheduler = (): void => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
};
