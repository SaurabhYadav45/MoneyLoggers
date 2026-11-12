import axios from 'axios';
import Parser from 'rss-parser';
import prisma from '../lib/prisma';
import { getCache, setCache } from '../lib/redis';
import { CURATED_STOCK_SYMBOLS } from './stockSyncService';

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
  }
});

// Common company name to ticker mappings
const COMPANY_NAME_MAP: Record<string, string> = {
  'reliance': 'RELIANCE',
  'tcs': 'TCS',
  'tata consultancy': 'TCS',
  'infosys': 'INFY',
  'infy': 'INFY',
  'wipro': 'WIPRO',
  'hcl tech': 'HCLTECH',
  'hcltech': 'HCLTECH',
  'tech mahindra': 'TECHM',
  'ltimindtree': 'LTIM',
  'ltim': 'LTIM',
  'hdfc bank': 'HDFCBANK',
  'hdfc': 'HDFCBANK',
  'icici bank': 'ICICIBANK',
  'icici': 'ICICIBANK',
  'sbi': 'SBIN',
  'state bank': 'SBIN',
  'kotak': 'KOTAKBANK',
  'kotak bank': 'KOTAKBANK',
  'axis bank': 'AXISBANK',
  'axis': 'AXISBANK',
  'bajaj finance': 'BAJFINANCE',
  'bajaj finserv': 'BAJAJFINSV',
  'tata motors': 'TATAMOTORS',
  'maruti': 'MARUTI',
  'maruti suzuki': 'MARUTI',
  'mahindra & mahindra': 'M&M',
  'm&m': 'M&M',
  'bajaj auto': 'BAJAJ-AUTO',
  'tvs motor': 'TVSMOTOR',
  'eicher': 'EICHERMOT',
  'sun pharma': 'SUNPHARMA',
  'dr reddy': 'DRREDDY',
  'cipla': 'CIPLA',
  'apollo hospitals': 'APOLLOHOSP',
  'tata steel': 'TATASTEEL',
  'jsw steel': 'JSWSTEEL',
  'hindalco': 'HINDALCO',
  'vedanta': 'VEDL',
  'itc': 'ITC',
  'hindustan unilever': 'HINDUNILVR',
  'hul': 'HINDUNILVR',
  'nestle': 'NESTLEIND',
  'britannia': 'BRITANNIA',
  'tata consumer': 'TATACONSUM',
  'airtel': 'BHARTIARTL',
  'bharti airtel': 'BHARTIARTL',
  'zomato': 'ZOMATO',
  'l&t': 'LT',
  'larsen & toubro': 'LT',
  'adani ports': 'ADANIPORTS',
  'adani': 'ADANIPORTS',
  'ultratech': 'ULTRACEMCO',
  'ntpc': 'NTPC',
  'power grid': 'POWERGRID',
  'coal india': 'COALINDIA',
  'tata power': 'TATAPOWER',
  'suzlon': 'SUZLON',
  'pnb': 'PNB',
  'canara bank': 'CANBK',
  'union bank': 'UNIONBANK'
};

// Financial Sentiment Dictionaries (Loughran-McDonald Heuristics)
const BULLISH_KEYWORDS = [
  'surge', 'surges', 'surging', 'surged',
  'jump', 'jumps', 'jumping', 'jumped',
  'soar', 'soars', 'soaring', 'soared',
  'rally', 'rallies', 'rallying', 'rallied',
  'gain', 'gains', 'gained',
  'rise', 'rises', 'rising', 'rose',
  'record high', 'all-time high', '52-week high',
  'profit jumps', 'profit up', 'profit rises', 'q2 profit up', 'q3 profit up',
  'upgrade', 'upgrades', 'upgraded',
  'outperform', 'beat', 'beats', 'beating',
  'rebound', 'rebounds', 'rebounding',
  'bullish', 'boom', 'dividend hike', 'order win', 'mega deal',
  'turnaround', 'strong growth', 'target raised', 'target price hike'
];

