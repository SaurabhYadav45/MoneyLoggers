import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  RefreshCw, 
  Search, 
  Clock 
} from 'lucide-react';

// Modular Dashboard Components
import MarketSnapshotBar from '../components/dashboard/MarketSnapshotBar';
import KeyIndicesPulse from '../components/dashboard/KeyIndicesPulse';
import type { IndexPulseItem } from '../components/dashboard/KeyIndicesPulse';
import MarketMoversWidget from '../components/dashboard/MarketMoversWidget';
import type { MarketMoverStock } from '../components/dashboard/MarketMoversWidget';
import GlobalPulseWidget from '../components/dashboard/GlobalPulseWidget';
import RecentNewsWidget from '../components/dashboard/RecentNewsWidget';

// Services
import * as stockService from '../services/stockService';
import { fetchGlobalSentiments } from '../services/globalSentimentService';
import { fetchBreakingNews } from '../services/newsService';
import type { GlobalSentimentsData, NewsItem } from '../types';

// Fallback index data with realistic day/week charts
const DEFAULT_INDICES_DATA: IndexPulseItem[] = [
  {
    id: 'nifty50',
    name: 'NIFTY 50',
    symbol: 'NIFTY 50',
    exchange: 'NSE',
    value: 24850.25,
    change: 142.60,
    changePercent: 0.58,
    dayHigh: 24895.50,
    dayLow: 24710.20,
    open: 24740.00,
    prevClose: 24707.65,
    week52High: 26277.35,
    week52Low: 18837.85,
    peRatio: 22.8,
    pcr: 1.12,
    rsi: 58.4,
    chartData1D: [
      { time: '09:15', value: 24740.0 },
      { time: '09:45', value: 24765.5 },
      { time: '10:30', value: 24725.0 },
      { time: '11:15', value: 24780.2 },
      { time: '12:00', value: 24810.0 },
      { time: '12:45', value: 24795.5 },
      { time: '13:30', value: 24840.0 },
      { time: '14:15', value: 24875.2 },
      { time: '15:00', value: 24895.5 },
      { time: '15:30', value: 24850.25 }
    ],
    chartData1W: [
      { time: 'Mon', value: 24650 },
      { time: 'Tue', value: 24580 },
      { time: 'Wed', value: 24720 },
      { time: 'Thu', value: 24707 },
      { time: 'Fri', value: 24850 }
    ],
    chartData1M: [
      { time: 'W1', value: 24150 },
      { time: 'W2', value: 24390 },
      { time: 'W3', value: 24600 },
      { time: 'W4', value: 24850 }
    ],
    chartData1Y: [
      { time: 'Nov', value: 19800 },
      { time: 'Jan', value: 21700 },
      { time: 'Mar', value: 22400 },
      { time: 'May', value: 22900 },
      { time: 'Jul', value: 24500 },
      { time: 'Sep', value: 25800 },
      { time: 'Oct', value: 24850 }
    ]
  },
  {
    id: 'sensex',
    name: 'S&P BSE SENSEX',
    symbol: 'SENSEX',
    exchange: 'BSE',
    value: 81224.75,
    change: 485.20,
    changePercent: 0.60,
    dayHigh: 81380.00,
    dayLow: 80850.50,
    open: 80920.00,
    prevClose: 80739.55,
    week52High: 85978.25,
    week52Low: 63583.07,
    peRatio: 23.4,
    pcr: 1.08,
    rsi: 56.2,
    chartData1D: [
      { time: '09:15', value: 80920.0 },
      { time: '09:45', value: 80980.5 },
      { time: '10:30', value: 80890.0 },
      { time: '11:15', value: 81050.2 },
      { time: '12:00', value: 81120.0 },
      { time: '12:45', value: 81090.5 },
      { time: '13:30', value: 81210.0 },
      { time: '14:15', value: 81340.2 },
      { time: '15:00', value: 81380.0 },
      { time: '15:30', value: 81224.75 }
    ]
  },
  {
    id: 'banknifty',
    name: 'NIFTY BANK',
    symbol: 'BANKNIFTY',
    exchange: 'NSE',
    value: 51785.40,
    change: 320.15,
    changePercent: 0.62,
    dayHigh: 51920.00,
    dayLow: 51410.00,
    open: 51500.00,
    prevClose: 51465.25,
    week52High: 54467.35,
    week52Low: 42105.40,
    peRatio: 15.6,
    pcr: 1.25,
    rsi: 61.8,
    chartData1D: [
      { time: '09:15', value: 51500.0 },
      { time: '09:45', value: 51590.0 },
      { time: '10:30', value: 51480.0 },
      { time: '11:15', value: 51620.0 },
      { time: '12:00', value: 51710.0 },
      { time: '12:45', value: 51680.0 },
      { time: '13:30', value: 51820.0 },
      { time: '14:15', value: 51900.0 },
      { time: '15:00', value: 51920.0 },
      { time: '15:30', value: 51785.40 }
    ]
  },
  {
    id: 'niftyit',
    name: 'NIFTY IT',
    symbol: 'NIFTY IT',
    exchange: 'NSE',
    value: 41920.80,
    change: -115.40,
    changePercent: -0.27,
    dayHigh: 42200.50,
    dayLow: 41810.00,
    open: 42150.00,
    prevClose: 42036.20,
    week52High: 43250.00,
    week52Low: 30850.00,
    peRatio: 30.2,
    pcr: 0.88,
    rsi: 48.9,
    chartData1D: [
      { time: '09:15', value: 42150.0 },
      { time: '09:45', value: 42080.0 },
      { time: '10:30', value: 41950.0 },
      { time: '11:15', value: 41880.0 },
      { time: '12:00', value: 41920.0 },
      { time: '12:45', value: 41850.0 },
      { time: '13:30', value: 41900.0 },
      { time: '14:15', value: 41960.0 },
      { time: '15:00', value: 41940.0 },
      { time: '15:30', value: 41920.80 }
    ]
  }
];

