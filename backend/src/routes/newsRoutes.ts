import express from 'express';
import {
  getNews,
  getBreakingNewsHandler,
  getSentimentSummaryHandler,
  syncNewsHandler,
  getNewsSyncStatusHandler,
  forceSyncNewsHandler
} from '../controllers/newsController';
import { adminAuth } from '../middleware/adminAuth';

const router = express.Router();

router.get('/', getNews);
router.get('/breaking', getBreakingNewsHandler);
router.get('/sentiment-summary', getSentimentSummaryHandler);
router.get('/sync-status', getNewsSyncStatusHandler);

// Public sync check for "Sync Now" button (reads DB only, reports cooldown/next schedule, zero 3rd-party API calls)
router.post('/sync', syncNewsHandler);

// Admin-only manual force sync (actually triggers 3rd-party RSS fetch when explicitly required)
router.post('/admin/force-sync', adminAuth, forceSyncNewsHandler);

export default router;
