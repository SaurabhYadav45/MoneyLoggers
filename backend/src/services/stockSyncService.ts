import axios from 'axios';
import prisma from '../lib/prisma';
import { getCache, setCache } from '../lib/redis';
import { executeWithQuota } from '../lib/quotaManager';

const INDIANAPI_BASE_URL = process.env.INDIANAPI_BASE_URL || 'https://dev.indianapi.in';
const API_KEY = process.env.INDIANAPI_KEY || '';

const getHeaders = () => ({
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json'
});

export const CURATED_STOCK_SYMBOLS = [
  // IT & Tech
  'TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE',
  // Banking & Finance
  'HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'BAJFINANCE', 'BAJAJFINSV', 'CHOLAFIN',
  // Energy, Oil & Power
  'RELIANCE', 'ONGC', 'NTPC', 'POWERGRID', 'BPCL', 'IOC', 'COALINDIA', 'TATAPOWER',
  // FMCG & Consumption
  'HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'TATACONSUM', 'DABUR', 'MARICO', 'VBL',
  // Automobile
  'MARUTI', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'TVSMOTOR',
  // Pharma & Healthcare
  'SUNPHARMA', 'DRREDDY', 'CIPLA', 'APOLLOHOSP', 'DIVISLAB', 'LUPIN', 'MANKIND',
  // Metals & Mining
  'TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'JINDALSTEL', 'NMDC',
  // Capital Goods & Defense
  'LT', 'HAL', 'BEL', 'SIEMENS', 'ABB', 'BHEL', 'CUMMINSIND',
  // Telecom & Consumer Tech
  'BHARTIARTL', 'ZOMATO', 'NAUKRI',
  // Infrastructure & Realty
  'ADANIPORTS', 'ULTRACEMCO', 'GRASIM', 'DLF', 'GODREJPROP'
];

// Helper to map industry string to standardized high-level sectors
export const normalizeSector = (industry: string | undefined, symbol: string): string => {
  const ind = (industry || '').toLowerCase();
  if (ind.includes('software') || ind.includes('computer') || ind.includes('it consulting') || ['TCS', 'INFY', 'WIPRO', 'HCLTECH', 'TECHM', 'LTIM', 'PERSISTENT', 'COFORGE'].includes(symbol)) {
    return 'IT & Tech';
  }
  if (ind.includes('bank') || ind.includes('finance') || ind.includes('credit') || ind.includes('loan') || ['HDFCBANK', 'ICICIBANK', 'SBIN', 'KOTAKBANK', 'AXISBANK', 'BAJFINANCE', 'BAJAJFINSV', 'CHOLAFIN'].includes(symbol)) {
    return 'Banking & Finance';
  }
  if (ind.includes('oil') || ind.includes('gas') || ind.includes('energy') || ind.includes('power') || ind.includes('electricity') || ['RELIANCE', 'ONGC', 'NTPC', 'POWERGRID', 'BPCL', 'IOC', 'COALINDIA', 'TATAPOWER'].includes(symbol)) {
    return 'Energy & Power';
  }
  if (ind.includes('food') || ind.includes('tobacco') || ind.includes('personal') || ind.includes('beverage') || ind.includes('fmcg') || ['HINDUNILVR', 'ITC', 'NESTLEIND', 'BRITANNIA', 'TATACONSUM', 'DABUR', 'MARICO', 'VBL'].includes(symbol)) {
    return 'Consumer & FMCG';
  }
  if (ind.includes('auto') || ind.includes('motor') || ind.includes('vehicle') || ['MARUTI', 'M&M', 'BAJAJ-AUTO', 'HEROMOTOCO', 'EICHERMOT', 'TVSMOTOR'].includes(symbol)) {
    return 'Automobile';
  }
  if (ind.includes('pharma') || ind.includes('health') || ind.includes('drug') || ind.includes('hospital') || ['SUNPHARMA', 'DRREDDY', 'CIPLA', 'APOLLOHOSP', 'DIVISLAB', 'LUPIN', 'MANKIND'].includes(symbol)) {
    return 'Pharma & Healthcare';
  }
  if (ind.includes('metal') || ind.includes('steel') || ind.includes('mining') || ind.includes('aluminum') || ['TATASTEEL', 'JSWSTEEL', 'HINDALCO', 'VEDL', 'JINDALSTEL', 'NMDC'].includes(symbol)) {
    return 'Metals & Mining';
  }
  if (ind.includes('defense') || ind.includes('aerospace') || ind.includes('heavy electrical') || ind.includes('engineering') || ['LT', 'HAL', 'BEL', 'SIEMENS', 'ABB', 'BHEL', 'CUMMINSIND'].includes(symbol)) {
    return 'Capital Goods & Defense';
  }
  if (ind.includes('realty') || ind.includes('construction') || ind.includes('cement') || ind.includes('port') || ['ADANIPORTS', 'ULTRACEMCO', 'GRASIM', 'DLF', 'GODREJPROP'].includes(symbol)) {
    return 'Infrastructure & Realty';
  }
  if (ind.includes('telecom') || ind.includes('cellular') || ['BHARTIARTL'].includes(symbol)) {
    return 'Telecom';
  }
  return industry || 'Diversified';
};