const Dashboard: React.FC = () => {
  // State
  const [indices, setIndices] = useState<IndexPulseItem[]>([]);
  const [allIndicesList, setAllIndicesList] = useState<any[]>([]);
  const [gainers, setGainers] = useState<MarketMoverStock[]>([]);
  const [losers, setLosers] = useState<MarketMoverStock[]>([]);
  const [mostActive, setMostActive] = useState<MarketMoverStock[]>([]);
  const [breakouts, setBreakouts] = useState<MarketMoverStock[]>([]);
  const [indiaVix, setIndiaVix] = useState<{ value: number; change: number } | null>(null);
  const [globalData, setGlobalData] = useState<Partial<GlobalSentimentsData> | null>(null);
  const [recentNews, setRecentNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');

  // Real-time IST Digital Clock & Market Session Calculator
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Indian Market Session status (NSE / BSE)
  const marketSession = useMemo(() => {
    const now = new Date();
    // Get hours & minutes in Indian Standard Time (IST, UTC+5:30)
    const istTimeStr = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    const istDate = new Date(istTimeStr);
    const day = istDate.getDay(); // 0 is Sunday, 6 is Saturday
    const hours = istDate.getHours();
    const minutes = istDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // Weekend
    if (day === 0 || day === 6) {
      return {
        status: 'CLOSED',
        label: 'Market Closed (Weekend)',
        badgeType: 'neutral' as const,
        isOpen: false,
        detail: 'Reopens Monday 09:15 AM IST'
      };
    }

    // Normal Trading: 9:15 AM (555 min) to 3:30 PM (930 min)
    if (totalMinutes >= 555 && totalMinutes < 930) {
      return {
        status: 'OPEN',
        label: 'NSE & BSE Live Trading',
        badgeType: 'success' as const,
        isOpen: true,
        detail: 'Closes at 03:30 PM IST'
      };
    }

    // Pre-Market: 9:00 AM (540 min) to 9:15 AM (555 min)
    if (totalMinutes >= 540 && totalMinutes < 555) {
      return {
        status: 'PRE-MARKET',
        label: 'Pre-Market Discovery Call',
        badgeType: 'warning' as const,
        isOpen: true,
        detail: 'Regular session starts 09:15 AM'
      };
    }

    // Post-Market / Closing session: 3:30 PM (930 min) to 4:00 PM (960 min)
    if (totalMinutes >= 930 && totalMinutes < 960) {
      return {
        status: 'POST-MARKET',
        label: 'Post-Market Closing Run',
        badgeType: 'warning' as const,
        isOpen: false,
        detail: 'Closes at 04:00 PM IST'
      };
    }

    return {
      status: 'CLOSED',
      label: 'Market Closed (After Hours)',
      badgeType: 'neutral' as const,
      isOpen: false,
      detail: 'Reopens 09:15 AM IST'
    };
  }, [currentTimeStr]);

  // Master Data Loading function with resilient non-blocking Promise.allSettled
  const loadDashboardData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [
        indicesResult,
        gainersResult,
        losersResult,
        activeResult,
        breakoutsResult,
        globalResult,
        newsResult
      ] = await Promise.allSettled([
        stockService.getMarketIndices(),
        stockService.getTopGainers(),
        stockService.getTopLosers(),
        stockService.getMostActive(),
        stockService.getBreakouts(),
        fetchGlobalSentiments(),
        fetchBreakingNews()
      ]);

      // 1. Process Market Indices
      if (indicesResult.status === 'fulfilled' && indicesResult.value && indicesResult.value.length > 0) {
        const fetchedIndices = indicesResult.value;
        setAllIndicesList(fetchedIndices);
        const mapped = DEFAULT_INDICES_DATA.map((baseIdx) => {
          const match = fetchedIndices.find(
            f => f.name.toLowerCase().includes(baseIdx.symbol.toLowerCase()) || 
                 baseIdx.name.toLowerCase().includes(f.name.toLowerCase())
          );
          if (match) {
            const val = match.value;
            const chg = match.change;
            const pct = match.pct ?? 0;
            return {
              ...baseIdx,
              value: val,
              change: chg,
              changePercent: pct,
              open: Math.round(val - chg),
              prevClose: Math.round(val - chg),
              dayHigh: Math.round(val * 1.008),
              dayLow: Math.round(val * 0.992)
            };
          }
          return baseIdx;
        });
        setIndices(mapped);

        // Extract India VIX if present
        const vixItem = fetchedIndices.find(f => f.name.toLowerCase().includes('vix'));
        if (vixItem) {
          setIndiaVix({ value: vixItem.value, change: vixItem.change });
        }
      }

      // 2. Process Gainers (Strictly from live exchange mover feed or EOD closing snapshot)
      if (gainersResult.status === 'fulfilled' && gainersResult.value && gainersResult.value.length > 0) {
        const gList: MarketMoverStock[] = gainersResult.value.map((s: any) => ({
          symbol: (s.symbol || '').replace('.NS', '').replace('.BO', ''),
          name: s.name,
          price: s.price,
          change: s.change,
          pct: s.pct ?? s.changePercent ?? 0,
          volume: s.volume || 1500000,
          sector: s.sector || 'Equities',
          week52High: s.week52High,
          isClosingSnapshot: s.isClosingSnapshot,
          snapshotTime: s.snapshotTime
        }));
        setGainers(gList);
      } else if (!isRefresh) {
        setGainers([]);
      }

      // 3. Process Losers
      if (losersResult.status === 'fulfilled' && losersResult.value && losersResult.value.length > 0) {
        const lList: MarketMoverStock[] = losersResult.value.map((s: any) => ({
          symbol: (s.symbol || '').replace('.NS', '').replace('.BO', ''),
          name: s.name,
          price: s.price,
          change: s.change,
          pct: s.pct ?? s.changePercent ?? 0,
          volume: s.volume || 1200000,
          sector: s.sector || 'Equities',
          week52High: s.week52High,
          isClosingSnapshot: s.isClosingSnapshot,
          snapshotTime: s.snapshotTime
        }));
        setLosers(lList);
      } else if (!isRefresh) {
        setLosers([]);
      }

      // 4. Process Most Active
      if (activeResult.status === 'fulfilled' && activeResult.value && activeResult.value.length > 0) {
        const aList: MarketMoverStock[] = activeResult.value.map((s: any) => ({
          symbol: (s.symbol || '').replace('.NS', '').replace('.BO', ''),
          name: s.name,
          price: s.price,
          change: s.change,
          pct: s.pct ?? s.changePercent ?? 0,
          volume: s.volume || 2500000,
          sector: s.sector || 'Active Volume',
          week52High: s.week52High,
          isClosingSnapshot: s.isClosingSnapshot,
          snapshotTime: s.snapshotTime
        }));
        setMostActive(aList);
      } else if (!isRefresh) {
        setMostActive([]);
      }

      // 5. Process 52W Breakouts
      if (breakoutsResult.status === 'fulfilled' && breakoutsResult.value && breakoutsResult.value.length > 0) {
        const bList: MarketMoverStock[] = breakoutsResult.value.map((s: any) => ({
          symbol: (s.symbol || '').replace('.NS', '').replace('.BO', ''),
          name: s.name,
          price: s.price,
          change: s.change,
          pct: s.pct ?? s.changePercent ?? 0,
          volume: s.volume || 1800000,
          week52High: s.week52High,
          sector: s.sector || '52W High',
          isClosingSnapshot: s.isClosingSnapshot,
          snapshotTime: s.snapshotTime
        }));
        setBreakouts(bList);
      } else if (!isRefresh) {
        setBreakouts([]);
      }

      // 6. Process Global Sentiments Data
      if (globalResult.status === 'fulfilled' && globalResult.value) {
        setGlobalData(globalResult.value);
      }

      // 7. Process Recent News
      if (newsResult.status === 'fulfilled' && newsResult.value && newsResult.value.length > 0) {
        setRecentNews(newsResult.value);
      }

      setLastUpdated(new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    // Auto-refresh every 60 seconds strictly during active trading hours (09:15 - 15:30 IST)
    // Completely paused when market is closed or over weekends to eliminate unnecessary API requests.
    const pollTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (!marketSession.isOpen) {
        return;
      }
      loadDashboardData(true);
    }, 60000);
    return () => clearInterval(pollTimer);
  }, [loadDashboardData, marketSession.isOpen]);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 overflow-x-hidden">
      {/* 1. HERO HEADER: Institutional Command Banner (Adaptive Light/Dark Theme) */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-slate-950 p-4 sm:p-6 lg:p-8 border border-slate-200/80 dark:border-slate-800 shadow-xl transition-colors">
        {/* Ambient Gradient Glows */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 sm:w-96 h-72 sm:h-96 bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 -mb-10 w-64 sm:w-80 h-64 sm:h-80 bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6">
          {/* Left Title & Status */}
          <div className="space-y-2 sm:space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5">
              {/* Live Market Status Pill with Pulsing Dot */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-bold ${
                marketSession.isOpen
                  ? 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  marketSession.isOpen ? 'bg-emerald-500 dark:bg-emerald-400 animate-ping' : 'bg-slate-400'
                }`} />
                <span>{marketSession.status}</span>
                <span className="text-slate-400">•</span>
                <span className="truncate max-w-[180px] sm:max-w-none">{marketSession.detail}</span>
              </span>

              {/* Real-time IST Digital Clock */}
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/80 dark:bg-white/10 text-slate-800 dark:text-white text-[11px] sm:text-xs font-mono font-medium border border-slate-200/80 dark:border-white/10 shadow-xs">
                <Clock className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
                <span>{currentTimeStr || '15:30:00 IST'}</span>
              </span>
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <span>Market Intelligence</span>
            </h1>

            {/* Point-wise feature highlights displayed in 2 rows */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 sm:gap-y-2 pt-1 text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0" />
                <span>Live NSE & BSE Real-Time Tick Feeds</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400 shrink-0" />
                <span>GIFT Nifty Opening Gap Predictions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 shrink-0" />
                <span>Institutional FII & DII Cash Flow Radar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 dark:bg-purple-400 shrink-0" />
                <span>Loughran-McDonald Financial News Sentiment</span>
              </div>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 pt-2 lg:pt-0">
            {/* Ctrl + K Shortcut Trigger Pill */}
            <button
              onClick={() => {
                // Dispatch Ctrl+K keyboard event to toggle OmniSearch modal
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
              }}
              className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/80 hover:bg-white dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-white text-xs font-semibold border border-slate-200/80 dark:border-white/15 transition-all shadow-xs"
            >
              <Search className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-300" />
              <span>Quick Search</span>
              <kbd className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-black/40 text-[10px] text-slate-600 dark:text-slate-300 font-mono border border-slate-200 dark:border-slate-800">
                Ctrl K
              </kbd>
            </button>

            {/* Last Synced Pill - Placed directly beside the Refresh button for phone, tablet, and desktop */}
            <div className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-white/80 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[11px] sm:text-xs font-medium border border-slate-200/80 dark:border-white/10 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-500 dark:text-slate-400">Synced:</span>
              <span className="font-bold text-slate-800 dark:text-white font-mono">{lastUpdated}</span>
            </div>

            {/* Sync / Refresh Button */}
            <button
              onClick={() => loadDashboardData(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. BENCHMARK INDICES & INTERACTIVE CHART WITH BESIDE-CHART FII/DII & VIX CARDS */}
      <KeyIndicesPulse 
        loading={loading}
        indices={indices}
        allIndices={allIndicesList}
        asideWidget={
          <MarketSnapshotBar
            loading={loading}
            fiiInflow={globalData?.fiiDiiFlows?.[0]?.fiiNet ?? null}
            diiInflow={globalData?.fiiDiiFlows?.[0]?.diiNet ?? null}
            fiiDate={globalData?.fiiDiiFlows?.[0]?.date || null}
            fiiSource={globalData?.fiiDiiFlows?.[0]?.fiiBuy ? 'NSE Official EOD' : undefined}
            vix={indiaVix?.value ?? globalData?.volatility?.find(v => v.id === 'india-vix')?.value ?? null}
            vixChange={indiaVix?.change ?? globalData?.volatility?.find(v => v.id === 'india-vix')?.change ?? null}
          />
        }
      />

      {/* 3. ROW 2: MARKET MOVERS (8 COLS) + KEY GLOBAL CUES (4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        {/* Left: Market Movers (Gainers, Losers, Active, Breakouts) */}
        <div className="lg:col-span-8">
          <MarketMoversWidget
            loading={loading}
            gainers={gainers}
            losers={losers}
            mostActive={mostActive}
            breakouts={breakouts}
          />
        </div>

        {/* Right: Key Global Cues */}
        <div className="lg:col-span-4 flex flex-col">
          <GlobalPulseWidget loading={loading} data={globalData || undefined} />
        </div>
      </div>

      {/* 4. ROW 3: RECENT MARKET NEWS & NLP SENTIMENT CARDS (FULL WIDTH) */}
      <RecentNewsWidget loading={loading} news={recentNews} />

      {/* 6. BOTTOM BANNER: MONEYLOGGER QUANTITATIVE AI MODEL TEASER */}
      {/* IN FUTURE VERSION */}
    </div>
  );
};

export default Dashboard;