const BEARISH_KEYWORDS = [
  'fall', 'falls', 'falling', 'fell',
  'slump', 'slumps', 'slumping', 'slumped',
  'drop', 'drops', 'dropping', 'dropped',
  'crash', 'crashes', 'crashing', 'crashed',
  'decline', 'declines', 'declining', 'declined',
  'slip', 'slips', 'slipping', 'slipped',
  'plunge', 'plunges', 'plunging', 'plunged',
  'slide', 'slides', 'sliding',
  'loss', 'losses', 'profit falls', 'profit down', 'net loss',
  'downgrade', 'downgrades', 'downgraded',
  'probe', 'investigation', 'fraud', 'scam', 'penalty', 'fine',
  'default', 'debt crisis', 'halt', 'halts',
  'selloff', 'bearish', 'inflation rises', 'warning', 'weakness',
  'cuts target', 'disappoints', 'downturn'
];

const HIGH_IMPACT_KEYWORDS = [
  'q2 results', 'q3 results', 'q4 results', 'q1 results',
  'rbi monetary policy', 'repo rate', 'fed rate', 'interest rate',
  'breaking', 'urgent', 'ipo gmp', 'allotment status', 'listing day',
  'halt', 'sebi order', 'us fda inspection', 'acquisition', 'merger',
  'delisting', 'bonus issue', 'stock split', 'crashes', 'surges'
];

// Helper to determine sentiment
export const calculateSentiment = (text: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' => {
  const lower = text.toLowerCase();
  let bullScore = 0;
  let bearScore = 0;

  for (const word of BULLISH_KEYWORDS) {
    if (lower.includes(word)) bullScore++;
  }
  for (const word of BEARISH_KEYWORDS) {
    if (lower.includes(word)) bearScore++;
  }

  if (bullScore > bearScore) return 'BULLISH';
  if (bearScore > bullScore) return 'BEARISH';
  return 'NEUTRAL';
};

// Helper to calculate impact level
export const calculateImpact = (text: string): 'HIGH' | 'NORMAL' => {
  const lower = text.toLowerCase();
  for (const word of HIGH_IMPACT_KEYWORDS) {
    if (lower.includes(word)) return 'HIGH';
  }
  return 'NORMAL';
};

// Helper to detect related stock ticker symbols
export const extractRelatedSymbols = (text: string): string[] => {
  const lower = text.toLowerCase();
  const matched = new Set<string>();

  // Check company names first
  for (const [name, ticker] of Object.entries(COMPANY_NAME_MAP)) {
    // Regex for word boundary
    const regex = new RegExp(`\\b${name}\\b`, 'i');
    if (regex.test(lower)) {
      matched.add(ticker);
    }
  }

  // Also check exact symbols
  for (const symbol of CURATED_STOCK_SYMBOLS) {
    const symbolRegex = new RegExp(`\\b${symbol}\\b`, 'i');
    if (symbolRegex.test(text)) {
      matched.add(symbol);
    }
  }

  return Array.from(matched).slice(0, 4);
};

