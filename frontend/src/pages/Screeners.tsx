import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  RotateCcw,
  Download,
  TrendingUp,
  Sparkles,
  ShieldCheck,
  Zap,
  Coins,
  SearchCheck,
  Building2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  X,
  Info,
  LayoutGrid,
  LayoutList,
  Bookmark,
  Trash2
} from 'lucide-react';
import type { ScreenerStock, ScreenerFilters, ScreenerTableView } from '../types';
import {
  fetchScreenerStocks,
  fetchScreenerSummary,
  getExportCsvUrl,
  type ScreenerSummary
} from '../services/screenerService';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

type ViewMode = 'table' | 'card';

export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
  dayChangePercent: number;
  sector: string;
  marketCap?: number;
  peRatio?: number;
  roe?: number;
  addedAt: string;
}

const SECTORS = [
  'All Sectors',
  'IT & Tech',
  'Banking & Finance',
  'Energy & Power',
  'Consumer & FMCG',
  'Automobile',
  'Pharma & Healthcare',
  'Metals & Mining',
  'Capital Goods & Defense',
  'Infrastructure & Realty',
  'Telecom'
];

const PRESET_ICONS: Record<string, React.ReactNode> = {
  'buffett-moat': <ShieldCheck className="w-5 h-5 text-amber-500" />,
  'garp': <TrendingUp className="w-5 h-5 text-emerald-500" />,
  'momentum-breakout': <Zap className="w-5 h-5 text-cyan-500" />,
  'dividend-aristocrats': <Coins className="w-5 h-5 text-purple-500" />,
  'deep-value': <SearchCheck className="w-5 h-5 text-blue-500" />,
  'institutional-favorites': <Building2 className="w-5 h-5 text-rose-500" />
};

const DEFAULT_FILTERS: ScreenerFilters = {
  search: '',
  priceRange: [0, 100000],
  marketCap: 'all',
  sector: null,
  peRatioRange: [0, 150],
  pbRatioRange: [0, 40],
  roeRange: [0, 100],
  roceRange: [0, 100],
  deRange: [0, 5],
  revenueGrowthRange: [-50, 100],
  profitGrowthRange: [-50, 100],
  dividendYieldRange: [0, 15],
  high52wPercent: [-100, 100],
  rsiRange: [0, 100],
  above200dma: null,
  customQuery: '',
  preset: null
};

// Mini SVG Sparkline Component
const Sparkline: React.FC<{ points?: number[]; isPositive: boolean }> = ({ points, isPositive }) => {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const height = 24;
  const width = 64;

  const svgPoints = points
    .map((p, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((p - min) / range) * (height - 6) - 3;
      return `${x},${y}`;
    })
    .join(' ');

  const strokeColor = isPositive ? '#10B981' : '#F43F5E';

  return (
    <svg width={width} height={height} className="overflow-visible inline-block">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={svgPoints}
      />
    </svg>
  );
};

