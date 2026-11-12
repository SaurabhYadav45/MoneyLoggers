import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Search,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Coins,
  Shield,
  Star,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  Loader2,
  X,
  AlertCircle,
  BarChart3
} from 'lucide-react';
import type { MutualFund, MutualFundDetail } from '../types';
import {
  getScreenerFunds,
  getCuratedCollections,
  getFundHouses,
  compareMutualFunds,
  getCachedScreener,
  type CuratedCollection
} from '../services/mutualFundService';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

type CategoryType = 'all' | 'Equity' | 'Debt' | 'Hybrid' | 'Index' | 'Solution Oriented';
type ViewMode = 'table' | 'card';

const CATEGORIES: { label: string; value: CategoryType }[] = [
  { label: 'All Funds', value: 'all' },
  { label: 'Equity', value: 'Equity' },
  { label: 'Debt', value: 'Debt' },
  { label: 'Hybrid', value: 'Hybrid' },
  { label: 'Index Funds', value: 'Index' },
  { label: 'Tax Saver (ELSS)', value: 'Solution Oriented' }
];

const SUB_CATEGORIES = [
  'All Sub-Categories',
  'Small Cap',
  'Mid Cap',
  'Large Cap',
  'Flexi Cap',
  'Tax Saver (ELSS)',
  'Balanced Advantage',
  'Liquid',
  'Index Fund',
  'International'
];

const FUND_HOUSES = [
  'All Fund Houses',
  'Quant Mutual Fund',
  'PPFAS Mutual Fund',
  'HDFC Mutual Fund',
  'Nippon India Mutual Fund',
  'UTI Mutual Fund',
  'Mirae Asset Mutual Fund',
  'ICICI Prudential Mutual Fund',
  'Aditya Birla Sun Life Mutual Fund',
  'Motilal Oswal Mutual Fund'
];

const SORT_OPTIONS = [
  { label: '3-Year Returns (Highest)', field: 'returns3Y', order: 'desc' },
  { label: '1-Year Returns (Highest)', field: 'returns1Y', order: 'desc' },
  { label: '5-Year Returns (Highest)', field: 'returns5Y', order: 'desc' },
  { label: 'AUM / Fund Size (Highest)', field: 'aum', order: 'desc' },
  { label: 'Expense Ratio (Lowest)', field: 'expenseRatio', order: 'asc' },
  { label: 'Rating (Highest Stars)', field: 'riskRating', order: 'desc' }
];

