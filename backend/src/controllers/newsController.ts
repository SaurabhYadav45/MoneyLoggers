import { Request, Response } from 'express';
import {
  getNewsFeed,
  getBreakingNews,
  getSentimentSummary,
  syncMarketNews,
  getNewsSyncStatus
} from '../services/newsService';

// GET /api/v1/news
export const getNews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, category, sector, symbol, sentiment, search } = req.query;

    const data = await getNewsFeed({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      category: typeof category === 'string' ? category : undefined,
      sector: typeof sector === 'string' ? sector : undefined,
      symbol: typeof symbol === 'string' ? symbol : undefined,
      sentiment: typeof sentiment === 'string' ? sentiment : undefined,
      search: typeof search === 'string' ? search : undefined,
    });

    res.json(data);
  } catch (error: any) {
    console.error('Error in getNews:', error.message);
    res.status(500).json({ message: 'Failed to retrieve market news', error: error.message });
  }
};

// GET /api/v1/news/breaking
export const getBreakingNewsHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 5;
    const items = await getBreakingNews(limit);
    res.json(items);
  } catch (error: any) {
    console.error('Error in getBreakingNewsHandler:', error.message);
    res.status(500).json({ message: 'Failed to retrieve breaking news', error: error.message });
  }
};

// GET /api/v1/news/sentiment-summary
export const getSentimentSummaryHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await getSentimentSummary();
    res.json(summary);
  } catch (error: any) {
    console.error('Error in getSentimentSummaryHandler:', error.message);
    res.status(500).json({ message: 'Failed to retrieve sentiment summary', error: error.message });
  }
};

// GET /api/v1/news/sync-status
export const getNewsSyncStatusHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getNewsSyncStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Error in getNewsSyncStatusHandler:', error.message);
    res.status(500).json({ success: false, message: 'Failed to get sync status', error: error.message });
  }
};

// POST /api/v1/news/sync
// Public user-facing endpoint for "Sync Now" button
// Only checks status & returns scheduled refresh timing without calling 3rd-party APIs!
export const syncNewsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await getNewsSyncStatus();
    res.json({
      success: true,
      count: 0,
      message: status.message,
      lastSyncedAt: status.lastSyncedAt,
      isSyncing: status.isSyncing,
      nextSyncInSeconds: status.nextSyncInSeconds
    });
  } catch (error: any) {
    console.error('Error in syncNewsHandler:', error.message);
    res.status(500).json({ message: 'News status check failed', error: error.message });
  }
};

// POST /api/v1/news/admin/force-sync
// Admin-only explicit trigger that forces an outbound 3rd-party API call
export const forceSyncNewsHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await syncMarketNews(true);
    res.json(result);
  } catch (error: any) {
    console.error('Error in forceSyncNewsHandler:', error.message);
    res.status(500).json({ message: 'Admin news sync failed', error: error.message });
  }
};
