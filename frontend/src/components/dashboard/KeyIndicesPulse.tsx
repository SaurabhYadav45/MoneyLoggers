import React, { useState, useMemo } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight,
  Search,
  X,
  Layers
} from 'lucide-react';
import GlassCard from '../ui/GlassCard';
import Badge from '../ui/Badge';
import TradingViewChart from './TradingViewChart';

export interface IndexPulseItem {
  id: string;
  name: string;
  symbol: string;
  exchange: 'NSE' | 'BSE';
  value: number;
  change: number;
  changePercent: number;
  dayHigh: number;
  dayLow: number;
  open: number;
  prevClose: number;
  week52High: number;
  week52Low: number;
  peRatio?: number;
  pcr?: number; // Put-Call Ratio
  rsi?: number;
  chartData1D: Array<{ time: string; value: number }>;
  chartData1W?: Array<{ time: string; value: number }>;
  chartData1M?: Array<{ time: string; value: number }>;
  chartData1Y?: Array<{ time: string; value: number }>;
}

export interface RawMarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  dayHigh?: number;
  dayLow?: number;
  open?: number;
  prevClose?: number;
  exchange?: string;
  time?: string;
}

interface KeyIndicesPulseProps {
  loading?: boolean;
  indices?: IndexPulseItem[];
  allIndices?: RawMarketIndex[];
  asideWidget?: React.ReactNode;
  onSelectIndex?: (symbol: string) => void;
}

type IndexCategory = 'ALL' | 'BROAD' | 'SECTORAL' | 'NSE' | 'BSE';

/**
 * Maps common Indian index names to official TradingView ticker symbols.
 */
const getTradingViewSymbol = (name: string): string => {
  const lower = name.toLowerCase().trim();
  if (lower.includes('nifty 50') || lower === 'nifty') return 'NSE:NIFTY';
  if (lower.includes('sensex')) return 'BSE:SENSEX';
  if (lower.includes('banknifty') || lower.includes('nifty bank')) return 'NSE:BANKNIFTY';
  if (lower.includes('nifty it') || lower === 'cnx it') return 'NSE:CNXIT';
  if (lower.includes('nifty auto') || lower === 'cnx auto') return 'NSE:CNXAUTO';
  if (lower.includes('nifty pharma') || lower === 'cnx pharma') return 'NSE:CNXPHARMA';
  if (lower.includes('nifty metal') || lower === 'cnx metal') return 'NSE:CNXMETAL';
  if (lower.includes('nifty fmcg') || lower === 'cnx fmcg') return 'NSE:CNXFMCG';
  if (lower.includes('nifty realty') || lower === 'cnx realty') return 'NSE:CNXREALTY';
  if (lower.includes('nifty energy') || lower === 'cnx energy') return 'NSE:CNXENERGY';
  if (lower.includes('nifty midcap 50') || lower.includes('nifty midcap')) return 'NSE:NIFTY_MIDCAP_50';
  if (lower.includes('nifty smallcap 100') || lower.includes('nifty smallcap')) return 'NSE:NIFTY_SMALLCAP_100';
  if (lower.includes('nifty 100')) return 'NSE:NIFTY100';
  if (lower.includes('nifty 500')) return 'NSE:NIFTY500';
  if (lower.includes('bse 100')) return 'BSE:BSE100';
  if (lower.includes('bse 500')) return 'BSE:BSE500';
  if (lower.includes('india vix') || lower.includes('vix')) return 'NSE:INDIAVIX';

  if (name.toUpperCase().startsWith('BSE')) return `BSE:${name.replace(/BSE\s*/i, '').trim()}`;
  return `NSE:${name.replace(/NIFTY\s*/i, '').trim() || 'NIFTY'}`;
};

const DEFAULT_QUICK_TABS = [
  { symbol: 'NIFTY 50', name: 'NIFTY 50' },
  { symbol: 'SENSEX', name: 'SENSEX' },
  { symbol: 'NIFTY IT', name: 'NIFTY IT' },
  { symbol: 'BANKNIFTY', name: 'BANK NIFTY' },
  { symbol: 'NIFTY MIDCAP 50', name: 'NIFTY MIDCAP' },
  { symbol: 'NIFTY AUTO', name: 'NIFTY AUTO' },
];

