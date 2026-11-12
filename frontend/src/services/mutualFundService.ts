import api from './api';
import type { MutualFund, MutualFundDetail } from '../types';

export interface ScreenerParams {
  category?: string;
  subCategory?: string;
  fundHouse?: string;
  search?: string;
  collection?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  refresh?: boolean;
}

export interface ScreenerResponse {
  funds: MutualFund[];
  total: number;
  page: number;
  totalPages: number;
}

export interface CuratedCollection {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  count: number;
  gradient: string;
}

export interface ChartPoint {
  date: string;
  nav: number;
  benchmarkNav: number;
  returnPct: number;
}

export interface ChartResponse {
  schemeCode: number;
  range: string;
  benchmark: string;
  points: ChartPoint[];
}

// =========================================================================
// IN-MEMORY CLIENT CACHE
// Eliminates redundant backend requests when navigating across pages and tabs
// =========================================================================
interface InMemoryCacheEntry<T> {
  data: T;
  timestamp: number;
}

const screenerCache = new Map<string, InMemoryCacheEntry<ScreenerResponse>>();
const detailCache = new Map<string, InMemoryCacheEntry<MutualFundDetail>>();
const chartCache = new Map<string, InMemoryCacheEntry<ChartResponse>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes fresh in-memory

export const getCachedScreener = (key: string): ScreenerResponse | null => {
  const entry = screenerCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
    return entry.data;
  }
  return null;
};

export const setCachedScreener = (key: string, data: ScreenerResponse): void => {
  screenerCache.set(key, { data, timestamp: Date.now() });
};

export const clearMutualFundMemoryCache = (): void => {
  screenerCache.clear();
  detailCache.clear();
  chartCache.clear();
};

// Fetch screener funds with filtering, sorting, pagination, and client in-memory cache
export const getScreenerFunds = async (params: ScreenerParams = {}): Promise<ScreenerResponse> => {
  const cacheKey = JSON.stringify(params);

  // Return in-memory cached response if not a force-refresh
  if (!params.refresh) {
    const memCached = getCachedScreener(cacheKey);
    if (memCached) {
      return memCached;
    }
  } else {
    screenerCache.delete(cacheKey);
  }

  try {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.subCategory && params.subCategory !== 'all') query.append('subCategory', params.subCategory);
    if (params.fundHouse && params.fundHouse !== 'all') query.append('fundHouse', params.fundHouse);
    if (params.search) query.append('search', params.search);
    if (params.collection && params.collection !== 'all') query.append('collection', params.collection);
    if (params.sortBy) query.append('sortBy', params.sortBy);
    if (params.sortOrder) query.append('sortOrder', params.sortOrder);
    if (params.page) query.append('page', String(params.page));
    if (params.limit) query.append('limit', String(params.limit));
    if (params.refresh) query.append('refresh', 'true');

    const res = await api.get(`/mutual-funds?${query.toString()}`);
    const result: ScreenerResponse = {
      funds: res.data.data || [],
      total: res.data.total || 0,
      page: res.data.page || 1,
      totalPages: res.data.totalPages || 1
    };

    setCachedScreener(cacheKey, result);
    return result;
  } catch (error: any) {
    console.error('Error fetching screener mutual funds:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch mutual funds');
  }
};

// Fetch curated collections
export const getCuratedCollections = async (): Promise<CuratedCollection[]> => {
  try {
    const res = await api.get('/mutual-funds/collections');
    return res.data.data || [];
  } catch (error: any) {
    console.error('Error fetching curated collections:', error);
    return [];
  }
};

// Fetch available real fund houses from backend
export const getFundHouses = async (): Promise<string[]> => {
  try {
    const res = await api.get('/mutual-funds/fund-houses');
    return res.data.data || [];
  } catch (error: any) {
    console.error('Error fetching fund houses:', error);
    return [];
  }
};

// Search mutual funds by name, AMC, or code
export const searchMutualFunds = async (query: string): Promise<MutualFund[]> => {
  try {
    const response = await api.get(`/mutual-funds/search?q=${encodeURIComponent(query)}`);
    return response.data.data || [];
  } catch (error: any) {
    console.error('Error searching mutual funds:', error);
    throw new Error(error.response?.data?.message || 'Failed to search mutual funds');
  }
};

// Get single mutual fund detailed analytics (with in-memory cache)
export const getMutualFundDetails = async (schemeCode: string | number, skipCache = false): Promise<MutualFundDetail> => {
  const key = String(schemeCode);
  if (!skipCache) {
    const entry = detailCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
  }

  try {
    const response = await api.get(`/mutual-funds/${schemeCode}`);
    const data = response.data.data;
    detailCache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error: any) {
    console.error(`Error fetching mutual fund details for scheme ${schemeCode}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to fetch mutual fund details');
  }
};

// Get downsampled interactive NAV chart (with in-memory cache)
export const getMutualFundChart = async (
  schemeCode: string | number,
  range: string = '1Y',
  skipCache = false
): Promise<ChartResponse> => {
  const key = `${schemeCode}:${range}`;
  if (!skipCache) {
    const entry = chartCache.get(key);
    if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
      return entry.data;
    }
  }

  try {
    const response = await api.get(`/mutual-funds/${schemeCode}/chart?range=${range}`);
    const data = response.data.data;
    chartCache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error: any) {
    console.error(`Error fetching chart for scheme ${schemeCode}:`, error);
    throw new Error(error.response?.data?.message || 'Failed to fetch chart data');
  }
};

// Compare multiple funds
export const compareMutualFunds = async (schemeCodes: Array<number | string>): Promise<MutualFundDetail[]> => {
  try {
    const res = await api.get(`/mutual-funds/compare?codes=${schemeCodes.join(',')}`);
    return res.data.data || [];
  } catch (error: any) {
    console.error('Error comparing mutual funds:', error);
    throw new Error(error.response?.data?.message || 'Failed to compare mutual funds');
  }
};

// Legacy backward-compatible methods
export const getMutualFundHistory = async (schemeCode: string) => {
  return getMutualFundChart(schemeCode, '1Y');
};

export const listMutualFunds = async (limit: number = 50, offset: number = 0) => {
  const page = Math.floor(offset / limit) + 1;
  const data = await getScreenerFunds({ page, limit });
  return data.funds;
};
// Force sync & refresh all mutual funds from live APIs
export const syncMutualFunds = async () => {
  const res = await api.post('/mutual-funds/sync');
  return res.data;
};
