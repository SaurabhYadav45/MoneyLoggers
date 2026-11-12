import axios from 'axios';
import type { Stock, MarketIndex, NewsItem } from '../types';

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipCache?: boolean;
    cacheTtl?: number;
  }
}

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  // When accessed from a phone/tablet (LAN IP), never route requests to the phone's localhost
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal && (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return '/api/v1';
    }
  }
  return envUrl || '/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token & admin key
api.interceptors.request.use((config: any) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const adminKey = sessionStorage.getItem('moneylogger_admin_key');
  if (adminKey && config.headers) {
    config.headers['x-admin-key'] = adminKey;
  }

  return config;
});

// Response interceptor to handle errors gracefully
api.interceptors.response.use(
  (response: any) => response,
  (error: any) => {
    // If admin key was rejected, clear stored admin key
    if (error.response?.status === 401 && error.config?.headers?.['x-admin-key']) {
      sessionStorage.removeItem('moneylogger_admin_key');
    }
    return Promise.reject(error);
  }
);

// =========================================================================
// SMART CLIENT-SIDE RESPONSE CACHE & IN-FLIGHT DEDUPLICATION
// Eliminates redundant backend requests when navigating across pages and sections
// =========================================================================

interface CacheEntry {
  response: any;
  timestamp: number;
  ttl: number;
}

const apiCache = new Map<string, CacheEntry>();
const inFlightRequests = new Map<string, Promise<any>>();

export const clearApiCache = (pattern?: string | RegExp): void => {
  if (!pattern) {
    apiCache.clear();
    return;
  }
  for (const key of Array.from(apiCache.keys())) {
    const match = typeof pattern === 'string' ? key.includes(pattern) : pattern.test(key);
    if (match) {
      apiCache.delete(key);
    }
  }
};

const resolveTtl = (url: string, customTtl?: number): number => {
  if (typeof customTtl === 'number') return customTtl;
  if (url.includes('/ipos')) return 5 * 60 * 1000; // 5 mins fresh for IPO listings
  if (url.includes('/news')) return 3 * 60 * 1000; // 3 mins for news
  if (url.includes('/stocks/screener/summary') || url.includes('/stocks/screener/presets')) {
    return 10 * 60 * 1000; // 10 mins for screener presets & market summary
  }
  if (url.includes('/stocks/screener')) return 3 * 60 * 1000; // 3 mins for stock screener query results
  if (url.includes('/mutual-funds/collections') || url.includes('/mutual-funds/fund-houses')) {
    return 10 * 60 * 1000; // 10 mins for MF metadata
  }
  if (url.includes('/mutual-funds')) return 5 * 60 * 1000; // 5 mins for mutual funds
  if (url.includes('/stocks/gainers') || url.includes('/stocks/losers') || url.includes('/stocks/active') || url.includes('/stocks/breakouts')) {
    return 5 * 60 * 1000; // 5 mins for live market movers
  }
  if (url.includes('/stocks/indices')) {
    return 60 * 1000; // 1 min for live market indices
  }
  return 2 * 60 * 1000; // 2 mins default
};

const originalGet = api.get.bind(api);
(api as any).get = async (url: string, config?: any) => {
  const skipCache = config?.skipCache || config?.headers?.['x-skip-cache'] === 'true' || url.includes('skipCache=true');
  const ttl = resolveTtl(url, config?.cacheTtl);
  const serializedParams = config?.params ? JSON.stringify(config.params) : '';
  const cacheKey = `GET:${url}:${serializedParams}`;

  if (!skipCache) {
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.response;
    }

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey);
    }
  }

  const promise = originalGet(url, config)
    .then((res: any) => {
      if (!skipCache && res?.status >= 200 && res?.status < 300) {
        apiCache.set(cacheKey, {
          response: res,
          timestamp: Date.now(),
          ttl,
        });
      }
      return res;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  if (!skipCache) {
    inFlightRequests.set(cacheKey, promise);
  }

  return promise;
};

// Invalidate cache on mutations (POST, PUT, PATCH, DELETE)
const originalPost = api.post.bind(api);
(api as any).post = async (url: string, data?: any, config?: any) => {
  const res = await originalPost(url, data, config);
  if (url.includes('/ipos')) clearApiCache('/ipos');
  if (url.includes('/news')) clearApiCache('/news');
  if (url.includes('/portfolio')) clearApiCache('/portfolio');
  if (url.includes('/mutual-funds')) clearApiCache('/mutual-funds');
  return res;
};

const originalPut = api.put.bind(api);
(api as any).put = async (url: string, data?: any, config?: any) => {
  const res = await originalPut(url, data, config);
  if (url.includes('/ipos')) clearApiCache('/ipos');
  if (url.includes('/news')) clearApiCache('/news');
  if (url.includes('/portfolio')) clearApiCache('/portfolio');
  return res;
};

const originalPatch = api.patch.bind(api);
(api as any).patch = async (url: string, data?: any, config?: any) => {
  const res = await originalPatch(url, data, config);
  if (url.includes('/ipos')) clearApiCache('/ipos');
  if (url.includes('/news')) clearApiCache('/news');
  if (url.includes('/portfolio')) clearApiCache('/portfolio');
  return res;
};

const originalDelete = api.delete.bind(api);
(api as any).delete = async (url: string, config?: any) => {
  const res = await originalDelete(url, config);
  if (url.includes('/ipos')) clearApiCache('/ipos');
  if (url.includes('/news')) clearApiCache('/news');
  if (url.includes('/portfolio')) clearApiCache('/portfolio');
  return res;
};

// Auth APIs
export const register = (userData: { name: string; email: string; password: string }) => {
  return api.post('/auth/register', userData);
};

export const login = (credentials: { email: string; password: string }) => {
  return api.post('/auth/login', credentials);
};

// Stock APIs
export const getTopGainers = async (): Promise<Stock[]> => {
  const response = await api.get('/stocks/gainers');
  return response.data;
};

export const getTopLosers = async (): Promise<Stock[]> => {
  const response = await api.get('/stocks/losers');
  return response.data;
};

export const getMostActive = async (): Promise<Stock[]> => {
  const response = await api.get('/stocks/active');
  return response.data;
};

export const getBreakouts = async (): Promise<Stock[]> => {
  const response = await api.get('/stocks/breakouts');
  return response.data;
};

export const getMarketIndices = async (): Promise<MarketIndex[]> => {
  const response = await api.get('/stocks/indices');
  return response.data;
};

export const fetchChartData = async (symbol: string, range: string = '1mo', interval?: string) => {
  const params = new URLSearchParams({ range });
  if (interval) params.append('interval', interval);
  const response = await api.get(`/stocks/chart/${encodeURIComponent(symbol)}?${params.toString()}`);
  return response.data;
};

export const getLatestNews = async (): Promise<NewsItem[]> => {
  const response = await api.get('/stocks/news');
  return response.data;
};

export const searchStocks = async (query: string): Promise<Stock[]> => {
  const response = await api.get(`/stocks/search?query=${query}`);
  return response.data;
};

export default api;