const KeyIndicesPulse: React.FC<KeyIndicesPulseProps> = ({ 
  loading = false,
  indices = [],
  allIndices = [],
  asideWidget,
  onSelectIndex
}) => {
  const [selectedIndexSymbol, setSelectedIndexSymbol] = useState<string>(indices[0]?.symbol || 'NIFTY 50');
  const [selectedCustomItem, setSelectedCustomItem] = useState<IndexPulseItem | null>(null);
  const [showAllModal, setShowAllModal] = useState<boolean>(false);
  const [modalSearch, setModalSearch] = useState<string>('');
  const [modalCategory, setModalCategory] = useState<IndexCategory>('ALL');

  // Update selected symbol if primary indices load
  React.useEffect(() => {
    if (indices.length > 0 && !selectedIndexSymbol) {
      setSelectedIndexSymbol(indices[0].symbol);
    }
  }, [indices, selectedIndexSymbol]);

  // Handle index selection internally (no page redirection)
  const handleSelectIndex = (symbol: string, customItem?: IndexPulseItem) => {
    setSelectedIndexSymbol(symbol);
    if (customItem) {
      setSelectedCustomItem(customItem);
    } else {
      setSelectedCustomItem(null);
    }
    if (onSelectIndex) {
      onSelectIndex(symbol);
    }
  };

  // Find active selected index data
  const selectedIndex = useMemo(() => {
    if (selectedCustomItem) return selectedCustomItem;
    const match = indices.find(i => i.symbol.toLowerCase() === selectedIndexSymbol.toLowerCase() || i.name.toLowerCase() === selectedIndexSymbol.toLowerCase());
    if (match) return match;

    // Check allIndices list
    const fromAll = allIndices.find(a => a.name.toLowerCase() === selectedIndexSymbol.toLowerCase());
    if (fromAll) {
      return {
        id: fromAll.name.toLowerCase().replace(/\s+/g, '-'),
        name: fromAll.name,
        symbol: fromAll.name,
        exchange: (fromAll.exchange === 'BSE' ? 'BSE' : 'NSE') as 'NSE' | 'BSE',
        value: fromAll.value,
        change: fromAll.change,
        changePercent: fromAll.changePercent,
        dayHigh: fromAll.dayHigh || fromAll.value * 1.008,
        dayLow: fromAll.dayLow || fromAll.value * 0.992,
        open: fromAll.open || fromAll.value - fromAll.change,
        prevClose: fromAll.prevClose || fromAll.value - fromAll.change,
        week52High: fromAll.value * 1.08,
        week52Low: fromAll.value * 0.85
      } as IndexPulseItem;
    }

    return indices[0];
  }, [indices, allIndices, selectedIndexSymbol, selectedCustomItem]);

  const isPositive = selectedIndex ? selectedIndex.change >= 0 : true;

  // Filter indices inside the All Indices Modal
  const filteredAllIndices = useMemo(() => {
    const list = allIndices.length > 0 ? allIndices : indices.map(i => ({
      name: i.name,
      value: i.value,
      change: i.change,
      changePercent: i.changePercent,
      exchange: i.exchange
    }));

    return list.filter(item => {
      // Search filter
      const matchesSearch = !modalSearch.trim() || 
        item.name.toLowerCase().includes(modalSearch.toLowerCase()) ||
        (item.exchange && item.exchange.toLowerCase().includes(modalSearch.toLowerCase()));

      if (!matchesSearch) return false;

      // Category filter
      const nameLower = item.name.toLowerCase();
      if (modalCategory === 'NSE') return item.exchange === 'NSE';
      if (modalCategory === 'BSE') return item.exchange === 'BSE' || nameLower.includes('bse') || nameLower.includes('sensex');
      if (modalCategory === 'SECTORAL') {
        return nameLower.includes('bank') || nameLower.includes('it') || nameLower.includes('auto') || 
               nameLower.includes('pharma') || nameLower.includes('metal') || nameLower.includes('fmcg') || 
               nameLower.includes('realty') || nameLower.includes('energy') || nameLower.includes('infra');
      }
      if (modalCategory === 'BROAD') {
        return nameLower.includes('nifty 50') || nameLower.includes('sensex') || nameLower.includes('100') || 
               nameLower.includes('200') || nameLower.includes('500') || nameLower.includes('midcap') || 
               nameLower.includes('smallcap');
      }

      return true;
    });
  }, [allIndices, indices, modalSearch, modalCategory]);

  const tradingViewSymbol = useMemo(() => {
    return getTradingViewSymbol(selectedIndex?.name || selectedIndexSymbol);
  }, [selectedIndex, selectedIndexSymbol]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="p-3.5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 animate-pulse space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-12 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
              <div className="h-6 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 p-6 rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 min-h-[350px] animate-pulse flex items-center justify-center">
            <span className="text-xs text-slate-400">Loading benchmark index chart...</span>
          </div>
          <div className="lg:col-span-3">
            {asideWidget}
          </div>
        </div>
      </div>
    );
  }

  if (!indices || indices.length === 0) {
    return (
      <div className="space-y-4">
        <GlassCard className="p-8 text-center space-y-2 border-slate-200/70 dark:border-slate-800">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
            <span className="text-lg font-bold">!</span>
          </div>
          <h3 className="text-base font-bold text-slate-800 dark:text-white">Benchmark Indices Offline</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Real-time feeds for NSE & BSE indices could not be retrieved from the exchange gateway.
          </p>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 1. Header with 4 Benchmark Cards + "Explore All Indices" Button */}
      <div className="space-y-2 sm:space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Benchmark Indicators
            </span>
            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              NSE & BSE Live
            </span>
          </div>

          <button
            onClick={() => setShowAllModal(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200/70 dark:border-indigo-800/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all shadow-xs"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden xs:inline">Explore All 208 Indices</span>
            <span className="xs:hidden">All Indices</span>
          </button>
        </div>

        {/* 4 Benchmark Index Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
          {indices.slice(0, 4).map((idx) => {
            const isSelected = selectedIndex?.symbol === idx.symbol || selectedIndex?.name === idx.name;
            const isUp = idx.change >= 0;

            return (
              <div
                key={idx.symbol}
                onClick={() => handleSelectIndex(idx.symbol)}
                className={`p-2.5 sm:p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                  isSelected
                    ? 'bg-white dark:bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-md shadow-indigo-500/10'
                    : 'bg-white/80 dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <div className="flex justify-between items-start mb-1.5 sm:mb-2 gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1 sm:gap-1.5 truncate">
                      <span className="truncate">{idx.name}</span>
                      <span className="text-[9px] sm:text-[10px] font-semibold text-slate-600 dark:text-slate-300 px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-800 shrink-0">
                        {idx.exchange}
                      </span>
                    </div>
                    <div className="text-[10px] sm:text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-medium truncate">
                      {idx.symbol}
                    </div>
                  </div>
                  <span className={`text-[10px] sm:text-[11px] font-extrabold px-1 sm:px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0 ${
                    isUp 
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  }`}>
                    {isUp ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                    {isUp ? '+' : ''}{idx.changePercent.toFixed(2)}%
                  </span>
                </div>

                {/* Price & Absolute Points */}
                <div className="flex flex-wrap items-baseline justify-between gap-1 mb-1.5 sm:mb-2">
                  <span className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate">
                    {idx.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[11px] sm:text-xs font-bold ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {isUp ? '+' : ''}{idx.change.toFixed(2)}
                  </span>
                </div>

                {/* Mini Day Range Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-600 dark:text-slate-300 font-medium">
                    <span>L: {idx.dayLow.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    <span>H: {idx.dayHigh.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                  </div>
                  <div className="h-1 sm:h-1.5 bg-slate-200 dark:bg-slate-700/60 rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full rounded-full ${isUp ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ 
                        width: `${Math.min(Math.max(((idx.value - idx.dayLow) / (idx.dayHigh - idx.dayLow || 1)) * 100, 5), 100)}%` 
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Detailed Chart Row + Space beside chart for FII/DII & VIX Snapshot Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* Left: Detailed Chart Box (9 cols - wider chart box) */}
        <div className={asideWidget ? "lg:col-span-9" : "lg:col-span-12"}>
          {selectedIndex && (
            <GlassCard className="border-slate-200/80 dark:border-slate-800 h-full flex flex-col justify-between" noPadding>
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 flex-1 flex flex-col justify-between">
                
                {/* Header: Compact Single Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2.5 min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                      {selectedIndex.name}
                    </h3>

                    <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono tracking-tight">
                      ₹{selectedIndex.value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>

                    <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-1.5 py-0.5 rounded-md ${
                      isPositive ? 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10' : 'text-rose-700 dark:text-rose-400 bg-rose-500/10'
                    }`}>
                      {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      <span>{isPositive ? '+' : ''}{selectedIndex.change.toFixed(2)}</span>
                      <span>({isPositive ? '+' : ''}{selectedIndex.changePercent.toFixed(2)}%)</span>
                    </span>

                    <Badge type={isPositive ? 'success' : 'danger'}>
                      {isPositive ? 'EXPANDING' : 'CONTRACTING'}
                    </Badge>

                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium hidden md:inline">
                      • {selectedIndex.exchange} Real-Time Tick
                    </span>
                  </div>

                  {/* Right Header Status Pill */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Live Feed
                    </span>
                  </div>
                </div>

                {/* Quick-Switch Index Tabs directly inside the Chart Box */}
                <div className="flex flex-wrap items-center gap-1.5 py-2 border-b border-slate-100 dark:border-slate-800/60 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0 mr-1">
                    Quick Switch:
                  </span>
                  {DEFAULT_QUICK_TABS.map((tab) => {
                    const isActive = selectedIndex?.symbol === tab.symbol || selectedIndex?.name.toLowerCase() === tab.symbol.toLowerCase();
                    return (
                      <button
                        key={tab.symbol}
                        onClick={() => handleSelectIndex(tab.symbol)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-xs font-bold'
                            : 'bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {tab.name}
                      </button>
                    );
                  })}

                  {/* If custom index is selected from modal, show as active tab */}
                  {selectedCustomItem && !DEFAULT_QUICK_TABS.some(t => t.symbol === selectedCustomItem.symbol) && (
                    <button
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-xs whitespace-nowrap"
                    >
                      {selectedCustomItem.name}
                    </button>
                  )}

                  <button
                    onClick={() => setShowAllModal(true)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1 shrink-0 ml-auto whitespace-nowrap"
                  >
                    <Layers className="w-3 h-3" />
                    <span>All 208 Indices</span>
                  </button>
                </div>

                {/* High-Performance Candlestick & Volume Viewport (Responsive Height) */}
                <div className="w-full pt-2 pb-0.5 min-h-[350px] sm:min-h-[390px] md:min-h-[430px]">
                  <div className="h-[350px] sm:h-[390px] md:h-[430px] w-full rounded-xl overflow-hidden border border-slate-200/60 dark:border-slate-800/80 bg-slate-950/5">
                    <TradingViewChart 
                      symbol={selectedIndex.name || selectedIndexSymbol} 
                      name={selectedIndex.name} 
                      currentPrice={selectedIndex.value}
                      height="100%" 
                    />
                  </div>
                </div>

                {/* Quick Metrics Bar at Bottom */}
                <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2">
                  <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                      Day Open
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
                      ₹{selectedIndex.open.toLocaleString()}
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                      Prev Close
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
                      ₹{selectedIndex.prevClose.toLocaleString()}
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                      Day High / Low
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
                      {selectedIndex.dayHigh.toLocaleString()} / {selectedIndex.dayLow.toLocaleString()}
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                      52W High
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 truncate block">
                      {selectedIndex.week52High.toLocaleString()}
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                      Ticker
                    </span>
                    <span className="text-xs sm:text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate block">
                      {tradingViewSymbol}
                    </span>
                  </div>

                  <div className="py-1.5 px-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
                    <span className="text-[9px] sm:text-[10px] font-semibold text-slate-500 dark:text-slate-400 block uppercase">
                      RSI / PCR
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate block">
                      {selectedIndex.rsi || 58.4} / {selectedIndex.pcr || 1.12}
                    </span>
                  </div>
                </div>

              </div>
            </GlassCard>
          )}
        </div>

        {/* Right: Sits directly in the space beside the chart (3 cols - takes only required height) */}
        {asideWidget && (
          <div className="lg:col-span-3 flex flex-col justify-start">
            {asideWidget}
          </div>
        )}
      </div>

      {/* 3. Explore All 208 Indian Indices Modal */}
      {showAllModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    All Indian Exchange Indices
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    {filteredAllIndices.length} Available
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select any benchmark, sectoral, or thematic index to inspect its live chart
                </p>
              </div>

              <button
                onClick={() => setShowAllModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Controls & Search */}
            <div className="p-3 sm:p-4 border-b border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search indices (e.g. Pharma, Auto, Midcap, BSE)..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-1 sm:pb-0">
                {(['ALL', 'BROAD', 'SECTORAL', 'NSE', 'BSE'] as IndexCategory[]).map(cat => (
                  <button
                    key={cat}
                    onClick={() => setModalCategory(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      modalCategory === cat
                        ? 'bg-indigo-600 text-white shadow-xs font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {cat === 'ALL' ? 'All (208)' : cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable Indices List */}
            <div className="overflow-y-auto flex-1 p-3 sm:p-4 divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredAllIndices.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  No index matched "{modalSearch}".
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filteredAllIndices.map((item) => {
                    const isSelected = selectedIndex?.name.toLowerCase() === item.name.toLowerCase();
                    const isUp = item.changePercent >= 0;

                    return (
                      <div
                        key={item.name}
                        onClick={() => {
                          handleSelectIndex(item.name);
                          setShowAllModal(false);
                        }}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between group ${
                          isSelected
                            ? 'bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-500 ring-1 ring-indigo-500/30'
                            : 'bg-white dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/60'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                              {item.name}
                            </span>
                            <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                              {item.exchange || 'NSE'}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            {getTradingViewSymbol(item.name)}
                          </span>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-xs font-mono font-bold text-slate-900 dark:text-white">
                            ₹{item.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </div>
                          <div className={`text-[11px] font-mono font-bold flex items-center justify-end gap-0.5 ${
                            isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                            <span>{isUp ? '+' : ''}{item.changePercent.toFixed(2)}%</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 px-4 sm:px-5 bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-2 items-center justify-between text-xs text-slate-500 text-center sm:text-left">
              <span>Clicking any index immediately renders its chart in the dashboard</span>
              <button
                onClick={() => setShowAllModal(false)}
                className="w-full sm:w-auto px-4 py-1.5 rounded-lg text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KeyIndicesPulse;
