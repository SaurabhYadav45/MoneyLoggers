import api from './api';

export interface OmniSearchStockResult {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  dayChangePercent: number;
  marketCapCategory?: string;
  marketCap?: number;
}

export interface OmniSearchMutualFundResult {
  id: string;
  schemeCode: number;
  name: string;
  fundHouse: string;
  category: string;
  subCategory?: string;
  nav: number;
  returns3Y?: number;
}

export interface OmniSearchIPOResult {
  id: string;
  symbol: string;
  name: string;
  segment: string;
  status: string;
  issuePrice: number;
  estimatedGainPercent?: number;
}

export interface OmniSearchPageResult {
  title: string;
  description: string;
  path: string;
  category: string;
  keywords: string[];
}

export interface OmniSearchNewsResult {
  id: string;
  title: string;
  category: string;
  source: string;
  publishedAt: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  relatedSymbols?: string[];
}

export interface OmniSearchResponse {
  query: string;
  totalHits: number;
  stocks: OmniSearchStockResult[];
  mutualFunds: OmniSearchMutualFundResult[];
  ipos: OmniSearchIPOResult[];
  pages: OmniSearchPageResult[];
  news?: OmniSearchNewsResult[];
}

/**
 * Fetch unified search across stocks, mutual funds, IPOs, and platform pages
 */
export const fetchOmniSearch = async (
  query: string,
  signal?: AbortSignal
): Promise<OmniSearchResponse> => {
  const response = await api.get('/search', {
    params: { q: query },
    signal,
  });
  return response.data;
};
