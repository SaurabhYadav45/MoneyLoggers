import React from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  Flame, 
  ShieldAlert,
  AlertCircle
} from 'lucide-react';
import GlassCard from '../ui/GlassCard';

export interface MarketSnapshotBarProps {
  loading?: boolean;
  fiiInflow?: number | null; // In Crores
  diiInflow?: number | null; // In Crores
  fiiDate?: string | null;
  fiiSource?: string | null;
  vix?: number | null;
  vixChange?: number | null;
}

/**
 * MarketSnapshotBar
 * Displays the 2 compact institutional market health cards:
 * 1. FII / DII Net Cash Flow (Official NSE EOD Settlement)
 * 2. India VIX (Live NSE Volatility & Fear Index)
 * 
 * Takes only their natural required compact height, leaving the space
 * beneath them open for future components.
 */
const MarketSnapshotBar: React.FC<MarketSnapshotBarProps> = ({
  loading = false,
  fiiInflow,
  diiInflow,
  fiiDate,
  fiiSource = 'NSE Official EOD',
  vix,
  vixChange,
}) => {
  // Loading skeleton state (Takes only natural required height)
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 w-full">
        {[1, 2].map((i) => (
          <GlassCard 
            key={i} 
            className="p-0 overflow-hidden border-slate-200/70 dark:border-slate-800" 
            noPadding
          >
            <div className="p-3 space-y-2.5 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-3.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-4 w-14 bg-slate-200 dark:bg-slate-700 rounded-full" />
              </div>
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-3 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
              </div>
            </div>
            <div className="px-3 py-1.5 bg-slate-100/50 dark:bg-slate-800/40 border-t border-slate-200/50 dark:border-slate-800/50">
              <div className="h-2.5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
            </div>
          </GlassCard>
        ))}
      </div>
    );
  }

  // FII/DII calculation
  const hasFiiDii = fiiInflow !== undefined && fiiInflow !== null && diiInflow !== undefined && diiInflow !== null;
  const combinedFlow = hasFiiDii ? (fiiInflow! + diiInflow!) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 sm:gap-4 w-full">
      {/* 1. Institutional FII / DII Flow Card (Natural compact height) */}
      <GlassCard 
        className="relative overflow-hidden p-0 border-slate-200/80 dark:border-slate-800"
        noPadding
      >
        <div className="px-3.5 py-2 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            FII / DII Net Flow
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-slate-700/60">
            {fiiDate ? `${fiiDate}` : (fiiSource || 'EOD Report')}
          </span>
        </div>

        <div className="p-3 space-y-1.5">
          {hasFiiDii ? (
            <div className="space-y-1">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">FII Cash:</span>
                <span className={`font-mono font-bold ${fiiInflow! >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {fiiInflow! >= 0 ? `+₹${fiiInflow!.toLocaleString()}` : `-₹${Math.abs(fiiInflow!).toLocaleString()}`} Cr
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">DII Cash:</span>
                <span className={`font-mono font-bold ${diiInflow! >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {diiInflow! >= 0 ? `+₹${diiInflow!.toLocaleString()}` : `-₹${Math.abs(diiInflow!).toLocaleString()}`} Cr
                </span>
              </div>
            </div>
          ) : (
            <div className="py-1 text-center">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                Data Pending
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">NSE daily settlement files publish EOD ~6:00 PM</p>
            </div>
          )}
        </div>

        {/* Combined Flow Footer Strip */}
        <div className="px-3.5 py-1.5 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200/70 dark:border-slate-800 flex justify-between items-center text-[11px]">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Combined:</span>
          {hasFiiDii ? (
            <span className={`font-mono font-bold ${combinedFlow! >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {combinedFlow! >= 0 ? '+' : ''}₹{combinedFlow!.toLocaleString()} Cr
            </span>
          ) : (
            <span className="text-slate-400 font-mono font-semibold">--</span>
          )}
        </div>
      </GlassCard>

      {/* 2. India VIX & Volatility Regime Card (Natural compact height) */}
      <GlassCard 
        className="relative overflow-hidden p-0 border-slate-200/80 dark:border-slate-800"
        noPadding
      >
        <div className="px-3.5 py-2 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-purple-500" />
            India VIX
          </span>
          {vix !== undefined && vix !== null ? (
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
              vix < 15 
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' 
                : vix < 20 
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' 
                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
            }`}>
              {vix < 15 ? 'LOW RISK' : vix < 20 ? 'NORMAL' : 'ELEVATED'}
            </span>
          ) : (
            <span className="text-[10px] font-bold text-slate-400">NSE FEED</span>
          )}
        </div>

        <div className="p-3 space-y-1">
          {vix !== undefined && vix !== null ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-base sm:text-lg font-black font-mono text-slate-900 dark:text-white">
                  {vix.toFixed(2)}
                </span>
                {vixChange !== undefined && vixChange !== null && (
                  <span className={`text-xs font-mono font-bold flex items-center ${
                    vixChange <= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {vixChange <= 0 ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                    {vixChange > 0 ? '+' : ''}{vixChange.toFixed(2)}%
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {vix < 15 ? 'Complacent Volatility' : vix < 20 ? 'Standard Volatility Range' : 'Elevated Volatility'}
              </p>
            </>
          ) : (
            <div className="py-1 text-center">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                VIX Syncing
              </span>
              <p className="text-[10px] text-slate-400 mt-0.5">Awaiting live index tick</p>
            </div>
          )}
        </div>

        {/* Volatility Benchmark Strip */}
        <div className="px-3.5 py-1.5 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200/70 dark:border-slate-800 flex justify-between items-center text-[10px]">
          <span className="text-slate-500 dark:text-slate-400 font-medium">Fear & Greed</span>
          <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
            NSE Volatility
          </span>
        </div>
      </GlassCard>
    </div>
  );
};

export default MarketSnapshotBar;
