import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  TrendingDown, 
  Flame, 
  Award, 
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
import { formatCurrency, formatNumber } from '../../utils/formatters';

export interface MarketMoverStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  pct: number;
  volume: number;
  sector?: string;
  week52High?: number;
  marketCap?: number;
  isClosingSnapshot?: boolean;
  snapshotTime?: string;
}

interface MarketMoversWidgetProps {
  loading?: boolean;
  gainers?: MarketMoverStock[];
  losers?: MarketMoverStock[];
  mostActive?: MarketMoverStock[];
  breakouts?: MarketMoverStock[];
  onSelectStock?: (symbol: string) => void;
}

type TabType = 'gainers' | 'losers' | 'active' | 'breakouts';

const MarketMoversWidget: React.FC<MarketMoversWidgetProps> = ({
  loading = false,
  gainers = [],
  losers = [],
  mostActive = [],
  breakouts = [],
  onSelectStock
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('gainers');

  const tabList = [
    { id: 'gainers' as TabType, label: 'Top Gainers', icon: TrendingUp, count: gainers.length, color: 'text-emerald-500' },
    { id: 'losers' as TabType, label: 'Top Losers', icon: TrendingDown, count: losers.length, color: 'text-rose-500' },
    { id: 'active' as TabType, label: 'Most Active', icon: Flame, count: mostActive.length, color: 'text-amber-500' },
    { id: 'breakouts' as TabType, label: '52W Breakouts', icon: Award, count: breakouts.length, color: 'text-indigo-500' },
  ];

  const currentList = {
    gainers,
    losers,
    active: mostActive,
    breakouts
  }[activeTab];

  const handleStockClick = (symbol: string) => {
    if (onSelectStock) {
      onSelectStock(symbol);
    } else {
      navigate(`/screeners?search=${encodeURIComponent(symbol)}`);
    }
  };

  const isSnapshotMode = Boolean(currentList[0]?.isClosingSnapshot);

  return (
    <GlassCard className="h-full flex flex-col justify-between" noPadding>
      {/* Widget Header & Category Navigation */}
      <div className="px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">
            Market Movers
          </h2>
          {isSnapshotMode ? (
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20"
              title="Market closed. Showing official closing prices from previous session."
            >
              EOD Snapshot (15:30 IST)
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              Live
            </span>
          )}
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg self-start sm:self-auto border border-slate-200 dark:border-slate-700/60 overflow-x-auto scrollbar-none max-w-full">
          {tabList.map((tab) => {
            const Icon = tab.icon;
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all whitespace-nowrap ${
                  isTabActive
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className={`w-3 h-3 ${tab.color}`} />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`text-[10px] px-1 py-0.2 rounded ${isTabActive ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 font-bold' : 'text-slate-400'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compact Tabular Rows Content */}
      <div className="overflow-x-auto flex-1">
        {loading ? (
          // Loading skeleton state
          <div className="p-3 space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between py-1.5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3 w-32 bg-slate-200 dark:bg-slate-700 rounded hidden sm:block" />
                </div>
                <div className="flex items-center gap-6">
                  <div className="h-3 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3.5 w-16 bg-slate-200 dark:bg-slate-700 rounded" />
                  <div className="h-3.5 w-14 bg-slate-200 dark:bg-slate-700 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : currentList.length === 0 ? (
          // Clean Transparent Offline / Closed State (No misleading local DB fallback)
          <div className="py-12 px-4 text-center space-y-2.5">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 dark:bg-amber-500/15 flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
              Live {tabList.find(t => t.id === activeTab)?.label} Feed Offline
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
              Exchange mover rankings stream via Upstox during market hours (09:15 - 15:30 IST).
            </p>
          </div>
        ) : (
          // Structured Compact Table View
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/70 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-400 bg-slate-50/50 dark:bg-slate-900/40">
                <th className="py-1.5 px-2 w-6 sm:w-8 text-center">#</th>
                <th className="py-1.5 px-2 sm:px-3">Stock / Company</th>
                <th className="py-1.5 px-3 text-right hidden sm:table-cell">Volume</th>
                <th className="py-1.5 px-2 sm:px-3 text-right">Price (₹)</th>
                <th className="py-1.5 px-3 text-right hidden md:table-cell">Change (₹)</th>
                <th className="py-1.5 px-2 sm:px-3 text-right">% Change</th>
                <th className="py-1.5 px-3 text-right hidden lg:table-cell">52W High</th>
                <th className="py-1.5 px-1.5 sm:px-2 w-5 text-center"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 text-xs">
              {currentList.map((stock, index) => {
                const isUp = stock.pct >= 0;
                return (
                  <tr
                    key={stock.symbol}
                    onClick={() => handleStockClick(stock.symbol)}
                    className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/60 transition-colors cursor-pointer group"
                  >
                    {/* Rank */}
                    <td className="py-1.5 sm:py-2 px-2 text-center text-[10px] sm:text-[11px] font-semibold text-slate-400 group-hover:text-indigo-500 transition-colors">
                      {index + 1}
                    </td>

                    {/* Stock Symbol & Company Name */}
                    <td className="py-1.5 sm:py-2 px-2 sm:px-3 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-1.5 min-w-0">
                        <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate">
                          {stock.symbol}
                        </span>
                        <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-[100px] sm:max-w-[160px] md:max-w-[200px]">
                          {stock.name}
                        </span>
                      </div>
                    </td>

                    {/* Volume (Hidden on Mobile) */}
                    <td className="py-1.5 sm:py-2 px-3 text-right font-mono text-[11px] text-slate-600 dark:text-slate-300 whitespace-nowrap hidden sm:table-cell">
                      {formatNumber(stock.volume)}
                    </td>

                    {/* Price (LTP) */}
                    <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-right font-mono font-bold text-xs sm:text-sm text-slate-900 dark:text-white whitespace-nowrap">
                      {formatCurrency(stock.price)}
                      {/* Show Change on small screens where Change column is hidden */}
                      <span className={`block md:hidden text-[10px] font-semibold ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {isUp ? '+' : ''}₹{stock.change.toFixed(2)}
                      </span>
                    </td>

                    {/* Net Change (₹) (Hidden on Mobile/Small Tablet) */}
                    <td className={`py-1.5 sm:py-2 px-3 text-right font-mono font-semibold text-xs whitespace-nowrap hidden md:table-cell ${
                      isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {isUp ? '+' : ''}₹{stock.change.toFixed(2)}
                    </td>

                    {/* % Change */}
                    <td className="py-1.5 sm:py-2 px-2 sm:px-3 text-right whitespace-nowrap">
                      <span className={`inline-flex items-center gap-0.5 font-mono font-bold text-[10px] sm:text-xs px-1.5 py-0.5 rounded-md ${
                        isUp ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {isUp ? <ArrowUpRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> : <ArrowDownRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                        <span>{isUp ? '+' : ''}{stock.pct.toFixed(2)}%</span>
                      </span>
                    </td>

                    {/* 52-Week High (Hidden on Mobile & Tablet) */}
                    <td className="py-1.5 sm:py-2 px-3 text-right font-mono text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap hidden lg:table-cell">
                      {stock.week52High ? `₹${stock.week52High.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '--'}
                    </td>

                    {/* Row action chevron */}
                    <td className="py-1.5 sm:py-2 px-1.5 sm:px-2 text-center">
                      <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all inline-block" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Compact Footer */}
      <div className="px-3.5 sm:px-4 py-1.5 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
        <span className="text-slate-500 dark:text-slate-400 font-medium">
          Top {currentList.length} Real-Time Movers • {tabList.find(t => t.id === activeTab)?.label}
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          NSE Live Feed
        </span>
      </div>
    </GlassCard>
  );
};

export default MarketMoversWidget;
