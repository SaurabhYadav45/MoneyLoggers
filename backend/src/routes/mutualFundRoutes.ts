import express from 'express';
import {
  getScreenerFunds,
  getCuratedCollections,
  getFundHouses,
  searchMutualFunds,
  getMutualFundDetails,
  getMutualFundChart,
  compareMutualFunds,
  getMutualFundHistory,
  getLatestNav,
  syncMutualFunds
} from '../controllers/mutualFundController';
import { adminAuth } from '../middleware/adminAuth';

const router = express.Router();

// Curated collections (e.g. high-return, tax-saver, top-index, pocket-sip)
router.get('/collections', getCuratedCollections);

// Distinct fund houses for filters
router.get('/fund-houses', getFundHouses);

// Side-by-side comparison (?codes=120828,122639)
router.get('/compare', compareMutualFunds);

// Search mutual funds by name, code or fund house
router.get('/search', searchMutualFunds);

// Force sync & refresh all mutual funds from live APIs (Admin Only)
router.post('/sync', adminAuth, syncMutualFunds);

// Get downsampled interactive NAV chart
router.get('/:schemeCode/chart', getMutualFundChart);

// Get mutual fund details by scheme code
router.get('/:schemeCode', getMutualFundDetails);

// Legacy backward-compatible routes
router.get('/:schemeCode/history', getMutualFundHistory);
router.get('/:schemeCode/latest', getLatestNav);

// Screener list with filters, categories, and pagination
router.get('/', getScreenerFunds);

export default router;