// Sector Classifier
export const classifySector = (text: string): string => {
  const lower = text.toLowerCase();

  if (
    lower.includes('bank') || lower.includes('nbfc') || lower.includes('rbi') ||
    lower.includes('repo') || lower.includes('credit') || lower.includes('loan') ||
    lower.includes('npa') || lower.includes('hdfc') || lower.includes('icici') ||
    lower.includes('sbi') || lower.includes('pnb') || lower.includes('fintech')
  ) {
    return 'Banking & Finance';
  }

  if (
    lower.includes('it ') || lower.includes('tech') || lower.includes('software') ||
    lower.includes('cloud') || lower.includes('ai') || lower.includes('tcs') ||
    lower.includes('infosys') || lower.includes('wipro') || lower.includes('hcl') ||
    lower.includes('saas') || lower.includes('semiconductor')
  ) {
    return 'IT & Tech';
  }

  if (
    lower.includes('auto') || lower.includes('car') || lower.includes('vehicle') ||
    lower.includes('ev ') || lower.includes('electric vehicle') || lower.includes('maruti') ||
    lower.includes('tata motors') || lower.includes('bajaj auto') || lower.includes('suv')
  ) {
    return 'Automobile';
  }

  if (
    lower.includes('pharma') || lower.includes('healthcare') || lower.includes('drug') ||
    lower.includes('hospital') || lower.includes('fda') || lower.includes('medicine') ||
    lower.includes('vaccine') || lower.includes('sun pharma') || lower.includes('cipla')
  ) {
    return 'Pharma & Healthcare';
  }

  if (
    lower.includes('oil') || lower.includes('crude') || lower.includes('gas') ||
    lower.includes('energy') || lower.includes('power') || lower.includes('petrol') ||
    lower.includes('diesel') || lower.includes('renewable') || lower.includes('solar') ||
    lower.includes('reliance') || lower.includes('omc') || lower.includes('ntpc')
  ) {
    return 'Energy & Power';
  }

  if (
    lower.includes('fmcg') || lower.includes('consumer') || lower.includes('retail') ||
    lower.includes('food') || lower.includes('beverage') || lower.includes('itc') ||
    lower.includes('hul') || lower.includes('nestle') || lower.includes('sugar')
  ) {
    return 'Consumer & FMCG';
  }

  if (
    lower.includes('steel') || lower.includes('metal') || lower.includes('mining') ||
    lower.includes('copper') || lower.includes('gold') || lower.includes('silver') ||
    lower.includes('aluminum') || lower.includes('iron') || lower.includes('vedanta')
  ) {
    return 'Metals & Mining';
  }

  if (
    lower.includes('realty') || lower.includes('real estate') || lower.includes('infrastructure') ||
    lower.includes('cement') || lower.includes('construction') || lower.includes('port') ||
    lower.includes('l&t') || lower.includes('adani') || lower.includes('dlf')
  ) {
    return 'Infrastructure & Realty';
  }

  if (lower.includes('telecom') || lower.includes('5g') || lower.includes('spectrum') || lower.includes('airtel') || lower.includes('vodafone')) {
    return 'Telecom';
  }

  return 'Diversified';
};

// General Category Classifier
export const classifyCategory = (title: string, summary: string, overrideCat?: string): string => {
  if (overrideCat) return overrideCat;

  const combined = (title + ' ' + summary).toLowerCase();

  if (combined.includes('ipo') || combined.includes('gmp') || combined.includes('drhp') || combined.includes('allotment') || combined.includes('listing date') || combined.includes('subscription status')) {
    return 'IPO Hub';
  }

  if (combined.includes('mutual fund') || combined.includes('amfi') || combined.includes('sip') || combined.includes('etf') || combined.includes('nav ') || combined.includes('fund manager')) {
    return 'Mutual Funds';
  }

  if (combined.includes('quarterly results') || combined.includes('q1') || combined.includes('q2') || combined.includes('q3') || combined.includes('q4') || combined.includes('earnings') || combined.includes('revenue') || combined.includes('profit')) {
    return 'Corporate Earnings';
  }

  if (combined.includes('rbi') || combined.includes('gdp') || combined.includes('inflation') || combined.includes('repo rate') || combined.includes('monetary policy') || combined.includes('rupee') || combined.includes('trade deficit') || combined.includes('cpi')) {
    return 'Economy & Macro';
  }

  if (combined.includes('gold') || combined.includes('silver') || combined.includes('crude oil') || combined.includes('dollar') || combined.includes('forex') || combined.includes('brent')) {
    return 'Commodities & FX';
  }

  return 'Stocks & Earnings';
};

// ============================================================================
// INGESTION WORKERS
// ============================================================================

interface IngestionItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  imageUrl?: string | null;
  publishedAt: Date;
  category: string;
  sector: string;
  relatedSymbols: string[];
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact: 'HIGH' | 'NORMAL';
  isBreaking: boolean;
}

