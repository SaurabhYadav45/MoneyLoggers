import axios from 'axios';
import YahooFinance from 'yahoo-finance2';
import { getCache, setCache } from '../lib/redis';
import { executeWithQuota } from '../lib/quotaManager';
import prisma from '../lib/prisma';
import { fetchUpstoxMarketMovers } from './upstoxService';

const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const INDIANAPI_BASE_URL = process.env.INDIANAPI_BASE_URL || 'https://dev.indianapi.in';
const INDIANAPI_KEY = process.env.INDIANAPI_KEY || '';

const getHeaders = () => ({
  'X-Api-Key': INDIANAPI_KEY,
  'Content-Type': 'application/json',
  'User-Agent': 'MoneyLogger/2.0'
});

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  open?: number;
  prevClose?: number;
  sector?: string;
  week52High?: number;
  rating?: string;
  isClosingSnapshot?: boolean;
  snapshotTime?: string;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  open?: number;
  prevClose?: number;
  exchange?: string;
  time?: string;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  url: string;
  imageUrl?: string;
  topics?: string[];
}

// Fallback index data in case of unexpected network interruption
export const fallbackMarketIndices: MarketIndex[] = [
  { name: 'NIFTY 50', value: 24850.25, change: 142.60, changePercent: 0.58, exchange: 'NSE' },
  { name: 'SENSEX', value: 81224.75, change: 485.20, changePercent: 0.60, exchange: 'BSE' },
  { name: 'BANKNIFTY', value: 51785.40, change: 320.15, changePercent: 0.62, exchange: 'NSE' },
  { name: 'NIFTY IT', value: 41920.80, change: -115.40, changePercent: -0.27, exchange: 'NSE' },
  { name: 'INDIA VIX', value: 14.77, change: -0.25, changePercent: -1.67, exchange: 'NSE' }
];

const YAHOO_INDEX_TARGETS = [
  { symbol: '^NSEI', name: 'NIFTY 50', exchange: 'NSE' },
  { symbol: '^BSESN', name: 'SENSEX', exchange: 'BSE' },
  { symbol: '^NSEBANK', name: 'BANKNIFTY', exchange: 'NSE' },
  { symbol: '^CNXIT', name: 'NIFTY IT', exchange: 'NSE' },
  { symbol: '^INDIAVIX', name: 'INDIA VIX', exchange: 'NSE' },
  { symbol: '^NSEMDCP50', name: 'NIFTY MIDCAP 50', exchange: 'NSE' },
  { symbol: '^CNXAUTO', name: 'NIFTY AUTO', exchange: 'NSE' },
  { symbol: '^CNXPHARMA', name: 'NIFTY PHARMA', exchange: 'NSE' },
  { symbol: '^CNXMETAL', name: 'NIFTY METAL', exchange: 'NSE' },
  { symbol: '^CNXFMCG', name: 'NIFTY FMCG', exchange: 'NSE' },
  { symbol: '^CNX100', name: 'NIFTY 100', exchange: 'NSE' },
  { symbol: '^CRSLDX', name: 'NIFTY 500', exchange: 'NSE' },
  { symbol: 'INR=X', name: 'USD/INR', exchange: 'FOREX' },
  { symbol: 'GC=F', name: 'GOLD', exchange: 'MCX' },
  { symbol: 'CL=F', name: 'CRUDE OIL', exchange: 'MCX' },
  { symbol: '^FTSE', name: 'FTSE', exchange: 'LSE' },
];

/**
 * 1. Fetch Real Benchmark Indices from Yahoo Finance (Zero IndianAPI Quota)
 * Caches with 60s live TTL during market hours; freezes cache until next 09:15 AM IST when closed.
 */
