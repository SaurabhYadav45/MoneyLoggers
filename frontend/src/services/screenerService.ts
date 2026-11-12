import api from './api';
import type { ScreenerStock, ScreenerFilters, ScreenerPreset } from '../types';

export interface ScreenerResponse {
  stocks: ScreenerStock[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ScreenerSummary {
  totalStocks: number;
  sectors: Array<{
    name: string;
    count: number;
    avgChange: number;
    avgPe: number;
  }>;
  topGainers: ScreenerStock[];
  topLosers: ScreenerStock[];
  presets: ScreenerPreset[];
}

// Convert frontend ScreenerFilters to backend query params
export const buildScreenerQueryParams = (
  filters: Partial<ScreenerFilters>,
  page = 1,
  limit = 20,
  sortBy = 'marketCap',
  sortOrder: 'asc' | 'desc' = 'desc'
): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.search) params.append('search', filters.search);
  if (filters.sector && filters.sector !== 'all') params.append('sector', filters.sector);
  if (filters.marketCap && filters.marketCap !== 'all') {
    const mapCap: Record<string, string> = {
      large: 'Large',
      mid: 'Mid',
      small: 'Small'
    };
    params.append('marketCapCategory', mapCap[filters.marketCap] || filters.marketCap);
  }

  if (filters.priceRange) {
    if (filters.priceRange[0] > 0) params.append('minPrice', String(filters.priceRange[0]));
    if (filters.priceRange[1] < 100000) params.append('maxPrice', String(filters.priceRange[1]));
  }

  if (filters.peRatioRange) {
    if (filters.peRatioRange[0] > 0) params.append('minPe', String(filters.peRatioRange[0]));
    if (filters.peRatioRange[1] < 150) params.append('maxPe', String(filters.peRatioRange[1]));
  }

  if (filters.pbRatioRange) {
    if (filters.pbRatioRange[0] > 0) params.append('minPb', String(filters.pbRatioRange[0]));
    if (filters.pbRatioRange[1] < 40) params.append('maxPb', String(filters.pbRatioRange[1]));
  }

  if (filters.roeRange) {
    if (filters.roeRange[0] > 0) params.append('minRoe', String(filters.roeRange[0]));
    if (filters.roeRange[1] < 100) params.append('maxRoe', String(filters.roeRange[1]));
  }

  if (filters.roceRange) {
    if (filters.roceRange[0] > 0) params.append('minRoce', String(filters.roceRange[0]));
    if (filters.roceRange[1] < 100) params.append('maxRoce', String(filters.roceRange[1]));
  }

  if (filters.deRange) {
    if (filters.deRange[0] > 0) params.append('minDebtToEquity', String(filters.deRange[0]));
    if (filters.deRange[1] < 5) params.append('maxDebtToEquity', String(filters.deRange[1]));
  }

  if (filters.dividendYieldRange) {
    if (filters.dividendYieldRange[0] > 0) params.append('minDividendYield', String(filters.dividendYieldRange[0]));
    if (filters.dividendYieldRange[1] < 15) params.append('maxDividendYield', String(filters.dividendYieldRange[1]));
  }

  if (filters.rsiRange) {
    if (filters.rsiRange[0] > 0) params.append('minRsi', String(filters.rsiRange[0]));
    if (filters.rsiRange[1] < 100) params.append('maxRsi', String(filters.rsiRange[1]));
  }

  if (filters.revenueGrowthRange) {
    if (filters.revenueGrowthRange[0] > -50) params.append('minRevGrowth', String(filters.revenueGrowthRange[0]));
    if (filters.revenueGrowthRange[1] < 100) params.append('maxRevGrowth', String(filters.revenueGrowthRange[1]));
  }

  if (filters.profitGrowthRange) {
    if (filters.profitGrowthRange[0] > -50) params.append('minProfitGrowth', String(filters.profitGrowthRange[0]));
    if (filters.profitGrowthRange[1] < 100) params.append('maxProfitGrowth', String(filters.profitGrowthRange[1]));
  }

  if (filters.above200dma !== null && filters.above200dma !== undefined) {
    params.append('above200dma', String(filters.above200dma));
  }

  if (filters.preset) {
    params.append('preset', filters.preset);
  }

  if (filters.customQuery) {
    params.append('customQuery', filters.customQuery);
  }

  params.append('page', String(page));
  params.append('limit', String(limit));
  params.append('sortBy', sortBy);
  params.append('sortOrder', sortOrder);

  return params;
};

// Fetch stocks with filtering, sorting, and pagination
export const fetchScreenerStocks = async (
  filters: Partial<ScreenerFilters>,
  page = 1,
  limit = 20,
  sortBy = 'marketCap',
  sortOrder: 'asc' | 'desc' = 'desc',
  skipCache = false
): Promise<ScreenerResponse> => {
  try {
    const params = buildScreenerQueryParams(filters, page, limit, sortBy, sortOrder);
    const res = await api.get(`/stocks/screener?${params.toString()}`, { skipCache });
    return {
      stocks: res.data.data || [],
      total: res.data.total || 0,
      page: res.data.page || 1,
      limit: res.data.limit || 20,
      totalPages: res.data.totalPages || 1
    };
  } catch (error: any) {
    console.error('Error fetching screener stocks:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch screener stocks');
  }
};

// Fetch screener market summary, presets, and sector stats
export const fetchScreenerSummary = async (skipCache = false): Promise<ScreenerSummary> => {
  try {
    const res = await api.get('/stocks/screener/summary', { skipCache });
    return res.data.data;
  } catch (error: any) {
    console.error('Error fetching screener summary:', error);
    throw new Error(error.response?.data?.message || 'Failed to fetch screener summary');
  }
};

// Fetch single stock profile
export const fetchStockProfile = async (symbol: string): Promise<ScreenerStock> => {
  try {
    const res = await api.get(`/stocks/${symbol}`);
    return res.data.data;
  } catch (error: any) {
    console.error(`Error fetching stock profile for "${symbol}":`, error);
    throw new Error(error.response?.data?.message || 'Failed to fetch stock profile');
  }
};

// Export to CSV URL generator
export const getExportCsvUrl = (filters: Partial<ScreenerFilters>): string => {
  const base = import.meta.env.VITE_API_URL || '/api/v1';
  const params = buildScreenerQueryParams(filters, 1, 500);
  return `${base}/stocks/screener/export?${params.toString()}`;
};
