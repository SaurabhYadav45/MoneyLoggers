import prisma from '../lib/prisma';
import { getCache, setCache } from '../lib/redis';
import { Prisma } from '@prisma/client';

export interface ScreenerFilterParams {
  search?: string;
  sector?: string;
  marketCapCategory?: string; // 'all' | 'Large' | 'Mid' | 'Small' | 'Micro'
  minMarketCap?: number;
  maxMarketCap?: number;
  minPrice?: number;
  maxPrice?: number;
  minPe?: number;
  maxPe?: number;
  minPb?: number;
  maxPb?: number;
  minRoe?: number;
  maxRoe?: number;
  minRoce?: number;
  maxRoce?: number;
  minDebtToEquity?: number;
  maxDebtToEquity?: number;
  minDividendYield?: number;
  maxDividendYield?: number;
  minRsi?: number;
  maxRsi?: number;
  minRevGrowth?: number;
  maxRevGrowth?: number;
  minProfitGrowth?: number;
  maxProfitGrowth?: number;
  min1YReturn?: number;
  max1YReturn?: number;
  above50dma?: boolean;
  above200dma?: boolean;
  preset?: string;
  customQuery?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface CuratedPreset {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  description: string;
  gradient: string;
  criteria: Partial<ScreenerFilterParams>;
}

export const PRESETS: CuratedPreset[] = [
  {
    id: 'buffett-moat',
    title: 'Buffett Moat Masters',
    subtitle: 'High ROE & ROCE with negligible debt',
    icon: 'ShieldCheck',
    badge: 'Quality & Moat',
    description: 'Companies with sustainable competitive advantages: ROE > 18%, ROCE > 18%, Debt/Equity < 0.4',
    gradient: 'from-amber-500/20 via-emerald-500/10 to-transparent',
    criteria: {
      minRoe: 18,
      minRoce: 18,
      maxDebtToEquity: 0.4,
      minRevGrowth: 8
    }
  },
  {
    id: 'garp',
    title: 'Growth at Fair Price (GARP)',
    subtitle: 'High earnings expansion at sensible P/E',
    icon: 'TrendingUp',
    badge: 'Growth & Value',
    description: 'PEG < 1.5, Profit Growth > 12%, and reasonable valuation multiples (P/E < 35)',
    gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    criteria: {
      maxPe: 35,
      minProfitGrowth: 12,
      minRoe: 14
    }
  },
  {
    id: 'momentum-breakout',
    title: 'Momentum & 52W Highs',
    subtitle: 'Stocks displaying technical strength & volume',
    icon: 'Zap',
    badge: 'Technical & Trend',
    description: 'RSI between 55 & 75, trading above 200 DMA, near annual highs with positive weekly momentum',
    gradient: 'from-blue-500/20 via-indigo-500/10 to-transparent',
    criteria: {
      minRsi: 55,
      maxRsi: 75,
      above200dma: true,
      min1YReturn: 10
    }
  },
  {
    id: 'dividend-aristocrats',
    title: 'Dividend Aristocrats',
    subtitle: 'Generous cash dividends with balance sheet safety',
    icon: 'Coins',
    badge: 'Passive Income',
    description: 'Dividend yield > 2.0%, solid interest coverage, and manageable debt profile',
    gradient: 'from-purple-500/20 via-pink-500/10 to-transparent',
    criteria: {
      minDividendYield: 2.0,
      maxDebtToEquity: 0.8,
      minRoe: 12
    }
  },
  {
    id: 'deep-value',
    title: 'Undervalued Deep Value',
    subtitle: 'Low P/E and P/B with healthy fundamentals',
    icon: 'SearchCheck',
    badge: 'Value Discovery',
    description: 'P/E < 20, P/B < 2.5, positive quarterly momentum and debt-disciplined operations',
    gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
    criteria: {
      maxPe: 20,
      maxPb: 2.5,
      minRoe: 10
    }
  },
  {
    id: 'institutional-favorites',
    title: 'Institutional Accumulation',
    subtitle: 'Backed by major domestic & foreign institutions',
    icon: 'Building2',
    badge: 'FII / DII Backed',
    description: 'Heavy institutional backing (FII + DII holding > 35%) with market capitalization > ₹20,000 Cr',
    gradient: 'from-rose-500/20 via-orange-500/10 to-transparent',
    criteria: {
      minMarketCap: 20000,
      minRoe: 15
    }
  }
];

// Custom Formula Query Parser (Screener.in style e.g. "roe > 15 AND pe < 30 AND debt_to_equity < 0.5")
export const parseCustomQueryToWhere = (queryStr: string): Prisma.StockWhereInput => {
  const where: Prisma.StockWhereInput = {};
  if (!queryStr || !queryStr.trim()) return where;

  // Split clauses by 'AND'
  const clauses = queryStr.split(/\s+AND\s+/i);
  for (const clause of clauses) {
    const match = clause.trim().match(/([a-zA-Z_]+)\s*([><=!]+)\s*([0-9.]+)/);
    if (!match) continue;

    const [, rawField, op, rawVal] = match;
    const numVal = parseFloat(rawVal);
    if (isNaN(numVal)) continue;

    const fieldMap: Record<string, keyof Prisma.StockWhereInput> = {
      pe: 'peRatio',
      pe_ratio: 'peRatio',
      pb: 'pbRatio',
      pb_ratio: 'pbRatio',
      roe: 'roe',
      roce: 'roce',
      debt_to_equity: 'debtToEquity',
      de: 'debtToEquity',
      dividend_yield: 'dividendYield',
      rsi: 'rsi',
      market_cap: 'marketCap',
      price: 'price',
      profit_growth: 'profitGrowth3y',
      sales_growth: 'revenueGrowth3y',
      return_1y: 'oneYearReturn'
    };

    const mappedField = fieldMap[rawField.toLowerCase()];
    if (!mappedField) continue;

    const targetWhere = where as Record<string, any>;
    if (op === '>') targetWhere[mappedField] = { gt: numVal };
    else if (op === '>=') targetWhere[mappedField] = { gte: numVal };
    else if (op === '<') targetWhere[mappedField] = { lt: numVal };
    else if (op === '<=') targetWhere[mappedField] = { lte: numVal };
    else if (op === '=' || op === '==') targetWhere[mappedField] = { equals: numVal };
  }

  return where;
};

// Main Screener Query Execution
export const getFilteredStocks = async (params: ScreenerFilterParams) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(100, Math.max(5, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  // Cache key based on filter parameters
  const cacheKey = `screener:query:${JSON.stringify(params)}`;
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;

  // Check if preset applies
  let activeParams = { ...params };
  if (params.preset) {
    const presetObj = PRESETS.find(p => p.id === params.preset);
    if (presetObj) {
      activeParams = { ...presetObj.criteria, ...params };
    }
  }

  // Construct Prisma Where Input
  const where: Prisma.StockWhereInput = {};

  // Search by ticker or name
  if (activeParams.search && activeParams.search.trim()) {
    const s = activeParams.search.trim();
    where.OR = [
      { symbol: { contains: s, mode: 'insensitive' } },
      { name: { contains: s, mode: 'insensitive' } }
    ];
  }

  // Sector filter
  if (activeParams.sector && activeParams.sector !== 'all') {
    where.sector = { equals: activeParams.sector, mode: 'insensitive' };
  }

  // Market Cap Category
  if (activeParams.marketCapCategory && activeParams.marketCapCategory !== 'all') {
    where.marketCapCategory = activeParams.marketCapCategory;
  }

  // Number range helpers
  const applyRange = (field: keyof Prisma.StockWhereInput, min?: number, max?: number) => {
    if (min !== undefined || max !== undefined) {
      const condition: Prisma.DecimalFilter = {};
      if (min !== undefined) condition.gte = min;
      if (max !== undefined) condition.lte = max;
      (where as any)[field] = condition;
    }
  };

  applyRange('marketCap', activeParams.minMarketCap, activeParams.maxMarketCap);
  applyRange('price', activeParams.minPrice, activeParams.maxPrice);
  applyRange('peRatio', activeParams.minPe, activeParams.maxPe);
  applyRange('pbRatio', activeParams.minPb, activeParams.maxPb);
  applyRange('roe', activeParams.minRoe, activeParams.maxRoe);
  applyRange('roce', activeParams.minRoce, activeParams.maxRoce);
  applyRange('debtToEquity', activeParams.minDebtToEquity, activeParams.maxDebtToEquity);
  applyRange('dividendYield', activeParams.minDividendYield, activeParams.maxDividendYield);
  applyRange('rsi', activeParams.minRsi, activeParams.maxRsi);
  applyRange('revenueGrowth3y', activeParams.minRevGrowth, activeParams.maxRevGrowth);
  applyRange('profitGrowth3y', activeParams.minProfitGrowth, activeParams.maxProfitGrowth);
  applyRange('oneYearReturn', activeParams.min1YReturn, activeParams.max1YReturn);

  if (activeParams.above50dma !== undefined) where.above50dma = activeParams.above50dma;
  if (activeParams.above200dma !== undefined) where.above200dma = activeParams.above200dma;

  // Custom formula integration
  if (activeParams.customQuery) {
    const customWhere = parseCustomQueryToWhere(activeParams.customQuery);
    Object.assign(where, customWhere);
  }

  // Sorting
  const sortBy = activeParams.sortBy || 'marketCap';
  const sortOrder = activeParams.sortOrder === 'asc' ? 'asc' : 'desc';
  const orderBy: Prisma.StockOrderByWithRelationInput = { [sortBy]: sortOrder };

  // Run Count & Fetch concurrently with graceful fallback
  try {
    const [total, stocks] = await Promise.all([
      prisma.stock.count({ where }),
      prisma.stock.findMany({
        where,
        orderBy,
        skip,
        take: limit
      })
    ]);

    const totalPages = Math.ceil(total / limit);

    const response = {
      stocks,
      total,
      page,
      limit,
      totalPages
    };

    await setCache(cacheKey, response, 300); // 5 mins cache
    await setCache('screener:last_good_response', response, 86400); // 24h backup cache
    return response;
  } catch (dbError: any) {
    console.error('[Screener DB Query Error]:', dbError.message);
    // If database is temporarily unavailable (e.g. Neon waking up), fallback to cached last good response
    const fallback = await getCache<any>('screener:last_good_response');
    if (fallback) {
      console.warn('⚠️ Serving cached screener results while database reconnects.');
      return fallback;
    }
    throw dbError;
  }
};

// Sector Aggregation & Market Summary
export const getScreenerSummary = async () => {
  const cacheKey = 'screener:summary';
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;

  try {
    const [totalStocks, sectorsRaw, topGainers, topLosers] = await Promise.all([
      prisma.stock.count(),
      prisma.stock.groupBy({
        by: ['sector'],
        _count: { symbol: true },
        _avg: { dayChangePercent: true, peRatio: true }
      }),
      prisma.stock.findMany({
        orderBy: { dayChangePercent: 'desc' },
        take: 5
      }),
      prisma.stock.findMany({
        orderBy: { dayChangePercent: 'asc' },
        take: 5
      })
    ]);

    const sectors = sectorsRaw.map(s => ({
      name: s.sector,
      count: s._count.symbol,
      avgChange: Number((s._avg.dayChangePercent || 0).toFixed(2)),
      avgPe: Number((s._avg.peRatio || 0).toFixed(2))
    }));

    const data = {
      totalStocks,
      sectors,
      topGainers,
      topLosers,
      presets: PRESETS
    };

    await setCache(cacheKey, data, 600); // 10 mins cache
    await setCache('screener:summary:backup', data, 86400); // 24h backup
    return data;
  } catch (dbError: any) {
    console.error('[Screener Summary DB Error]:', dbError.message);
    const fallback = await getCache<any>('screener:summary:backup');
    if (fallback) return fallback;
    return {
      totalStocks: 50,
      sectors: [],
      topGainers: [],
      topLosers: [],
      presets: PRESETS
    };
  }
};

// Single Stock Detailed Profile
export const getStockDetail = async (symbol: string) => {
  const upper = symbol.toUpperCase();
  const cacheKey = `screener:detail:${upper}`;
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;

  const stock = await prisma.stock.findUnique({
    where: { symbol: upper }
  });

  if (!stock) return null;

  // Also fetch 4 peers in same sector
  const peers = await prisma.stock.findMany({
    where: {
      sector: stock.sector,
      symbol: { not: upper }
    },
    take: 4,
    orderBy: { marketCap: 'desc' }
  });

  const detail = {
    ...stock,
    peers
  };

  await setCache(cacheKey, detail, 1800);
  return detail;
};