// 1. Ingest Economic Times Markets Wire
export const fetchEconomicTimesNews = async (): Promise<IngestionItem[]> => {
  try {
    const url = 'https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms';
    const feed = await rssParser.parseURL(url);

    return (feed.items || []).slice(0, 30).map((item: any) => {
      const rawTitle = (item.title || '').trim();
      const summary = (item.contentSnippet || item.content || rawTitle).trim();
      const combined = `${rawTitle} ${summary}`;
      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
      const imageUrl = item.enclosure?.url || null;

      return {
        title: rawTitle,
        summary,
        url: item.link || `et-${Math.random()}`,
        source: 'The Economic Times',
        imageUrl,
        publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        category: classifyCategory(rawTitle, summary, 'Stocks & Earnings'),
        sector: classifySector(combined),
        relatedSymbols: extractRelatedSymbols(combined),
        sentiment: calculateSentiment(combined),
        impact: calculateImpact(combined),
        isBreaking: calculateImpact(combined) === 'HIGH' && publishedAt.getTime() > Date.now() - 6 * 3600 * 1000
      };
    }).filter(i => i.title.length > 10);
  } catch (err: any) {
    console.error('Error fetching Economic Times RSS feed:', err.message);
    return [];
  }
};

// 3. Ingest LiveMint Markets Wire
export const fetchLiveMintNews = async (): Promise<IngestionItem[]> => {
  try {
    const url = 'https://www.livemint.com/rss/markets';
    const feed = await rssParser.parseURL(url);

    return (feed.items || []).slice(0, 30).map((item: any) => {
      const rawTitle = (item.title || '').trim();
      const summary = (item.contentSnippet || item.content || rawTitle).trim();
      const combined = `${rawTitle} ${summary}`;
      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();
      const imageUrl = item.enclosure?.url || null;

      return {
        title: rawTitle,
        summary,
        url: item.link || `mint-${Math.random()}`,
        source: 'LiveMint',
        imageUrl,
        publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        category: classifyCategory(rawTitle, summary, 'Stocks & Earnings'),
        sector: classifySector(combined),
        relatedSymbols: extractRelatedSymbols(combined),
        sentiment: calculateSentiment(combined),
        impact: calculateImpact(combined),
        isBreaking: calculateImpact(combined) === 'HIGH' && publishedAt.getTime() > Date.now() - 6 * 3600 * 1000
      };
    }).filter(i => i.title.length > 10);
  } catch (err: any) {
    console.error('Error fetching LiveMint RSS feed:', err.message);
    return [];
  }
};

// 4. Ingest Google News Query for IPOs
export const fetchGoogleNewsIpos = async (): Promise<IngestionItem[]> => {
  try {
    const url = 'https://news.google.com/rss/search?q=when:3d+(%22IPO%22+OR+%22GMP%22+OR+%22allotment%22)+India&hl=en-IN&gl=IN&ceid=IN:en';
    const feed = await rssParser.parseURL(url);

    return (feed.items || []).slice(0, 20).map(item => {
      const rawTitle = item.title || '';
      const parts = rawTitle.split(' - ');
      const source = parts.length > 1 ? parts[parts.length - 1] : 'IPO News';
      const title = parts.length > 1 ? parts.slice(0, -1).join(' - ') : rawTitle;
      const summary = item.contentSnippet || item.content || title;
      const combined = `${title} ${summary}`;
      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

      return {
        title,
        summary,
        url: item.link || `google-news-ipo-${Math.random()}`,
        source,
        imageUrl: null,
        publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        category: 'IPO Hub',
        sector: classifySector(combined),
        relatedSymbols: extractRelatedSymbols(combined),
        sentiment: calculateSentiment(combined),
        impact: calculateImpact(combined),
        isBreaking: combined.toLowerCase().includes('gmp') || combined.toLowerCase().includes('allotment')
      };
    }).filter(i => i.title.length > 10);
  } catch (err: any) {
    console.error('Error fetching Google News IPO feed:', err.message);
    return [];
  }
};