const Screeners: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [stocks, setStocks] = useState<ScreenerStock[]>([]);
  const [summary, setSummary] = useState<ScreenerSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View Mode & Table Tabs
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [activeTab, setActiveTab] = useState<ScreenerTableView>('overview');
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [showFormulaBox, setShowFormulaBox] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  );

  // Watchlist Persistent State & Modal
  const [watchlistItems, setWatchlistItems] = useState<WatchlistItem[]>(() => {
    try {
      const raw = localStorage.getItem('stock_watchlist_items');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showWatchlistOnly, setShowWatchlistOnly] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [watchlistToast, setWatchlistToast] = useState<{ symbol: string; added: boolean } | null>(null);

  const [filters, setFilters] = useState<ScreenerFilters>(() => ({
    ...DEFAULT_FILTERS,
    search: searchParams.get('search') || '',
  }));
  const [debouncedFilters, setDebouncedFilters] = useState<ScreenerFilters>(filters);
  const [selectedStock, setSelectedStock] = useState<ScreenerStock | null>(null);

  // Sorting
  const [sortBy, setSortBy] = useState<string>('marketCap');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Set of watchlisted symbols for quick O(1) checks
  const watchlistSymbols = useMemo(() => new Set(watchlistItems.map(item => item.symbol)), [watchlistItems]);

  // Debounce filter changes (search bar keystrokes, range sliders) to prevent redundant database & API hits
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // Sync URL search param if it changes dynamically
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      const updated = { ...filters, search: q };
      setFilters(updated);
      setDebouncedFilters(updated);
      setPage(1);
    }
  }, [searchParams]);

  // Load summary and presets once (backed by 10-minute client cache)
  useEffect(() => {
    fetchScreenerSummary()
      .then(data => setSummary(data))
      .catch(err => console.error('Error fetching screener summary:', err));
  }, []);

  // Fetch stocks when debouncedFilters, page, or sort changes
  const loadStocks = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const res = await fetchScreenerStocks(debouncedFilters, page, limit, sortBy, sortOrder, isRefresh);
      setStocks(res.stocks);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setLastSyncedAt(
        new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    } catch (err: any) {
      setError(err.message || 'Failed to fetch screener results');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedFilters, page, limit, sortBy, sortOrder]);

  useEffect(() => {
    loadStocks();
  }, [loadStocks]);

  // Handle Sort column click
  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  // Preset click handler (immediately applies without debounce lag)
  const handlePresetClick = (presetId: string) => {
    const nextFilters = filters.preset === presetId
      ? { ...filters, preset: null }
      : { ...DEFAULT_FILTERS, preset: presetId };
    setFilters(nextFilters);
    setDebouncedFilters(nextFilters);
    setShowWatchlistOnly(false);
    setPage(1);
  };

  // Reset all filters (immediately applies without debounce lag)
  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDebouncedFilters(DEFAULT_FILTERS);
    setShowWatchlistOnly(false);
    setPage(1);
  };

  // Toggle stock in watchlist (Add or Remove) with persistent storage
  const toggleWatchlist = (
    e: React.MouseEvent,
    stock: {
      symbol: string;
      name: string;
      price: number;
      dayChangePercent?: number;
      sector?: string;
      marketCap?: number;
      peRatio?: number;
      roe?: number;
    }
  ) => {
    e.stopPropagation();
    const isAlreadyAdded = watchlistSymbols.has(stock.symbol);
    let updated: WatchlistItem[];

    if (isAlreadyAdded) {
      updated = watchlistItems.filter(item => item.symbol !== stock.symbol);
      setWatchlistToast({ symbol: stock.symbol, added: false });
    } else {
      const newItem: WatchlistItem = {
        symbol: stock.symbol,
        name: stock.name,
        price: Number(stock.price || 0),
        dayChangePercent: Number(stock.dayChangePercent || 0),
        sector: stock.sector || 'General',
        marketCap: stock.marketCap ? Number(stock.marketCap) : undefined,
        peRatio: stock.peRatio ? Number(stock.peRatio) : undefined,
        roe: stock.roe ? Number(stock.roe) : undefined,
        addedAt: new Date().toISOString()
      };
      updated = [newItem, ...watchlistItems];
      setWatchlistToast({ symbol: stock.symbol, added: true });
    }

    setWatchlistItems(updated);
    try {
      localStorage.setItem('stock_watchlist_items', JSON.stringify(updated));
      localStorage.setItem('stock_watchlist', JSON.stringify(updated.map(i => i.symbol)));
    } catch (err) {
      console.error('Failed to save watchlist to localStorage', err);
    }

    setTimeout(() => setWatchlistToast(null), 3000);
  };

  const removeFromWatchlist = (symbol: string) => {
    const updated = watchlistItems.filter(item => item.symbol !== symbol);
    setWatchlistItems(updated);
    try {
      localStorage.setItem('stock_watchlist_items', JSON.stringify(updated));
      localStorage.setItem('stock_watchlist', JSON.stringify(updated.map(i => i.symbol)));
    } catch (err) {
      console.error('Failed to update watchlist', err);
    }
  };

  const clearWatchlist = () => {
    setWatchlistItems([]);
    try {
      localStorage.removeItem('stock_watchlist_items');
      localStorage.removeItem('stock_watchlist');
    } catch (err) {
      console.error('Failed to clear watchlist', err);
    }
  };

  // Determine which stocks to display:
  // When showWatchlistOnly is active, show only stocks in the user's watchlist
  const displayedStocks = useMemo(() => {
    if (!showWatchlistOnly) return stocks;

    // Build watchlist list: prefer full stock object from loaded `stocks` if available,
    // otherwise fallback gracefully to stored watchlist snapshot so off-page stocks remain visible
    return watchlistItems.map(item => {
      const match = stocks.find(s => s.symbol === item.symbol);
      if (match) return match;

      return {
        id: item.symbol,
        symbol: item.symbol,
        name: item.name,
        sector: item.sector,
        price: item.price,
        dayChangePercent: item.dayChangePercent,
        dayChange: (item.price * item.dayChangePercent) / 100,
        marketCap: item.marketCap || 0,
        peRatio: item.peRatio || 0,
        roe: item.roe || 0,
        oneYearReturn: 0,
        pbRatio: 0,
        dividendYield: 0,
        high52w: 0,
        low52w: 0
      } as unknown as ScreenerStock;
    });
  }, [stocks, showWatchlistOnly, watchlistItems]);

  // Count active non-default filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.sector) count++;
    if (filters.marketCap !== 'all') count++;
    if (filters.preset) count++;
    if (filters.customQuery) count++;
    if (filters.peRatioRange[1] < 150 || filters.peRatioRange[0] > 0) count++;
    if (filters.roeRange[0] > 0) count++;
    if (filters.roceRange[0] > 0) count++;
    if (filters.deRange[1] < 5) count++;
    if (filters.dividendYieldRange[0] > 0) count++;
    if (filters.rsiRange[0] > 0 || filters.rsiRange[1] < 100) count++;
    if (filters.above200dma !== null) count++;
    if (showWatchlistOnly) count++;
    return count;
  }, [filters, showWatchlistOnly]);

  // Dynamic pagination window calculator
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    const end = Math.min(totalPages, start + maxButtons - 1);
    if (end - start + 1 < maxButtons) {
      start = Math.max(1, end - maxButtons + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const renderRatingBadge = (rating?: string) => {
    switch (rating) {
      case 'Strong Buy':
      case 'Buy':
        return <Badge type="success">{rating.toUpperCase()}</Badge>;
      case 'Hold':
        return <Badge type="warning">HOLD</Badge>;
      case 'Sell':
      case 'Strong Sell':
        return <Badge type="danger">{rating.toUpperCase()}</Badge>;
      default:
        return <Badge type="primary">{rating || 'NEUTRAL'}</Badge>;
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 pb-20">
      {/* 1. HERO HEADER (Adaptive Light/Dark Theme matching MoneyLogger) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-slate-950 p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-md transition-colors">
        {/* Ambient Subtle Glow Orbs */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-60 h-60 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30">
                <Sparkles className="w-3 h-3" />
                REAL-TIME NSE & BSE PIPELINE
              </span>
              <span className="text-[11px] text-slate-500 dark:text-indigo-200 font-medium">
                Indexed Postgres • Sub-50ms Redis Cache
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Institutional Stock Screener
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-normal">
              Screen, rank, and discover high-conviction Indian equities across 40+ fundamental, valuation, and technical criteria with one-click presets or custom formula queries.
            </p>
          </div>

          {/* Actions: Synced Pill, Watchlist Hub, CSV, Refresh */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Synced Time Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs font-medium border border-slate-200/80 dark:border-white/10 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="hidden xs:inline text-slate-400 dark:text-slate-400">Synced:</span>
              <span>{lastSyncedAt}</span>
            </div>

            {/* Watchlist Hub Modal Trigger */}
            <button
              onClick={() => setShowWatchlistModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold border border-amber-500/30 transition-all shadow-xs active:scale-95"
              title="Open My Watchlist Hub"
            >
              <Bookmark className={`w-3.5 h-3.5 ${watchlistItems.length > 0 ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>Watchlist</span>
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                {watchlistItems.length}
              </span>
            </button>

            <a
              href={getExportCsvUrl(filters)}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-white/80 hover:bg-white dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold border border-slate-200/80 dark:border-slate-700 backdrop-blur-md transition-all shadow-xs active:scale-95"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Export CSV</span>
            </a>

            <button
              onClick={() => loadStocks(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Quick Market Pulse Bar */}
        {summary && (
          <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Tracked Universe
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                {summary.totalStocks} Listed Companies
              </span>
            </div>
            <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Top Gainer Today
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
                {summary.topGainers?.[0]?.symbol || 'N/A'} (+{Number(summary.topGainers?.[0]?.dayChangePercent || 0).toFixed(2)}%)
              </span>
            </div>
            <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Most Active Sector
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5 truncate">
                {summary.sectors?.[0]?.name || 'IT & Tech'} ({summary.sectors?.[0]?.count || 0})
              </span>
            </div>
            <div
              onClick={() => setShowWatchlistModal(true)}
              className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-amber-300/60 dark:border-amber-500/30 shadow-xs flex flex-col justify-center cursor-pointer hover:bg-amber-50/50 dark:hover:bg-slate-800 transition-colors group"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  My Watchlist
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 group-hover:underline font-semibold">
                  View →
                </span>
              </div>
              <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
                {watchlistItems.length} Saved {watchlistItems.length === 1 ? 'Stock' : 'Stocks'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. ONE-CLICK CURATED PRESETS */}
      <div className="space-y-2.5 sm:space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Curated Screening Presets & Investment Themes
            </h2>
          </div>
          {filters.preset && (
            <button
              onClick={() => setFilters(prev => ({ ...prev, preset: null }))}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Clear Preset
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
          {(summary?.presets || []).map((preset) => {
            const isSelected = filters.preset === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handlePresetClick(preset.id)}
                className={`p-3 sm:p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 group relative overflow-hidden ${
                  isSelected
                    ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                    : 'bg-white/90 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="p-1.5 sm:p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
                    {PRESET_ICONS[preset.id] || <Sparkles className="w-4 h-4 text-indigo-500" />}
                  </div>
                  <span className={`text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full ${
                    isSelected
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}>
                    {preset.badge}
                  </span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                  {preset.title}
                </h4>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-1 leading-snug">
                  {preset.subtitle}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. SEARCH & CONTROLS TOOLBAR */}
      <GlassCard className="p-3.5 sm:p-5 space-y-3 sm:space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-full lg:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={filters.search || ''}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, search: e.target.value }));
                setPage(1);
              }}
              placeholder="Search by symbol or name (e.g. TCS, HDFCBANK)..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {filters.search && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, search: '' }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Actions & Filters Button */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Market Cap Pills */}
            <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center text-xs overflow-x-auto scrollbar-none">
              {(['all', 'large', 'mid', 'small'] as const).map(mc => (
                <button
                  key={mc}
                  onClick={() => {
                    setFilters(prev => ({ ...prev, marketCap: mc }));
                    setPage(1);
                  }}
                  className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg capitalize font-semibold transition-all whitespace-nowrap ${
                    filters.marketCap === mc
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {mc === 'all' ? 'All Caps' : `${mc} Cap`}
                </button>
              ))}
            </div>

            {/* My Watchlist Filter Pill */}
            <button
              onClick={() => {
                setShowWatchlistOnly(!showWatchlistOnly);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition-all ${
                showWatchlistOnly
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25 ring-2 ring-amber-500/20'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${showWatchlistOnly || watchlistItems.length > 0 ? 'fill-current' : ''}`} />
              <span>Watchlist</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                showWatchlistOnly ? 'bg-white/20 text-white' : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
              }`}>
                {watchlistItems.length}
              </span>
            </button>

            {/* Formula Query Box Toggle */}
            <button
              onClick={() => setShowFormulaBox(!showFormulaBox)}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition-all ${
                showFormulaBox || filters.customQuery
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 ring-2 ring-indigo-500/20'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm'
              }`}
            >
              <span>Query (SQL/Formula)</span>
              {filters.customQuery && <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />}
            </button>

            {/* Advanced Filters Button */}
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold border transition-all ${
                showFiltersPanel || activeFiltersCount > 0
                  ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-sm'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
              <span>Filters</span>
              {activeFiltersCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
              {showFiltersPanel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {/* Reset Button */}
            {activeFiltersCount > 0 && (
              <button
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                title="Reset all filters"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* Sector Pills Bar */}
        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-slate-100 dark:border-slate-800/80 -webkit-overflow-scrolling-touch">
          {SECTORS.map(sec => {
            const isSelected = (!filters.sector && sec === 'All Sectors') || filters.sector === sec;
            return (
              <button
                key={sec}
                onClick={() => {
                  setFilters(prev => ({
                    ...prev,
                    sector: sec === 'All Sectors' ? null : sec
                  }));
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {sec}
              </button>
            );
          })}
        </div>

        {/* Watchlist Filter Active Banner */}
        {showWatchlistOnly && (
          <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs animate-fadeIn">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500 shrink-0" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white">
                  Viewing My Saved Watchlist ({watchlistItems.length} {watchlistItems.length === 1 ? 'company' : 'companies'})
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Showing only stocks bookmarked to your watchlist. Click the bookmark on any stock to add or remove.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowWatchlistModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-500 text-white font-bold hover:bg-amber-600 transition-colors shadow-xs"
              >
                Manage Watchlist
              </button>
              <button
                onClick={() => setShowWatchlistOnly(false)}
                className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-semibold hover:bg-slate-100"
              >
                Show All Stocks
              </button>
            </div>
          </div>
        )}

        {/* SCREENER.IN FORMULA QUERY BOX */}
        {showFormulaBox && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-50/50 dark:bg-slate-900/90 border border-indigo-200 dark:border-indigo-800/60 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                  Screener.in Power Query Builder
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Combine metrics with AND (e.g. roe &gt; 20 AND pe &lt; 25)
                </span>
              </div>
              <button
                onClick={() => setShowFormulaBox(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={filters.customQuery || ''}
                onChange={(e) => setFilters(prev => ({ ...prev, customQuery: e.target.value }))}
                placeholder="e.g. roe > 18 AND pe < 30 AND debt_to_equity < 0.3 AND market_cap > 10000"
                className="flex-1 px-3.5 py-2 sm:py-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-900 dark:text-cyan-300 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => setPage(1)}
                className="px-5 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-600/30 whitespace-nowrap"
              >
                Run Query
              </button>
            </div>

            {/* Quick snippet buttons */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">Quick Filters:</span>
              <button
                onClick={() => setFilters(prev => ({ ...prev, customQuery: 'roe > 20 AND pe < 30' }))}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] hover:bg-indigo-50 dark:hover:bg-slate-700"
              >
                roe &gt; 20 AND pe &lt; 30
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, customQuery: 'debt_to_equity < 0.2 AND roe > 15' }))}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] hover:bg-indigo-50 dark:hover:bg-slate-700"
              >
                debt_to_equity &lt; 0.2 AND roe &gt; 15
              </button>
              <button
                onClick={() => setFilters(prev => ({ ...prev, customQuery: 'dividend_yield > 2.5 AND pe < 20' }))}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-indigo-600 dark:text-indigo-400 font-mono text-[11px] hover:bg-indigo-50 dark:hover:bg-slate-700"
              >
                dividend_yield &gt; 2.5 AND pe &lt; 20
              </button>
            </div>
          </div>
        )}

        {/* COLLAPSIBLE ADVANCED FILTERS PANEL */}
        {showFiltersPanel && (
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 animate-fadeIn">
            {/* Valuation */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Valuation Multiples
              </h4>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>P/E Ratio</span>
                  <span className="font-bold text-slate-900 dark:text-white">&le; {filters.peRatioRange[1]}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="150"
                  value={filters.peRatioRange[1]}
                  onChange={(e) => setFilters(prev => ({ ...prev, peRatioRange: [prev.peRatioRange[0], Number(e.target.value)] }))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>P/B Ratio</span>
                  <span className="font-bold text-slate-900 dark:text-white">&le; {filters.pbRatioRange[1]}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="40"
                  step="0.5"
                  value={filters.pbRatioRange[1]}
                  onChange={(e) => setFilters(prev => ({ ...prev, pbRatioRange: [prev.pbRatioRange[0], Number(e.target.value)] }))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Min Dividend Yield</span>
                  <span className="font-bold text-slate-900 dark:text-white">&ge; {filters.dividendYieldRange[0]}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.25"
                  value={filters.dividendYieldRange[0]}
                  onChange={(e) => setFilters(prev => ({ ...prev, dividendYieldRange: [Number(e.target.value), prev.dividendYieldRange[1]] }))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Profitability & Quality */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Profitability & Quality
              </h4>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Min ROE (%)</span>
                  <span className="font-bold text-slate-900 dark:text-white">&ge; {filters.roeRange[0]}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={filters.roeRange[0]}
                  onChange={(e) => setFilters(prev => ({ ...prev, roeRange: [Number(e.target.value), prev.roeRange[1]] }))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Min ROCE (%)</span>
                  <span className="font-bold text-slate-900 dark:text-white">&ge; {filters.roceRange[0]}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={filters.roceRange[0]}
                  onChange={(e) => setFilters(prev => ({ ...prev, roceRange: [Number(e.target.value), prev.roceRange[1]] }))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Max Debt to Equity</span>
                  <span className="font-bold text-slate-900 dark:text-white">&le; {filters.deRange[1]}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={filters.deRange[1]}
                  onChange={(e) => setFilters(prev => ({ ...prev, deRange: [prev.deRange[0], Number(e.target.value)] }))}
                  className="w-full accent-emerald-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Growth */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">
                Growth (3-Year CAGR)
              </h4>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Min Sales Growth</span>
                  <span className="font-bold text-slate-900 dark:text-white">&ge; {filters.revenueGrowthRange[0]}%</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="50"
                  value={filters.revenueGrowthRange[0]}
                  onChange={(e) => setFilters(prev => ({ ...prev, revenueGrowthRange: [Number(e.target.value), prev.revenueGrowthRange[1]] }))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>Min Profit Growth</span>
                  <span className="font-bold text-slate-900 dark:text-white">&ge; {filters.profitGrowthRange[0]}%</span>
                </div>
                <input
                  type="range"
                  min="-20"
                  max="50"
                  value={filters.profitGrowthRange[0]}
                  onChange={(e) => setFilters(prev => ({ ...prev, profitGrowthRange: [Number(e.target.value), prev.profitGrowthRange[1]] }))}
                  className="w-full accent-cyan-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Technicals */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Technicals & Trend
              </h4>
              <div>
                <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                  <span>RSI (14) Range</span>
                  <span className="font-bold text-slate-900 dark:text-white">{filters.rsiRange[0]} - {filters.rsiRange[1]}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.rsiRange[0]}
                    onChange={(e) => setFilters(prev => ({ ...prev, rsiRange: [Number(e.target.value), prev.rsiRange[1]] }))}
                    className="w-1/2 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white text-center font-medium"
                    placeholder="Min"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.rsiRange[1]}
                    onChange={(e) => setFilters(prev => ({ ...prev, rsiRange: [prev.rsiRange[0], Number(e.target.value)] }))}
                    className="w-1/2 p-2 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white text-center font-medium"
                    placeholder="Max"
                  />
                </div>
              </div>
              <div>
                <span className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">200-Day Moving Average</span>
                <div className="flex gap-1.5 text-xs">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, above200dma: null }))}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                      filters.above200dma === null
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Any
                  </button>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, above200dma: true }))}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                      filters.above200dma === true
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Above
                  </button>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, above200dma: false }))}
                    className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                      filters.above200dma === false
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    Below
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </GlassCard>

      {/* 4. MULTI-VIEW TABS & VIEW MODE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-3">
        {/* Table View Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5 -webkit-overflow-scrolling-touch">
          {(
            [
              { id: 'overview', label: 'Overview' },
              { id: 'valuation', label: 'Valuation' },
              { id: 'profitability', label: 'Profitability & Health' },
              { id: 'technicals', label: 'Technicals & Momentum' },
              { id: 'ownership', label: 'Shareholding & Consensus' }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* View Toggle & Counts */}
        <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto">
          {/* Current Count */}
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            <span>
              Showing <strong className="text-slate-900 dark:text-white font-bold">{displayedStocks.length}</strong> of{' '}
              <strong className="text-slate-900 dark:text-white font-bold">{showWatchlistOnly ? watchlistItems.length : total}</strong>
            </span>
          </div>

          {/* Table / Card View Toggle */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Table View"
            >
              <LayoutList className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('card')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'card'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Card View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. DATA CONTENT (TABLE OR CARD VIEW) */}
      <GlassCard className="overflow-hidden p-0 border border-slate-200/80 dark:border-slate-800 shadow-sm">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mx-auto" />
            <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
              Scanning stock databases & calculating ratios...
            </p>
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3">
            <Info className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-sm font-semibold text-rose-600 dark:text-rose-400 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => loadStocks(true)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer inline-flex items-center gap-1.5 mx-auto"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>
        ) : displayedStocks.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <Search className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {showWatchlistOnly ? 'Your Watchlist is Empty' : 'No Companies Matched Your Screen'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              {showWatchlistOnly
                ? 'Click the bookmark icon in the Watchlist column on any stock to track it in your watchlist.'
                : 'Try adjusting your valuation or quality filters, or clear your search term to see more results.'}
            </p>
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
            >
              {showWatchlistOnly ? 'Show All Stocks' : 'Reset Filters'}
            </button>
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW WITH STICKY COMPANY COLUMN */
          <div>
            <div className="block lg:hidden px-4 py-2 bg-slate-100/70 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800 text-center font-medium">
              ← Swipe horizontally to view all financial metrics →
            </div>

            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse text-sm min-w-[760px] sm:min-w-[960px]">
                <thead>
                  <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {/* Sticky Company Column */}
                    <th className="py-3 px-3 sm:py-3.5 sm:px-4 sticky left-0 z-20 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md min-w-[130px] sm:min-w-[190px] border-r border-slate-200/80 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                      <button
                        onClick={() => handleSort('symbol')}
                        className="flex items-center gap-1 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                      >
                        <span>Company / Symbol</span>
                        {sortBy === 'symbol' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />)}
                      </button>
                    </th>

                    {activeTab === 'overview' && (
                      <>
                        <th className="py-3.5 px-3">Sector</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('price')}>
                          <span className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                            Price (₹)
                            {sortBy === 'price' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />)}
                          </span>
                        </th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('dayChangePercent')}>
                          <span className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                            1D Change
                            {sortBy === 'dayChangePercent' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />)}
                          </span>
                        </th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('oneYearReturn')}>
                          <span className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                            1Y Return
                            {sortBy === 'oneYearReturn' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />)}
                          </span>
                        </th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('marketCap')}>
                          <span className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white">
                            Market Cap
                            {sortBy === 'marketCap' && (sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-500" /> : <ArrowDown className="w-3 h-3 text-indigo-500" />)}
                          </span>
                        </th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('peRatio')}>
                          <span>P/E</span>
                        </th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('roe')}>
                          <span>ROE (%)</span>
                        </th>
                        <th className="py-3.5 px-3 text-center">Trend (7D)</th>
                        {/* Meaningful Watchlist Column Header */}
                        <th className="py-3.5 px-3 sm:px-4 text-center min-w-[95px]">
                          <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-300">
                            <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                            <span>Watchlist</span>
                          </span>
                        </th>
                      </>
                    )}

                    {activeTab === 'valuation' && (
                      <>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('price')}>Price (₹)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('peRatio')}>P/E</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('sectorPe')}>Sector P/E</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('pbRatio')}>P/B</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('evEbitda')}>EV/EBITDA</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('dividendYield')}>Div Yield (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('bookValue')}>Book Value (₹)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('eps')}>EPS (₹)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('marketCap')}>Market Cap (Cr)</th>
                      </>
                    )}

                    {activeTab === 'profitability' && (
                      <>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('roe')}>ROE (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('roce')}>ROCE (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('opm')}>OPM (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('npm')}>NPM (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('debtToEquity')}>Debt / Equity</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('interestCoverage')}>Interest Cov</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('revenueGrowth3y')}>3Y Sales (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('profitGrowth3y')}>3Y Profit (%)</th>
                      </>
                    )}

                    {activeTab === 'technicals' && (
                      <>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('price')}>Price (₹)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('rsi')}>RSI (14)</th>
                        <th className="py-3.5 px-3 text-center">50 DMA</th>
                        <th className="py-3.5 px-3 text-center">200 DMA</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('high52wPercent')}>From 52W High</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('oneWeekReturn')}>1W Change</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('oneMonthReturn')}>1M Change</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('beta')}>Beta</th>
                      </>
                    )}

                    {activeTab === 'ownership' && (
                      <>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('promoterHolding')}>Promoter (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('fiiHolding')}>FII (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('diiHolding')}>DII (%)</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('publicHolding')}>Public (%)</th>
                        <th className="py-3.5 px-3 text-center">Consensus Rating</th>
                        <th className="py-3.5 px-3 text-right cursor-pointer" onClick={() => handleSort('marketCap')}>Market Cap</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {displayedStocks.map((stock) => {
                    const isGain = Number(stock.dayChangePercent || 0) >= 0;
                    const is1YGain = Number(stock.oneYearReturn || 0) >= 0;
                    const isWatched = watchlistSymbols.has(stock.symbol);

                    return (
                      <tr
                        key={stock.id || stock.symbol}
                        onClick={() => setSelectedStock(stock)}
                        className="hover:bg-indigo-50/40 dark:hover:bg-indigo-500/5 transition-colors cursor-pointer group"
                      >
                        {/* Sticky Company Cell */}
                        <td className="py-3 px-3 sm:py-3.5 sm:px-4 sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 group-hover:bg-indigo-50/60 dark:group-hover:bg-slate-800/80 transition-colors border-r border-slate-200/80 dark:border-slate-800 min-w-[130px] sm:min-w-[190px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                          <div className="flex items-center justify-between gap-1.5 sm:gap-2">
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1 sm:gap-1.5">
                                <span className="text-xs sm:text-sm">{stock.symbol}</span>
                                {isWatched && (
                                  <span title="In Watchlist" className="inline-flex items-center">
                                    <Bookmark className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                                  </span>
                                )}
                                {stock.marketCapCategory === 'Large' && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/50">
                                    LARGE
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[120px] sm:max-w-[160px]">
                                {stock.name}
                              </div>
                            </div>
                          </div>
                        </td>

                        {activeTab === 'overview' && (
                          <>
                            <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300">
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700 whitespace-nowrap">
                                {stock.sector}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              ₹{Number(stock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                              <span className={`inline-flex items-center gap-0.5 ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                {isGain ? '+' : ''}{Number(stock.dayChangePercent || 0).toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                              <span className={is1YGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {is1YGain ? '+' : ''}{Number(stock.oneYearReturn || 0).toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                              ₹{Math.round(Number(stock.marketCap || 0)).toLocaleString('en-IN')} Cr
                            </td>
                            <td className="py-3.5 px-3 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                              {Number(stock.peRatio || 0).toFixed(1)}
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {Number(stock.roe || 0).toFixed(1)}%
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <Sparkline points={stock.sparkline} isPositive={isGain} />
                            </td>

                            {/* Meaningful Watchlist Action Button */}
                            <td className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={(e) => toggleWatchlist(e, stock)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                                  isWatched
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-xs ring-1 ring-amber-500/20'
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-white hover:border-indigo-400'
                                }`}
                                title={isWatched ? `Remove ${stock.symbol} from Watchlist` : `Add ${stock.symbol} to Watchlist`}
                              >
                                <Bookmark className={`w-3.5 h-3.5 ${isWatched ? 'fill-amber-500 text-amber-500' : ''}`} />
                                <span className="hidden sm:inline font-bold">
                                  {isWatched ? 'Saved' : '+ Save'}
                                </span>
                              </button>
                            </td>
                          </>
                        )}

                        {activeTab === 'valuation' && (
                          <>
                            <td className="py-3.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                              ₹{Number(stock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{Number(stock.peRatio || 0).toFixed(1)}</td>
                            <td className="py-3.5 px-3 text-right text-slate-500 dark:text-slate-400 whitespace-nowrap">{Number(stock.sectorPe || 0).toFixed(1)}</td>
                            <td className="py-3.5 px-3 text-right font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">{Number(stock.pbRatio || 0).toFixed(2)}</td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 whitespace-nowrap">{Number(stock.evEbitda || 0).toFixed(1)}</td>
                            <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{Number(stock.dividendYield || 0).toFixed(2)}%</td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 whitespace-nowrap">₹{Number(stock.bookValue || 0).toFixed(1)}</td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 whitespace-nowrap">₹{Number(stock.eps || 0).toFixed(1)}</td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">₹{Math.round(Number(stock.marketCap || 0)).toLocaleString('en-IN')} Cr</td>
                          </>
                        )}

                        {activeTab === 'profitability' && (
                          <>
                            <td className="py-3.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{Number(stock.roe || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-right font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">{Number(stock.roce || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 whitespace-nowrap">{Number(stock.opm || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 whitespace-nowrap">{Number(stock.npm || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{Number(stock.debtToEquity || 0).toFixed(2)}</td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 whitespace-nowrap">{Number(stock.interestCoverage || 0).toFixed(1)}x</td>
                            <td className="py-3.5 px-3 text-right text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap">+{Number(stock.revenueGrowth3y || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-right text-cyan-600 dark:text-cyan-400 font-medium whitespace-nowrap">+{Number(stock.profitGrowth3y || 0).toFixed(1)}%</td>
                          </>
                        )}

                        {activeTab === 'technicals' && (
                          <>
                            <td className="py-3.5 px-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">₹{Number(stock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                              <span className={Number(stock.rsi || 0) > 70 ? 'text-rose-600 dark:text-rose-400' : Number(stock.rsi || 0) < 35 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200'}>
                                {Number(stock.rsi || 0).toFixed(1)}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                stock.above50dma
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                              }`}>
                                {stock.above50dma ? 'ABOVE' : 'BELOW'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                stock.above200dma
                                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                              }`}>
                                {stock.above200dma ? 'ABOVE' : 'BELOW'}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right text-slate-600 dark:text-slate-400 font-medium whitespace-nowrap">
                              {Number(stock.high52wPercent || 0).toFixed(1)}%
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                              <span className={Number(stock.oneWeekReturn || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {Number(stock.oneWeekReturn || 0) >= 0 ? '+' : ''}{Number(stock.oneWeekReturn || 0).toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right font-bold whitespace-nowrap">
                              <span className={Number(stock.oneMonthReturn || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                {Number(stock.oneMonthReturn || 0) >= 0 ? '+' : ''}{Number(stock.oneMonthReturn || 0).toFixed(2)}%
                              </span>
                            </td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 font-medium whitespace-nowrap">{Number(stock.beta || 1.0).toFixed(2)}</td>
                          </>
                        )}

                        {activeTab === 'ownership' && (
                          <>
                            <td className="py-3.5 px-3 text-right font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{Number(stock.promoterHolding || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">{Number(stock.fiiHolding || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-right font-bold text-teal-600 dark:text-teal-400 whitespace-nowrap">{Number(stock.diiHolding || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-right text-slate-600 dark:text-slate-400 whitespace-nowrap">{Number(stock.publicHolding || 0).toFixed(1)}%</td>
                            <td className="py-3.5 px-3 text-center whitespace-nowrap">
                              {renderRatingBadge(stock.analystRating)}
                            </td>
                            <td className="py-3.5 px-3 text-right text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap">
                              ₹{Math.round(Number(stock.marketCap || 0)).toLocaleString('en-IN')} Cr
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* CARD VIEW (IDEAL FOR MOBILE & TOUCH DEVICES) */
          <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
            {displayedStocks.map((stock) => {
              const isGain = Number(stock.dayChangePercent || 0) >= 0;
              const is1YGain = Number(stock.oneYearReturn || 0) >= 0;
              const isWatched = watchlistSymbols.has(stock.symbol);

              return (
                <div
                  key={stock.id || stock.symbol}
                  onClick={() => setSelectedStock(stock)}
                  className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-xs hover:shadow-md cursor-pointer flex flex-col justify-between group space-y-3"
                >
                  {/* Card Header: Symbol, Name, Sector, MarketCap */}
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                            {stock.symbol}
                          </span>
                          {isWatched && (
                            <span title="In Watchlist" className="inline-flex items-center">
                              <Bookmark className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                            </span>
                          )}
                          {stock.marketCapCategory === 'Large' && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200 dark:border-indigo-800/50">
                              LARGE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                          {stock.name}
                        </p>
                      </div>

                      <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 shrink-0">
                        {stock.sector}
                      </span>
                    </div>

                    {/* Price, 1D % Change, Sparkline */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                      <div>
                        <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                          ₹{Number(stock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`text-xs font-bold ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isGain ? '+' : ''}{Number(stock.dayChangePercent || 0).toFixed(2)}%
                          </span>
                          <span className="text-[11px] text-slate-400">1D</span>
                          <span className="text-[11px] text-slate-300 dark:text-slate-700">•</span>
                          <span className={`text-xs font-semibold ${is1YGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {is1YGain ? '+' : ''}{Number(stock.oneYearReturn || 0).toFixed(1)}% 1Y
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <Sparkline points={stock.sparkline} isPositive={isGain} />
                      </div>
                    </div>
                  </div>

                  {/* Contextual Metric Chips based on active tab */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800/80 text-[11px]">
                    {activeTab === 'overview' && (
                      <>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">P/E</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-bold">{Number(stock.peRatio || 0).toFixed(1)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">ROE</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{Number(stock.roe || 0).toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">M-Cap</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-bold truncate block">₹{Math.round(Number(stock.marketCap || 0)).toLocaleString('en-IN')} Cr</strong>
                        </div>
                      </>
                    )}

                    {activeTab === 'valuation' && (
                      <>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">P/E</span>
                          <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{Number(stock.peRatio || 0).toFixed(1)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">P/B</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-bold">{Number(stock.pbRatio || 0).toFixed(2)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Div Yield</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{Number(stock.dividendYield || 0).toFixed(2)}%</strong>
                        </div>
                      </>
                    )}

                    {activeTab === 'profitability' && (
                      <>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">ROE</span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{Number(stock.roe || 0).toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">ROCE</span>
                          <strong className="text-teal-600 dark:text-teal-400 font-bold">{Number(stock.roce || 0).toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Debt/Eq</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-bold">{Number(stock.debtToEquity || 0).toFixed(2)}</strong>
                        </div>
                      </>
                    )}

                    {activeTab === 'technicals' && (
                      <>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">RSI (14)</span>
                          <strong className="text-cyan-600 dark:text-cyan-400 font-bold">{Number(stock.rsi || 0).toFixed(1)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">50 DMA</span>
                          <strong className={`font-bold ${stock.above50dma ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {stock.above50dma ? 'ABOVE' : 'BELOW'}
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">200 DMA</span>
                          <strong className={`font-bold ${stock.above200dma ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {stock.above200dma ? 'ABOVE' : 'BELOW'}
                          </strong>
                        </div>
                      </>
                    )}

                    {activeTab === 'ownership' && (
                      <>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">Promoter</span>
                          <strong className="text-slate-800 dark:text-slate-200 font-bold">{Number(stock.promoterHolding || 0).toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">FII</span>
                          <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{Number(stock.fiiHolding || 0).toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span className="text-slate-400 dark:text-slate-500 block text-[10px]">DII</span>
                          <strong className="text-teal-600 dark:text-teal-400 font-bold">{Number(stock.diiHolding || 0).toFixed(1)}%</strong>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Card Action Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStock(stock);
                      }}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      View Details →
                    </button>

                    <button
                      onClick={(e) => toggleWatchlist(e, stock)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                        isWatched
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300 font-bold shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isWatched ? 'fill-amber-500 text-amber-500' : ''}`} />
                      <span>{isWatched ? 'Saved' : '+ Watchlist'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINATION FOOTER */}
        {!loading && displayedStocks.length > 0 && !showWatchlistOnly && (
          <div className="p-3.5 sm:p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
              <span>Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-2.5 py-1.5 outline-none font-semibold shadow-sm"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="ml-1 sm:ml-2">Page {page} of {totalPages}</span>
            </div>

            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
                disabled={page <= 1}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 font-semibold shadow-sm"
              >
                Previous
              </button>
              {getPageNumbers().map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl font-bold transition-all text-xs sm:text-sm ${
                    page === pageNum
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
              <button
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages}
                className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-200 dark:border-slate-700 font-semibold shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </GlassCard>

      {/* 6. STOCK QUICK DETAIL MODAL */}
      {selectedStock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-4 sm:p-6 sm:p-7 space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 sm:pb-4 border-b border-slate-200/80 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">{selectedStock.name}</h3>
                  <Badge type="primary">{selectedStock.sector}</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono">
                  NSE: {selectedStock.symbol} • {selectedStock.industry || 'Equities'}
                </p>
              </div>
              <button
                onClick={() => setSelectedStock(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Price & 52-Week Range */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Current Market Price
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                    ₹{Number(selectedStock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  <span className={`text-xs sm:text-sm font-bold ${
                    Number(selectedStock.dayChangePercent || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {Number(selectedStock.dayChangePercent || 0) >= 0 ? '+' : ''}
                    {Number(selectedStock.dayChangePercent || 0).toFixed(2)}%
                  </span>
                </div>
                <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Market Cap: <strong className="text-slate-900 dark:text-white">₹{Math.round(Number(selectedStock.marketCap || 0)).toLocaleString('en-IN')} Cr</strong>
                </div>
              </div>

              <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  52-Week Range
                </span>
                <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 mt-1 font-bold">
                  <span>₹{Number(selectedStock.low52w || 0).toFixed(1)}</span>
                  <span>₹{Number(selectedStock.high52w || 0).toFixed(1)}</span>
                </div>
                {/* 52w range bar */}
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full mt-2 relative overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400 h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max(5, ((Number(selectedStock.price) - Number(selectedStock.low52w)) / (Number(selectedStock.high52w) - Number(selectedStock.low52w) || 1)) * 100))}%`
                    }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  <span>52W Low</span>
                  <span>52W High</span>
                </div>
              </div>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">P/E Ratio</span>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5">{Number(selectedStock.peRatio || 0).toFixed(1)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">P/B Ratio</span>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5">{Number(selectedStock.pbRatio || 0).toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">ROE</span>
                <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{Number(selectedStock.roe || 0).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">ROCE</span>
                <p className="text-sm sm:text-base font-bold text-teal-600 dark:text-teal-400 mt-0.5">{Number(selectedStock.roce || 0).toFixed(1)}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">Debt / Equity</span>
                <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-0.5">{Number(selectedStock.debtToEquity || 0).toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">Div Yield</span>
                <p className="text-sm sm:text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{Number(selectedStock.dividendYield || 0).toFixed(2)}%</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">RSI (14)</span>
                <p className="text-sm sm:text-base font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">{Number(selectedStock.rsi || 0).toFixed(1)}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 text-[11px] font-semibold">Consensus</span>
                <div className="mt-1">{renderRatingBadge(selectedStock.analystRating)}</div>
              </div>
            </div>

            {/* Shareholding breakdown */}
            <div className="p-3.5 sm:p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Shareholding Pattern
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Promoter</span>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">{Number(selectedStock.promoterHolding || 0).toFixed(1)}%</p>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">FII</span>
                  <p className="font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">{Number(selectedStock.fiiHolding || 0).toFixed(1)}%</p>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">DII</span>
                  <p className="font-bold text-teal-600 dark:text-teal-400 mt-0.5">{Number(selectedStock.diiHolding || 0).toFixed(1)}%</p>
                </div>
                <div className="p-2 sm:p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400 text-[11px]">Public</span>
                  <p className="font-bold text-slate-600 dark:text-slate-400 mt-0.5">{Number(selectedStock.publicHolding || 0).toFixed(1)}%</p>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2.5 sm:gap-3 pt-3 sm:pt-4 border-t border-slate-200/80 dark:border-slate-800">
              <button
                onClick={() => setSelectedStock(null)}
                className="px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Close
              </button>
              <button
                onClick={(e) => toggleWatchlist(e, selectedStock)}
                className={`inline-flex items-center gap-1.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-xl text-xs font-semibold transition-all shadow-md ${
                  watchlistSymbols.has(selectedStock.symbol)
                    ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30'
                }`}
              >
                <Bookmark className={`w-3.5 h-3.5 ${watchlistSymbols.has(selectedStock.symbol) ? 'fill-white text-white' : ''}`} />
                <span>
                  {watchlistSymbols.has(selectedStock.symbol)
                    ? 'Saved in Watchlist (Click to Remove)'
                    : '+ Add to Watchlist'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. WATCHLIST HUB MODAL (WHERE USERS VIEW & MANAGE ALL WATCHLISTED STOCKS) */}
      {showWatchlistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-2xl sm:rounded-3xl max-w-2xl w-full max-h-[88vh] overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Bookmark className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    My Stock Watchlist
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {watchlistItems.length} {watchlistItems.length === 1 ? 'company' : 'companies'} saved • Stored in your browser
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowWatchlistModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Items List */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              {watchlistItems.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <Bookmark className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Your Watchlist is Currently Empty
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                    Click the <strong>+ Save</strong> button or bookmark icon in any table row to save high-conviction stocks here.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {watchlistItems.map((item) => {
                    const isGain = (item.dayChangePercent || 0) >= 0;
                    return (
                      <div
                        key={item.symbol}
                        className="p-3 sm:p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-3 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
                      >
                        {/* Company Info */}
                        <div
                          className="flex-1 cursor-pointer"
                          onClick={() => {
                            const found = stocks.find(s => s.symbol === item.symbol);
                            if (found) {
                              setSelectedStock(found);
                              setShowWatchlistModal(false);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-sm text-slate-900 dark:text-white hover:text-indigo-600 transition-colors">
                              {item.symbol}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium">
                              {item.sector}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs mt-0.5">
                            {item.name}
                          </p>
                        </div>

                        {/* Price & 1D Change */}
                        <div className="text-right shrink-0">
                          <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white">
                            ₹{Number(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </div>
                          <div className={`text-[11px] font-bold ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {isGain ? '+' : ''}{Number(item.dayChangePercent || 0).toFixed(2)}%
                          </div>
                        </div>

                        {/* Delete Button */}
                        <button
                          onClick={() => removeFromWatchlist(item.symbol)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Remove from Watchlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {watchlistItems.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between text-xs">
                <button
                  onClick={clearWatchlist}
                  className="text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowWatchlistOnly(true);
                      setShowWatchlistModal(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-600/30"
                  >
                    Filter Screener By Watchlist
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. FLOATING WATCHLIST TOAST NOTIFICATION */}
      {watchlistToast && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className="px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xl border border-slate-700 dark:border-slate-300 flex items-center gap-2.5 text-xs font-semibold">
            <Bookmark className={`w-4 h-4 ${watchlistToast.added ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
            <span>
              {watchlistToast.added
                ? `Added ${watchlistToast.symbol} to your Watchlist`
                : `Removed ${watchlistToast.symbol} from Watchlist`}
            </span>
            <button
              onClick={() => setShowWatchlistModal(true)}
              className="ml-1 text-indigo-400 dark:text-indigo-600 underline font-bold hover:opacity-80"
            >
              View
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Screeners;
