import express from 'express';
import {
  getTopGainers,
  getTopLosers,
  getMostActive,
  getBreakouts,
  getMarketIndices,
  getChartData,
  getLatestNews,
  searchStocks,
  getUpstoxAuthUrl,
  handleUpstoxCallback,
  getUpstoxStatus,
  disconnectUpstox
} from '../controllers/stockController';
import {
  getScreenerStocks,
  getScreenerSummaryHandler,
  getScreenerPresets,
  getStockDetailHandler,
  syncStocksHandler,
  exportScreenerCsv
} from '../controllers/stockScreenerController';
import { adminAuth } from '../middleware/adminAuth';

const router = express.Router();

// Screener endpoints
router.get('/screener', getScreenerStocks);
router.get('/screener/summary', getScreenerSummaryHandler);
router.get('/screener/presets', getScreenerPresets);
router.get('/screener/export', exportScreenerCsv);
router.post('/sync', adminAuth, syncStocksHandler);

// Upstox Official OAuth Authentication Flow
router.get('/upstox/status', getUpstoxStatus);
router.get('/upstox/auth-url', getUpstoxAuthUrl);
router.get('/upstox/callback', handleUpstoxCallback);
router.post('/upstox/disconnect', adminAuth, disconnectUpstox);

// Dashboard endpoints
router.get('/gainers', getTopGainers);
router.get('/losers', getTopLosers);
router.get('/active', getMostActive);
router.get('/breakouts', getBreakouts);
router.get('/indices', getMarketIndices);
router.get('/chart/:symbol', getChartData);
router.get('/news', getLatestNews);
router.get('/search', searchStocks);

// Individual stock profile (dynamic parameter should be last)
router.get('/:symbol', getStockDetailHandler);

export default router;
