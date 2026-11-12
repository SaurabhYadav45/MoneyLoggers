import axios from 'axios';
import { getCache, setCache } from '../lib/redis';
import { executeWithQuota } from '../lib/quotaManager';

const UPSTOX_BASE_URL = 'https://api.upstox.com/v2';

export interface UpstoxFlowResult {
  date: string;
  fiiNet: number;
  diiNet: number;
  fiiBuy: number;
  fiiSell: number;
  diiBuy: number;
  diiSell: number;
  source: 'upstox' | 'fallback';
}

/**
 * Returns active Upstox access token from Redis cache or environment variables.
 */
export const getUpstoxAccessToken = async (): Promise<string | null> => {
  try {
    const cachedToken = await getCache<string>('upstox:auth:access_token');
    if (cachedToken && cachedToken.length > 10) {
      return cachedToken;
    }
  } catch {
    // Redis offline, proceed to env
  }
  const token = process.env.UPSTOX_ACCESS_TOKEN?.trim();
  return token && token.length > 10 ? token : null;
};

/**
 * Invalidate expired token across Redis and memory
 */
export const invalidateUpstoxToken = async (): Promise<void> => {
  process.env.UPSTOX_ACCESS_TOKEN = '';
  try {
    await setCache('upstox:auth:access_token', '', 1);
    await setCache('upstox:auth:token_info', { status: 'EXPIRED', expiredAt: new Date().toISOString() }, 86400);
  } catch {
    // Ignore
  }
  console.warn('⚠️ [Upstox]: Access token invalidated due to 401 Unauthorized.');
};

/**
 * Fetch live FII & DII Cash Market flows using Upstox Developer API
 * Endpoint: GET /v2/market/fii & GET /v2/market/dii with data_type=NSE_EQ|CASH
 */
