import axios from 'axios';
import type { GlobalSentimentsData, FIIDIIFlow, GiftNiftyGapAnalysis } from '../types';

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined') {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!isLocal && (!envUrl || envUrl.includes('localhost') || envUrl.includes('127.0.0.1'))) {
      return '/api/v1';
    }
  }
  return envUrl || '/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

export interface GlobalSentimentsApiResponse extends GlobalSentimentsData {
  rateLimited?: boolean;
  nextAllowedSeconds?: number;
  syncIntervalSeconds?: number;
  message?: string;
}

export const fetchGlobalSentiments = async (forceRefresh: boolean = false): Promise<GlobalSentimentsApiResponse> => {
  try {
    const url = forceRefresh
      ? `${API_BASE_URL}/global-sentiments?force=true`
      : `${API_BASE_URL}/global-sentiments`;
    const res = await axios.get(url, { timeout: 25000 });
    if (res.data?.success && res.data?.data) {
      const result: GlobalSentimentsApiResponse = {
        ...res.data.data,
        rateLimited: res.data.rateLimited,
        nextAllowedSeconds: res.data.nextAllowedSeconds,
        syncIntervalSeconds: res.data.syncIntervalSeconds || 600,
        message: res.data.message
      };
      return result;
    }
    throw new Error(res.data?.message || 'Invalid server response');
  } catch (error: any) {
    console.error('Error fetching global sentiments from backend:', error.message);
    throw error;
  }
};

export const fetchFIIDIIHistory = async (forceRefresh: boolean = false): Promise<FIIDIIFlow[]> => {
  try {
    const url = forceRefresh
      ? `${API_BASE_URL}/global-sentiments/fii-dii?force=true`
      : `${API_BASE_URL}/global-sentiments/fii-dii`;
    const res = await axios.get(url, { timeout: 15000 });
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return [];
  } catch (error: any) {
    console.error('Error fetching FII/DII history:', error.message);
    return [];
  }
};

export const fetchGiftNiftyGap = async (): Promise<GiftNiftyGapAnalysis | null> => {
  try {
    const res = await axios.get(`${API_BASE_URL}/global-sentiments/gift-nifty-gap`, { timeout: 15000 });
    if (res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (error: any) {
    console.error('Error fetching GIFT Nifty gap:', error.message);
    return null;
  }
};