// 5. Ingest Google News Query for Mutual Funds
export const fetchGoogleNewsMutualFunds = async (): Promise<IngestionItem[]> => {
  try {
    const url = 'https://news.google.com/rss/search?q=when:4d+(%22Mutual+Fund%22+OR+%22Mutual+Funds%22+OR+%22AMFI%22+OR+%22SIP%22)+India&hl=en-IN&gl=IN&ceid=IN:en';
    const feed = await rssParser.parseURL(url);

    return (feed.items || []).slice(0, 20).map(item => {
      const rawTitle = item.title || '';
      const parts = rawTitle.split(' - ');
      const source = parts.length > 1 ? parts[parts.length - 1] : 'Mutual Funds News';
      const title = parts.length > 1 ? parts.slice(0, -1).join(' - ') : rawTitle;
      const summary = item.contentSnippet || item.content || title;
      const combined = `${title} ${summary}`;
      const publishedAt = item.pubDate ? new Date(item.pubDate) : new Date();

      return {
        title,
        summary,
        url: item.link || `google-news-mf-${Math.random()}`,
        source,
        imageUrl: null,
        publishedAt: isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
        category: 'Mutual Funds',
        sector: 'Banking & Finance',
        relatedSymbols: extractRelatedSymbols(combined),
        sentiment: calculateSentiment(combined),
        impact: calculateImpact(combined),
        isBreaking: false
      };
    }).filter(i => i.title.length > 10);
  } catch (err: any) {
    console.error('Error fetching Google News MF feed:', err.message);
    return [];
  }
};

// ============================================================================
// CORE SYNC & DATABASE UPSERT ENGINE
// ============================================================================

// Helper to retrieve the actual timestamp when 3rd-party APIs were last synchronized
export const getLastSyncedTimestamp = async (): Promise<string> => {
  try {
    const cached = await getCache<string>('news:last_sync_timestamp');
    if (cached) return cached;

    // Fall back to the most recent article creation timestamp in PostgreSQL
    const latest = await prisma.marketNews.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    });

    if (latest?.createdAt) {
      const iso = latest.createdAt.toISOString();
      await setCache('news:last_sync_timestamp', iso, 86400 * 30);
      return iso;
    }
  } catch (err: any) {
    console.warn('[NewsService] Could not retrieve last synced timestamp:', err.message);
  }

  return new Date().toISOString();
};

// Helper to check if news ingestion is actively in progress
export const isNewsSyncing = async (): Promise<boolean> => {
  try {
    const isSyncing = await getCache<string>('news:is_syncing');
    if (isSyncing === 'true') return true;
    const isLocked = await getCache<string>('lock:news_sync');
    return Boolean(isLocked && isLocked === 'locked');
  } catch {
    return false;
  }
};

// Helper to calculate countdown until next 30-minute scheduled cron slot (:00 and :30)
export const getNextSyncCountdown = () => {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();

  let remainingMinutes: number;
  let remainingSeconds: number;

  if (currentMinutes < 30) {
    remainingMinutes = 29 - currentMinutes;
    remainingSeconds = 60 - currentSeconds;
  } else {
    remainingMinutes = 59 - currentMinutes;
    remainingSeconds = 60 - currentSeconds;
  }

  if (remainingSeconds === 60) {
    remainingMinutes += 1;
    remainingSeconds = 0;
  }

  const totalRemainingSeconds = remainingMinutes * 60 + remainingSeconds;
  const timeText = remainingMinutes > 0
    ? `${remainingMinutes}m ${remainingSeconds}s`
    : `${remainingSeconds}s`;

  return {
    remainingMinutes,
    remainingSeconds,
    totalRemainingSeconds,
    timeText
  };
};

// Returns current sync status, last timestamp, and time until next update
export const getNewsSyncStatus = async () => {
  const isSyncing = await isNewsSyncing();
  const lastSyncedAt = await getLastSyncedTimestamp();
  const { totalRemainingSeconds, timeText } = getNextSyncCountdown();

  const message = isSyncing
    ? 'Syncing in progress... 3rd-party wire is updating in background.'
    : `Feed is already up to date. Next update in ${timeText}.`;

  return {
    success: true,
    isSyncing,
    message,
    lastSyncedAt,
    nextSyncInSeconds: totalRemainingSeconds
  };
};

