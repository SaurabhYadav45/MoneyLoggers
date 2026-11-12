import { Request, Response } from 'express';
import * as mutualFundService from '../services/mutualFundService';

// Get screener funds with rich filtering & sorting
export const getScreenerFunds = async (req: Request, res: Response) => {
  try {
    const {
      category,
      subCategory,
      fundHouse,
      search,
      collection,
      sortBy,
      sortOrder,
      page,
      limit,
      refresh
    } = req.query;

    const data = await mutualFundService.getScreenerFunds({
      category: category as string,
      subCategory: subCategory as string,
      fundHouse: fundHouse as string,
      search: search as string,
      collection: collection as string,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 50,
      refresh: refresh === 'true'
    });

    res.json({
      success: true,
      data: data.funds,
      total: data.total,
      page: data.page,
      totalPages: data.totalPages
    });
  } catch (error: any) {
    console.error('Error in getScreenerFunds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch screener mutual funds',
      error: error.message
    });
  }
};

// Explicit sync endpoint: refreshes NAV & returns for all funds in DB and flushes Redis cache
export const syncMutualFunds = async (_req: Request, res: Response) => {
  try {
    const result = await mutualFundService.syncAllMutualFunds(true);
    res.json({
      success: true,
      message: 'Mutual funds synchronization completed successfully',
      data: result
    });
  } catch (error: any) {
    console.error('Error in syncMutualFunds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to synchronize mutual funds',
      error: error.message
    });
  }
};

// Get curated discovery collections
export const getCuratedCollections = async (_req: Request, res: Response) => {
  try {
    const collections = await mutualFundService.getCuratedCollections();
    res.json({
      success: true,
      data: collections
    });
  } catch (error: any) {
    console.error('Error fetching curated collections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch curated collections',
      error: error.message
    });
  }
};

// Get available fund houses from database
export const getFundHouses = async (_req: Request, res: Response) => {
  try {
    const fundHouses = await mutualFundService.getAvailableFundHouses();
    res.json({
      success: true,
      data: fundHouses
    });
  } catch (error: any) {
    console.error('Error fetching fund houses:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch fund houses',
      error: error.message
    });
  }
};

// Search mutual funds by name, code or AMC
export const searchMutualFunds = async (req: Request, res: Response) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "q" is required'
      });
    }

    const results = await mutualFundService.searchMutualFunds(q);

    res.json({
      success: true,
      data: results,
      count: results.length
    });
  } catch (error: any) {
    console.error('Error searching mutual funds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search mutual funds',
      error: error.message
    });
  }
  return;
};

// Get mutual fund details by scheme code
export const getMutualFundDetails = async (req: Request, res: Response) => {
  try {
    const { schemeCode } = req.params;

    if (!schemeCode) {
      return res.status(400).json({
        success: false,
        message: 'Scheme code is required'
      });
    }

    const details = await mutualFundService.getMutualFundDetails(schemeCode);

    res.json({
      success: true,
      data: details
    });
  } catch (error: any) {
    console.error(`Error fetching mutual fund details for scheme ${req.params.schemeCode}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch mutual fund details',
      error: error.message
    });
  }
  return;
};

// Get downsampled NAV historical chart
export const getMutualFundChart = async (req: Request, res: Response) => {
  try {
    const { schemeCode } = req.params;
    const { range = '1Y' } = req.query;

    if (!schemeCode) {
      return res.status(400).json({
        success: false,
        message: 'Scheme code is required'
      });
    }

    const chartData = await mutualFundService.getMutualFundChart(schemeCode, range as string);

    res.json({
      success: true,
      data: chartData
    });
  } catch (error: any) {
    console.error(`Error fetching chart for scheme ${req.params.schemeCode}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chart data',
      error: error.message
    });
  }
  return;
};

// Compare multiple mutual funds
export const compareMutualFunds = async (req: Request, res: Response) => {
  try {
    const { codes } = req.query;

    if (!codes || typeof codes !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Query parameter "codes" (comma separated) is required'
      });
    }

    const schemeCodes = codes.split(',').map((c) => c.trim()).filter(Boolean);
    const comparison = await mutualFundService.compareMutualFunds(schemeCodes);

    res.json({
      success: true,
      data: comparison
    });
  } catch (error: any) {
    console.error('Error comparing mutual funds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare mutual funds',
      error: error.message
    });
  }
  return;
};

// Legacy backward-compatible handlers
export const getMutualFundHistory = async (req: Request, res: Response) => {
  return getMutualFundChart(req, res);
};

export const getLatestNav = async (req: Request, res: Response) => {
  try {
    const { schemeCode } = req.params;
    const latest = await mutualFundService.getLatestMutualFundNav(schemeCode);
    res.json({ success: true, data: latest });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};