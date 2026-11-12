import api from './api';
import type { NewsFeedResponse, NewsItem, NewsSentimentSummary, NewsFilterParams } from '../types';

export const fetchNewsFeed = async (params: NewsFilterParams = {}): Promise<NewsFeedResponse> => {
  try {
    const cleanParams: Record<string, any> = {};
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.category && params.category !== 'All') cleanParams.category = params.category;
    if (params.sector && params.sector !== 'All Sectors') cleanParams.sector = params.sector;
    if (params.sentiment && params.sentiment !== 'All') cleanParams.sentiment = params.sentiment;
    if (params.symbol) cleanParams.symbol = params.symbol;
    if (params.search) cleanParams.search = params.search;

    const res = await api.get('/news', { params: cleanParams });
    return res.data;
  } catch (error) {
    console.error('Error fetching news feed:', error);
    return {
      items: [],
      pagination: { total: 0, page: 1, limit: 20, totalPages: 1 }
    };
  }
};

export const fetchBreakingNews = async (): Promise<NewsItem[]> => {
  try {
    const res = await api.get('/news/breaking');
    return res.data;
  } catch (error) {
    console.error('Error fetching breaking news:', error);
    return [];
  }
};

export const fetchSentimentSummary = async (): Promise<NewsSentimentSummary | null> => {
  try {
    const res = await api.get('/news/sentiment-summary');
    return res.data;
  } catch (error) {
    console.error('Error fetching sentiment summary:', error);
    return null;
  }
};

export interface NewsSyncStatus {
  success: boolean;
  isSyncing: boolean;
  message: string;
  lastSyncedAt?: string;
  nextSyncInSeconds?: number;
}

export const fetchNewsSyncStatus = async (): Promise<NewsSyncStatus> => {
  try {
    const res = await api.get('/news/sync-status');
    return res.data;
  } catch (error) {
    return { success: false, isSyncing: false, message: '' };
  }
};

export const triggerNewsSync = async (): Promise<{ count?: number; message: string; lastSyncedAt?: string; isSyncing?: boolean; nextSyncInSeconds?: number }> => {
  try {
    const res = await api.post('/news/sync');
    return res.data;
  } catch (error: any) {
    console.error('Error triggering news sync:', error);
    return {
      message: error?.response?.data?.message || 'Feed is already up to date.'
    };
  }
};