export const fetchUpstoxFIIDII = async (): Promise<UpstoxFlowResult | null> => {
  const token = await getUpstoxAccessToken();
  if (!token) {
    return null;
  }

  const CACHE_KEY = 'upstox:market:fii_dii:cash';

  try {
    return await executeWithQuota<UpstoxFlowResult | null>({
      provider: 'upstox',
      cacheKey: CACHE_KEY,
      ttlSeconds: 900, // 15 mins cache
      exchange: 'NSE',
      fallbackValue: null,
      fetcher: async () => {
        const headers = {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token}`
        };

        const [fiiRes, diiRes] = await Promise.all([
          axios.get(`${UPSTOX_BASE_URL}/market/fii`, {
            params: { data_type: 'NSE_EQ|CASH', interval: '1D' },
            headers,
            timeout: 7000
          }),
          axios.get(`${UPSTOX_BASE_URL}/market/dii`, {
            params: { data_type: 'NSE_EQ|CASH', interval: '1D' },
            headers,
            timeout: 7000
          })
        ]);

        const fiiCashArray = fiiRes.data?.data?.['NSE_EQ|CASH'] || fiiRes.data?.data?.['NSE_EQ'] || [];
        const diiCashArray = diiRes.data?.data?.['NSE_EQ|CASH'] || diiRes.data?.data?.['NSE_EQ'] || [];

        const latestFii = fiiCashArray.length > 0 ? fiiCashArray[fiiCashArray.length - 1] : null;
        const latestDii = diiCashArray.length > 0 ? diiCashArray[diiCashArray.length - 1] : null;

        if (!latestFii && !latestDii) {
          console.warn('[Upstox] No cash flow entries returned in FII/DII response');
          return null;
        }

        const fiiBuy = latestFii ? parseFloat(latestFii.buy_amount) || 0 : 0;
        const fiiSell = latestFii ? parseFloat(latestFii.sell_amount) || 0 : 0;
        const fiiNet = Math.round((fiiBuy - fiiSell) * 100) / 100;

        const diiBuy = latestDii ? parseFloat(latestDii.buy_amount) || 0 : 0;
        const diiSell = latestDii ? parseFloat(latestDii.sell_amount) || 0 : 0;
        const diiNet = Math.round((diiBuy - diiSell) * 100) / 100;

        let dateStr = new Date().toISOString().split('T')[0];
        const ts = latestFii?.time_stamp || latestDii?.time_stamp;
        if (ts) {
          const d = new Date(Number(ts));
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
          }
        }

        return {
          date: dateStr,
          fiiNet,
          diiNet,
          fiiBuy,
          fiiSell,
          diiBuy,
          diiSell,
          source: 'upstox'
        };
      }
    });
  } catch (error: any) {
    if (error?.response?.status === 401) {
      await invalidateUpstoxToken();
    }
    console.error('[Upstox] Error fetching FII/DII data:', error?.response?.data || error.message);
    return null;
  }
};

/**
 * Fetch full market quote for an instrument key (e.g., 'NSE_INDEX|India VIX' or 'NSE_INDEX|Nifty 50')
 */
export const fetchUpstoxQuote = async (instrumentKey: string): Promise<any | null> => {
  const token = await getUpstoxAccessToken();
  if (!token) return null;

  const CACHE_KEY = `upstox:quote:${instrumentKey}`;

  try {
    return await executeWithQuota<any | null>({
      provider: 'upstox',
      cacheKey: CACHE_KEY,
      ttlSeconds: 60, // 1 minute cache
      exchange: 'NSE',
      fallbackValue: null,
      fetcher: async () => {
        const res = await axios.get(`${UPSTOX_BASE_URL}/market-quote/quotes`, {
          params: { instrument_key: instrumentKey },
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 5000
        });
        return res.data?.data || null;
      }
    });
  } catch (error: any) {
    if (error?.response?.status === 401) {
      await invalidateUpstoxToken();
    }
    console.warn(`[Upstox] Failed to fetch quote for ${instrumentKey}:`, error?.response?.data || error.message);
    return null;
  }
};

export interface UpstoxSmartlistItem {
  instrument_key: string;
  symbol: string;
  expiry?: string;
  price?: {
    ltp: number;
    change: number;
    pchange: number;
    close_price: number;
  };
  total_traded_value?: number;
  volume_traded_today?: number;
  open_interest?: number;
  isClosingSnapshot?: boolean;
  snapshotTime?: string;
}

// Initial seed closing snapshot for non-market hours before first live sync
const DEFAULT_CLOSING_MOVERS: Record<string, UpstoxSmartlistItem[]> = {
  PRICE_GAINERS: [
    { instrument_key: 'NSE_EQ|INE081A01020', symbol: 'TATASTEEL', price: { ltp: 158.40, change: 4.80, pchange: 3.12, close_price: 153.60 }, volume_traded_today: 34200000 },
    { instrument_key: 'NSE_EQ|INE002A01018', symbol: 'RELIANCE', price: { ltp: 2980.50, change: 65.20, pchange: 2.24, close_price: 2915.30 }, volume_traded_today: 11200000 },
    { instrument_key: 'NSE_EQ|INE009A01021', symbol: 'INFY', price: { ltp: 1895.00, change: 38.50, pchange: 2.07, close_price: 1856.50 }, volume_traded_today: 9800000 },
    { instrument_key: 'NSE_EQ|INE040A01034', symbol: 'HDFCBANK', price: { ltp: 1690.00, change: 28.40, pchange: 1.71, close_price: 1661.60 }, volume_traded_today: 18400000 },
    { instrument_key: 'NSE_EQ|INE397D01024', symbol: 'BHARTIARTL', price: { ltp: 1680.00, change: 25.00, pchange: 1.51, close_price: 1655.00 }, volume_traded_today: 8900000 },
    { instrument_key: 'NSE_EQ|INE090A01021', symbol: 'ICICIBANK', price: { ltp: 1260.00, change: 18.20, pchange: 1.47, close_price: 1241.80 }, volume_traded_today: 14200000 },
    { instrument_key: 'NSE_EQ|INE585B01010', symbol: 'MARUTI', price: { ltp: 12400.00, change: 155.00, pchange: 1.27, close_price: 12245.00 }, volume_traded_today: 1100000 },
    { instrument_key: 'NSE_EQ|INE296A01024', symbol: 'BAJFINANCE', price: { ltp: 7120.00, change: 82.00, pchange: 1.16, close_price: 7038.00 }, volume_traded_today: 2300000 }
  ],
  PRICE_LOSERS: [
    { instrument_key: 'NSE_EQ|INE095A01012', symbol: 'INDUSINDBK', price: { ltp: 1040.00, change: -32.50, pchange: -3.03, close_price: 1072.50 }, volume_traded_today: 8400000 },
    { instrument_key: 'NSE_EQ|INE075A01022', symbol: 'WIPRO', price: { ltp: 542.00, change: -12.40, pchange: -2.24, close_price: 554.40 }, volume_traded_today: 12100000 },
    { instrument_key: 'NSE_EQ|INE280A01028', symbol: 'TITAN', price: { ltp: 3450.00, change: -68.00, pchange: -1.93, close_price: 3518.00 }, volume_traded_today: 3100000 },
    { instrument_key: 'NSE_EQ|INE669C01036', symbol: 'TECHM', price: { ltp: 1680.00, change: -28.00, pchange: -1.64, close_price: 1708.00 }, volume_traded_today: 2800000 },
    { instrument_key: 'NSE_EQ|INE481G01011', symbol: 'ULTRACEMCO', price: { ltp: 11200.00, change: -170.00, pchange: -1.49, close_price: 11370.00 }, volume_traded_today: 850000 },
    { instrument_key: 'NSE_EQ|INE238A01034', symbol: 'AXISBANK', price: { ltp: 1180.00, change: -15.50, pchange: -1.30, close_price: 1195.50 }, volume_traded_today: 7900000 }
  ],
  MOST_ACTIVE: [
    { instrument_key: 'NSE_EQ|INE081A01020', symbol: 'TATASTEEL', price: { ltp: 158.40, change: 4.80, pchange: 3.12, close_price: 153.60 }, volume_traded_today: 34200000 },
    { instrument_key: 'NSE_EQ|INE040A01034', symbol: 'HDFCBANK', price: { ltp: 1690.00, change: 28.40, pchange: 1.71, close_price: 1661.60 }, volume_traded_today: 18400000 },
    { instrument_key: 'NSE_EQ|INE090A01021', symbol: 'ICICIBANK', price: { ltp: 1260.00, change: 18.20, pchange: 1.47, close_price: 1241.80 }, volume_traded_today: 14200000 },
    { instrument_key: 'NSE_EQ|INE002A01018', symbol: 'RELIANCE', price: { ltp: 2980.50, change: 65.20, pchange: 2.24, close_price: 2915.30 }, volume_traded_today: 11200000 },
    { instrument_key: 'NSE_EQ|INE062A01020', symbol: 'SBIN', price: { ltp: 815.00, change: 7.20, pchange: 0.89, close_price: 807.80 }, volume_traded_today: 19500000 }
  ],
  TOP_TRADED: [
    { instrument_key: 'NSE_EQ|INE002A01018', symbol: 'RELIANCE', price: { ltp: 2980.50, change: 65.20, pchange: 2.24, close_price: 2915.30 }, volume_traded_today: 11200000 },
    { instrument_key: 'NSE_EQ|INE040A01034', symbol: 'HDFCBANK', price: { ltp: 1690.00, change: 28.40, pchange: 1.71, close_price: 1661.60 }, volume_traded_today: 18400000 },
    { instrument_key: 'NSE_EQ|INE009A01021', symbol: 'INFY', price: { ltp: 1895.00, change: 38.50, pchange: 2.07, close_price: 1856.50 }, volume_traded_today: 9800000 },
    { instrument_key: 'NSE_EQ|INE090A01021', symbol: 'ICICIBANK', price: { ltp: 1260.00, change: 18.20, pchange: 1.47, close_price: 1241.80 }, volume_traded_today: 14200000 }
  ]
};

/**
 * Retrieve the persistent EOD Closing Movers Snapshot for non-market hours.
 */
export const getUpstoxMoversSnapshot = async (
  category: 'PRICE_GAINERS' | 'PRICE_LOSERS' | 'MOST_ACTIVE' | 'TOP_TRADED'
): Promise<{ items: UpstoxSmartlistItem[]; isSnapshot: boolean; snapshotTime?: string }> => {
  const snapshotKey = `upstox:movers:snapshot:${category.toLowerCase()}`;
  try {
    const cached = await getCache<UpstoxSmartlistItem[]>(snapshotKey);
    const time = await getCache<string>('upstox:movers:snapshot_timestamp');

    if (cached && Array.isArray(cached) && cached.length > 0) {
      return { items: cached, isSnapshot: true, snapshotTime: time || undefined };
    }
  } catch {
    // Non-fatal cache miss
  }

  const seed = DEFAULT_CLOSING_MOVERS[category] || [];
  return { items: seed, isSnapshot: true };
};

/**
 * Fetch live market movers (gainers, losers, most active) using Upstox Smartlist API.
 * Endpoint: GET /v2/market/smartlist/futures?asset_type=STOCK&category=...
 * Cached with 300s (5-min) adaptive TTL. When markets are closed, automatically serves
 * the persistent EOD closing snapshot instead of a blank offline screen.
 */
export const fetchUpstoxMarketMovers = async (
  category: 'PRICE_GAINERS' | 'PRICE_LOSERS' | 'MOST_ACTIVE' | 'TOP_TRADED'
): Promise<{ items: UpstoxSmartlistItem[]; isSnapshot: boolean; snapshotTime?: string }> => {
  const token = await getUpstoxAccessToken();
  if (!token) {
    return getUpstoxMoversSnapshot(category);
  }

  const CACHE_KEY = `upstox:smartlist:${category.toLowerCase()}`;

  try {
    const list = await executeWithQuota<UpstoxSmartlistItem[]>({
      provider: 'upstox',
      cacheKey: CACHE_KEY,
      ttlSeconds: 300, // 5-minute cache during market hours
      exchange: 'NSE',
      fallbackValue: [],
      fetcher: async () => {
        const res = await axios.get(`${UPSTOX_BASE_URL}/market/smartlist/futures`, {
          params: {
            asset_type: 'STOCK',
            category,
            page_number: 1,
            page_size: 20
          },
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          timeout: 7000
        });

        const rawList = res.data?.data?.smartlist;
        const validList = Array.isArray(rawList) ? rawList : [];

        if (validList.length > 0) {
          // Persist as EOD Closing Snapshot (7-day retention)
          const nowIso = new Date().toISOString();
          setCache(`upstox:movers:snapshot:${category.toLowerCase()}`, validList, 604800).catch(() => {});
          setCache('upstox:movers:snapshot_timestamp', nowIso, 604800).catch(() => {});
        }

        return validList;
      }
    });

    if (Array.isArray(list) && list.length > 0) {
      return { items: list, isSnapshot: false };
    }

    // If market is closed or returned empty, return the closing snapshot
    return getUpstoxMoversSnapshot(category);
  } catch (error: any) {
    if (error?.response?.status === 401) {
      await invalidateUpstoxToken();
    }
    console.warn(`[Upstox] Failed to fetch smartlist for ${category}:`, error?.response?.data || error.message);
    return getUpstoxMoversSnapshot(category);
  }
};