export const syncMarketNews = async (force: boolean = false): Promise<{ count: number; message: string; lastSyncedAt?: string; isThrottled?: boolean }> => {
  const syncLockKey = 'lock:news_sync';
  const isLocked = await getCache<string>(syncLockKey);
  if (isLocked) {
    const currentSyncTime = await getLastSyncedTimestamp();
    return { count: 0, message: 'Sync already in progress by background worker.', lastSyncedAt: currentSyncTime, isThrottled: true };
  }

  // Anti-Spam & API Protection: Cooldown of 30 minutes (1800 seconds) for manual/non-cron triggers
  const SYNC_COOLDOWN_SECONDS = 1800;
  const lastSyncTimeStr = await getCache<string>('news:last_sync_timestamp');
  if (!force && lastSyncTimeStr) {
    const lastSyncTime = new Date(lastSyncTimeStr).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - lastSyncTime) / 1000));
    if (elapsedSeconds < SYNC_COOLDOWN_SECONDS) {
      const remainingSeconds = SYNC_COOLDOWN_SECONDS - elapsedSeconds;
      const { timeText } = getNextSyncCountdown();
      console.log(`⏱️ [NewsService] Sync requested within cooldown (${elapsedSeconds}s < ${SYNC_COOLDOWN_SECONDS}s). Next auto-sync in ${timeText}.`);
      return {
        count: 0,
        message: `Feed is already up to date. Next update in ${timeText}.`,
        lastSyncedAt: lastSyncTimeStr,
        isThrottled: true
      };
    }
  }

  // Set 60-second lock and active syncing indicator to inform frontend
  await setCache(syncLockKey, 'locked', 60);
  await setCache('news:is_syncing', 'true', 120);

  try {
    console.log('🔄 [NewsService] Starting multi-stream news ingestion...');

    // Parallel fetch from official financial news RSS streams (The Economic Times, LiveMint, Google News)
    // 100% free, institutional quality, zero IndianAPI quota consumption!
    const results = await Promise.allSettled([
      fetchEconomicTimesNews(),
      fetchLiveMintNews(),
      fetchGoogleNewsIpos(),
      fetchGoogleNewsMutualFunds()
    ]);

    const allItems: IngestionItem[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && Array.isArray(r.value)) {
        allItems.push(...r.value);
      }
    }

    console.log(`📦 [NewsService] Collected ${allItems.length} raw articles to upsert.`);

    let insertedOrUpdated = 0;

    for (const item of allItems) {
      if (!item.url || !item.title) continue;

      try {
        await prisma.marketNews.upsert({
          where: { url: item.url },
          update: {
            title: item.title,
            summary: item.summary,
            imageUrl: item.imageUrl || undefined,
            category: item.category,
            sector: item.sector,
            relatedSymbols: item.relatedSymbols,
            sentiment: item.sentiment,
            impact: item.impact,
            isBreaking: item.isBreaking
          },
          create: {
            title: item.title,
            summary: item.summary,
            url: item.url,
            source: item.source,
            imageUrl: item.imageUrl,
            publishedAt: item.publishedAt,
            category: item.category,
            sector: item.sector,
            relatedSymbols: item.relatedSymbols,
            sentiment: item.sentiment,
            impact: item.impact,
            isBreaking: item.isBreaking
          }
        });
        insertedOrUpdated++;
      } catch (upsertErr: any) {
        // Continue on single item failures
      }
    }

    // Auto-prune articles older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const deleted = await prisma.marketNews.deleteMany({
      where: {
        publishedAt: { lt: thirtyDaysAgo }
      }
    });

    if (deleted.count > 0) {
      console.log(`🧹 [NewsService] Pruned ${deleted.count} legacy articles older than 30 days.`);
    }

    // Record exact sync timestamp in Redis (30-day retention) & 30-min freshness flag
    const nowIso = new Date().toISOString();
    await setCache('news:last_sync', Date.now().toString(), 1800); // 30 mins freshness flag
    await setCache('news:last_sync_timestamp', nowIso, 86400 * 30);
    console.log(`✅ [NewsService] Sync complete! Processed ${insertedOrUpdated} news items at ${nowIso}.`);

    return { count: insertedOrUpdated, message: `Successfully synced ${insertedOrUpdated} articles.`, lastSyncedAt: nowIso };
  } catch (error: any) {
    console.error('❌ [NewsService] Sync failed:', error.message);
    return { count: 0, message: `Sync failed: ${error.message}` };
  } finally {
    // Release the sync lock and clear the syncing in-progress flag
    await setCache('news:is_syncing', 'false', 1);
    await setCache(syncLockKey, '', 1);
  }
};

