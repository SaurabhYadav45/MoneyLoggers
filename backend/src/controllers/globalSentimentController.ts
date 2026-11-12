import { Request, Response } from 'express';
import { getGlobalSentimentsPayload, getFIIDIIHistory } from '../services/globalSentimentService';
import { getCache, setCache } from '../lib/redis';

/**
 * Controller to get full global sentiments data
 * GET /api/v1/global-sentiments?force=true
 * Includes 10-minute (600s) server-side cooldown on manual force sync to protect 3rd-party APIs
 */
export const getGlobalSentiments = async (req: Request, res: Response) => {
  try {
    let forceRefresh = req.query.force === 'true' || req.query.refresh === 'true';
    let rateLimited = false;
    let nextAllowedSeconds = 0;

    if (forceRefresh) {
      const COOLDOWN_KEY = 'global:sentiments:last_force_sync';
      const lastSync = await getCache<number>(COOLDOWN_KEY);
      const now = Date.now();
      const COOLDOWN_MS = 600000; // 10 minutes server cooldown (600s)

      if (lastSync && now - lastSync < COOLDOWN_MS) {
        forceRefresh = false; // Do not hit 3rd party APIs
        rateLimited = true;
        nextAllowedSeconds = Math.ceil((COOLDOWN_MS - (now - lastSync)) / 1000);
      } else {
        await setCache(COOLDOWN_KEY, now, 600);
      }
    }

    const data = await getGlobalSentimentsPayload(forceRefresh);
    const minutes = Math.floor(nextAllowedSeconds / 60);
    const remSeconds = nextAllowedSeconds % 60;
    const cooldownFormatted = minutes > 0 ? `${minutes}m ${remSeconds}s` : `${remSeconds}s`;

    return res.status(200).json({
      success: true,
      data,
      syncIntervalSeconds: 600, // 10 minutes unified auto-sync interval
      rateLimited,
      nextAllowedSeconds: rateLimited ? nextAllowedSeconds : 0,
      message: rateLimited
        ? `Data was recently updated. Next manual sync available in ${cooldownFormatted}.`
        : 'Live market data synced successfully'
    });
  } catch (error: any) {
    console.error('Error in getGlobalSentiments controller:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch global sentiment indicators',
      error: error.message
    });
  }
};

/**
 * Controller to get FII / DII history
 * GET /api/v1/global-sentiments/fii-dii?force=true
 */
export const getFIIDIIActivity = async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.force === 'true' || req.query.refresh === 'true';
    const data = await getFIIDIIHistory(forceRefresh);
    return res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Error in getFIIDIIActivity controller:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch FII/DII activity',
      error: error.message
    });
  }
};

/**
 * Controller to get GIFT Nifty Gap analysis alone
 * GET /api/v1/global-sentiments/gift-nifty-gap
 * Protected by 10-minute cooldown on force refresh
 */
export const getGiftNiftyGap = async (req: Request, res: Response) => {
  try {
    let forceRefresh = req.query.force === 'true' || req.query.refresh === 'true';

    if (forceRefresh) {
      const COOLDOWN_KEY = 'global:sentiments:last_force_sync';
      const lastSync = await getCache<number>(COOLDOWN_KEY);
      const now = Date.now();
      const COOLDOWN_MS = 600000; // 10 minutes (600s)

      if (lastSync && now - lastSync < COOLDOWN_MS) {
        forceRefresh = false; // Throttled: serve cached payload
      } else {
        await setCache(COOLDOWN_KEY, now, 600);
      }
    }

    const data = await getGlobalSentimentsPayload(forceRefresh);
    return res.status(200).json({
      success: true,
      data: data.giftNiftyGap
    });
  } catch (error: any) {
    console.error('Error in getGiftNiftyGap controller:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch GIFT Nifty gap',
      error: error.message
    });
  }
};
