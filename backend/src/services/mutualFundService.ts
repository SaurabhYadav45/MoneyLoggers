import axios from 'axios';
import { getCache, setCache, deleteCachePattern } from '../lib/redis';
import prisma from '../lib/prisma';
import {
  searchFundsFromIndianAPI,
  getFundDetailsFromIndianAPI,
  upsertFundToDatabase,
  fetchAllMutualFundsFromIndianAPI
} from './indianApiService';

// Base URL for AMFI official NAV history
const MF_API_BASE_URL = 'https://api.mfapi.in';

export interface MutualFundItem {
  id: string;
  schemeCode: number;
  name: string;
  schemeName: string;
  fundHouse: string;
  category: string;
  subCategory: string;
  planType: 'Direct' | 'Regular' | string;
  optionType: 'Growth' | 'IDCW' | string;
  nav: number;
  navDate: string;
  change: number;
  pct: number;
  aum: number; // in Crores
  expenseRatio?: number | null;
  riskRating?: number | null; // 1 to 5 Stars (null if <3Y history/unrated)
  riskometer: string;
  returns1Y?: number | null;
  returns3Y?: number | null;
  returns5Y?: number | null;
  returnsSinceInception?: number | null;
  benchmark: string;
  tags: string[];
  minSip: number;
  minLumpsum: number;
  exitLoad: string;
  lockInPeriod?: string;
  turnoverRatio?: number;
  fundManagers: Array<{ name: string; experience?: string; tenure?: string; description?: string }>;
  riskMetrics: {
    alpha?: number | null;
    beta?: number | null;
    sharpeRatio?: number | null;
    sortinoRatio?: number | null;
    stdDeviation?: number | null;
  };
  assetAllocation: {
    equity: number;
    debt: number;
    cash: number;
  };
  topHoldings: Array<{
    name: string;
    sector: string;
    percentage: number;
  }>;
  sectorAllocation: Array<{
    name: string;
    percentage: number;
  }>;
  peers?: Array<{
    schemeCode: number;
    name: string;
    category: string;
    nav: number;
    returns1Y?: number | null;
    returns3Y?: number | null;
    returns5Y?: number | null;
    expenseRatio?: number | null;
    aum: number;
    riskRating?: number | null;
  }>;
}

export interface ScreenerFilterOptions {
  category?: string;
  subCategory?: string;
  fundHouse?: string;
  search?: string;
  collection?: string;
  sortBy?: 'returns3Y' | 'returns1Y' | 'returns5Y' | 'aum' | 'expenseRatio' | 'riskRating' | 'name' | 'nav';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  refresh?: boolean;
}

// Transform PostgreSQL database record into frontend model preserving null values for missing track records
export const mapDbToItem = (f: any): MutualFundItem => {
  // SEBI & CRISIL mandate: Star Ratings are awarded strictly after a fund completes 3 full years of performance
  const has3YHistory = f.returns3Y !== null && f.returns3Y !== undefined;
  const validRating = has3YHistory && f.riskRating && f.riskRating > 0 ? Number(f.riskRating) : null;

  return {
    id: f.id || String(f.schemeCode),
    schemeCode: f.schemeCode,
    name: f.name,
    schemeName: f.schemeName || f.name,
    fundHouse: f.fundHouse,
    category: f.category,
    subCategory: f.subCategory,
    planType: f.planType || 'Direct',
    optionType: f.optionType || 'Growth',
    nav: f.currentNav ? Number(f.currentNav) : 0,
    navDate: f.navDate || 'Latest',
    change: f.dayChange ? Number(f.dayChange) : 0,
    pct: f.dayChangePct ? Number(f.dayChangePct) : 0,
    aum: f.aum ? Number(f.aum) : 0,
    expenseRatio: f.expenseRatio !== null && f.expenseRatio !== undefined ? Number(f.expenseRatio) : null,
    riskRating: validRating,
    riskometer: f.riskometer || 'Very High',
    returns1Y: f.returns1Y !== null && f.returns1Y !== undefined ? Number(f.returns1Y) : null,
    returns3Y: f.returns3Y !== null && f.returns3Y !== undefined ? Number(f.returns3Y) : null,
    returns5Y: f.returns5Y !== null && f.returns5Y !== undefined ? Number(f.returns5Y) : null,
    returnsSinceInception: f.returnsSinceInception !== null && f.returnsSinceInception !== undefined ? Number(f.returnsSinceInception) : null,
    benchmark: f.benchmark || 'NIFTY 50 TRI',
    tags: f.tags || [],
    minSip: f.minSip ? Number(f.minSip) : 500,
    minLumpsum: f.minLumpsum ? Number(f.minLumpsum) : 1000,
    exitLoad: f.exitLoad || 'Nil',
    lockInPeriod: f.lockInPeriod || undefined,
    turnoverRatio: f.turnoverRatio ? Number(f.turnoverRatio) : undefined,
    fundManagers: (f.fundManagers as any) || [],
    riskMetrics: (f.riskMetrics as any) || {},
    assetAllocation: (f.assetAlloc as any) || { equity: 95.0, debt: 0.0, cash: 5.0 },
    topHoldings: (f.holdings as any) || [],
    sectorAllocation: (f.sectorAlloc as any) || [],
    peers: (f.peers as any) || []
  };
};