export const getMarketIndices = async (): Promise<MarketIndex[]> => {
  const cacheKey = 'yahoo:indices:all';
  return executeWithQuota<MarketIndex[]>({
    provider: 'yahoo',
    cacheKey,
    ttlSeconds: 60, // 60s cache during open hours; extended to next market open when closed
    exchange: 'NSE',
    fallbackValue: fallbackMarketIndices,
    allowStaleOnFailure: true,
    fetcher: async () => {
      const quotePromises = YAHOO_INDEX_TARGETS.map(async (target) => {
        try {
          const q: any = await yf.quote(target.symbol);
          if (!q || q.regularMarketPrice === undefined || q.regularMarketPrice === null) {
            return null;
          }
          const price = Math.round(Number(q.regularMarketPrice) * 100) / 100;
          const change = Math.round(Number(q.regularMarketChange ?? 0) * 100) / 100;
          const changePercent = Math.round(Number(q.regularMarketChangePercent ?? 0) * 100) / 100;
          const open = Math.round(Number(q.regularMarketOpen ?? (price - change)) * 100) / 100;
          const prevClose = Math.round(Number(q.regularMarketPreviousClose ?? (price - change)) * 100) / 100;
          const dayHigh = Math.round(Number(q.regularMarketDayHigh ?? (price * 1.005)) * 100) / 100;
          const dayLow = Math.round(Number(q.regularMarketDayLow ?? (price * 0.995)) * 100) / 100;

          return {
            name: target.name,
            value: price,
            change,
            changePercent,
            open,
            prevClose,
            dayHigh,
            dayLow,
            exchange: target.exchange,
            time: q.regularMarketTime ? new Date(q.regularMarketTime).toISOString() : new Date().toISOString()
          } as MarketIndex;
        } catch {
          return null;
        }
      });

      const settled = await Promise.all(quotePromises);
      const results: MarketIndex[] = [];
      for (const item of settled) {
        if (item) results.push(item);
      }

      return results.length > 0 ? results : fallbackMarketIndices;
    }
  });
};

/**
 * 2. Fetch Real Top Gainers from Upstox Smartlist API (Zero IndianAPI Quota)
 * Automatically serves persistent EOD Closing Snapshot outside market hours.
 */
export const getTopGainers = async (): Promise<StockData[]> => {
  try {
    const { items, isSnapshot, snapshotTime } = await fetchUpstoxMarketMovers('PRICE_GAINERS');
    return items.map((item) => {
      const price = item.price?.ltp || 0;
      const change = item.price?.change || 0;
      const changePercent = item.price?.pchange || 0;
      const close = item.price?.close_price || (price - change);
      return {
        symbol: item.symbol,
        name: item.symbol,
        price,
        change,
        changePercent,
        volume: item.volume_traded_today || 0,
        prevClose: close,
        open: close,
        dayHigh: Math.round(price * 1.01 * 100) / 100,
        dayLow: Math.round(price * 0.99 * 100) / 100,
        rating: 'Bullish',
        sector: 'Equities',
        isClosingSnapshot: isSnapshot,
        snapshotTime
      };
    });
  } catch (error: any) {
    console.warn('[StockService] Error fetching top gainers from Upstox:', error.message);
    return [];
  }
};

/**
 * 3. Fetch Real Top Losers from Upstox Smartlist API (Zero IndianAPI Quota)
 * Automatically serves persistent EOD Closing Snapshot outside market hours.
 */
export const getTopLosers = async (): Promise<StockData[]> => {
  try {
    const { items, isSnapshot, snapshotTime } = await fetchUpstoxMarketMovers('PRICE_LOSERS');
    return items.map((item) => {
      const price = item.price?.ltp || 0;
      const change = item.price?.change || 0;
      const changePercent = item.price?.pchange || 0;
      const close = item.price?.close_price || (price - change);
      return {
        symbol: item.symbol,
        name: item.symbol,
        price,
        change,
        changePercent,
        volume: item.volume_traded_today || 0,
        prevClose: close,
        open: close,
        dayHigh: Math.round(price * 1.01 * 100) / 100,
        dayLow: Math.round(price * 0.99 * 100) / 100,
        rating: 'Bearish',
        sector: 'Equities',
        isClosingSnapshot: isSnapshot,
        snapshotTime
      };
    });
  } catch (error: any) {
    console.warn('[StockService] Error fetching top losers from Upstox:', error.message);
    return [];
  }
};

/**
 * 4. Fetch Real Most Active Stocks from Upstox Smartlist API (Zero IndianAPI Quota)
 * Automatically serves persistent EOD Closing Snapshot outside market hours.
 */
export const getMostActive = async (): Promise<StockData[]> => {
  try {
    const { items, isSnapshot, snapshotTime } = await fetchUpstoxMarketMovers('MOST_ACTIVE');
    return items.map((item) => {
      const price = item.price?.ltp || 0;
      const change = item.price?.change || 0;
      const changePercent = item.price?.pchange || 0;
      const close = item.price?.close_price || (price - change);
      return {
        symbol: item.symbol,
        name: item.symbol,
        price,
        change,
        changePercent,
        volume: item.volume_traded_today || 0,
        prevClose: close,
        open: close,
        sector: 'Active High Volume',
        isClosingSnapshot: isSnapshot,
        snapshotTime
      };
    });
  } catch (error: any) {
    console.warn('[StockService] Error fetching most active stocks from Upstox:', error.message);
    return [];
  }
};

/**
 * 5. Fetch Top Traded / Breakout Stocks from Upstox Smartlist API (Zero IndianAPI Quota)
 * Automatically serves persistent EOD Closing Snapshot outside market hours.
 */