const MutualFunds: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL state synchronization
  const initialCategory = (searchParams.get('category') as CategoryType) || 'all';
  const initialCollection = searchParams.get('collection') || 'all';

  // Check in-memory client cache to instantly show funds without any loading spinner or network delay
  const initialCacheKey = useMemo(() => JSON.stringify({
    category: initialCategory === 'all' ? undefined : initialCategory,
    collection: initialCollection === 'all' ? undefined : initialCollection,
    sortBy: SORT_OPTIONS[0].field,
    sortOrder: SORT_OPTIONS[0].order,
    limit: 100
  }), [initialCategory, initialCollection]);

  const initialCachedData = useMemo(() => getCachedScreener(initialCacheKey), [initialCacheKey]);

  const [funds, setFunds] = useState<MutualFund[]>(() => initialCachedData?.funds || []);
  const [collections, setCollections] = useState<CuratedCollection[]>([]);
  const [availableFundHouses, setAvailableFundHouses] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(() => !initialCachedData || initialCachedData.funds.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Filters & Controls
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>(initialCategory);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('All Sub-Categories');
  const [selectedFundHouse, setSelectedFundHouse] = useState<string>('All Fund Houses');
  const [activeCollection, setActiveCollection] = useState<string>(initialCollection);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedSort, setSelectedSort] = useState(SORT_OPTIONS[0]);
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Dynamically compute sub-categories from active funds
  const dynamicSubCategories = useMemo(() => {
    const subs = new Set<string>();
    funds.forEach((f) => {
      if (f.subCategory) subs.add(f.subCategory);
    });
    return ['All Sub-Categories', ...Array.from(subs).sort()];
  }, [funds]);

  // Sync URL search param if it changes dynamically
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  // Fetch Curated Collections and Live Fund Houses
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [collData, amcData] = await Promise.all([
          getCuratedCollections(),
          getFundHouses()
        ]);
        setCollections(collData);
        if (amcData && amcData.length > 0) {
          setAvailableFundHouses(['All Fund Houses', ...amcData]);
        }
      } catch (err) {
        console.error('Failed to load metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Compare Feature State
  const [compareList, setCompareList] = useState<MutualFund[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [comparingFundsData, setComparingFundsData] = useState<MutualFundDetail[]>([]);
  const [compareLoading, setCompareLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => {
    return new Date().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  });

  // Compute top 3Y return performer for pulse stats
  const topPerformer = useMemo(() => {
    if (!funds || funds.length === 0) return null;
    return [...funds].sort((a, b) => Number(b.returns3Y || 0) - Number(a.returns3Y || 0))[0];
  }, [funds]);

  // Fetch Screener Funds
  const loadFunds = async () => {
    try {
      if (funds.length === 0) {
        setLoading(true);
      }

      const res = await getScreenerFunds({
        category: selectedCategory === 'all' ? undefined : selectedCategory,
        subCategory: selectedSubCategory === 'All Sub-Categories' ? undefined : selectedSubCategory,
        fundHouse: selectedFundHouse === 'All Fund Houses' ? undefined : selectedFundHouse,
        collection: activeCollection === 'all' ? undefined : activeCollection,
        search: searchQuery.trim() || undefined,
        sortBy: selectedSort.field,
        sortOrder: selectedSort.order as 'asc' | 'desc',
        limit: 100
      });

      setFunds(res.funds);
      setError(null);
      setLastSyncTime(new Date().toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }));
    } catch (err: any) {
      console.error('Error fetching mutual funds:', err);
      setError(err.message || 'Failed to load mutual funds');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFunds();
  }, [selectedCategory, selectedSubCategory, selectedFundHouse, activeCollection, selectedSort]);

  // Handle Search submit / debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadFunds();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Toggle Collection Filter
  const handleCollectionClick = (collectionId: string) => {
    if (activeCollection === collectionId) {
      setActiveCollection('all');
      setSearchParams({});
    } else {
      setActiveCollection(collectionId);
      setSelectedCategory('all');
      setSelectedSubCategory('All Sub-Categories');
      setSearchParams({ collection: collectionId });
    }
  };

  // Compare Checkbox Handler (Max 3)
  const toggleCompare = (fund: MutualFund) => {
    const exists = compareList.some((f) => f.schemeCode === fund.schemeCode || f.id === fund.id);
    if (exists) {
      setCompareList(compareList.filter((f) => f.schemeCode !== fund.schemeCode && f.id !== fund.id));
    } else {
      if (compareList.length >= 3) {
        alert('You can compare a maximum of 3 mutual funds at once.');
        return;
      }
      setCompareList([...compareList, fund]);
    }
  };

  // Open Compare Modal
  const openCompareModal = async () => {
    if (compareList.length < 2) return;
    try {
      setCompareLoading(true);
      setCompareModalOpen(true);
      const codes = compareList.map((f) => f.schemeCode || f.id);
      const details = await compareMutualFunds(codes);
      setComparingFundsData(details);
    } catch (err) {
      console.error('Failed to load comparison data:', err);
    } finally {
      setCompareLoading(false);
    }
  };

  const getRiskometerBadge = (riskometer?: string) => {
    switch (riskometer) {
      case 'Low':
      case 'Moderately Low':
        return <Badge type="success">{riskometer.toUpperCase()}</Badge>;
      case 'Moderate':
        return <Badge type="warning">MODERATE</Badge>;
      case 'Moderately High':
        return <Badge type="warning">MOD. HIGH</Badge>;
      case 'Very High':
      case 'High':
      default:
        return <Badge type="danger">VERY HIGH</Badge>;
    }
  };

  const renderStars = (rating?: number | null) => {
    if (!rating || rating <= 0) {
      return (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          title="Unrated (requires at least 3 years track record under SEBI/CRISIL rules)"
        >
          Unrated
        </span>
      );
    }
    return (
      <div className="flex items-center gap-0.5 text-amber-400" title={`${rating} Star Rating`}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${
              i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
            }`}
          />
        ))}
      </div>
    );
  };

  const formatReturnText = (val?: number | null, isBold3Y = false) => {
    if (val === null || val === undefined) {
      return (
        <span
          className="text-slate-400 dark:text-slate-500 font-medium text-xs cursor-help"
          title="Fund has not completed this time horizon yet (launched recently)"
        >
          N/A
        </span>
      );
    }
    const isPos = val >= 0;
    if (isBold3Y) {
      return (
        <span
          className={`font-bold px-2 py-0.5 rounded-lg text-xs ${
            val >= 20
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : isPos
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          {isPos ? '+' : ''}{val}%
        </span>
      );
    }
    return (
      <span
        className={`font-semibold ${
          isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
        }`}
      >
        {isPos ? '+' : ''}{val}%
      </span>
    );
  };

  const getCollectionIcon = (icon: string) => {
    switch (icon) {
      case 'TrendingUp':
        return <TrendingUp className="w-5 h-5 text-emerald-500" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-5 h-5 text-blue-500" />;
      case 'Sparkles':
        return <Sparkles className="w-5 h-5 text-amber-500" />;
      case 'Coins':
        return <Coins className="w-5 h-5 text-purple-500" />;
      case 'Shield':
      default:
        return <Shield className="w-5 h-5 text-cyan-500" />;
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* 1. HERO HEADER (Adaptive Light/Dark Theme matching MoneyLogger) */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-slate-950 p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-md transition-colors">
        {/* Ambient Subtle Glow Orbs */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-60 h-60 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-60 h-60 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30">
                <Sparkles className="w-3 h-3" />
                100% REAL DATA & INSTITUTIONAL PIPELINE
              </span>
              <span className="text-[11px] text-slate-500 dark:text-indigo-200 font-medium">
                Direct Growth Schemes • Daily NAV Sync
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Mutual Funds Explorer
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-normal">
              Screen India&apos;s top-performing direct schemes, risk-adjusted returns, historical NAV trajectories, and portfolio allocation analytics.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-1 md:pt-0">
            {compareList.length >= 2 && (
              <button
                onClick={openCompareModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all active:scale-95"
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Compare ({compareList.length})</span>
              </button>
            )}

            {/* Synced Pill */}
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs font-medium border border-slate-200/80 dark:border-white/10 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Synced:</span>
              <span className="font-bold text-slate-800 dark:text-white font-mono">{lastSyncTime}</span>
            </div>
          </div>
        </div>

        {/* 4 Quick Market Pulse Cards */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Active Schemes
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
              {funds.length} Direct Plans
            </span>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Top 3Y Performer
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">
              {topPerformer ? `${topPerformer.name} (+${Number(topPerformer.returns3Y || 0).toFixed(1)}%)` : '--'}
            </span>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Curated Collections
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 truncate">
              {collections.length} Investment Themes
            </span>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Multi-Scheme Compare
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-cyan-600 dark:text-cyan-400 mt-0.5">
              {compareList.length > 0 ? `${compareList.length} Selected` : 'Select up to 3'}
            </span>
          </div>
        </div>
      </div>

      {/* Curated Collections Bar */}
      {collections.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Curated Collections & Themes
            </span>
            {activeCollection !== 'all' && (
              <button
                onClick={() => {
                  setActiveCollection('all');
                  setSearchParams({});
                }}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear Collection Filter
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
            {collections.map((col) => {
              const isActive = activeCollection === col.id;
              return (
                <div
                  key={col.id}
                  onClick={() => handleCollectionClick(col.id)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 group relative overflow-hidden last:col-span-2 last:sm:col-span-1 ${
                    isActive
                      ? 'bg-indigo-500/10 border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                      : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/80 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800 hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:scale-110 transition-transform">
                      {getCollectionIcon(col.icon)}
                    </div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {col.count}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">
                    {col.title}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {col.subtitle}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Filter & Control Panel */}
      <GlassCard className="p-4 sm:p-5 space-y-4">
        {/* Category Pill Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.value && activeCollection === 'all';
            return (
              <button
                key={cat.value}
                onClick={() => {
                  setSelectedCategory(cat.value);
                  setActiveCollection('all');
                }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Filter Dropdowns + Search Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
          {/* Search Box */}
          <div className="lg:col-span-4 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search scheme name, AMC or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sub-Category Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={selectedSubCategory}
              onChange={(e) => setSelectedSubCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(dynamicSubCategories.length > 1 ? dynamicSubCategories : SUB_CATEGORIES).map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* Fund House Dropdown */}
          <div className="lg:col-span-3">
            <select
              value={selectedFundHouse}
              onChange={(e) => setSelectedFundHouse(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {(availableFundHouses.length > 0 ? availableFundHouses : FUND_HOUSES).map((fh) => (
                <option key={fh} value={fh}>
                  {fh}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="lg:col-span-2 flex items-center justify-end gap-1.5">
            <div className="p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center">
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Table View"
              >
                <LayoutList className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
                title="Card Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sort & Quick Badges Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="font-semibold">Sort By:</span>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((opt) => {
                const isSelected = selectedSort.field === opt.field && selectedSort.order === opt.order;
                return (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedSort(opt)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
              Direct - Growth Plans
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Main Content Area: Loading / Empty / Data */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Analyzing mutual fund returns and metrics...
          </p>
        </div>
      ) : error ? (
        <GlassCard className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unable to Load Mutual Funds</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => loadFunds()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </GlassCard>
      ) : funds.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Mutual Funds Match Filters</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Try adjusting your category, sub-category, or search keywords.
          </p>
          <button
            onClick={() => {
              setSelectedCategory('all');
              setSelectedSubCategory('All Sub-Categories');
              setSelectedFundHouse('All Fund Houses');
              setActiveCollection('all');
              setSearchQuery('');
            }}
            className="mt-4 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Reset All Filters
          </button>
        </GlassCard>
      ) : viewMode === 'table' ? (
        /* STICKY TABLE VIEW (OPTIMIZED FOR DESKTOP, TABLET & MOBILE) */
        <GlassCard className="overflow-hidden p-0 shadow-lg">
          {/* Mobile & Tablet horizontal swipe notice */}
          <div className="block lg:hidden px-4 py-2 bg-slate-100/70 dark:bg-slate-800/50 text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-800 text-center font-medium">
            ← Swipe table horizontally to view all returns & fund metrics →
          </div>

          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            <table className="w-full text-left border-collapse text-sm min-w-[840px] sm:min-w-[980px]">
              <thead>
                <tr className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {/* Sticky Scheme & Compare Column */}
                  <th className="py-3 px-3 sm:py-3.5 sm:px-4 sticky left-0 z-20 bg-slate-100/95 dark:bg-slate-900/95 backdrop-blur-md min-w-[170px] sm:min-w-[240px] max-w-[200px] sm:max-w-[320px] border-r border-slate-200/80 dark:border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 font-semibold tracking-wider">CMP</span>
                      <span>Scheme & Fund House</span>
                    </div>
                  </th>
                  <th className="py-3.5 px-3">Rating</th>
                  <th className="py-3.5 px-3">Risk</th>
                  <th className="py-3.5 px-4 text-right">Current NAV</th>
                  <th className="py-3.5 px-3 text-right">1Y Return</th>
                  <th className="py-3.5 px-3 text-right font-bold text-slate-900 dark:text-white">3Y Return</th>
                  <th className="py-3.5 px-3 text-right">5Y Return</th>
                  <th className="py-3.5 px-4 text-right">AUM (Cr)</th>
                  <th className="py-3.5 px-3 text-right">Exp. Ratio</th>
                  <th className="py-3.5 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {funds.map((fund) => {
                  const isCompared = compareList.some((f) => f.schemeCode === fund.schemeCode || f.id === fund.id);
                  return (
                    <tr
                      key={fund.schemeCode || fund.id}
                      className="hover:bg-indigo-500/5 transition-colors group cursor-pointer"
                      onClick={() => navigate(`/mutual-funds/${fund.schemeCode || fund.id}`)}
                    >
                      {/* Sticky Scheme & Compare Cell */}
                      <td className="py-3 px-3 sm:py-3.5 sm:px-4 sticky left-0 z-10 bg-white/95 dark:bg-slate-900/95 group-hover:bg-indigo-50/60 dark:group-hover:bg-slate-800/80 transition-colors border-r border-slate-200/80 dark:border-slate-800 min-w-[170px] sm:min-w-[240px] max-w-[200px] sm:max-w-[320px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center gap-2 sm:gap-2.5">
                          {/* Compare Checkbox */}
                          <div
                            className="shrink-0 p-1 -m-1 cursor-pointer"
                            title={isCompared ? 'Remove from comparison' : 'Add to compare'}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleCompare(fund);
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isCompared}
                              onChange={() => {}}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                            />
                          </div>

                          {/* Scheme Title & Metadata */}
                          <div className="min-w-0 flex-1">
                            <div
                              className="font-semibold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate"
                              title={fund.name}
                            >
                              {fund.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              <span className="truncate">{fund.fundHouse}</span>
                              <span>•</span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-600 dark:text-slate-300 shrink-0">
                                {fund.subCategory}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Rating */}
                      <td className="py-3.5 px-3">
                        {renderStars(fund.riskRating)}
                      </td>

                      {/* Riskometer */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {getRiskometerBadge(fund.riskometer)}
                      </td>

                      {/* NAV */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-bold text-slate-900 dark:text-white">
                          ₹{fund.nav > 0 ? fund.nav.toFixed(2) : '--'}
                        </div>
                        <div
                          className={`flex items-center justify-end text-xs font-semibold ${
                            fund.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {fund.change >= 0 ? '+' : ''}
                          {fund.pct ? `${fund.pct.toFixed(2)}%` : '0.00%'}
                        </div>
                      </td>

                      {/* 1Y Return */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {formatReturnText(fund.returns1Y)}
                      </td>

                      {/* 3Y Return (Primary Anchor) */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {formatReturnText(fund.returns3Y, true)}
                      </td>

                      {/* 5Y Return */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        {formatReturnText(fund.returns5Y)}
                      </td>

                      {/* AUM */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          ₹{(fund.aum || 0).toLocaleString('en-IN')} Cr
                        </span>
                      </td>

                      {/* Expense Ratio */}
                      <td className="py-3.5 px-3 text-right whitespace-nowrap">
                        <span className="font-medium text-slate-600 dark:text-slate-400">
                          {fund.expenseRatio !== undefined ? `${fund.expenseRatio}%` : '--'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/mutual-funds/${fund.schemeCode || fund.id}`);
                          }}
                          className="p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 transition-colors cursor-pointer"
                          title="View Fund Details"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {funds.map((fund) => {
            const isCompared = compareList.some((f) => f.schemeCode === fund.schemeCode || f.id === fund.id);
            return (
              <GlassCard
                key={fund.schemeCode || fund.id}
                className="flex flex-col justify-between p-5 hover:shadow-xl transition-all duration-300 group cursor-pointer border hover:border-indigo-400 dark:hover:border-indigo-600"
               
                onClick={() => navigate(`/mutual-funds/${fund.schemeCode || fund.id}`)}
              >
                <div>
                  {/* Top Bar: Fund House & Compare Checkbox */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 line-clamp-1">
                      {fund.fundHouse}
                    </span>
                    <div
                      className="flex items-center gap-1.5"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleCompare(fund);
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isCompared}
                        onChange={() => {}}
                        className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700 cursor-pointer"
                      />
                      <span className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        Compare
                      </span>
                    </div>
                  </div>

                  {/* Fund Name */}
                  <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
                    {fund.name}
                  </h3>

                  {/* SubCategory & Rating */}
                  <div className="flex items-center justify-between gap-2 mt-3 mb-4">
                    <div className="flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {fund.subCategory}
                      </span>
                      {getRiskometerBadge(fund.riskometer)}
                    </div>
                    {renderStars(fund.riskRating)}
                  </div>

                  {/* Metrics Row: NAV & 3Y Return */}
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800/80 mb-4">
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">NAV</p>
                      <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                        ₹{fund.nav > 0 ? fund.nav.toFixed(2) : '--'}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          fund.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {fund.change >= 0 ? '+' : ''}
                        {fund.pct ? `${fund.pct.toFixed(2)}%` : '0.00%'}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">3Y CAGR</p>
                      <div className="mt-0.5">
                        {fund.returns3Y !== null && fund.returns3Y !== undefined ? (
                          <p
                            className={`text-lg font-bold ${
                              fund.returns3Y >= 20 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {fund.returns3Y >= 0 ? '+' : ''}{fund.returns3Y}%
                          </p>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 font-medium text-sm" title="Not completed 3 years yet">N/A</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        1Y: {fund.returns1Y !== null && fund.returns1Y !== undefined ? `${fund.returns1Y >= 0 ? '+' : ''}${fund.returns1Y}%` : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* AUM & Expense Ratio Info */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-4 px-1">
                    <span>AUM: <strong className="text-slate-800 dark:text-slate-200">₹{(fund.aum || 0).toLocaleString('en-IN')} Cr</strong></span>
                    <span>Exp. Ratio: <strong className="text-slate-800 dark:text-slate-200">{fund.expenseRatio || 0.8}%</strong></span>
                  </div>
                </div>

                {/* View Details Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/mutual-funds/${fund.schemeCode || fund.id}`);
                  }}
                  className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm group-hover:shadow-md"
                >
                  <span>Explore Fund Analytics</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Floating Bottom Comparison Bar */}
      {compareList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-2xl bg-white dark:bg-slate-900 border border-indigo-500/40 shadow-2xl rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
              Compare ({compareList.length}/3):
            </span>
            <div className="flex flex-wrap gap-1.5 overflow-x-auto">
              {compareList.map((fund) => (
                <div
                  key={fund.schemeCode || fund.id}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-xs font-medium text-slate-900 dark:text-white"
                >
                  <span className="line-clamp-1 max-w-[140px]">{fund.name}</span>
                  <button
                    onClick={() => toggleCompare(fund)}
                    className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded text-slate-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={() => setCompareList([])}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium px-2 py-1.5"
            >
              Clear
            </button>
            <button
              onClick={openCompareModal}
              disabled={compareList.length < 2}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors ${
                compareList.length >= 2
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/25 cursor-pointer'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Compare Side-by-Side</span>
            </button>
          </div>
        </div>
      )}

      {/* Side-by-Side Compare Modal */}
      {compareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" />
                  Mutual Fund Head-to-Head Comparison
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Analyzing performance, volatility, expense ratios, and asset allocation
                </p>
              </div>
              <button
                onClick={() => setCompareModalOpen(false)}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-6">
              {compareLoading ? (
                <div className="py-16 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
                  <p className="text-sm text-slate-500">Compiling multi-fund comparison metrics...</p>
                </div>
              ) : comparingFundsData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                        <th className="py-3 px-4 text-xs font-bold text-slate-400 uppercase w-1/4">Metric</th>
                        {comparingFundsData.map((f) => (
                          <th key={f.schemeCode} className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                            <div className="line-clamp-2">{f.name}</div>
                            <div className="text-xs font-normal text-slate-500 mt-1">{f.fundHouse}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Sub-Category</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                            {f.subCategory}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Current NAV</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4 font-bold text-indigo-600 dark:text-indigo-400">
                            ₹{f.nav.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">1-Year Return</td>
                        {comparingFundsData.map((f) => {
                          const r1 = f.returns?.oneYear ?? f.returns1Y;
                          return (
                            <td key={f.schemeCode} className="py-3 px-4 font-semibold text-emerald-600">
                              {r1 !== null && r1 !== undefined ? `${r1 >= 0 ? '+' : ''}${r1}%` : 'N/A'}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">3-Year CAGR</td>
                        {comparingFundsData.map((f) => {
                          const r3 = f.returns?.threeYear ?? f.returns3Y;
                          return (
                            <td key={f.schemeCode} className="py-3 px-4 font-bold text-emerald-600">
                              {r3 !== null && r3 !== undefined ? `${r3 >= 0 ? '+' : ''}${r3}%` : 'N/A'}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">5-Year CAGR</td>
                        {comparingFundsData.map((f) => {
                          const r5 = f.returns?.fiveYear ?? f.returns5Y;
                          return (
                            <td key={f.schemeCode} className="py-3 px-4 font-semibold text-emerald-600">
                              {r5 !== null && r5 !== undefined ? `${r5 >= 0 ? '+' : ''}${r5}%` : 'N/A'}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">AUM (Fund Size)</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4 font-medium">
                            ₹{(f.aum || 0).toLocaleString('en-IN')} Cr
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Expense Ratio</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4 font-medium">
                            {f.expenseRatio}%
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Riskometer</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4">
                            {getRiskometerBadge(f.riskometer)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Sharpe Ratio</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4 font-semibold">
                            {f.riskMetrics?.sharpeRatio || '--'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Alpha</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4 font-semibold text-emerald-600">
                            +{f.riskMetrics?.alpha || '--'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Beta</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4 font-medium">
                            {f.riskMetrics?.beta || '--'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-500">Min. Monthly SIP</td>
                        {comparingFundsData.map((f) => (
                          <td key={f.schemeCode} className="py-3 px-4 font-medium">
                            ₹{f.minimumSip || f.minSip || 500}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex justify-end">
              <button
                onClick={() => setCompareModalOpen(false)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-xl text-sm hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MutualFunds;