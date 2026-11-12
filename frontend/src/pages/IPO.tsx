import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Briefcase, 
  TrendingUp, 
  Calendar, 
  Search, 
  LayoutList, 
  LayoutGrid, 
  ArrowRight,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  RefreshCw,
  WifiOff,
  Star
} from 'lucide-react';
import type { IPO } from '../types';
import { getIPOs, getCachedIPOs, sortIPOsByLatest, getLastIpoApiSyncTime } from '../services/ipoService';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';

type TabType = 'all' | 'open' | 'closed' | 'listed' | 'upcoming';
type SegmentType = 'all' | 'mainboard' | 'sme';
type ViewMode = 'table' | 'card';

const IPOPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Persist activeTab across navigation (URL query param & sessionStorage)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const urlTab = searchParams.get('tab') as TabType | null;
    if (urlTab && ['all', 'open', 'closed', 'listed', 'upcoming'].includes(urlTab)) {
      return urlTab;
    }
    const storedTab = sessionStorage.getItem('moneylogger_ipo_active_tab') as TabType | null;
    if (storedTab && ['all', 'open', 'closed', 'listed', 'upcoming'].includes(storedTab)) {
      return storedTab;
    }
    return 'open';
  });

  // Persist selectedSegment across navigation (URL query param)
  const [selectedSegment, setSelectedSegment] = useState<SegmentType>(() => {
    const urlSeg = searchParams.get('segment') as SegmentType | null;
    if (urlSeg && ['all', 'mainboard', 'sme'].includes(urlSeg)) {
      return urlSeg;
    }
    return 'all';
  });

  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [viewMode, setViewMode] = useState<ViewMode>('table'); // Table view as default

  // Tab switch handler with URL & session persistence
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    sessionStorage.setItem('moneylogger_ipo_active_tab', tab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (tab === 'open') {
        next.delete('tab');
      } else {
        next.set('tab', tab);
      }
      return next;
    }, { replace: true });
  };

  // Segment switch handler with URL & session persistence
  const handleSegmentChange = (seg: SegmentType) => {
    setSelectedSegment(seg);
    sessionStorage.setItem('moneylogger_ipo_selected_segment', seg);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (seg === 'all') {
        next.delete('segment');
      } else {
        next.set('segment', seg);
      }
      return next;
    }, { replace: true });
  };

  // Initialize synchronously with cached data if available (0ms instant render when returning to IPO table)
  const [allIpos, setAllIpos] = useState<IPO[]>(() => {
    const cached = getCachedIPOs();
    return cached && cached.data && cached.data.length > 0 ? cached.data : [];
  });
  const [loading, setLoading] = useState<boolean>(() => {
    const cached = getCachedIPOs();
    return !(cached && cached.data && cached.data.length > 0);
  });
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [lastApiSyncTime, setLastApiSyncTime] = useState<string | null>(() => {
    return getLastIpoApiSyncTime() || (getCachedIPOs()?.timestamp ? new Date(getCachedIPOs()!.timestamp).toISOString() : new Date().toISOString());
  });

  const formatApiSyncTime = (timestamp?: string | number | null) => {
    let d: Date;
    if (timestamp) {
      d = new Date(timestamp);
      if (isNaN(d.getTime())) {
        const cached = getCachedIPOs();
        d = cached?.timestamp ? new Date(cached.timestamp) : new Date();
      }
    } else {
      const cached = getCachedIPOs();
      d = cached?.timestamp ? new Date(cached.timestamp) : new Date();
    }
    const timeStr = d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).toUpperCase();
    return `${timeStr} IST`;
  };

  // Sync state if URL query params change (e.g. browser back/forward buttons)
  useEffect(() => {
    const q = searchParams.get('search');
    if (q !== null && q !== searchQuery) {
      setSearchQuery(q);
    }
    const urlTab = searchParams.get('tab') as TabType | null;
    if (urlTab && ['all', 'open', 'closed', 'listed', 'upcoming'].includes(urlTab) && urlTab !== activeTab) {
      setActiveTab(urlTab);
      sessionStorage.setItem('moneylogger_ipo_active_tab', urlTab);
    }
    const urlSeg = searchParams.get('segment') as SegmentType | null;
    if (urlSeg && ['all', 'mainboard', 'sme'].includes(urlSeg) && urlSeg !== selectedSegment) {
      setSelectedSegment(urlSeg);
      sessionStorage.setItem('moneylogger_ipo_selected_segment', urlSeg);
    }
  }, [searchParams]);

  // Fetch all IPOs in a single API call on mount (uses client cache so no refetch flicker when switching sections)
  const loadIPOs = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else if (allIpos.length === 0) {
        setLoading(true);
      }
      setError(null);

      const data = await getIPOs(undefined, { skipCache: isRefresh });
      setAllIpos(data);
      setIsUsingCache(false);
      setLastApiSyncTime(getLastIpoApiSyncTime() || new Date().toISOString());
    } catch (err: any) {
      console.error('Error loading IPOs:', err);
      const cached = getCachedIPOs();
      if (cached && cached.data.length > 0) {
        setAllIpos(cached.data);
        setIsUsingCache(true);
        setError(null);
      } else if (allIpos.length === 0) {
        setAllIpos([]);
        setError(err?.message || 'Unable to connect to live IPO market service.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadIPOs();
  }, []);

  const isPreApplyIpo = (item: IPO): boolean => {
    if (item.isPreApply || (item.status as string) === 'pre_apply') return true;
    const preDate = item.timeline?.preApplyStartDate || item.timeline?.preApplicationStart;
    const openDate = item.timeline?.openDate || item.timeline?.biddingStart || item.timeline?.applicationStartDate || item.openDate;
    if (!preDate) return false;
    const istNow = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split('T')[0];
    return istNow >= preDate && (!openDate || istNow < openDate);
  };

  // Instant client-side filtering (0ms lag, no re-fetching) & latest-first sorting
  const ipos = useMemo(() => {
    const filtered = allIpos.filter((item) => {
      // Tab status match: 'open' tab displays both live bidding and pre-apply IPOs
      if (activeTab === 'open') {
        if (item.status !== 'open' && !isPreApplyIpo(item)) {
          return false;
        }
      } else if (activeTab === 'upcoming') {
        // Exclude pre-apply IPOs that are actively listed in 'open' tab
        if (item.status !== 'upcoming' || isPreApplyIpo(item)) {
          return false;
        }
      } else if (activeTab !== 'all' && item.status !== activeTab) {
        return false;
      }
      // Segment match
      if (selectedSegment !== 'all' && item.segment !== selectedSegment) {
        return false;
      }
      // Search match
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchSymbol = item.symbol.toLowerCase().includes(q);
        if (!matchName && !matchSymbol) return false;
      }
      return true;
    });

    return sortIPOsByLatest(filtered, activeTab);
  }, [allIpos, activeTab, selectedSegment, searchQuery]);

  // Live count badges per tab (dynamically synchronized with selected segment)
  const tabCounts = useMemo(() => {
    const baseList = selectedSegment === 'all'
      ? allIpos
      : allIpos.filter((i) => i.segment === selectedSegment);

    return {
      all: baseList.length,
      open: baseList.filter((i) => i.status === 'open' || isPreApplyIpo(i)).length,
      upcoming: baseList.filter((i) => i.status === 'upcoming' && !isPreApplyIpo(i)).length,
      closed: baseList.filter((i) => i.status === 'closed').length,
      listed: baseList.filter((i) => i.status === 'listed').length,
    };
  }, [allIpos, selectedSegment]);

  // Live count per segment (dynamically synchronized with active tab)
  const segmentCounts = useMemo(() => {
    const tabFiltered = allIpos.filter((item) => {
      if (activeTab === 'open') return item.status === 'open' || isPreApplyIpo(item);
      if (activeTab === 'upcoming') return item.status === 'upcoming' && !isPreApplyIpo(item);
      if (activeTab !== 'all' && item.status !== activeTab) return false;
      return true;
    });

    return {
      all: tabFiltered.length,
      mainboard: tabFiltered.filter((i) => i.segment === 'mainboard').length,
      sme: tabFiltered.filter((i) => i.segment === 'sme').length,
    };
  }, [allIpos, activeTab]);

  // Compute top GMP expected gain IPO for pulse stats
  const topGmpIpo = useMemo(() => {
    if (!allIpos || allIpos.length === 0) return null;
    // Prioritize active pipeline IPOs (open or upcoming) with positive expected gains
    const activePipeline = allIpos.filter(
      (i) => (i.status === 'open' || i.status === 'upcoming') && Number(i.gmpData?.estimatedGainPercent || 0) > 0
    );
    const pool = activePipeline.length > 0 ? activePipeline : allIpos.filter((i) => i.status !== 'listed' && Number(i.gmpData?.estimatedGainPercent || 0) > 0);
    if (pool.length === 0) return null;

    return [...pool].sort(
      (a, b) => Number(b.gmpData?.estimatedGainPercent || 0) - Number(a.gmpData?.estimatedGainPercent || 0)
    )[0];
  }, [allIpos]);

  const tabConfig = [
    { id: 'all', label: 'All IPOs', mobileLabel: 'All', icon: Briefcase },
    { id: 'open', label: 'Open (Bidding Live)', mobileLabel: 'Live', icon: TrendingUp },
    { id: 'closed', label: 'Closed (Allotment)', mobileLabel: 'Closed', icon: Clock },
    { id: 'listed', label: 'Recently Listed', mobileLabel: 'Listed', icon: CheckCircle2 },
    { id: 'upcoming', label: 'Upcoming', mobileLabel: 'Upcoming', icon: Calendar },
  ];

  const getRatingInfo = (ipo: IPO) => {
    const rec = ipo.verdict?.recommendation;

    // Only display ratings when explicitly provided by research/admin
    if (rec && rec.trim()) {
      const lower = rec.toLowerCase();
      if (lower.includes('listing gains')) {
        return { stars: '4.5', label: 'Listing Gains', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      }
      if (lower.includes('subscribe')) {
        return { stars: '4.8', label: 'Subscribe', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      }
      if (lower.includes('may apply')) {
        return { stars: '3.5', label: 'May Apply', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      }
      if (lower.includes('neutral')) {
        return { stars: '3.0', label: 'Neutral', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30' };
      }
      if (lower.includes('avoid')) {
        return { stars: '1.5', label: 'Avoid', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' };
      }
    }

    // Default to Awaiting when not rated manually yet
    return { stars: null, label: 'Awaiting', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge type="success">LIVE NOW</Badge>;
      case 'upcoming':
        return <Badge type="warning">UPCOMING</Badge>;
      case 'closed':
        return <Badge type="neutral">CLOSED</Badge>;
      case 'listed':
        return <Badge type="primary">LISTED</Badge>;
      default:
        return <Badge type="neutral">{status.toUpperCase()}</Badge>;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr || !dateStr.trim() || dateStr === 'TBA') return 'TBA';
    try {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return 'TBA';
      return parsed.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'TBA';
    }
  };

  return (
    <div className="space-y-6">
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
                LIVE GMP & BIDDING PIPELINE
              </span>
              <span className="text-[11px] text-slate-500 dark:text-indigo-200 font-medium">
                Mainboard & SME • Real-time Grey Market
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              IPO Intelligence Hub
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-2xl leading-normal">
              Track upcoming and live Mainboard & SME IPOs, real-time Grey Market Premiums (GMP), subscription multiples across QIB/NII/Retail, and post-listing returns.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-1 md:pt-0">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutList className="w-3.5 h-3.5" /> Table
              </button>
              <button
                onClick={() => setViewMode('card')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'card'
                    ? 'bg-white dark:bg-indigo-600 text-indigo-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Cards
              </button>
            </div>

            {/* Synced Pill - right beside Refresh Button across all screens */}
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-white/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs font-medium border border-slate-200/80 dark:border-white/10 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Synced:</span>
              <span className="font-bold text-slate-800 dark:text-white font-mono">{formatApiSyncTime(lastApiSyncTime)}</span>
            </div>

            {/* Refresh / Sync Button */}
            <button
              onClick={() => loadIPOs(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Market Pulse Cards */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Open For Bidding
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
              {tabCounts.open} Active Issues
            </span>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
              Pipeline Issues
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
              {tabCounts.upcoming} Upcoming IPOs
            </span>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              Top Expected Gain
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 truncate" title={topGmpIpo?.name}>
              {topGmpIpo && Number(topGmpIpo.gmpData?.estimatedGainPercent || 0) > 0
                ? `${topGmpIpo.name} (+${Number(topGmpIpo.gmpData?.estimatedGainPercent).toFixed(1)}%)`
                : 'TBA'}
            </span>
          </div>

          <div className="bg-white/80 dark:bg-slate-800/60 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-slate-200/80 dark:border-slate-700/60 shadow-xs flex flex-col justify-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
              Tracked Database
            </span>
            <span className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white mt-0.5">
              {tabCounts.all} Total ({tabCounts.listed} Listed)
            </span>
          </div>
        </div>
      </div>

      {/* Offline Cached Data Banner */}
      {isUsingCache && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-semibold shadow-sm">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Displaying saved offline IPO data from your last live session. Live market connection pending.
            </span>
          </div>
          <button
            onClick={() => loadIPOs(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 transition-colors w-fit font-bold"
          >
            <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Reconnecting...' : 'Reconnect Live'}
          </button>
        </div>
      )}

      {/* Top Filter Bar: Status Tabs + Segment Pills + Search Input */}
      <div className="space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1.5 sm:gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-3">
          {tabConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id as TabType)}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl font-semibold transition-all text-xs sm:text-sm ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-bold'
                    : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.mobileLabel}</span>
                <span className={`px-1.5 sm:px-2 py-0.2 sm:py-0.5 rounded-full text-[10px] sm:text-xs font-bold transition-colors ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                }`}>
                  {tabCounts[tab.id as keyof typeof tabCounts] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Segment Pill Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider shrink-0">
              Segment:
            </span>
            {(['all', 'mainboard', 'sme'] as SegmentType[]).map((seg) => (
              <button
                key={seg}
                onClick={() => handleSegmentChange(seg)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold uppercase transition-colors shrink-0 ${
                  selectedSegment === seg
                    ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
                }`}
              >
                <span>
                  {seg === 'all' ? (
                    <>
                      <span className="hidden sm:inline">All Segments</span>
                      <span className="sm:hidden">All</span>
                    </>
                  ) : seg}
                </span>
                <span className="text-[10px] opacity-75 font-normal">
                  ({segmentCounts[seg]})
                </span>
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search company or symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Loading live IPO data & Grey Market Premiums...</p>
        </div>
      ) : error && allIpos.length === 0 ? (
        <GlassCard className="text-center py-16 border-rose-200 dark:border-rose-900/40">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center mb-4 border border-rose-500/20 shadow-inner">
            <WifiOff className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">Unable to Connect to Live IPO Feed</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
            {error} No mock or fabricated offerings are displayed.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              onClick={() => loadIPOs(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Reconnecting...' : 'Retry Connection'}</span>
            </button>
          </div>
        </GlassCard>
      ) : ipos.length === 0 ? (
        <GlassCard className="text-center py-16">
          <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">No IPOs Found</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            No offerings match your current status or segment filter. Try resetting your search or selecting another category.
          </p>
        </GlassCard>
      ) : viewMode === 'table' ? (
        /* ================= TABLE VIEW (DEFAULT) ================= */
        <GlassCard noPadding className="overflow-hidden shadow-xl border border-slate-200/80 dark:border-slate-800">
          {/* Scoped CSS guaranteeing complete scrollbar suppression across all browsers/OS */}
          <style>{`
            .ipo-table-scroll {
              scrollbar-width: none !important;
              -ms-overflow-style: none !important;
            }
            .ipo-table-scroll::-webkit-scrollbar {
              display: none !important;
              width: 0px !important;
              height: 0px !important;
              min-width: 0px !important;
              min-height: 0px !important;
              background: transparent !important;
              opacity: 0 !important;
            }
            .ipo-table-scroll::-webkit-scrollbar-thumb,
            .ipo-table-scroll::-webkit-scrollbar-track,
            .ipo-table-scroll::-webkit-scrollbar-corner {
              display: none !important;
              background: transparent !important;
              width: 0px !important;
              height: 0px !important;
              opacity: 0 !important;
            }
          `}</style>

          {/* Mobile horizontal scroll hint safely outside table scroll container */}
          <div className="sm:hidden px-3 py-1.5 bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200/80 dark:border-slate-800 text-[10px] text-slate-500 dark:text-slate-400 flex items-center justify-between">
            <span>← Swipe table for Size, Rating, Subscription & Dates →</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">3 cols locked</span>
          </div>

          <div
            className="overflow-auto max-h-[calc(100vh-210px)] sm:max-h-[720px] scrollbar-none ipo-table-scroll"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            <table className="w-full text-left border-separate border-spacing-0 min-w-[760px] lg:min-w-full">
              <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 shadow-xs">
                <tr className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  {/* Sticky Company Name Header (Corner: sticks both left & top on all screens) */}
                  <th className="sticky left-0 top-0 z-30 bg-slate-100 dark:bg-slate-900 border-b border-r border-slate-200/80 dark:border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.08)] dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.5)] px-2.5 py-3 lg:px-3 lg:py-3 text-left w-[140px] min-w-[140px] max-w-[140px] lg:w-[195px] lg:min-w-[195px] lg:max-w-[210px]">
                    Company Name
                  </th>

                  {activeTab === 'listed' ? (
                    <>
                      <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[94px] min-w-[94px] max-w-[94px] lg:w-[104px] lg:min-w-[104px] lg:max-w-[115px] whitespace-nowrap">
                        Listing Gain
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[82px] min-w-[82px] max-w-[82px] lg:w-[90px] lg:min-w-[90px] lg:max-w-[96px] whitespace-nowrap">
                        GMP
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[82px] min-w-[82px] max-w-[82px] lg:w-[90px] lg:min-w-[90px] lg:max-w-[96px] whitespace-nowrap">
                        GMP
                      </th>
                      <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[94px] min-w-[94px] max-w-[94px] lg:w-[104px] lg:min-w-[104px] lg:max-w-[115px] whitespace-nowrap">
                        Est. List Gain
                      </th>
                    </>
                  )}

                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[80px] min-w-[80px] lg:w-[88px] lg:min-w-[88px] whitespace-nowrap">Issue Size</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[84px] min-w-[84px] lg:w-[94px] lg:min-w-[94px] whitespace-nowrap">Rating</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[88px] min-w-[88px] lg:w-[96px] lg:min-w-[96px] whitespace-nowrap">{activeTab === 'listed' ? 'Issue Price' : 'Price Band'}</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[88px] min-w-[88px] lg:w-[98px] lg:min-w-[98px] whitespace-nowrap">Lot & Min Inv</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[76px] min-w-[76px] lg:w-[82px] lg:min-w-[82px] whitespace-nowrap">Subscription</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[96px] min-w-[96px] lg:w-[108px] lg:min-w-[108px] whitespace-nowrap">Bidding Date</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[80px] min-w-[80px] lg:w-[88px] lg:min-w-[88px] whitespace-nowrap">Allotment</th>
                  <th className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 px-1.5 py-3 lg:px-2 lg:py-3 text-center w-[80px] min-w-[80px] lg:w-[90px] lg:min-w-[90px] whitespace-nowrap">Listing Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {ipos.map((ipo) => {
                  const isPreApply = isPreApplyIpo(ipo);
                  const gmp = ipo.gmpData?.currentGmp ?? 0;
                  const estGain = ipo.gmpData?.estimatedGainPercent ?? 0;
                  const estPrice = ipo.gmpData?.estimatedListingPrice ?? (ipo.issuePrice + gmp);
                  const parsedSubTotal = Number(ipo.subscription?.total ?? ipo.totalSubscription ?? 0);
                  const subTotal = !isNaN(parsedSubTotal) ? parsedSubTotal : 0;
                  const rawIssue = ipo.issueSize;
                  const parsedIssue = (typeof rawIssue === 'object' && rawIssue !== null) ? (rawIssue as any).total : rawIssue;
                  const issueTotal = Number(parsedIssue) || 0;
                  const minInv = ipo.minInvestment || (ipo.lotSize * ipo.issuePrice);
                  const rating = getRatingInfo(ipo);

                  // Actual listing details from API or Admin
                  const actualListingPrice = ipo.listingDetails?.listingPrice ?? ipo.listingPrice ?? null;
                  const actualGainPercent = ipo.listingDetails?.listingGainPercent ?? ipo.listingGain ?? (
                    actualListingPrice && ipo.issuePrice > 0
                      ? Number((((actualListingPrice - ipo.issuePrice) / ipo.issuePrice) * 100).toFixed(2))
                      : null
                  );
                  const actualGainValue = actualListingPrice && ipo.issuePrice > 0 ? (actualListingPrice - ipo.issuePrice) : null;
                  const allotmentDate = ipo.timeline?.allotmentDate || (ipo as any).allotmentDate;

                  return (
                    <tr
                      key={ipo.id}
                      onClick={() => navigate(`/ipo/${ipo.id}`)}
                      className="border-b border-slate-100 dark:border-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer group"
                    >
                      {/* 1. Company Name Column: sticky left on all screens */}
                      <td className="sticky left-0 z-10 bg-white dark:bg-slate-950 group-hover:bg-slate-50 dark:group-hover:bg-slate-900 border-b border-r border-slate-100 dark:border-slate-800/80 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_6px_-2px_rgba(0,0,0,0.4)] px-2.5 py-2 lg:px-3 lg:py-2.5 w-[140px] min-w-[140px] max-w-[140px] lg:w-[195px] lg:min-w-[195px] lg:max-w-[210px] transition-colors">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                            <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-tight">
                              {ipo.name}
                            </span>
                            <span className={`text-[9px] sm:text-[10px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded tracking-wider ${
                              ipo.segment === 'sme'
                                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/60'
                                : 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-300/80 dark:border-blue-800/60'
                            }`}>
                              {ipo.segment === 'sme' ? 'SME' : 'MAIN'}
                            </span>
                            {isPreApply && (
                              <span className="text-[9px] sm:text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-300/80 dark:border-violet-800/60">
                                PRE-APPLY
                              </span>
                            )}
                            {/* In All IPO Tab: show (upcoming/listed/open/closed) status badge */}
                            {activeTab === 'all' && (
                              <span className="scale-75 sm:scale-90 origin-left">
                                {getStatusBadge(ipo.status)}
                              </span>
                            )}
                          </div>

                          {/* Secondary info row */}
                          {activeTab === 'all' && ipo.status === 'listed' && actualListingPrice != null && (
                            <div className="pt-0.5">
                              <span className={`text-[10px] sm:text-xs font-bold ${
                                (actualGainPercent ?? 0) >= 0
                                   ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-rose-600 dark:text-rose-400'
                              }`}>
                                @{actualListingPrice.toFixed(1)} ({actualGainPercent != null ? `${actualGainPercent >= 0 ? '+' : ''}${actualGainPercent.toFixed(1)}%` : '--'})
                              </span>
                            </div>
                          )}

                          {activeTab === 'listed' && (
                            <div className="pt-0.5">
                              <span className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium">
                                (List: {formatDate(ipo.listingDate || ipo.timeline?.listingDate)})
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 2 & 3. For Listed Tab: Listing Gain (Return) then GMP */}
                      {activeTab === 'listed' ? (
                        <>
                          {/* Listing Gain (Return) */}
                          <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[94px] min-w-[94px] max-w-[94px] lg:w-[104px] lg:min-w-[104px] whitespace-nowrap">
                            <div className="flex flex-col items-center justify-center text-center">
                              {actualGainPercent != null ? (
                                <div>
                                  {actualListingPrice != null && (
                                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                                      ₹{actualListingPrice.toFixed(1)}
                                    </span>
                                  )}
                                  <p className={`text-[10px] sm:text-xs font-bold ${actualGainPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {actualGainPercent >= 0 ? '+' : ''}{actualGainPercent.toFixed(1)}%
                                    {actualGainValue != null && (
                                      <span className="text-[10px] sm:text-[11px] font-medium ml-0.5 sm:ml-1">
                                        ({actualGainValue >= 0 ? '+' : '-'}₹{Math.abs(actualGainValue).toFixed(0)})
                                      </span>
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">--</span>
                              )}
                            </div>
                          </td>

                          {/* GMP */}
                          <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[82px] min-w-[82px] max-w-[82px] lg:w-[90px] lg:min-w-[90px] whitespace-nowrap">
                            <div className="flex items-center justify-center text-center">
                              {gmp > 0 ? (
                                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                  <span>+₹{gmp}</span>
                                </span>
                              ) : gmp < 0 ? (
                                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
                                  <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                  <span>-₹{Math.abs(gmp)}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">--</span>
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        /* For All, Open, Closed, Upcoming Tabs: GMP then Est. Listing Gain (Return) */
                        <>
                          {/* GMP */}
                          <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[82px] min-w-[82px] max-w-[82px] lg:w-[90px] lg:min-w-[90px] whitespace-nowrap">
                            <div className="flex items-center justify-center text-center">
                              {ipo.status === 'listed' ? (
                                <span className="text-xs text-slate-400 font-medium">--</span>
                              ) : gmp > 0 ? (
                                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                  <span>+₹{gmp}</span>
                                </span>
                              ) : gmp < 0 ? (
                                <span className="inline-flex items-center gap-0.5 sm:gap-1 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 whitespace-nowrap">
                                  <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                                  <span>-₹{Math.abs(gmp)}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">--</span>
                              )}
                            </div>
                          </td>

                          {/* Est. Listing Gain (Return) */}
                          <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[94px] min-w-[94px] max-w-[94px] lg:w-[104px] lg:min-w-[104px] whitespace-nowrap">
                            <div className="flex flex-col items-center justify-center text-center">
                              {/* If listed, DO NOT show actual listing gain here (already shown with @ under company name) */}
                              {ipo.status === 'listed' ? (
                                <span className="text-xs text-slate-400 font-medium">--</span>
                              ) : gmp !== 0 ? (
                                <div>
                                  <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                                    ₹{estPrice.toFixed(0)}
                                  </span>
                                  <p className={`text-[10px] sm:text-xs font-semibold ${estGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                    {estGain >= 0 ? '+' : ''}{estGain.toFixed(1)}%
                                  </p>
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 font-medium">--</span>
                              )}
                            </div>
                          </td>
                        </>
                      )}

                      {/* 4. Issue Size */}
                      <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[80px] min-w-[80px] lg:w-[88px] lg:min-w-[88px] whitespace-nowrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                          {issueTotal > 0 ? `₹${issueTotal.toLocaleString()} Cr` : '--'}
                        </span>
                      </td>

                      {/* 5. Research Rating */}
                      <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[84px] min-w-[84px] lg:w-[94px] lg:min-w-[94px] whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {rating.stars ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span className={`inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-bold border ${rating.bg}`}>
                                <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 fill-current" />
                                <span>{rating.stars}</span>
                              </span>
                              <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                                {rating.label}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Awaiting
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Price Band / Issue Price */}
                      <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[88px] min-w-[88px] lg:w-[96px] lg:min-w-[96px] whitespace-nowrap">
                        <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {activeTab === 'listed'
                            ? (ipo.issuePrice > 0 ? `₹${ipo.issuePrice}` : (ipo.priceBand || 'TBA'))
                            : (ipo.priceBand || (ipo.issuePrice > 0 ? `₹${ipo.issuePrice}` : 'TBA'))}
                        </span>
                      </td>

                      {/* 7. Lot & Min Inv */}
                      <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[88px] min-w-[88px] lg:w-[98px] lg:min-w-[98px] whitespace-nowrap">
                        <div className="text-[11px] sm:text-xs">
                          <span className="font-bold text-slate-900 dark:text-slate-100">
                            {ipo.lotSize > 1 ? `${ipo.lotSize} shares` : 'TBA'}
                          </span>
                          <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[10px] sm:text-xs">
                            {minInv > 0 ? `₹${minInv.toLocaleString()}` : '--'}
                          </p>
                        </div>
                      </td>

                      {/* 8. Subscription */}
                      <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[76px] min-w-[76px] lg:w-[82px] lg:min-w-[82px] whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          {isPreApply ? (
                            <span className="text-xs text-slate-400">--</span>
                          ) : subTotal > 0 ? (
                            <span className="px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-bold bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                              {subTotal.toFixed(2)}x
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">--</span>
                          )}
                        </div>
                      </td>

                      {/* 9. Bidding Date */}
                      <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[96px] min-w-[96px] lg:w-[108px] lg:min-w-[108px] whitespace-nowrap">
                        <div className="text-[11px] sm:text-xs">
                          <p className="text-slate-500 dark:text-slate-400">
                            {formatDate(ipo.timeline?.openDate || ipo.openDate)}
                          </p>
                          <div className="mt-0.5 inline-block px-1.5 py-0.5 rounded font-bold text-[10px] sm:text-[11px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                            Closes: {formatDate(ipo.timeline?.closeDate || ipo.closeDate)}
                          </div>
                        </div>
                      </td>

                      {/* 10. Allotment */}
                      <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[80px] min-w-[80px] lg:w-[88px] lg:min-w-[88px] whitespace-nowrap">
                        <div className="text-[11px] sm:text-xs">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatDate(allotmentDate)}
                          </p>
                        </div>
                      </td>

                      {/* 11. Listing Date */}
                      <td className="px-1.5 py-2 lg:px-2 lg:py-2.5 text-center w-[80px] min-w-[80px] lg:w-[90px] lg:min-w-[90px] whitespace-nowrap">
                        <div className="text-[11px] sm:text-xs">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatDate(ipo.listingDate || ipo.timeline?.listingDate)}
                          </p>
                          {ipo.status === 'listed' && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">
                              NSE / BSE
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : (
        /* ================= CARD VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ipos.map((ipo) => {
            const isPreApply = isPreApplyIpo(ipo);
            const gmp = ipo.gmpData?.currentGmp ?? 0;
            const estGain = ipo.gmpData?.estimatedGainPercent ?? 0;
            const estPrice = ipo.gmpData?.estimatedListingPrice ?? (ipo.issuePrice + gmp);
            const parsedSubTotal = Number(ipo.subscription?.total ?? ipo.totalSubscription ?? 0);
            const subTotal = !isNaN(parsedSubTotal) ? parsedSubTotal : 0;
            const rawIssue = ipo.issueSize;
            const parsedIssue = (typeof rawIssue === 'object' && rawIssue !== null) ? (rawIssue as any).total : rawIssue;
            const issueTotal = Number(parsedIssue) || 0;
            const minInv = ipo.minInvestment || (ipo.lotSize * ipo.issuePrice);

            // Actual listing details from API or Admin
            const actualListingPrice = ipo.listingDetails?.listingPrice ?? ipo.listingPrice ?? null;
            const actualGainPercent = ipo.listingDetails?.listingGainPercent ?? ipo.listingGain ?? (
              actualListingPrice && ipo.issuePrice > 0
                ? Number((((actualListingPrice - ipo.issuePrice) / ipo.issuePrice) * 100).toFixed(1))
                : null
            );
            const actualGainValue = actualListingPrice && ipo.issuePrice > 0 ? (actualListingPrice - ipo.issuePrice) : null;

            return (
              <GlassCard
                key={ipo.id}
                onClick={() => navigate(`/ipo/${ipo.id}`)}
                className="flex flex-col justify-between hover:shadow-2xl transition-all duration-300 border-slate-200/80 dark:border-slate-800 cursor-pointer group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${
                          ipo.segment === 'sme'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300/60 dark:border-blue-800/60'
                        }`}>
                          {ipo.segment === 'sme' ? 'SME' : 'MAINBOARD'}
                        </span>
                        {isPreApply && (
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 border border-violet-300/60 dark:border-violet-800/60">
                            PRE-APPLY
                          </span>
                        )}
                        {(() => {
                          const rating = getRatingInfo(ipo);
                          return rating.stars ? (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${rating.bg}`}>
                              <Star className="w-2.5 h-2.5 fill-current" />
                              <span>{rating.stars} {rating.label}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                              Awaiting
                            </span>
                          );
                        })()}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {ipo.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono font-bold">
                          {ipo.symbol}
                        </span>
                      </div>
                    </div>
                    <div>{getStatusBadge(ipo.status)}</div>
                  </div>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl mb-3 border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Price Band</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {ipo.priceBand || (ipo.issuePrice > 0 ? `₹${ipo.issuePrice}` : 'TBA')}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Issue Size</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {issueTotal > 0 ? `₹${issueTotal.toLocaleString()} Cr` : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Lot & Min Inv</p>
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {ipo.lotSize > 1 ? `${ipo.lotSize} sh` : 'TBA'} {minInv > 0 ? `(₹${minInv.toLocaleString()})` : ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">Subscription</p>
                      <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                        {isPreApply ? '--' : (subTotal > 0 ? `${subTotal.toFixed(2)}x` : '--')}
                      </p>
                    </div>
                  </div>

                  {/* Advantages & Risks Quick Count */}
                  {(ipo.strengths || ipo.risks) && (
                    <div className="flex items-center justify-between text-[11px] font-medium px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/40 rounded-lg mb-3 border border-slate-100 dark:border-slate-800">
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                        ✓ {ipo.strengths?.length || 0} Advantages
                      </span>
                      <span className="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                        ⚠ {ipo.risks?.length || 0} Risks
                      </span>
                    </div>
                  )}

                  {/* GMP Spotlight Box OR Listing Performance Box */}
                  {ipo.status === 'listed' ? (
                    <div className="p-3 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-teal-500/10 border border-indigo-500/20 rounded-xl mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Listing Performance
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          Listed {formatDate(ipo.listingDate || ipo.timeline?.listingDate)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <div>
                          <span className="text-xl font-black text-slate-900 dark:text-white">
                            {actualListingPrice != null && actualListingPrice > 0 ? `₹${actualListingPrice.toFixed(0)}` : '--'}
                          </span>
                          {actualGainValue != null && (
                            <span className="text-xs font-bold text-slate-500 ml-1.5">
                              ({actualGainValue >= 0 ? '+' : '-'}₹{Math.abs(actualGainValue).toFixed(0)})
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-bold ${actualGainPercent != null && actualGainPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {actualGainPercent != null ? `${actualGainPercent >= 0 ? '+' : ''}${actualGainPercent.toFixed(1)}%` : '--'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 border border-emerald-500/20 rounded-xl mb-4">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                          <TrendingUp className="w-3.5 h-3.5" /> Grey Market Premium
                        </span>
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          {gmp !== 0 ? `${estGain >= 0 ? '+' : ''}${estGain.toFixed(1)}% Est.` : 'Awaited'}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xl font-black text-emerald-700 dark:text-emerald-400">
                          {gmp > 0 ? `+₹${gmp}` : gmp < 0 ? `-₹${Math.abs(gmp)}` : '--'}
                        </span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {gmp !== 0 ? (
                            <>Est. Listing: <strong className="text-slate-900 dark:text-white">₹{estPrice.toFixed(0)}</strong></>
                          ) : (
                            <>Est. Listing: <strong className="text-slate-500 dark:text-slate-400">--</strong></>
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Dates & Action */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                    <span>{formatDate(ipo.timeline?.openDate || ipo.openDate)}</span>
                    <span className="text-slate-400">→</span>
                    <span className="px-1.5 py-0.5 rounded font-bold text-[11px] bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
                      Closes {formatDate(ipo.timeline?.closeDate || ipo.closeDate)}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    Details <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default IPOPage;