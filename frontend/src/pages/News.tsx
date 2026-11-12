/**
 * Market News & Analysis Page
 * Institutional Bloomberg-style market wire with live feeds,
 * matching IPO & Mutual Fund hero header, card view as default with
 * uniform card geometry (fallback media banner) and a full-screen portalled modal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  ExternalLink,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  X,
  Copy,
  Check,
  Tag,
  ArrowUpRight,
  ShieldAlert,
  ChevronLeft,
  Sparkles,
  Newspaper
} from 'lucide-react';
import type { NewsItem, NewsSentimentSummary } from '../types';
import {
  fetchNewsFeed,
  fetchBreakingNews,
  fetchSentimentSummary,
  triggerNewsSync,
  fetchNewsSyncStatus
} from '../services/newsService';
import GlassCard from '../components/ui/GlassCard';

const CATEGORIES = [
  'All',
  'Stocks & Earnings',
  'IPO Hub',
  'Mutual Funds',
  'Economy & Macro',
  'Commodities & FX'
];

const SECTORS = [
  'All Sectors',
  'Banking & Finance',
  'IT & Tech',
  'Automobile',
  'Pharma & Healthcare',
  'Energy & Power',
  'Consumer & FMCG',
  'Metals & Mining',
  'Infrastructure & Realty'
];

export const News: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state synchronization
  const initialCategory = searchParams.get('category') || 'All';
  const initialSector = searchParams.get('sector') || 'All Sectors';
  const initialSymbol = searchParams.get('symbol') || '';

  const [category, setCategory] = useState(initialCategory);
  const [sector, setSector] = useState(initialSector);
  const [sentiment, setSentiment] = useState('All');
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol);
  // Default view is Cards (grid)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('grid');
  const [page, setPage] = useState(1);

  // Data States
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [breakingItems, setBreakingItems] = useState<NewsItem[]>([]);
  const [sentimentSummary, setSentimentSummary] = useState<NewsSentimentSummary | null>(null);

  // UI States
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isSyncingWire, setIsSyncingWire] = useState(false);
  const [previewArticle, setPreviewArticle] = useState<NewsItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && previewArticle) {
        setPreviewArticle(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewArticle]);

  // Load Main News Feed
  const loadFeed = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const response = await fetchNewsFeed({
        page,
        limit: 20,
        category,
        sector,
        sentiment,
        symbol: selectedSymbol || undefined
      });

      setNewsItems(response.items);
      setTotalPages(response.pagination.totalPages);
      setTotalCount(response.pagination.total);
      if (response.lastSyncedAt) {
        setLastSyncedAt(response.lastSyncedAt);
      }
      if (typeof response.isSyncing === 'boolean') {
        setIsSyncingWire(response.isSyncing);
      }
    } catch (err) {
      console.error('Error loading news feed:', err);
    } finally {
      if (!isSilent) setLoading(false);
    }
  }, [page, category, sector, sentiment, selectedSymbol]);

  // Background Wire Sync Monitor: detects background 30-min cron runs and updates UI when completed
  useEffect(() => {
    let timer: any;
    const checkStatus = async () => {
      try {
        const status = await fetchNewsSyncStatus();
        if (status && typeof status.isSyncing === 'boolean') {
          setIsSyncingWire((prev) => {
            // When transitioning from syncing to idle, sync completed! Re-fetch latest from DB
            if (prev && !status.isSyncing) {
              loadFeed(true);
              fetchBreakingNews().then(setBreakingItems).catch(() => {});
              fetchSentimentSummary().then(setSentimentSummary).catch(() => {});
            }
            return status.isSyncing;
          });
          if (status.lastSyncedAt) {
            setLastSyncedAt(status.lastSyncedAt);
          }
        }
      } catch {
        // Silent on background check errors
      }
    };

    // Fast check every 4s when syncing is active; otherwise every 30s
    const pollInterval = isSyncingWire ? 4000 : 30000;
    timer = setInterval(checkStatus, pollInterval);
    return () => clearInterval(timer);
  }, [isSyncingWire, loadFeed]);

  // Load Breaking & Sentiment Stats on mount
  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [breaking, sentimentData] = await Promise.all([
          fetchBreakingNews(),
          fetchSentimentSummary()
        ]);
        setBreakingItems(breaking);
        setSentimentSummary(sentimentData);
      } catch (e) {
        console.error('Error loading metadata:', e);
      }
    };
    loadMetadata();
  }, []);

  // Reload feed when filters or page change
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Sync state to URL params
  useEffect(() => {
    const params: Record<string, string> = {};
    if (category !== 'All') params.category = category;
    if (sector !== 'All Sectors') params.sector = sector;
    if (selectedSymbol) params.symbol = selectedSymbol;
    setSearchParams(params, { replace: true });
  }, [category, sector, selectedSymbol, setSearchParams]);

  // Handle manual sync: queries DB for latest news and shows next scheduled cron update countdown
  const handleManualSync = async () => {
    setSyncing(true);
    setSyncFeedback(null);
    try {
      const syncRes = await triggerNewsSync();
      if (syncRes.lastSyncedAt) {
        setLastSyncedAt(syncRes.lastSyncedAt);
      }
      if (typeof syncRes.isSyncing === 'boolean') {
        setIsSyncingWire(syncRes.isSyncing);
      }
      if (syncRes.message) {
        setSyncFeedback(syncRes.message);
        setTimeout(() => setSyncFeedback(null), 6000);
      }
      // Re-fetch latest records from PostgreSQL database
      await loadFeed(true);
      const [breaking, sentimentData] = await Promise.all([
        fetchBreakingNews(),
        fetchSentimentSummary()
      ]);
      setBreakingItems(breaking);
      setSentimentSummary(sentimentData);
    } catch (e) {
      console.error('Manual sync failed:', e);
    } finally {
      setSyncing(false);
    }
  };

  // Format relative timestamp
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return '';
    const now = new Date();
    const date = new Date(dateStr);
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  // Format exact clock time (e.g. 10:45 AM)
  const formatClockTime = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  // Handle Copy Article Link
  const handleCopy = (item: NewsItem) => {
    navigator.clipboard.writeText(item.url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Jump to screener for a symbol
  const handleSymbolClick = (e: React.MouseEvent, sym: string) => {
    e.stopPropagation();
    navigate(`/screeners?search=${encodeURIComponent(sym)}`);
  };

  // Top breaking highlight item for the pulse card
  const topBreakingStory = breakingItems[0] || null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. HERO HEADER (Adaptive Light/Dark Theme matching MoneyLogger) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-slate-950 p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-md transition-colors">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-60 h-60 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30">
                <Sparkles className="w-3 h-3" />
                REAL-TIME FINANCIAL INTELLIGENCE
              </span>
              <span className="text-[11px] text-slate-500 dark:text-indigo-200 font-medium">
                Stocks • Q2 Results • IPOs • Mutual Funds • RBI Macro
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Market News & Analysis
            </h1>

            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-normal">
              Institutional intelligence wire, corporate quarterly earnings reports, regulatory announcements, and sector-wide catalysts parsed directly from Indian markets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* View Mode Toggle: Table vs Cards */}
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80 shadow-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutList className="w-3 h-3" /> Table
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3 h-3" /> Cards
              </button>
            </div>

            {/* Sync Feedback Badge */}
            {syncFeedback && (
              <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/80 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 animate-fade-in shadow-xs">
                {syncFeedback}
              </span>
            )}

            {/* Manual Sync Button */}
            <button
              onClick={handleManualSync}
              disabled={syncing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Market Pulse Cards (Includes Squeezed Sentiment Barometer in Card 2 without header height increase) */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Card 1: Total Stories */}
          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Total Stories
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
              {loading ? 'Streaming...' : `${totalCount} Active Stories`}
            </span>
            <span className="text-[10px] text-slate-400 font-medium truncate">
              Real-time Indian market wire
            </span>
          </div>

          {/* Card 2: Market Sentiment Barometer settled cleanly inside header */}
          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Sentiment Barometer
              </span>
              {sentimentSummary && sentimentSummary.total > 0 && (
                <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                  {sentimentSummary.total} analyzed
                </span>
              )}
            </div>

            <div className="flex items-center justify-between mt-0.5 gap-1">
              <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
                {loading
                  ? 'Analyzing wire...'
                  : sentimentSummary && sentimentSummary.total > 0
                  ? `${sentimentSummary.bullish.percentage}% Bullish`
                  : 'Balanced Tone'}
              </span>
              {sentimentSummary && sentimentSummary.total > 0 && (
                <span className="text-[10px] font-bold text-rose-500 font-mono shrink-0">
                  {sentimentSummary.bearish.percentage}% Bear
                </span>
              )}
            </div>

            {/* Compact Segmented Sentiment Barometer (Height 1.5, Fits within card without expanding header) */}
            {sentimentSummary && sentimentSummary.total > 0 ? (
              <div
                className="w-full h-1.5 rounded-full overflow-hidden flex bg-slate-200 dark:bg-slate-700 mt-1 shadow-inner"
                title={`Bullish: ${sentimentSummary.bullish.percentage}% | Neutral: ${sentimentSummary.neutral.percentage}% | Bearish: ${sentimentSummary.bearish.percentage}%`}
              >
                <div
                  style={{ width: `${sentimentSummary.bullish.percentage}%` }}
                  className="bg-emerald-500 transition-all duration-500"
                />
                <div
                  style={{ width: `${sentimentSummary.neutral.percentage}%` }}
                  className="bg-slate-400 dark:bg-slate-500 transition-all duration-500"
                />
                <div
                  style={{ width: `${sentimentSummary.bearish.percentage}%` }}
                  className="bg-rose-500 transition-all duration-500"
                />
              </div>
            ) : (
              <div className="w-full h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-700/70 mt-1 opacity-40" />
            )}
          </div>

          {/* Card 3: High Impact Trigger */}
          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              High Impact Trigger
            </span>
            {loading ? (
              <span className="text-xs sm:text-sm font-semibold text-slate-400 mt-0.5 animate-pulse">
                Scanning catalysts...
              </span>
            ) : topBreakingStory ? (
              <span
                onClick={() => setPreviewArticle(topBreakingStory)}
                className="text-xs sm:text-sm font-extrabold text-amber-700 dark:text-amber-300 mt-0.5 truncate cursor-pointer hover:underline"
                title={topBreakingStory.title}
              >
                {topBreakingStory.title}
              </span>
            ) : (
              <span className="text-xs sm:text-sm font-medium text-slate-400 mt-0.5">
                No active breaking alerts
              </span>
            )}
            <span className="text-[10px] text-slate-400 font-medium truncate">
              Catalyst & earnings detector
            </span>
          </div>

          {/* Card 4: Wire Last Synced */}
          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                Wire Last Synced
              </span>
              {isSyncingWire && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 animate-pulse">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  SYNCING
                </span>
              )}
            </div>

            {isSyncingWire ? (
              <div className="mt-0.5 space-y-0.5">
                <span className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-1.5 animate-pulse">
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                  Syncing in progress...
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate block">
                  {lastSyncedAt ? `Saved: ${formatClockTime(lastSyncedAt)} (${formatTimeAgo(lastSyncedAt)})` : 'Updating 3rd-party wire...'}
                </span>
              </div>
            ) : (
              <>
                <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100 mt-0.5 font-mono">
                  {lastSyncedAt ? formatClockTime(lastSyncedAt) : 'Syncing wire...'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium truncate">
                  {lastSyncedAt ? `${formatTimeAgo(lastSyncedAt)} • 3rd-party wire` : 'Live API stream'}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 2. FILTER CONTROL CENTER (Category Tabs on Left, Sentiment Dropdown on Rightmost Side) */}
      <div className="space-y-3">
        {/* Category Tabs & Sentiment Filter Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Primary Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 max-w-full">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setCategory(cat);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  category === cat
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}

            {/* Active Symbol Tag Indicator */}
            {selectedSymbol && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold shrink-0">
                <Tag className="w-3.5 h-3.5" />
                <span>Ticker: ${selectedSymbol}</span>
                <button
                  onClick={() => setSelectedSymbol('')}
                  className="hover:text-amber-700 dark:hover:text-amber-300 ml-1"
                  title="Clear ticker filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Sentiment Filter Dropdown placed at rightmost side */}
          <div className="shrink-0 self-end sm:self-auto">
            <select
              value={sentiment}
              onChange={(e) => {
                setSentiment(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by sentiment"
              className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <option value="All">All Sentiments</option>
              <option value="BULLISH">Bullish Only</option>
              <option value="BEARISH">Bearish Only</option>
              <option value="NEUTRAL">Neutral Only</option>
            </select>
          </div>
        </div>

        {/* Sector Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Sector:
          </span>
          {SECTORS.map((sec) => (
            <button
              key={sec}
              onClick={() => {
                setSector(sec);
                setPage(1);
              }}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all whitespace-nowrap ${
                sector === sec
                  ? 'bg-slate-900 dark:bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white border border-transparent dark:border-slate-700/60'
              }`}
            >
              {sec}
            </button>
          ))}
        </div>
      </div>

      {/* 3. NEWS LISTING CONTAINER (CARDS OR TABLE) */}
      {loading ? (
        <div className="py-24 text-center flex flex-col items-center justify-center space-y-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-2 border-indigo-200 dark:border-indigo-900/60 border-t-indigo-600 dark:border-t-indigo-400 animate-spin" />
            <Newspaper className="w-5 h-5 text-indigo-600 dark:text-indigo-400 absolute inset-0 m-auto" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Streaming Real-Time Market Intelligence...
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Fetching live financial feeds from The Economic Times, LiveMint, and Google News
            </p>
          </div>
        </div>
      ) : newsItems.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-8 max-w-lg mx-auto">
          <ShieldAlert className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
            No Matching Headlines Found
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto leading-relaxed">
            {category !== 'All' || sector !== 'All Sectors' || sentiment !== 'All' || selectedSymbol
              ? 'No active articles match your current filter criteria. Try resetting your filters to view the latest market wire.'
              : 'No market news articles are available at the moment. Please sync now to fetch the latest real-time market wire.'}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            {(category !== 'All' || sector !== 'All Sectors' || sentiment !== 'All' || selectedSymbol) && (
              <button
                onClick={() => {
                  setCategory('All');
                  setSector('All Sectors');
                  setSentiment('All');
                  setSelectedSymbol('');
                }}
                className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition-colors"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={handleManualSync}
              disabled={syncing}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Sync Latest News'}</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* INSTITUTIONAL TABLE VIEW */
        <div className="space-y-2">
          <div className="sm:hidden flex items-center justify-between px-1 text-[11px] text-slate-500 dark:text-slate-400">
            <span>Market Headlines Wire</span>
            <span className="font-medium">← Swipe horizontally →</span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
            <table className="w-full min-w-[780px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3.5 px-4 w-24 whitespace-nowrap">Time</th>
                  <th className="py-3.5 px-4 w-28 whitespace-nowrap">Sentiment</th>
                  <th className="py-3.5 px-4 w-36 whitespace-nowrap">Sector</th>
                  <th className="py-3.5 px-4 min-w-[280px]">Headline & Catalysts</th>
                  <th className="py-3.5 px-4 w-36 whitespace-nowrap">Source</th>
                  <th className="py-3.5 px-4 w-28 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
              {newsItems.map((item) => {
                const isBullish = item.sentiment === 'BULLISH';
                const isBearish = item.sentiment === 'BEARISH';

                return (
                  <tr
                    key={item.id}
                    onClick={() => setPreviewArticle(item)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer group"
                  >
                    {/* Time */}
                    <td className="py-3.5 px-4 font-mono font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {formatClockTime(item.publishedAt)}
                    </td>

                    {/* Sentiment Pill */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                          isBullish
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : isBearish
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {isBullish ? '+' : isBearish ? '-' : '•'} {item.sentiment}
                      </span>
                    </td>

                    {/* Sector Tag */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-[10px] font-semibold border border-slate-200 dark:border-slate-800">
                        {item.sector}
                      </span>
                    </td>

                    {/* Headline & Tickers */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                          {item.title}
                        </span>

                        {/* Stock Chips */}
                        {item.relatedSymbols && item.relatedSymbols.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0">
                            {item.relatedSymbols.map((sym) => (
                              <button
                                key={sym}
                                onClick={(e) => handleSymbolClick(e, sym)}
                                className="px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-colors"
                                title={`View ${sym} on Screener`}
                              >
                                ${sym}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Source & Relative Time */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-700 dark:text-slate-300">
                        {item.source}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {formatTimeAgo(item.publishedAt)}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewArticle(item);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 hover:text-white transition-colors"
                      >
                        <span>View</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    ) : (
        /* EDITORIAL GRID VIEW (DEFAULT) WITH UNIFORM MEDIA BANNER HEIGHT */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {newsItems.map((item) => {
            const isBullish = item.sentiment === 'BULLISH';
            const isBearish = item.sentiment === 'BEARISH';

            return (
              <GlassCard
                key={item.id}
                onClick={() => setPreviewArticle(item)}
                hoverEffect
                className="cursor-pointer flex flex-col justify-between !p-0 overflow-hidden border-slate-200 dark:border-slate-800 h-full"
              >
                {/* 1. TOP MEDIA BANNER (Always exactly h-44 for 100% uniform geometry across all cards) */}
                {item.imageUrl ? (
                  <div className="relative h-44 w-full overflow-hidden bg-slate-900 shrink-0">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                      loading="lazy"
                      onError={(e) => {
                        // Safe fallback if external thumbnail fails
                        const target = e.currentTarget;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.className = 'relative h-44 w-full bg-gradient-to-br from-indigo-50/90 via-slate-100 to-indigo-100/60 dark:from-slate-900 dark:via-indigo-950/70 dark:to-slate-900 p-4 flex flex-col justify-between shrink-0';
                        }
                      }}
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider">
                        {item.category}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Institutional Fallback Banner (Exact h-44 height with watermark icon) */
                  <div className="relative h-44 w-full bg-gradient-to-br from-indigo-50/90 via-slate-100 to-indigo-100/60 dark:from-slate-900 dark:via-indigo-950/70 dark:to-slate-900 border-b border-slate-200/80 dark:border-slate-800/80 p-4 flex flex-col justify-between shrink-0 overflow-hidden">
                    {/* Watermark decoration */}
                    <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-indigo-500/10 rounded-full blur-xl pointer-events-none" />
                    <div className="absolute right-3 bottom-3 opacity-20 text-indigo-500 dark:text-indigo-400 pointer-events-none">
                      <Newspaper className="w-16 h-16" />
                    </div>

                    <div className="relative z-10 flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-md bg-white/90 dark:bg-white/10 backdrop-blur-md text-slate-700 dark:text-white text-[10px] font-bold uppercase tracking-wider border border-slate-200/80 dark:border-white/10 shadow-xs">
                        {item.category}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{formatTimeAgo(item.publishedAt)}</span>
                    </div>

                    <div className="relative z-10">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-300 uppercase tracking-wider block">
                        {item.sector}
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">Market Intelligence Brief</span>
                    </div>
                  </div>
                )}

                {/* 2. CARD CONTENT CONTAINER WITH FIXED METRICS */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    {/* Header Tags: Tone pill + Published Time */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                          isBullish
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : isBearish
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {item.sentiment}
                      </span>

                      {item.imageUrl && (
                        <span className="text-[11px] font-mono text-slate-400">{formatTimeAgo(item.publishedAt)}</span>
                      )}
                    </div>

                    {/* Headline: Locked 2 lines (h-10) for uniform alignment */}
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-2 h-10 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                      {item.title}
                    </h3>

                    {/* Excerpt: Locked 3 lines (h-[52px]) */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-3 h-[52px] leading-relaxed">
                      {item.summary}
                    </p>
                  </div>

                  {/* 3. FOOTER ROW: Tickers & Source */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs mt-auto">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      {item.relatedSymbols && item.relatedSymbols.length > 0 ? (
                        item.relatedSymbols.map((sym) => (
                          <button
                            key={sym}
                            onClick={(e) => handleSymbolClick(e, sym)}
                            className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 font-mono text-[10px] font-bold hover:bg-indigo-600 hover:text-white transition-colors"
                          >
                            ${sym}
                          </button>
                        ))
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          {item.sector}
                        </span>
                      )}
                    </div>

                    <span className="font-medium text-slate-500 text-[11px] shrink-0">{item.source}</span>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* 5. PAGINATION CONTROLS */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Page {page} of {totalPages} ({totalCount} total articles)
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 font-medium"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 font-medium"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 6. CENTERED MODAL DIALOG (PORTALLED TO DOCUMENT.BODY: OVERLAYS NAVBAR & SIDEBAR COMPLETELY, NO INNER SCROLLBAR) */}
      {previewArticle &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-fade-in"
            onClick={() => setPreviewArticle(null)}
          >
            <div
              className="relative w-full max-w-xl max-h-[92vh] sm:max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider">
                    {previewArticle.category}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{previewArticle.sector}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy(previewArticle)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Copy article link"
                  >
                    {copiedId === previewArticle.id ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>

                  {/* Prominent Cross (X) Close Icon */}
                  <button
                    onClick={() => setPreviewArticle(null)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                    title="Close (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Scrollable two-row layout */}
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                {/* Row 1: Image (Left) + Details & Headline (Right) */}
                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  {/* Left Column: Image Thumbnail (or Institutional Fallback) */}
                  {previewArticle.imageUrl ? (
                    <div className="w-full sm:w-48 h-36 rounded-2xl overflow-hidden bg-slate-900 shrink-0 border border-slate-200 dark:border-slate-800 shadow-sm relative">
                      <img
                        src={previewArticle.imageUrl}
                        alt={previewArticle.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.className = 'w-full sm:w-48 h-36 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-slate-100 to-indigo-100/60 dark:from-slate-900 dark:via-indigo-950/70 dark:to-slate-900 p-3 flex flex-col justify-between shrink-0 border border-slate-200 dark:border-slate-800 relative';
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-full sm:w-48 h-36 rounded-2xl bg-gradient-to-br from-indigo-50/90 via-slate-100 to-indigo-100/60 dark:from-slate-900 dark:via-indigo-950/70 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-3 flex flex-col justify-between shrink-0 relative overflow-hidden shadow-sm">
                      <div className="absolute -right-3 -bottom-3 opacity-20 text-indigo-500 dark:text-indigo-400 pointer-events-none">
                        <Newspaper className="w-16 h-16" />
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-white/90 dark:bg-white/10 text-slate-700 dark:text-white text-[10px] font-bold uppercase tracking-wider w-fit border border-slate-200/80 dark:border-white/10">
                        {previewArticle.category}
                      </span>
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-300">
                        {previewArticle.sector}
                      </span>
                    </div>
                  )}

                  {/* Right Column: Meta Pills + Headline + Stock Tickers */}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Meta Tone & Source */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border ${
                          previewArticle.sentiment === 'BULLISH'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : previewArticle.sentiment === 'BEARISH'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {previewArticle.sentiment} TONE
                      </span>

                      <span className="text-slate-400">•</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">
                        {previewArticle.source}
                      </span>
                      <span className="text-slate-400 font-mono text-[11px]">
                        ({formatTimeAgo(previewArticle.publishedAt)})
                      </span>
                    </div>

                    {/* Headline */}
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-snug line-clamp-3">
                      {previewArticle.title}
                    </h2>

                    {/* Tagged Stock Tickers */}
                    {previewArticle.relatedSymbols && previewArticle.relatedSymbols.length > 0 && (
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Tagged:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {previewArticle.relatedSymbols.map((sym) => (
                            <button
                              key={sym}
                              onClick={(e) => {
                                setPreviewArticle(null);
                                handleSymbolClick(e, sym);
                              }}
                              className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] font-bold flex items-center gap-1 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-600 hover:text-white transition-colors"
                              title={`View ${sym} on Screener`}
                            >
                              <span>${sym}</span>
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Full-width Executive Summary Briefing */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Executive Summary & Market Context
                  </span>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-normal">
                    {previewArticle.summary}
                  </p>
                </div>
              </div>

              {/* Modal Footer with External Link & Close */}
              <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0">
                <a
                  href={previewArticle.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 shadow-md shadow-indigo-500/20 transition-colors"
                >
                  <span>Read Full Story on {previewArticle.source}</span>
                  <ExternalLink className="w-4 h-4" />
                </a>

                <button
                  onClick={() => setPreviewArticle(null)}
                  className="py-2.5 px-4 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-xs sm:text-sm rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

export default News;