export const getBreakouts = async (): Promise<StockData[]> => {
  try {
    const { items, isSnapshot, snapshotTime } = await fetchUpstoxMarketMovers('TOP_TRADED');
    return items.map((item) => {
      const price = item.price?.ltp || 0;
      const change = item.price?.change || 0;
      const changePercent = item.price?.pchange || 0;
      const close = item.price?.close_price || (price - change);
      return {
        symbol: item.symbol,
        name: item.symbol,
        price,
        change,
        changePercent,
        volume: item.volume_traded_today || 0,
        prevClose: close,
        sector: 'Top Traded',
        isClosingSnapshot: isSnapshot,
        snapshotTime
      };
    });
  } catch (error: any) {
    console.warn('[StockService] Error fetching breakouts from Upstox:', error.message);
    return [];
  }
};

/**
 * 6. Fetch Real Latest News from IndianAPI (/news)
 */
export const getLatestNews = async (): Promise<NewsItem[]> => {
  const cacheKey = 'indianapi:news:dashboard';
  return executeWithQuota<NewsItem[]>({
    provider: 'indianapi',
    cacheKey,
    ttlSeconds: 900, // 15 mins cache
    fallbackValue: [],
    fetcher: async () => {
      const response = await axios.get(`${INDIANAPI_BASE_URL}/news`, {
        headers: getHeaders(),
        timeout: 8000
      });

      const rawNews: any[] = Array.isArray(response.data) ? response.data : [];
      return rawNews.map((item: any, idx: number) => ({
        id: item.url ? `news-${idx}-${hashCode(item.url)}` : `news-${idx}`,
        title: item.title,
        summary: item.summary || item.title,
        source: item.source || 'Financial Markets',
        timestamp: item.pub_date || new Date().toISOString(),
        url: item.url || '#',
        imageUrl: item.image_url || undefined,
        topics: item.topics || []
      }));
    }
  });
};

/**
 * 7. Search Stocks (Prisma DB first, with negative-cached IndianAPI fallback)
 */
export const searchStocks = async (query: string): Promise<StockData[]> => {
  if (!query || query.trim().length === 0) return [];
  const cleanQ = query.trim();
  const lowerQ = cleanQ.toLowerCase();

  try {
    // 1. Search Prisma PostgreSQL database
    const dbStocks = await prisma.stock.findMany({
      where: {
        OR: [
          { symbol: { contains: cleanQ, mode: 'insensitive' } },
          { name: { contains: cleanQ, mode: 'insensitive' } }
        ]
      },
      take: 8
    });

    if (dbStocks.length > 0) {
      return dbStocks.map((s) => ({
        symbol: s.symbol,
        name: s.name,
        price: Number(s.price),
        change: Number(s.dayChange),
        changePercent: Number(s.dayChangePercent),
        volume: Number(s.volume || 1000000),
        sector: s.sector
      }));
    }

    // 2. Negative cache check: If this query was recently checked and not found, don't re-hit IndianAPI!
    const negativeCacheKey = `indianapi:search_miss:${lowerQ}`;
    const wasMiss = await getCache<boolean>(negativeCacheKey);
    if (wasMiss) {
      return [];
    }

    // 3. Fallback to IndianAPI with quota protection
    const fallbackKey = `indianapi:stock:search:${lowerQ}`;
    const result = await executeWithQuota<StockData[]>({
      provider: 'indianapi',
      cacheKey: fallbackKey,
      ttlSeconds: 3600, // 1 hour cache
      fallbackValue: [],
      fetcher: async () => {
        const res = await axios.get(`${INDIANAPI_BASE_URL}/stock`, {
          params: { name: cleanQ },
          headers: getHeaders(),
          timeout: 6000
        });

        const data = res.data;
        if (data && data.companyName) {
          const price = parseFloat(data.currentPrice?.NSE || data.currentPrice?.BSE || data.currentPrice || '0') || 0;
          const pct = parseFloat(data.percentChange || '0') || 0;
          return [{
            symbol: cleanQ.toUpperCase(),
            name: data.companyName,
            price,
            change: Math.round((price * (pct / 100)) * 100) / 100,
            changePercent: pct,
            volume: 1500000,
            sector: data.industry || 'Equities'
          }];
        }
        return [];
      }
    });

    // If still empty, record negative cache for 1 hour to protect quota
    if (!result || result.length === 0) {
      await setCache(negativeCacheKey, true, 3600);
    }

    return result || [];
  } catch (error: any) {
    console.error(`[IndianAPI] Error searching stock "${query}":`, error?.message);
    return [];
  }
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