// ============================================================================
// PUBLIC QUERY METHODS (WITH SWR & REDIS CACHE)
// ============================================================================

export interface NewsQueryParams {
  page?: number;
  limit?: number;
  category?: string;
  sector?: string;
  symbol?: string;
  sentiment?: string;
  search?: string;
}

export const getNewsFeed = async (params: NewsQueryParams) => {
  const page = Math.max(1, Number(params.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.limit) || 20));
  const skip = (page - 1) * limit;

  const category = params.category && params.category !== 'All' ? params.category : undefined;
  const sector = params.sector && params.sector !== 'All Sectors' ? params.sector : undefined;
  const sentiment = params.sentiment && params.sentiment !== 'All' ? params.sentiment : undefined;
  const symbol = params.symbol ? params.symbol.toUpperCase().trim() : undefined;
  const search = params.search ? params.search.trim() : undefined;

  // Initial cold-start seed only if database has 0 items
  const existingCount = await prisma.marketNews.count();
  if (existingCount === 0) {
    await syncMarketNews(true);
  }
  // Note: 3rd-party API calls are strictly handled by the 30-minute background cron job.
  // Regular user queries strictly query PostgreSQL database.

  // Construct Prisma Filter
  const where: any = {};

  if (category) {
    where.category = category;
  }

  if (sector) {
    where.sector = sector;
  }

  if (sentiment) {
    where.sentiment = sentiment;
  }

  if (symbol) {
    where.relatedSymbols = { has: symbol };
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { summary: { contains: search, mode: 'insensitive' } },
      { source: { contains: search, mode: 'insensitive' } }
    ];
  }

  // Execute Count, Query, Last Synced Timestamp, and isSyncing status in parallel
  const [total, items, lastSyncedAt, isSyncing] = await Promise.all([
    prisma.marketNews.count({ where }),
    prisma.marketNews.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit
    }),
    getLastSyncedTimestamp(),
    isNewsSyncing()
  ]);

  const { totalRemainingSeconds } = getNextSyncCountdown();

  return {
    items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1
    },
    lastSyncedAt,
    isSyncing,
    nextSyncInSeconds: totalRemainingSeconds
  };
};

// Get Breaking News / High Impact Ticker Items
export const getBreakingNews = async (limit: number = 5) => {
  const cacheKey = `news:breaking:${limit}`;
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;

  const items = await prisma.marketNews.findMany({
    where: {
      OR: [
        { isBreaking: true },
        { impact: 'HIGH' }
      ]
    },
    orderBy: { publishedAt: 'desc' },
    take: limit
  });

  await setCache(cacheKey, items, 300); // 5 mins cache
  return items;
};

// Get Market Mood / Sentiment Summary for Today
export const getSentimentSummary = async () => {
  const cacheKey = 'news:sentiment_summary';
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;

  // Get past 48 hours news counts
  const fortyEightHoursAgo = new Date();
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

  const [bullish, bearish, neutral, total] = await Promise.all([
    prisma.marketNews.count({ where: { sentiment: 'BULLISH', publishedAt: { gte: fortyEightHoursAgo } } }),
    prisma.marketNews.count({ where: { sentiment: 'BEARISH', publishedAt: { gte: fortyEightHoursAgo } } }),
    prisma.marketNews.count({ where: { sentiment: 'NEUTRAL', publishedAt: { gte: fortyEightHoursAgo } } }),
    prisma.marketNews.count({ where: { publishedAt: { gte: fortyEightHoursAgo } } })
  ]);

  const safeTotal = total || 1;
  const summary = {
    total,
    bullish: { count: bullish, percentage: Math.round((bullish / safeTotal) * 100) },
    bearish: { count: bearish, percentage: Math.round((bearish / safeTotal) * 100) },
    neutral: { count: neutral, percentage: Math.round((neutral / safeTotal) * 100) },
    overallMood: bullish > bearish ? 'BULLISH' : bearish > bullish ? 'BEARISH' : 'NEUTRAL'
  };

  await setCache(cacheKey, summary, 600); // 10 mins cache
  return summary;
};
