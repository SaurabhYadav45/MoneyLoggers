import { Request, Response } from 'express';
import {
  getFilteredStocks,
  getScreenerSummary,
  getStockDetail,
  PRESETS
} from '../services/stockScreenerService';
import { syncAllCuratedStocks } from '../services/stockSyncService';

// GET /api/v1/stocks/screener
export const getScreenerStocks = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      sector,
      marketCapCategory,
      minMarketCap,
      maxMarketCap,
      minPrice,
      maxPrice,
      minPe,
      maxPe,
      minPb,
      maxPb,
      minRoe,
      maxRoe,
      minRoce,
      maxRoce,
      minDebtToEquity,
      maxDebtToEquity,
      minDividendYield,
      maxDividendYield,
      minRsi,
      maxRsi,
      minRevGrowth,
      maxRevGrowth,
      minProfitGrowth,
      maxProfitGrowth,
      min1YReturn,
      max1YReturn,
      above50dma,
      above200dma,
      preset,
      customQuery,
      sortBy,
      sortOrder,
      page,
      limit
    } = req.query;

    const parseQueryNum = (val: any) => (val !== undefined && val !== '' ? parseFloat(String(val)) : undefined);
    const parseQueryBool = (val: any) => {
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    };

    const filters = {
      search: search ? String(search) : undefined,
      sector: sector ? String(sector) : undefined,
      marketCapCategory: marketCapCategory ? String(marketCapCategory) : undefined,
      minMarketCap: parseQueryNum(minMarketCap),
      maxMarketCap: parseQueryNum(maxMarketCap),
      minPrice: parseQueryNum(minPrice),
      maxPrice: parseQueryNum(maxPrice),
      minPe: parseQueryNum(minPe),
      maxPe: parseQueryNum(maxPe),
      minPb: parseQueryNum(minPb),
      maxPb: parseQueryNum(maxPb),
      minRoe: parseQueryNum(minRoe),
      maxRoe: parseQueryNum(maxRoe),
      minRoce: parseQueryNum(minRoce),
      maxRoce: parseQueryNum(maxRoce),
      minDebtToEquity: parseQueryNum(minDebtToEquity),
      maxDebtToEquity: parseQueryNum(maxDebtToEquity),
      minDividendYield: parseQueryNum(minDividendYield),
      maxDividendYield: parseQueryNum(maxDividendYield),
      minRsi: parseQueryNum(minRsi),
      maxRsi: parseQueryNum(maxRsi),
      minRevGrowth: parseQueryNum(minRevGrowth),
      maxRevGrowth: parseQueryNum(maxRevGrowth),
      minProfitGrowth: parseQueryNum(minProfitGrowth),
      maxProfitGrowth: parseQueryNum(maxProfitGrowth),
      min1YReturn: parseQueryNum(min1YReturn),
      max1YReturn: parseQueryNum(max1YReturn),
      above50dma: parseQueryBool(above50dma),
      above200dma: parseQueryBool(above200dma),
      preset: preset ? String(preset) : undefined,
      customQuery: customQuery ? String(customQuery) : undefined,
      sortBy: sortBy ? String(sortBy) : undefined,
      sortOrder: (sortOrder === 'asc' || sortOrder === 'desc') ? (sortOrder as 'asc' | 'desc') : undefined,
      page: parseQueryNum(page),
      limit: parseQueryNum(limit)
    };

    const data = await getFilteredStocks(filters);
    res.json({
      success: true,
      data: data.stocks,
      total: data.total,
      page: data.page,
      limit: data.limit,
      totalPages: data.totalPages
    });
  } catch (error: any) {
    console.error('Error in getScreenerStocks:', error.message || error);
    const isConnErr = error?.message?.includes('database server') || error?.code === 'P1001' || error?.message?.includes('Can\'t reach');
    const userMsg = isConnErr
      ? 'The cloud database is currently waking up from sleep mode. Please click Try Again in a few moments.'
      : (error.message || 'Failed to fetch screener stocks');
    res.status(503).json({ success: false, message: userMsg });
  }
};

// GET /api/v1/stocks/screener/summary
export const getScreenerSummaryHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const summary = await getScreenerSummary();
    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    console.error('Error in getScreenerSummaryHandler:', error.message || error);
    res.status(500).json({ success: false, message: 'Failed to fetch screener summary' });
  }
};

// GET /api/v1/stocks/screener/presets
export const getScreenerPresets = async (_req: Request, res: Response): Promise<void> => {
  try {
    res.json({
      success: true,
      data: PRESETS
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/v1/stocks/:symbol
export const getStockDetailHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const detail = await getStockDetail(symbol);
    if (!detail) {
      res.status(404).json({ success: false, message: `Stock "${symbol}" not found` });
      return;
    }
    res.json({
      success: true,
      data: detail
    });
  } catch (error: any) {
    console.error('Error in getStockDetailHandler:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// POST /api/v1/stocks/sync (Admin trigger)
export const syncStocksHandler = async (_req: Request, res: Response): Promise<void> => {
  try {
    const results = await syncAllCuratedStocks();
    res.json({
      success: true,
      message: 'Stock sync finished',
      data: results
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/v1/stocks/screener/export (CSV Export)
export const exportScreenerCsv = async (req: Request, res: Response): Promise<void> => {
  try {
    // Fetch with large limit (up to 500)
    const filters = {
      ...req.query,
      page: 1,
      limit: 500
    } as any;

    const data = await getFilteredStocks(filters);
    const stocks = data.stocks;

    const headers = [
      'Symbol',
      'Company Name',
      'Sector',
      'Price (INR)',
      '1D Change (%)',
      '1Y Return (%)',
      'Market Cap (Cr)',
      'P/E',
      'P/B',
      'ROE (%)',
      'ROCE (%)',
      'Debt to Equity',
      'Div Yield (%)',
      'RSI',
      'Above 200 DMA'
    ];

    const rows = stocks.map((s: any) => [
      `"${s.symbol}"`,
      `"${s.name}"`,
      `"${s.sector}"`,
      s.price,
      s.dayChangePercent,
      s.oneYearReturn,
      s.marketCap,
      s.peRatio,
      s.pbRatio,
      s.roe,
      s.roce,
      s.debtToEquity,
      s.dividendYield,
      s.rsi,
      s.above200dma ? 'Yes' : 'No'
    ]);

    const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="MoneyLogger_Screener_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (error: any) {
    console.error('Error exporting screener CSV:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