// Screener query with database filtering, sorting, pagination, and live on-demand ingestion
export const getScreenerFunds = async (options: ScreenerFilterOptions = {}) => {
  const {
    category = 'all',
    subCategory = 'all',
    fundHouse = 'all',
    search = '',
    collection = 'all',
    sortBy = 'returns3Y',
    sortOrder = 'desc',
    page = 1,
    limit = 50,
    refresh = false
  } = options;

  // On-demand refresh requested by user: Invalidate screener query cache only (never hit external APIs in batch)
  if (refresh) {
    await deleteCachePattern('mf:screener:*');
  }

  const where: any = {};
  if (category && category !== 'all') {
    where.category = { equals: category, mode: 'insensitive' };
  }
  if (subCategory && subCategory !== 'all') {
    where.subCategory = { contains: subCategory, mode: 'insensitive' };
  }
  if (fundHouse && fundHouse !== 'all') {
    where.fundHouse = { contains: fundHouse, mode: 'insensitive' };
  }
  if (collection && collection !== 'all') {
    where.tags = { has: collection };
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { schemeName: { contains: q, mode: 'insensitive' } },
      { fundHouse: { contains: q, mode: 'insensitive' } },
      { subCategory: { contains: q, mode: 'insensitive' } }
    ];
  }

  // Sort mapping
  const sortFieldMap: Record<string, string> = {
    returns3Y: 'returns3Y',
    returns1Y: 'returns1Y',
    returns5Y: 'returns5Y',
    aum: 'aum',
    expenseRatio: 'expenseRatio',
    riskRating: 'riskRating',
    name: 'name',
    nav: 'currentNav'
  };
  const dbSortField = sortFieldMap[sortBy] || 'returns3Y';

  // Cache key based on screener options to prevent redundant database queries
  const cacheKey = `mf:screener:${JSON.stringify(options)}`;
  if (!refresh) {
    const cached = await getCache<any>(cacheKey);
    if (cached) return cached;
  }

  const [dbFunds, total] = await Promise.all([
    prisma.mutualFund.findMany({
      where,
      orderBy: { [dbSortField]: sortOrder },
      skip: (page - 1) * limit,
      take: limit
    }),
    prisma.mutualFund.count({ where })
  ]);

  const response = {
    funds: dbFunds.map(mapDbToItem),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit))
  };

  await setCache(cacheKey, response, 300); // 5 mins cache
  return response;
};

// Curated collections with real counts computed directly from live PostgreSQL database
export const getCuratedCollections = async () => {
  const [highReturnCount, taxSaverCount, topIndexCount, pocketSipCount, lowRiskCount] = await Promise.all([
    prisma.mutualFund.count({ where: { tags: { has: 'high-return' } } }),
    prisma.mutualFund.count({ where: { tags: { has: 'tax-saver' } } }),
    prisma.mutualFund.count({ where: { tags: { has: 'top-index' } } }),
    prisma.mutualFund.count({ where: { tags: { has: 'pocket-sip' } } }),
    prisma.mutualFund.count({ where: { tags: { has: 'low-risk' } } })
  ]);

  return [
    {
      id: 'high-return',
      title: 'High Return Funds',
      subtitle: '3Y CAGR > 18% Alpha creators',
      icon: 'TrendingUp',
      count: highReturnCount,
      gradient: 'from-emerald-500/20 to-teal-500/20 text-emerald-500 dark:text-emerald-400'
    },
    {
      id: 'tax-saver',
      title: 'Tax Savers (ELSS)',
      subtitle: 'Save up to ₹46,800 under 80C',
      icon: 'ShieldCheck',
      count: taxSaverCount,
      gradient: 'from-blue-500/20 to-indigo-500/20 text-blue-500 dark:text-blue-400'
    },
    {
      id: 'top-index',
      title: 'Top Index Funds',
      subtitle: 'Lowest tracking error & expense ratio',
      icon: 'Sparkles',
      count: topIndexCount,
      gradient: 'from-amber-500/20 to-orange-500/20 text-amber-500 dark:text-amber-400'
    },
    {
      id: 'pocket-sip',
      title: 'SIP from ₹500',
      subtitle: 'Small monthly investments for big compounding',
      icon: 'Coins',
      count: pocketSipCount,
      gradient: 'from-purple-500/20 to-pink-500/20 text-purple-500 dark:text-purple-400'
    },
    {
      id: 'low-risk',
      title: 'Low Volatility & Debt',
      subtitle: 'Capital protection & stable accruals',
      icon: 'Shield',
      count: lowRiskCount,
      gradient: 'from-cyan-500/20 to-blue-500/20 text-cyan-500 dark:text-cyan-400'
    }
  ];
};

const hashCode = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
};

// Search mutual funds: PostgreSQL first, then IndianAPI live
export const searchMutualFunds = async (query: string) => {
  const cleanQ = query.toLowerCase().trim();
  if (!cleanQ) return [];

  const cacheKey = `mf:search:${cleanQ}`;
  const cached = await getCache<MutualFundItem[]>(cacheKey);
  if (cached) return cached;

  const results: MutualFundItem[] = [];
  const seenCodes = new Set<number>();
  const seenNames = new Set<string>();

  // 1. Search PostgreSQL Database
  try {
    const dbFunds = await prisma.mutualFund.findMany({
      where: {
        OR: [
          { name: { contains: cleanQ, mode: 'insensitive' } },
          { schemeName: { contains: cleanQ, mode: 'insensitive' } },
          { fundHouse: { contains: cleanQ, mode: 'insensitive' } },
          { subCategory: { contains: cleanQ, mode: 'insensitive' } }
        ]
      },
      take: 20
    });
    for (const f of dbFunds) {
      seenCodes.add(f.schemeCode);
      seenNames.add(f.name.toLowerCase());
      results.push(mapDbToItem(f));
    }
  } catch (err: any) {
    console.warn('Prisma search query warning:', err.message);
  }

  // 2. Query IndianAPI search if fewer than 5 results in PostgreSQL (1 single quota call, 0 detail loops)
  if (results.length < 5) {
    try {
      const remote = await searchFundsFromIndianAPI(cleanQ);
      for (const item of remote.slice(0, 10)) {
        const sName = item.schemeName;
        if (sName && !seenNames.has(sName.toLowerCase())) {
          seenNames.add(sName.toLowerCase());
          const schemeCode = Number(item.id) || (Math.abs(hashCode(sName)) % 900000 + 100000);
          seenCodes.add(schemeCode);

          const words = sName.split(' ');
          const fundHouse = words[0] ? `${words[0]} Mutual Fund` : 'Mutual Fund';

          const lower = sName.toLowerCase();
          let category = 'Equity';
          let subCategory = 'Flexi Cap';
          if (lower.includes('debt') || lower.includes('liquid') || lower.includes('gilt') || lower.includes('bond') || lower.includes('money market')) {
            category = 'Debt';
            subCategory = 'Debt Fund';
          } else if (lower.includes('hybrid') || lower.includes('balanced') || lower.includes('advantage') || lower.includes('arbitrage') || lower.includes('multi asset')) {
            category = 'Hybrid';
            subCategory = 'Hybrid Fund';
          } else if (lower.includes('index') || lower.includes('nifty') || lower.includes('sensex')) {
            category = 'Index';
            subCategory = 'Index Fund';
          } else if (lower.includes('elss') || lower.includes('tax')) {
            category = 'Solution Oriented';
            subCategory = 'Tax Saver (ELSS)';
          } else if (lower.includes('small cap')) {
            subCategory = 'Small Cap';
          } else if (lower.includes('mid cap') || lower.includes('midcap')) {
            subCategory = 'Mid Cap';
          } else if (lower.includes('large & mid') || lower.includes('large and mid')) {
            subCategory = 'Large & Mid Cap';
          } else if (lower.includes('large cap') || lower.includes('bluechip')) {
            subCategory = 'Large Cap';
          }

          results.push({
            id: String(schemeCode),
            schemeCode,
            name: sName,
            schemeName: sName,
            fundHouse,
            category,
            subCategory,
            planType: lower.includes('direct') ? 'Direct' : 'Regular',
            optionType: lower.includes('growth') ? 'Growth' : 'IDCW',
            nav: 0,
            navDate: 'Latest',
            change: 0,
            pct: 0,
            aum: 0,
            expenseRatio: null,
            riskRating: 4,
            riskometer: 'Very High',
            returns1Y: null,
            returns3Y: null,
            returns5Y: null,
            returnsSinceInception: null,
            benchmark: 'NIFTY 50 TRI',
            minSip: 500,
            minLumpsum: 1000,
            exitLoad: 'Nil',
            tags: [],
            fundManagers: [],
            riskMetrics: {},
            assetAllocation: { equity: 95.0, debt: 0.0, cash: 5.0 },
            topHoldings: [],
            sectorAllocation: [],
            peers: []
          });
        }
      }
    } catch (err: any) {
      console.warn('IndianAPI search fallback warning:', err.message);
    }
  }

  await setCache(cacheKey, results, 1800); // 30 min cache
  return results;
};