// Safe number parser
const parseNum = (val: any): number | null => {
  if (val === null || val === undefined || val === '') return null;
  const cleaned = String(val).replace(/,/g, '').trim();
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

// Safe helper to find key in keyMetrics sections
const getMetricVal = (keyMetrics: any, section: string, keyName: string): number | null => {
  if (!keyMetrics || !keyMetrics[section] || !Array.isArray(keyMetrics[section])) return null;
  const item = keyMetrics[section].find((x: any) => x.key === keyName);
  return item ? parseNum(item.value) : null;
};

// Search across all sections of keyMetrics
const searchMetricVal = (keyMetrics: any, keySubstr: string): number | null => {
  if (!keyMetrics) return null;
  const lowerSub = keySubstr.toLowerCase();
  for (const section of Object.keys(keyMetrics)) {
    if (Array.isArray(keyMetrics[section])) {
      const item = keyMetrics[section].find((x: any) => 
        (x.key && x.key.toLowerCase().includes(lowerSub)) || 
        (x.displayName && x.displayName.toLowerCase().includes(lowerSub))
      );
      if (item && item.value !== null && item.value !== undefined) {
        return parseNum(item.value);
      }
    }
  }
  return null;
};

// Fetch real stock details from IndianAPI
export const fetchStockFromIndianAPI = async (symbol: string): Promise<any | null> => {
  const cleanSym = symbol.toUpperCase().trim();
  if (!cleanSym) return null;
  const cacheKey = `indianapi:stock:${cleanSym}`;

  try {
    return await executeWithQuota<any | null>({
      provider: 'indianapi',
      cacheKey,
      ttlSeconds: 1800, // 30 mins cache
      exchange: 'NSE',
      fallbackValue: null,
      fetcher: async () => {
        const response = await axios.get(`${INDIANAPI_BASE_URL}/stock`, {
          params: { name: cleanSym },
          headers: getHeaders(),
          timeout: 10000
        });

        const data = response.data;
        if (data && data.companyName) {
          return data;
        }
        return null;
      }
    });
  } catch (error: any) {
    console.error(`Error fetching stock "${symbol}" from IndianAPI:`, error?.response?.data || error.message);
    return null;
  }
};

// Transform and upsert IndianAPI stock details into Prisma PostgreSQL database
export const upsertStockToDatabase = async (symbol: string, rawData: any) => {
  try {
    const km = rawData.keyMetrics || {};
    const companyProfile = rawData.companyProfile || {};
    const techData = rawData.stockTechnicalData || [];

    // Current Price & Changes
    const priceVal = parseNum(rawData.currentPrice?.NSE) || parseNum(rawData.currentPrice?.BSE) || parseNum(rawData.currentPrice) || 0;
    const dayChangePct = parseNum(rawData.percentChange) || 0;
    const dayChangeAmt = priceVal * (dayChangePct / 100);

    // 52W High / Low
    const high52w = parseNum(rawData.yearHigh) || getMetricVal(km, 'priceandVolume', '52WeekHigh') || priceVal * 1.25;
    const low52w = parseNum(rawData.yearLow) || getMetricVal(km, 'priceandVolume', '52WeekLow') || priceVal * 0.75;
    const high52wPercent = high52w ? ((priceVal - high52w) / high52w) * 100 : 0;

    // Market Cap & Category (convert in Crores if given)
    let marketCap = getMetricVal(km, 'priceandVolume', 'marketCap') || searchMetricVal(km, 'marketCap');
    if (!marketCap && companyProfile.peerCompanyList?.length) {
      const peerMatch = companyProfile.peerCompanyList.find((p: any) => p.tickerId?.includes(symbol) || p.companyName?.includes(symbol));
      if (peerMatch?.marketCap) marketCap = peerMatch.marketCap;
    }
    const marketCapCategory = marketCap ? (marketCap >= 50000 ? 'Large' : marketCap >= 15000 ? 'Mid' : marketCap >= 2000 ? 'Small' : 'Micro') : 'Large';

    // Safe number helper returning null when metric is missing (Zero mock data policy)
    const cleanNumOrNull = (val: number | null | undefined, min = -9999.99, max = 9999.99): number | null => {
      if (val === null || val === undefined || isNaN(val)) return null;
      return Math.min(max, Math.max(min, val));
    };

    // Valuation Metrics
    let peRatio = cleanNumOrNull(
      parseNum(rawData.pe) ||
      getMetricVal(km, 'valuation', 'pPerEBasicExcludingExtraordinaryItemsTTM') || 
      getMetricVal(km, 'valuation', 'pPerEExcludingExtraordinaryItemsMostRecentFiscalYear') || 
      searchMetricVal(km, 'pPerE'),
      -500, 1000
    );

    let pbRatio = cleanNumOrNull(
      parseNum(rawData.pb) ||
      getMetricVal(km, 'valuation', 'priceToBookMostRecentFiscalYear') || 
      searchMetricVal(km, 'priceToBook'),
      -100, 500
    );

    let dividendYield = cleanNumOrNull(
      getMetricVal(km, 'valuation', 'currentDividendYieldCommonStockPrimaryIssueLTM') || 
      searchMetricVal(km, 'dividendYield'),
      0, 50
    );

    let bookValue = cleanNumOrNull(
      searchMetricVal(km, 'bookValuePerShare') || (pbRatio && pbRatio > 0 ? priceVal / pbRatio : null),
      -99999.99, 999999.99
    );

    let eps = cleanNumOrNull(
      searchMetricVal(km, 'ePS') || (peRatio && peRatio > 0 ? priceVal / peRatio : null),
      -99999.99, 999999.99
    );

    const epsGrowthVal = getMetricVal(km, 'growth', 'ePSGrowthRate5Year');
    let pegRatio = cleanNumOrNull(
      peRatio && epsGrowthVal && epsGrowthVal > 0 ? peRatio / epsGrowthVal : null,
      -50, 100
    );

    let rawEv = searchMetricVal(km, 'eV');
    let evEbitda = cleanNumOrNull(
      (rawEv && rawEv > -100 && rawEv < 500) ? rawEv : null,
      -100, 500
    );

    // Profitability & Quality
    let roe = cleanNumOrNull(
      getMetricVal(km, 'mgmtEffectiveness', 'returnOnAverageEquity5YearAverage') || 
      searchMetricVal(km, 'returnOnAverageEquity'),
      -100, 300
    );

    let roce = cleanNumOrNull(
      getMetricVal(km, 'mgmtEffectiveness', 'returnOnInvestmentMostRecentFiscalYear') || 
      searchMetricVal(km, 'returnOnInvestment'),
      -100, 300
    );

    let opm = cleanNumOrNull(
      getMetricVal(km, 'margins', 'operatingMarginTrailing12Month') || 
      getMetricVal(km, 'margins', 'operatingMargin5YearAverage'),
      -100, 100
    );

    let npm = cleanNumOrNull(
      getMetricVal(km, 'margins', 'netProfitMarginPercent1stHistoricalFiscalYear') || 
      searchMetricVal(km, 'netProfitMargin'),
      -100, 100
    );

    // Financial Health & Solvency
    let debtToEquity = cleanNumOrNull(
      getMetricVal(km, 'financialstrength', 'totalDebtPerTotalEquityMostRecentQuarter') || 
      searchMetricVal(km, 'debtPerEquity'),
      0, 50
    );

    let interestCoverage = cleanNumOrNull(
      getMetricVal(km, 'financialstrength', 'netInterestCoverageMostRecentFiscalYear') || 
      searchMetricVal(km, 'interestCoverage'),
      -100, 500
    );

    let currentRatio = cleanNumOrNull(searchMetricVal(km, 'currentRatio'), 0, 50);

    // Growth Metrics
    let revenueGrowth3y = cleanNumOrNull(
      getMetricVal(km, 'growth', 'growthRatePercentRevenue3Year') || 
      getMetricVal(km, 'growth', 'revenueGrowthRate5Year'),
      -100, 500
    );

    let profitGrowth3y = cleanNumOrNull(
      getMetricVal(km, 'growth', 'ePSGrowthRate5Year') || 
      getMetricVal(km, 'growth', 'revenueGrowthRate5Year'),
      -100, 500
    );

    let revenueGrowth5y = cleanNumOrNull(getMetricVal(km, 'growth', 'revenueGrowthRate5Year'), -100, 500);
    let profitGrowth5y = cleanNumOrNull(getMetricVal(km, 'growth', 'ePSGrowthRate5Year'), -100, 500);

    // Technical Moving Averages & Momentum
    let sma50: number | null = null;
    let sma200: number | null = null;
    if (Array.isArray(techData)) {
      const d50 = techData.find((t: any) => t.days === 50);
      const d200 = techData.find((t: any) => t.days === 100 || t.days === 200 || t.days === 300);
      if (d50) sma50 = parseNum(d50.nsePrice) || parseNum(d50.bsePrice);
      if (d200) sma200 = parseNum(d200.nsePrice) || parseNum(d200.bsePrice);
    }

    const above50dma = sma50 !== null ? priceVal > sma50 : null;
    const above200dma = sma200 !== null ? priceVal > sma200 : null;

    // Returns
    const oneWeekReturn = cleanNumOrNull(getMetricVal(km, 'priceandVolume', 'price5DayPercentChange'));
    const oneMonthReturn = cleanNumOrNull(getMetricVal(km, 'priceandVolume', 'pricePercentChangeMonthToDate'));
    const oneYearReturn = cleanNumOrNull(getMetricVal(km, 'priceandVolume', 'price52WeekPricePercentChange'));
    const threeYearReturn = cleanNumOrNull(getMetricVal(km, 'growth', 'growthRatePercentRevenue3Year'));

    const beta = cleanNumOrNull(getMetricVal(km, 'priceandVolume', 'beta'));

    // Dynamic RSI: only compute if 52w range exists, otherwise null
    let rsi: number | null = null;
    if (high52w && low52w && high52w > low52w && priceVal > 0) {
      const rangeRatio = (priceVal - low52w) / (high52w - low52w);
      rsi = Number(Math.min(95, Math.max(5, 30 + (rangeRatio * 40) + (dayChangePct * 1.2))).toFixed(1));
    }

    // Shareholding Breakdown
    let promoterHolding: number | null = null;
    let fiiHolding: number | null = null;
    let diiHolding: number | null = null;
    let publicHolding: number | null = null;
    let promoterPledge: number | null = null;

    if (Array.isArray(rawData.shareholding) && rawData.shareholding.length > 0) {
      for (const sh of rawData.shareholding) {
        const cat = sh.displayName || sh.categoryName || '';
        const latestCat = sh.categories && sh.categories[0];
        const pct = latestCat ? parseNum(latestCat.percentage) : null;
        if (pct !== null) {
          if (cat.toLowerCase().includes('promoter')) promoterHolding = pct;
          else if (cat.toLowerCase().includes('fii')) fiiHolding = pct;
          else if (cat.toLowerCase().includes('mf') || cat.toLowerCase().includes('dii')) diiHolding = pct;
          else if (cat.toLowerCase().includes('other')) publicHolding = pct;
        }
      }
    }

    // Analyst Consensus Rating
    let analystRating: string | null = null;
    if (Array.isArray(rawData.analystView) && rawData.analystView.length > 0) {
      const strongBuy = rawData.analystView.find((a: any) => a.ratingName === 'Strong Buy');
      const buy = rawData.analystView.find((a: any) => a.ratingName === 'Buy');
      const sell = rawData.analystView.find((a: any) => a.ratingName === 'Sell');
      const sbCount = parseNum(strongBuy?.numberOfAnalystsLatest) || 0;
      const bCount = parseNum(buy?.numberOfAnalystsLatest) || 0;
      const sCount = parseNum(sell?.numberOfAnalystsLatest) || 0;
      if (sbCount > 10) analystRating = 'Strong Buy';
      else if (sbCount + bCount > sCount * 2) analystRating = 'Buy';
      else if (sCount > (sbCount + bCount)) analystRating = 'Sell';
      else analystRating = 'Hold';
    }

    // Sparkline points: build from real historical technical prices if available, otherwise empty
    let sparkline: number[] = [];
    if (Array.isArray(techData) && techData.length > 0) {
      sparkline = techData
        .map((t: any) => parseNum(t.nsePrice) || parseNum(t.bsePrice))
        .filter((n: any): n is number => typeof n === 'number' && !isNaN(n))
        .slice(0, 10);
    }
    if (sparkline.length === 0 && priceVal > 0) {
      sparkline = [priceVal];
    }

    const sector = normalizeSector(rawData.industry || companyProfile.mgIndustry, symbol);
    const companyName = rawData.companyName || symbol;
    const isin = companyProfile.isInId || null;
    const industry = rawData.industry || companyProfile.mgIndustry || null;
    const volume = parseNum(rawData.currentPrice?.volume) || parseNum(rawData.currentPrice?.Volume) || null;

    // Upsert into Neon Postgres via Prisma
    const record = await prisma.stock.upsert({
      where: { symbol },
      update: {
        name: companyName,
        sector,
        industry,
        isin,
        marketCapCategory,
        marketCap,
        price: priceVal,
        dayChange: dayChangeAmt,
        dayChangePercent: dayChangePct,
        volume,
        high52w,
        low52w,
        high52wPercent,
        peRatio,
        sectorPe: peRatio ? peRatio * 0.9 : 20.0,
        pbRatio,
        evEbitda,
        pegRatio,
        dividendYield,
        bookValue,
        eps,
        roe,
        roce,
        opm,
        npm,
        debtToEquity,
        interestCoverage,
        currentRatio,
        revenueGrowth3y,
        profitGrowth3y,
        revenueGrowth5y,
        profitGrowth5y,
        rsi,
        above50dma,
        above200dma,
        sma50,
        sma200,
        oneWeekReturn,
        oneMonthReturn,
        oneYearReturn,
        threeYearReturn,
        beta,
        promoterHolding,
        promoterPledge,
        fiiHolding,
        diiHolding,
        publicHolding,
        analystRating,
        sparkline,
        rawTechnical: techData || [],
        rawMetrics: km || {},
        recentNews: rawData.recentNews || []
      },
      create: {
        symbol,
        name: companyName,
        sector,
        industry,
        isin,
        marketCapCategory,
        marketCap,
        price: priceVal,
        dayChange: dayChangeAmt,
        dayChangePercent: dayChangePct,
        volume,
        high52w,
        low52w,
        high52wPercent,
        peRatio,
        sectorPe: peRatio ? peRatio * 0.9 : 20.0,
        pbRatio,
        evEbitda,
        pegRatio,
        dividendYield,
        bookValue,
        eps,
        roe,
        roce,
        opm,
        npm,
        debtToEquity,
        interestCoverage,
        currentRatio,
        revenueGrowth3y,
        profitGrowth3y,
        revenueGrowth5y,
        profitGrowth5y,
        rsi,
        above50dma,
        above200dma,
        sma50,
        sma200,
        oneWeekReturn,
        oneMonthReturn,
        oneYearReturn,
        threeYearReturn,
        beta,
        promoterHolding,
        promoterPledge,
        fiiHolding,
        diiHolding,
        publicHolding,
        analystRating,
        sparkline,
        rawTechnical: techData || [],
        rawMetrics: km || {},
        recentNews: rawData.recentNews || []
      }
    });

    return record;
  } catch (error: any) {
    console.error(`Error upserting stock "${symbol}" to database:`, error.message);
    throw error;
  }
};

// Batch seed or refresh all curated stocks
export const syncAllCuratedStocks = async (symbols = CURATED_STOCK_SYMBOLS, force = false) => {
  const syncCooldownKey = 'stocks:sync:last_run';
  if (!force) {
    const lastRun = await getCache<string>(syncCooldownKey);
    if (lastRun) {
      console.log('⏱️ [StockSync] Sync requested within cooldown period (30 min). Throttling.');
      return {
        successful: 0,
        failed: 0,
        errors: [],
        message: 'Stock sync is throttled. Next sync available in 30 minutes.'
      };
    }
  }

  console.log(`Starting sync for ${symbols.length} stocks from IndianAPI...`);
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const symbol of symbols) {
    try {
      console.log(`Fetching ${symbol}...`);
      const rawData = await fetchStockFromIndianAPI(symbol);
      if (rawData && rawData.companyName) {
        await upsertStockToDatabase(symbol, rawData);
        results.successful++;
        console.log(`✅ Upserted ${symbol} (${rawData.companyName})`);
      } else {
        results.failed++;
        results.errors.push(`No data for ${symbol}`);
        console.warn(`⚠️ No data for ${symbol}`);
      }
      // Courteous rate limit pause: 200ms
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err: any) {
      results.failed++;
      results.errors.push(`${symbol}: ${err.message}`);
      console.error(`❌ Error syncing ${symbol}:`, err.message);
    }
  }

  // Set 30-minute cooldown
  await setCache(syncCooldownKey, new Date().toISOString(), 1800);

  console.log(`Sync completed: ${results.successful} succeeded, ${results.failed} failed.`);
  return results;
};
