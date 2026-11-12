import apiInstance, * as api from './api';
import type { Stock, MarketIndex, NewsItem } from '../types';

export interface UpstoxStatusResponse {
  success: boolean;
  configured: boolean;
  hasActiveToken: boolean;
  tokenInfo?: {
    status: 'ACTIVE' | 'EXPIRED';
    obtainedAt?: string;
    expiresIn?: number;
    expiredAt?: string;
  } | null;
  message: string;
}

export const getUpstoxStatus = async (): Promise<UpstoxStatusResponse> => {
  const res = await apiInstance.get('/stocks/upstox/status', { skipCache: true });
  return res.data;
};

export const getUpstoxAuthUrl = async (): Promise<{ success: boolean; url: string }> => {
  const res = await apiInstance.get('/stocks/upstox/auth-url', { skipCache: true });
  return res.data;
};

export const disconnectUpstox = async (): Promise<{ success: boolean; message: string }> => {
  const res = await apiInstance.post('/stocks/upstox/disconnect');
  return res.data;
};

// Service functions
export const getTopGainers = async (): Promise<Stock[]> => {
  try {
    const data = await api.getTopGainers();
    return data.map((item: any) => ({
      ...item,
      pct: item.pct ?? item.changePercent ?? 0,
      changePercent: item.changePercent ?? item.pct ?? 0,
    }));
  } catch (error) {
    console.error('Error fetching top gainers:', error);
    return [];
  }
};

export const getTopLosers = async (): Promise<Stock[]> => {
  try {
    const data = await api.getTopLosers();
    return data.map((item: any) => ({
      ...item,
      pct: item.pct ?? item.changePercent ?? 0,
      changePercent: item.changePercent ?? item.pct ?? 0,
    }));
  } catch (error) {
    console.error('Error fetching top losers:', error);
    return [];
  }
};

export const getMostActive = async (): Promise<Stock[]> => {
  try {
    const data = await api.getMostActive();
    return data.map((item: any) => ({
      ...item,
      pct: item.pct ?? item.changePercent ?? 0,
      changePercent: item.changePercent ?? item.pct ?? 0,
    }));
  } catch (error) {
    console.error('Error fetching most active stocks:', error);
    return [];
  }
};

export const getBreakouts = async (): Promise<Stock[]> => {
  try {
    const data = await api.getBreakouts();
    return data.map((item: any) => ({
      ...item,
      pct: item.pct ?? item.changePercent ?? 0,
      changePercent: item.changePercent ?? item.pct ?? 0,
    }));
  } catch (error) {
    console.error('Error fetching breakouts:', error);
    return [];
  }
};

export const getMarketIndices = async (): Promise<MarketIndex[]> => {
  try {
    const data = await api.getMarketIndices();
    return data.map((item: any) => ({
      ...item,
      pct: item.pct ?? item.changePercent ?? 0,
      changePercent: item.changePercent ?? item.pct ?? 0,
    }));
  } catch (error) {
    console.error('Error fetching market indices:', error);
    return [];
  }
};

export const getHistoricalChart = async (symbol: string, range: string = '1mo', interval?: string) => {
  try {
    return await api.fetchChartData(symbol, range, interval);
  } catch (error) {
    console.error(`Error fetching chart data for ${symbol}:`, error);
    return null;
  }
};

export const getLatestNews = async (): Promise<NewsItem[]> => {
  try {
    return await api.getLatestNews();
  } catch (error) {
    console.error('Error fetching latest news:', error);
    return [];
  }
};

export const searchStocks = async (query: string): Promise<Stock[]> => {
  try {
    const data = await api.searchStocks(query);
    return data.map((item: any) => ({
      ...item,
      pct: item.pct ?? item.changePercent ?? 0,
      changePercent: item.changePercent ?? item.pct ?? 0,
    }));
  } catch (error) {
    console.error('Error searching stocks:', error);
    return [];
  }
};