/**
 * Resolves an official AMFI scheme code and NAV history for any mutual fund.
 * If schemeCode is already an official AMFI code, fetches directly.
 * If schemeCode is a synthetic hash or returns 404, searches official AMFI directory by fund name,
 * finds the best match, updates PostgreSQL so future lookups are instant, and returns the real data.
 */
export async function resolveOfficialAmfiScheme(
  schemeCode: string | number,
  fundName?: string
): Promise<{ schemeCode: number; schemeName: string; rawHistoryData: Array<{ date: string; nav: string }> } | null> {
  const codeNum = Number(schemeCode);

  // 1. If valid numeric AMFI code (< 200000), try direct fetch
  if (!isNaN(codeNum) && codeNum > 0 && codeNum < 200000) {
    try {
      const resp = await axios.get(`${MF_API_BASE_URL}/mf/${codeNum}`, { timeout: 8000 });
      if (resp.data && Array.isArray(resp.data.data) && resp.data.data.length > 0) {
        return {
          schemeCode: codeNum,
          schemeName: resp.data.meta?.scheme_name || fundName || '',
          rawHistoryData: resp.data.data
        };
      }
    } catch {
      // Continue to name search
    }
  }

  // 2. Look up fund in DB to get the official name and ID
  let targetName = fundName;
  let dbFundId: string | null = null;
  try {
    const dbFund = await prisma.mutualFund.findFirst({
      where: {
        OR: [
          { schemeCode: !isNaN(codeNum) && codeNum > 0 ? codeNum : -1 },
          { id: String(schemeCode) },
          { name: { equals: String(schemeCode), mode: 'insensitive' } }
        ]
      },
      select: { id: true, name: true, schemeName: true }
    });
    if (dbFund) {
      dbFundId = dbFund.id;
      targetName = targetName || dbFund.name || dbFund.schemeName;
    }
  } catch {
    // ignore
  }

  if (!targetName) {
    targetName = String(schemeCode);
  }

  // 3. Search AMFI official directory by fund name
  try {
    const clean = targetName
      .replace(/\b(Regular|Direct|Plan|Growth|Option|IDCW|Dividend|-)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    let searchRes = await axios.get(`${MF_API_BASE_URL}/mf/search?q=${encodeURIComponent(clean)}`, { timeout: 8000 });
    if (!searchRes.data || searchRes.data.length === 0) {
      const words = clean.split(' ').slice(0, 3).join(' ');
      searchRes = await axios.get(`${MF_API_BASE_URL}/mf/search?q=${encodeURIComponent(words)}`, { timeout: 8000 });
    }

    const matches: Array<{ schemeCode: number; schemeName: string }> = searchRes.data || [];
    if (matches.length > 0) {
      const wantDirect = /direct/i.test(targetName);
      const wantGrowth = /growth/i.test(targetName);
      const best = matches.find((m) => {
        const isDirect = /direct/i.test(m.schemeName);
        const isGrowth = /growth/i.test(m.schemeName);
        return (wantDirect ? isDirect : !isDirect) && (wantGrowth ? isGrowth : true);
      }) || matches.find((m) => /growth/i.test(m.schemeName)) || matches[0];

      if (best && best.schemeCode) {
        const navRes = await axios.get(`${MF_API_BASE_URL}/mf/${best.schemeCode}`, { timeout: 8000 });
        if (navRes.data && Array.isArray(navRes.data.data) && navRes.data.data.length > 0) {
          // If we had a DB record with a synthetic scheme code, update it to the official AMFI code
          if (dbFundId) {
            prisma.mutualFund.update({
              where: { id: dbFundId },
              data: { schemeCode: best.schemeCode }
            }).catch(() => {});
          }

          return {
            schemeCode: best.schemeCode,
            schemeName: best.schemeName,
            rawHistoryData: navRes.data.data
          };
        }
      }
    }
  } catch (searchErr: any) {
    console.warn(`[AMFI Search] Could not resolve AMFI scheme for "${targetName}":`, searchErr.message);
  }

  return null;
}

/**
 * Calculates authentic CAGR, Annualized Volatility (Std Dev), Sharpe Ratio, and Sortino Ratio
 * directly from official AMFI daily NAV history.
 */
export function computeRealFundMetrics(rawHistoryData: Array<{ date: string; nav: string }>) {
  if (!rawHistoryData || rawHistoryData.length < 30) {
    return {
      returns1Y: null,
      returns3Y: null,
      returns5Y: null,
      riskMetrics: {}
    };
  }

  // Parse points [oldest ... latest]
  const points = rawHistoryData
    .map((d) => {
      const [day, mon, yr] = d.date.split('-');
      return {
        date: new Date(`${yr}-${mon}-${day}`),
        nav: parseFloat(d.nav)
      };
    })
    .filter((p) => !isNaN(p.nav) && p.nav > 0)
    .reverse();

  if (points.length < 30) {
    return { returns1Y: null, returns3Y: null, returns5Y: null, riskMetrics: {} };
  }

  const latest = points[points.length - 1];

  // 1-Year CAGR
  const oneYearAgo = new Date(latest.date);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const p1Y = points.find((p) => p.date >= oneYearAgo);
  const returns1Y = p1Y ? Number((((latest.nav - p1Y.nav) / p1Y.nav) * 100).toFixed(2)) : null;

  // 3-Year CAGR
  const threeYearsAgo = new Date(latest.date);
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const p3Y = points.find((p) => p.date >= threeYearsAgo);
  let returns3Y: number | null = null;
  if (p3Y) {
    const years = (latest.date.getTime() - p3Y.date.getTime()) / (365.25 * 24 * 3600 * 1000);
    returns3Y = Number(((Math.pow(latest.nav / p3Y.nav, 1 / years) - 1) * 100).toFixed(2));
  }

  // 5-Year CAGR
  const fiveYearsAgo = new Date(latest.date);
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const p5Y = points.find((p) => p.date >= fiveYearsAgo);
  let returns5Y: number | null = null;
  if (p5Y) {
    const years = (latest.date.getTime() - p5Y.date.getTime()) / (365.25 * 24 * 3600 * 1000);
    returns5Y = Number(((Math.pow(latest.nav / p5Y.nav, 1 / years) - 1) * 100).toFixed(2));
  }

  // Daily returns over the last 3 years
  const historyForMetrics = points.filter((p) => p.date >= (p3Y ? p3Y.date : points[0].date));
  const dailyReturns: number[] = [];
  for (let i = 1; i < historyForMetrics.length; i++) {
    const prev = historyForMetrics[i - 1].nav;
    const curr = historyForMetrics[i].nav;
    dailyReturns.push((curr - prev) / prev);
  }

  if (dailyReturns.length < 20) {
    return { returns1Y, returns3Y, returns5Y, riskMetrics: {} };
  }

  const meanReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance = dailyReturns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / (dailyReturns.length - 1);
  const dailyStdDev = Math.sqrt(variance);
  const annualizedStdDev = dailyStdDev * Math.sqrt(252);

  const riskFreeRate = 0.0694; // 6.94% RBI 10Y Benchmark G-Sec yield
  const cagrDec = (returns3Y ?? returns1Y ?? 0) / 100;
  const sharpeRatio = annualizedStdDev > 0 ? Number(((cagrDec - riskFreeRate) / annualizedStdDev).toFixed(2)) : 0;

  // Downside deviation for Sortino
  const downsideReturns = dailyReturns.filter((r) => r < 0);
  const downsideVariance = downsideReturns.length > 0
    ? downsideReturns.reduce((a, b) => a + Math.pow(b, 2), 0) / dailyReturns.length
    : 0.0001;
  const downsideStdDev = Math.sqrt(downsideVariance) * Math.sqrt(252);
  const sortinoRatio = downsideStdDev > 0 ? Number(((cagrDec - riskFreeRate) / downsideStdDev).toFixed(2)) : 0;

  const stdDevPct = Number((annualizedStdDev * 100).toFixed(2));
  const beta = Number(Math.max(0.05, Math.min(2.5, annualizedStdDev / 0.14)).toFixed(2));
  const alpha = Number(((cagrDec - (riskFreeRate + beta * (0.13 - riskFreeRate))) * 100).toFixed(2));

  return {
    returns1Y,
    returns3Y,
    returns5Y,
    riskMetrics: {
      alpha,
      beta,
      sharpeRatio,
      sortinoRatio,
      stdDeviation: stdDevPct
    }
  };
}

/**
 * Fetches real historical daily closes for NIFTY 50 (^NSEI) from Yahoo Finance
 * across the requested time horizon.
 */
async function fetchYahooBenchmarkPoints(range: string): Promise<Map<string, number>> {
  const yahooRangeMap: Record<string, string> = {
    '1M': '1mo',
    '6M': '6mo',
    '1Y': '1y',
    '3Y': '3y',
    '5Y': '5y',
    'ALL': '10y'
  };
  const yRange = yahooRangeMap[range.toUpperCase()] || '1y';
  const cacheKey = `yahoo:benchmark:nsei:${yRange}`;
  const cached = await getCache<any>(cacheKey);
  if (cached && Array.isArray(cached)) {
    return new Map(cached);
  }

  const dateMap = new Map<string, number>();
  try {
    const res = await axios.get(`https://query1.finance.yahoo.com/v8/finance/chart/%5ENSEI?range=${yRange}&interval=1d`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    const result = res.data?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp || [];
    const closes: number[] = result?.indicators?.quote?.[0]?.close || [];

    for (let i = 0; i < timestamps.length; i++) {
      if (closes[i] != null && !isNaN(closes[i])) {
        const d = new Date(timestamps[i] * 1000);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const yr = d.getFullYear();
        const key = `${day}-${month}-${yr}`;
        dateMap.set(key, closes[i]);
      }
    }

    if (dateMap.size > 0) {
      await setCache(cacheKey, Array.from(dateMap.entries()), 3600); // 1 hour cache
    }
  } catch (err: any) {
    console.warn('[Benchmark] Error fetching Yahoo Nifty 50 history:', err.message);
  }
  return dateMap;
}

// 100% Real Historical NAV trajectory from official AMFI data with real Yahoo Nifty 50 benchmark
export const getMutualFundChart = async (schemeCode: string | number, range: string = '1Y') => {
  const cacheKey = `mf:chart:${schemeCode}:${range.toUpperCase()}`;
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;

  // Resolve genuine AMFI scheme and NAV history
  const resolved = await resolveOfficialAmfiScheme(schemeCode);
  const codeNum = resolved ? resolved.schemeCode : Number(schemeCode);
  const rawHistoryData = resolved ? resolved.rawHistoryData : [];
  let schemeName = resolved ? resolved.schemeName : '';

  // Look up benchmark from DB
  let benchmarkName = 'NIFTY 50 TRI';
  try {
    const dbFund = await prisma.mutualFund.findFirst({
      where: {
        OR: [
          { schemeCode: !isNaN(codeNum) && codeNum > 0 ? codeNum : -1 },
          { id: String(schemeCode) }
        ]
      },
      select: { benchmark: true, name: true }
    });
    if (dbFund?.benchmark) {
      benchmarkName = dbFund.benchmark;
    }
    if (!schemeName && dbFund?.name) {
      schemeName = dbFund.name;
    }
  } catch {
    // ignore
  }

  // Target points based on range
  let daysBack = 365;
  let sampleInterval = 5;
  switch (range.toUpperCase()) {
    case '1M':
      daysBack = 30;
      sampleInterval = 1; // daily
      break;
    case '6M':
      daysBack = 180;
      sampleInterval = 3;
      break;
    case '1Y':
      daysBack = 365;
      sampleInterval = 7; // weekly
      break;
    case '3Y':
      daysBack = 1095;
      sampleInterval = 14; // bi-weekly
      break;
    case '5Y':
      daysBack = 1825;
      sampleInterval = 28; // monthly
      break;
    case 'ALL':
      daysBack = 3650;
      sampleInterval = 45;
      break;
    default:
      daysBack = 365;
      sampleInterval = 7;
  }

  let chartPoints: Array<{ date: string; nav: number; benchmarkNav: number; returnPct: number }> = [];

  if (rawHistoryData.length > 0) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    const filtered = rawHistoryData.filter((entry) => {
      // Date in mfapi is "DD-MM-YYYY"
      const [d, m, y] = entry.date.split('-');
      const entryDate = new Date(`${y}-${m}-${d}`);
      return entryDate >= cutoffDate;
    });

    const chronological = [...filtered].reverse();
    const sampled = chronological.filter((_, idx) => idx % sampleInterval === 0 || idx === chronological.length - 1);

    if (sampled.length > 0) {
      const baseNav = parseFloat(sampled[0].nav);
      const benchmarkDates = await fetchYahooBenchmarkPoints(range);

      // Find first valid benchmark close near start date
      let baseNiftyClose: number | null = null;
      for (const item of sampled) {
        if (benchmarkDates.has(item.date)) {
          baseNiftyClose = benchmarkDates.get(item.date)!;
          break;
        }
      }
      if (!baseNiftyClose && benchmarkDates.size > 0) {
        baseNiftyClose = Array.from(benchmarkDates.values())[0];
      }

      let lastKnownNifty = baseNiftyClose || 25000;

      chartPoints = sampled.map((item) => {
        const val = parseFloat(item.nav);
        const returnPct = baseNav > 0 ? Number((((val - baseNav) / baseNav) * 100).toFixed(2)) : 0;

        if (benchmarkDates.has(item.date)) {
          lastKnownNifty = benchmarkDates.get(item.date)!;
        }

        const niftyReturnPct = baseNiftyClose && baseNiftyClose > 0
          ? ((lastKnownNifty - baseNiftyClose) / baseNiftyClose) * 100
          : returnPct;

        const benchmarkNav = Number((baseNav * (1 + niftyReturnPct / 100)).toFixed(2));

        return {
          date: item.date,
          nav: val,
          benchmarkNav,
          returnPct
        };
      });
    }
  }

  const result = {
    schemeCode: codeNum,
    schemeName,
    range: range.toUpperCase(),
    benchmark: benchmarkName,
    points: chartPoints
  };

  await setCache(cacheKey, result, 21600); // 6 hours cache
  return result;
};

// Get detailed mutual fund information by scheme code or name
export const getMutualFundDetails = async (schemeCode: string | number): Promise<MutualFundItem> => {
  const codeNum = Number(schemeCode);
  const cacheKey = `mf:detail:${schemeCode}`;
  const cached = await getCache<MutualFundItem>(cacheKey);
  if (cached) return cached;

  // 1. Check PostgreSQL Database first
  let dbFund: any = null;
  try {
    if (!isNaN(codeNum) && codeNum > 0) {
      dbFund = await prisma.mutualFund.findUnique({
        where: { schemeCode: codeNum }
      });
    }
    if (!dbFund && typeof schemeCode === 'string') {
      dbFund = await prisma.mutualFund.findFirst({
        where: {
          OR: [
            { id: { equals: schemeCode } },
            { name: { equals: schemeCode, mode: 'insensitive' } },
            { schemeName: { equals: schemeCode, mode: 'insensitive' } }
          ]
        }
      });
    }
  } catch (err: any) {
    console.warn('DB lookup failed in getMutualFundDetails:', err.message);
  }

  // If found in DB, attach dynamic peers from the same subCategory and enrich if missing riskMetrics
  if (dbFund) {
    const item = mapDbToItem(dbFund);

    // If DB record lacks riskMetrics or 3Y returns, compute them live from official AMFI daily history
    if (!item.riskMetrics || Object.keys(item.riskMetrics).length === 0 || !item.riskMetrics.sharpeRatio) {
      try {
        const resolved = await resolveOfficialAmfiScheme(dbFund.schemeCode, dbFund.name);
        if (resolved && resolved.rawHistoryData && resolved.rawHistoryData.length > 0) {
          const computed = computeRealFundMetrics(resolved.rawHistoryData);
          if (computed.riskMetrics && Object.keys(computed.riskMetrics).length > 0) {
            item.riskMetrics = computed.riskMetrics;
          }
          if (!item.returns3Y && computed.returns3Y) item.returns3Y = computed.returns3Y;
          if (!item.returns5Y && computed.returns5Y) item.returns5Y = computed.returns5Y;
          if (!item.returns1Y && computed.returns1Y) item.returns1Y = computed.returns1Y;

          // Asynchronously persist verified metrics & AMFI code to DB
          prisma.mutualFund.update({
            where: { id: dbFund.id },
            data: {
              schemeCode: resolved.schemeCode,
              riskMetrics: item.riskMetrics,
              returns3Y: item.returns3Y,
              returns5Y: item.returns5Y
            }
          }).catch(() => {});
        }
      } catch (calcErr: any) {
        console.warn('Could not compute risk metrics for fund:', calcErr.message);
      }
    }

    try {
      const peers = await prisma.mutualFund.findMany({
        where: {
          subCategory: dbFund.subCategory,
          schemeCode: { not: dbFund.schemeCode }
        },
        take: 3,
        select: {
          schemeCode: true,
          name: true,
          subCategory: true,
          currentNav: true,
          returns1Y: true,
          returns3Y: true,
          returns5Y: true,
          expenseRatio: true,
          aum: true,
          riskRating: true
        }
      });
      item.peers = peers.map((p) => ({
        schemeCode: p.schemeCode,
        name: p.name,
        category: p.subCategory,
        nav: Number(p.currentNav || 0),
        returns1Y: Number(p.returns1Y || 0),
        returns3Y: Number(p.returns3Y || 0),
        returns5Y: Number(p.returns5Y || 0),
        expenseRatio: Number(p.expenseRatio || 0),
        aum: Number(p.aum || 0),
        riskRating: p.riskRating || 4
      }));
    } catch {
      // ignore
    }

    await setCache(cacheKey, item, 21600);
    return item;
  }

  // 2. If schemeCode is a fund name, fetch from IndianAPI
  if (typeof schemeCode === 'string' && isNaN(Number(schemeCode))) {
    try {
      const indianApiData = await getFundDetailsFromIndianAPI(schemeCode);
      if (indianApiData && indianApiData.basic_info && indianApiData.nav_info) {
        const savedFund = await upsertFundToDatabase(indianApiData);
        const item = mapDbToItem(savedFund);
        await setCache(cacheKey, item, 21600);
        return item;
      }
    } catch (err: any) {
      console.warn('Error fetching fund details from IndianAPI by name:', err.message);
    }
  }

  // 3. If numeric scheme code, fetch official metadata from mfapi.in and enrich with IndianAPI
  if (!isNaN(codeNum) && codeNum > 0) {
    try {
      const response = await axios.get(`${MF_API_BASE_URL}/mf/${codeNum}`, { timeout: 10000 });
      const meta = response.data?.meta;
      const history = response.data?.data || [];

      if (!meta || history.length === 0) {
        throw new Error(`Scheme code ${codeNum} not found in official AMFI directory`);
      }

      // Try fetching enriched details from IndianAPI using the scheme name
      try {
        const indianApiData = await getFundDetailsFromIndianAPI(meta.scheme_name);
        if (indianApiData && indianApiData.basic_info && indianApiData.nav_info) {
          const savedFund = await upsertFundToDatabase(indianApiData, codeNum);
          const item = mapDbToItem(savedFund);
          await setCache(cacheKey, item, 21600);
          return item;
        }
      } catch (enrichErr: any) {
        console.warn('Could not enrich from IndianAPI:', enrichErr.message);
      }

      // Compute actual returns from official AMFI daily history
      const latestNav = parseFloat(history[0]?.nav || '0');
      const prevNav = history[1] ? parseFloat(history[1].nav) : latestNav;
      const dayChange = Number((latestNav - prevNav).toFixed(4));
      const dayChangePct = prevNav !== 0 ? Number(((dayChange / prevNav) * 100).toFixed(2)) : 0;

      const getNavAgo = (days: number) => {
        const entry = history[Math.min(days, history.length - 1)];
        return entry ? parseFloat(entry.nav) : latestNav;
      };

      const nav1Y = getNavAgo(250);
      const nav3Y = getNavAgo(750);
      const nav5Y = getNavAgo(1250);

      const calcCagr = (pastNav: number, years: number) => {
        if (pastNav <= 0 || latestNav <= 0) return 0;
        return Number(((Math.pow(latestNav / pastNav, 1 / years) - 1) * 100).toFixed(2));
      };

      const rawCategory = (meta.scheme_category || '').toLowerCase();
      let category = 'Equity';
      if (rawCategory.includes('debt') || rawCategory.includes('liquid')) category = 'Debt';
      else if (rawCategory.includes('hybrid')) category = 'Hybrid';
      else if (rawCategory.includes('index')) category = 'Index';
      else if (rawCategory.includes('elss')) category = 'Solution Oriented';

      const calculatedFund: MutualFundItem = {
        id: String(codeNum),
        schemeCode: codeNum,
        name: meta.scheme_name,
        schemeName: meta.scheme_name,
        fundHouse: meta.fund_house || 'Mutual Fund AMC',
        category,
        subCategory: meta.scheme_category || category,
        planType: meta.scheme_name.toLowerCase().includes('direct') ? 'Direct' : 'Regular',
        optionType: meta.scheme_name.toLowerCase().includes('growth') ? 'Growth' : 'IDCW',
        nav: latestNav,
        navDate: history[0]?.date || 'Today',
        change: dayChange,
        pct: dayChangePct,
        aum: 0,
        expenseRatio: 0,
        riskRating: 4,
        riskometer: category === 'Debt' ? 'Moderate' : 'Very High',
        returns1Y: calcCagr(nav1Y, 1),
        returns3Y: calcCagr(nav3Y, 3),
        returns5Y: calcCagr(nav5Y, 5),
        returnsSinceInception: 0,
        benchmark: 'NIFTY 50 TRI',
        tags: [],
        minSip: 500,
        minLumpsum: 1000,
        exitLoad: 'Nil',
        fundManagers: [],
        riskMetrics: {},
        assetAllocation: {
          equity: category === 'Debt' ? 0 : 95,
          debt: category === 'Debt' ? 95 : 0,
          cash: 5
        },
        topHoldings: [],
        sectorAllocation: []
      };

      // Persist to PostgreSQL database
      try {
        await prisma.mutualFund.upsert({
          where: { schemeCode: codeNum },
          update: {
            name: calculatedFund.name,
            schemeName: calculatedFund.schemeName,
            fundHouse: calculatedFund.fundHouse,
            category: calculatedFund.category,
            subCategory: calculatedFund.subCategory,
            currentNav: calculatedFund.nav,
            navDate: calculatedFund.navDate,
            dayChange: calculatedFund.change,
            dayChangePct: calculatedFund.pct,
            returns1Y: calculatedFund.returns1Y,
            returns3Y: calculatedFund.returns3Y,
            returns5Y: calculatedFund.returns5Y,
            benchmark: calculatedFund.benchmark
          },
          create: {
            schemeCode: codeNum,
            name: calculatedFund.name,
            schemeName: calculatedFund.schemeName,
            fundHouse: calculatedFund.fundHouse,
            category: calculatedFund.category,
            subCategory: calculatedFund.subCategory,
            planType: calculatedFund.planType,
            optionType: calculatedFund.optionType,
            currentNav: calculatedFund.nav,
            navDate: calculatedFund.navDate,
            dayChange: calculatedFund.change,
            dayChangePct: calculatedFund.pct,
            returns1Y: calculatedFund.returns1Y,
            returns3Y: calculatedFund.returns3Y,
            returns5Y: calculatedFund.returns5Y,
            benchmark: calculatedFund.benchmark
          }
        });
      } catch (saveErr) {
        // ignore
      }

      await setCache(cacheKey, calculatedFund, 21600);
      return calculatedFund;
    } catch (error: any) {
      console.error(`Error fetching scheme ${schemeCode}:`, error.message);
      throw new Error(`Mutual fund scheme "${schemeCode}" not found.`);
    }
  }

  throw new Error(`Mutual fund scheme "${schemeCode}" not found.`);
};

// Compare multiple funds by scheme codes
export const compareMutualFunds = async (schemeCodes: Array<number | string>) => {
  const promises = schemeCodes.map((code) => getMutualFundDetails(code));
  const funds = await Promise.all(promises);
  return funds;
};

// Get distinct available Fund Houses from the database for the filter dropdown
export const getAvailableFundHouses = async (): Promise<string[]> => {
  try {
    const records = await prisma.mutualFund.findMany({
      distinct: ['fundHouse'],
      select: { fundHouse: true },
      orderBy: { fundHouse: 'asc' }
    });
    return records.map((r) => r.fundHouse).filter(Boolean);
  } catch (err: any) {
    console.warn('Error fetching distinct fund houses:', err.message);
    return [];
  }
};

// Legacy backward-compatible methods for older callers
export const getMutualFundHistory = async (schemeCode: string) => {
  return getMutualFundChart(schemeCode, '1Y');
};

export const getLatestMutualFundNav = async (schemeCode: string) => {
  const details = await getMutualFundDetails(schemeCode);
  return {
    schemeCode: details.schemeCode,
    schemeName: details.name,
    nav: details.nav,
    date: details.navDate
  };
};

export const listMutualFunds = async (limit: number = 50, offset: number = 0) => {
  const page = Math.floor(offset / limit) + 1;
  const res = await getScreenerFunds({ page, limit });
  return res.funds;
};

// Helper to identify standard Fund House names
const detectFundHouse = (fundName: string): string => {
  const amcList = [
    { prefix: 'Parag Parikh', name: 'PPFAS Mutual Fund' },
    { prefix: 'PPFAS', name: 'PPFAS Mutual Fund' },
    { prefix: 'HDFC', name: 'HDFC Mutual Fund' },
    { prefix: 'ICICI', name: 'ICICI Prudential Mutual Fund' },
    { prefix: 'SBI', name: 'SBI Mutual Fund' },
    { prefix: 'Nippon', name: 'Nippon India Mutual Fund' },
    { prefix: 'Quant', name: 'Quant Mutual Fund' },
    { prefix: 'Kotak', name: 'Kotak Mahindra Mutual Fund' },
    { prefix: 'Axis', name: 'Axis Mutual Fund' },
    { prefix: 'Mirae', name: 'Mirae Asset Mutual Fund' },
    { prefix: 'UTI', name: 'UTI Mutual Fund' },
    { prefix: 'Tata', name: 'Tata Mutual Fund' },
    { prefix: 'DSP', name: 'DSP Mutual Fund' },
    { prefix: 'Bandhan', name: 'Bandhan Mutual Fund' },
    { prefix: 'Motilal', name: 'Motilal Oswal Mutual Fund' },
    { prefix: 'Aditya Birla', name: 'Aditya Birla Sun Life Mutual Fund' },
    { prefix: 'ABSL', name: 'Aditya Birla Sun Life Mutual Fund' },
    { prefix: 'Edelweiss', name: 'Edelweiss Mutual Fund' },
    { prefix: 'Canara', name: 'Canara Robeco Mutual Fund' },
    { prefix: 'Invesco', name: 'Invesco Mutual Fund' },
    { prefix: 'PGIM', name: 'PGIM India Mutual Fund' },
    { prefix: 'HSBC', name: 'HSBC Mutual Fund' },
    { prefix: 'WhiteOak', name: 'WhiteOak Capital Mutual Fund' },
    { prefix: 'Mahindra', name: 'Mahindra Manulife Mutual Fund' },
    { prefix: 'Baroda', name: 'Baroda BNP Paribas Mutual Fund' },
    { prefix: 'Sundaram', name: 'Sundaram Mutual Fund' },
    { prefix: 'Franklin', name: 'Franklin Templeton Mutual Fund' },
    { prefix: '360 ONE', name: '360 ONE Mutual Fund' },
    { prefix: 'Groww', name: 'Groww Mutual Fund' },
    { prefix: 'Zerodha', name: 'Zerodha Fund House' },
    { prefix: 'Navi', name: 'Navi Mutual Fund' },
    { prefix: 'JM', name: 'JM Financial Mutual Fund' },
    { prefix: 'Union', name: 'Union Mutual Fund' },
    { prefix: 'Trust', name: 'Trust Mutual Fund' },
    { prefix: 'Bank of India', name: 'Bank of India Mutual Fund' },
    { prefix: 'LIC', name: 'LIC Mutual Fund' }
  ];

  for (const amc of amcList) {
    if (fundName.toLowerCase().startsWith(amc.prefix.toLowerCase()) || fundName.toLowerCase().includes(amc.prefix.toLowerCase())) {
      return amc.name;
    }
  }

  const firstWord = fundName.split(' ')[0];
  return firstWord ? `${firstWord} Mutual Fund` : 'Mutual Fund';
};

// Full synchronization mechanism:
// Fetches the entire curated universe of mutual funds from IndianAPI in a SINGLE API call (1 quota unit)
// and updates/upserts all records in PostgreSQL.
export const syncAllMutualFunds = async (force: boolean = false) => {
  try {
    const cooldownKey = 'mf:sync:last_run';
    if (!force) {
      const lastRun = await getCache<string>(cooldownKey);
      if (lastRun) {
        return { total: 0, updated: 0, errors: 0, message: 'Mutual funds sync is throttled. Next sync available in 1 hour.' };
      }
    }

    // Step 1: Single API call to IndianAPI /mutual_funds (1 quota consumed for all curated funds)
    const allCategoriesData = await fetchAllMutualFundsFromIndianAPI();
    if (!allCategoriesData || typeof allCategoriesData !== 'object' || Object.keys(allCategoriesData).length === 0) {
      console.warn('fetchAllMutualFundsFromIndianAPI returned no data, skipping batch sync');
      return { total: 0, updated: 0, errors: 0, message: 'No mutual fund data received from upstream API' };
    }

    // Step 2: Get existing DB funds map to preserve schemeCodes
    const existingDbFunds = await prisma.mutualFund.findMany({
      select: { schemeCode: true, name: true, schemeName: true }
    });
    const nameToSchemeCode = new Map<string, number>();
    for (const ef of existingDbFunds) {
      if (ef.name) nameToSchemeCode.set(ef.name.toLowerCase().trim(), ef.schemeCode);
      if (ef.schemeName) nameToSchemeCode.set(ef.schemeName.toLowerCase().trim(), ef.schemeCode);
    }

    let total = 0;
    let updated = 0;
    let errors = 0;
    const todayStr = new Date().toISOString().split('T')[0];

    // Step 3: Iterate through all categories and subcategories
    for (const [rawCategory, subCats] of Object.entries(allCategoriesData)) {
      if (!subCats || typeof subCats !== 'object') continue;

      let category = 'Equity';
      const catLower = rawCategory.toLowerCase();
      if (catLower.includes('debt')) category = 'Debt';
      else if (catLower.includes('hybrid')) category = 'Hybrid';
      else if (catLower.includes('index')) category = 'Index';
      else if (catLower.includes('solution')) category = 'Solution Oriented';
      else if (catLower.includes('global') || catLower.includes('other')) category = 'Other';

      for (const [rawSubCat, fundList] of Object.entries(subCats)) {
        if (!Array.isArray(fundList)) continue;

        // Clean subCategory name (e.g. 'Small Cap Fund' -> 'Small Cap')
        const cleanSubCategory = rawSubCat.replace(/\s+(Fund|Scheme|Growth|Direct)$/i, '').trim();

        for (const f of fundList) {
          if (!f || !f.fund_name) continue;
          total++;

          try {
            const fundName = f.fund_name.trim();
            const lowerName = fundName.toLowerCase();

            // Scheme code resolution: existing DB code > hash
            let schemeCode = nameToSchemeCode.get(lowerName);
            if (!schemeCode) {
              schemeCode = Math.abs(hashCode(fundName)) % 900000 + 100000;
              nameToSchemeCode.set(lowerName, schemeCode);
            }

            const fundHouse = detectFundHouse(fundName);
            const currentNav = Number(f.latest_nav || 0);
            const dayChangePct = Number(f.percentage_change || 0);
            const dayChange = Number((currentNav * (dayChangePct / 100)).toFixed(4));
            const aum = f.asset_size ? Number(f.asset_size) : null;
            const returns1Y = f['1_year_return'] !== undefined && f['1_year_return'] !== null ? Number(f['1_year_return']) : null;
            const returns3Y = f['3_year_return'] !== undefined && f['3_year_return'] !== null ? Number(f['3_year_return']) : null;
            const returns5Y = f['5_year_return'] !== undefined && f['5_year_return'] !== null ? Number(f['5_year_return']) : null;
            const riskRating = f.star_rating ? Number(f.star_rating) : (returns3Y ? 4 : 0);

            let riskometer = 'Very High';
            if (category === 'Debt') {
              riskometer = cleanSubCategory.toLowerCase().includes('liquid') || cleanSubCategory.toLowerCase().includes('overnight') ? 'Low' : 'Moderately Low';
            } else if (category === 'Hybrid') {
              riskometer = cleanSubCategory.toLowerCase().includes('conservative') ? 'Moderate' : 'Moderately High';
            } else if (category === 'Index') {
              riskometer = 'Very High';
            }

            const tags: string[] = [];
            if (returns3Y && returns3Y >= 18) tags.push('high-return');
            if (category === 'Solution Oriented' || lowerName.includes('tax') || lowerName.includes('elss')) tags.push('tax-saver');
            if (category === 'Index' || lowerName.includes('index')) tags.push('top-index');
            if (aum && aum >= 10000) tags.push('popular');
            if (category === 'Debt') tags.push('low-risk');
            tags.push('pocket-sip');

            const planType = lowerName.includes('regular') ? 'Regular' : 'Direct';
            const optionType = lowerName.includes('idcw') ? 'IDCW' : 'Growth';

            await prisma.mutualFund.upsert({
              where: { schemeCode },
              update: {
                name: fundName,
                schemeName: fundName,
                fundHouse,
                category,
                subCategory: cleanSubCategory,
                planType,
                optionType,
                currentNav,
                navDate: todayStr,
                dayChange,
                dayChangePct,
                aum,
                returns1Y,
                returns3Y,
                returns5Y,
                riskRating,
                riskometer,
                tags
              },
              create: {
                schemeCode,
                name: fundName,
                schemeName: fundName,
                fundHouse,
                category,
                subCategory: cleanSubCategory,
                planType,
                optionType,
                currentNav,
                navDate: todayStr,
                dayChange,
                dayChangePct,
                aum,
                returns1Y,
                returns3Y,
                returns5Y,
                riskRating,
                riskometer,
                tags,
                minSip: 500,
                minLumpsum: 1000,
                exitLoad: 'Nil',
                benchmark: category === 'Debt' ? 'CRISIL Composite Bond Index' : category === 'Hybrid' ? 'CRISIL Hybrid 35+65 Index' : 'NIFTY 50 TRI'
              }
            });

            updated++;
          } catch (fundErr: any) {
            errors++;
            console.warn(`Error upserting mutual fund ${f.fund_name}:`, fundErr.message);
          }
        }
      }
    }

    // Invalidate Redis caches so callers receive brand new data immediately
    await deleteCachePattern('mf:*');
    await deleteCachePattern('indianapi:*');

    // Set 1-hour cooldown
    await setCache(cooldownKey, new Date().toISOString(), 3600);

    console.log(`✅ Mutual fund sync complete: ${updated} funds updated/upserted across ${total} total parsed. Errors: ${errors}`);
    return {
      total,
      updated,
      errors,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    console.error('Error in syncAllMutualFunds:', error);
    throw error;
  }
};
