/**
 * GlobalIndicesCard Component
 * Displays major world stock market indices organized across Americas, Europe, and Asia-Pacific
 * Features real-time prices, percentage shifts, market session status, and daily ranges
 */

import React from 'react';
import { TrendingUp, TrendingDown, Globe, Activity } from 'lucide-react';
import type { GlobalIndex } from '../../types';
import GlassCard from '../ui/GlassCard';

interface GlobalIndicesCardProps {
  indices: GlobalIndex[];
  isDarkMode?: boolean;
}

const getChangeColor = (changePercent: number) => {
  if (changePercent > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (changePercent < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-slate-600 dark:text-slate-400';
};

const getStatusBadge = (status?: 'Open' | 'Closed' | 'Pre-Market') => {
  if (status === 'Open') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Open
      </span>
    );
  }
  if (status === 'Pre-Market') {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Pre-Mkt
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
      Closed
    </span>
  );
};

const GlobalIndicesCard: React.FC<GlobalIndicesCardProps> = ({ indices }) => {
  const regions: { key: 'US' | 'Europe' | 'Asia'; title: string; subtitle: string }[] = [
    { key: 'US', title: 'Americas (US)', subtitle: 'NYSE & NASDAQ' },
    { key: 'Europe', title: 'Europe', subtitle: 'LSE, Deutsche Börse, Euronext' },
    { key: 'Asia', title: 'Asia - Pacific', subtitle: 'Tokyo, HK, Shanghai, Seoul' },
  ];

  return (
    <GlassCard>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Globe className="w-6 h-6 text-indigo-500" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">World Benchmark Indices</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Activity className="w-3.5 h-3.5 text-indigo-500" />
          <span>Real-time Global Quotes</span>
        </div>
      </div>

      {/* Grid layout for 3 regions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {regions.map(({ key, title, subtitle }) => {
          const regionIndices = indices.filter((i) => i.region === key);

          return (
            <div key={key} className="space-y-3">
              {/* Region Header */}
              <div className="border-b border-slate-200 dark:border-slate-700 pb-2 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">{title}</h3>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{subtitle}</p>
                </div>
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {regionIndices.filter(i => i.status === 'Open').length > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Live Session</span>
                  ) : (
                    <span>Session Ended</span>
                  )}
                </span>
              </div>

              {/* Individual Indices */}
              {regionIndices.length > 0 ? (
                <div className="space-y-2.5">
                  {regionIndices.map((index) => (
                    <div
                      key={index.id}
                      className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/60 dark:border-slate-700/50"
                    >
                      {/* Index Name and Symbol */}
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-slate-900 dark:text-white text-sm">{index.name}</p>
                            {index.status && getStatusBadge(index.status)}
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{index.symbol}</p>
                        </div>
                        {index.changePercent >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>

                      {/* Price and Change */}
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-base font-bold text-slate-900 dark:text-white">
                          {index.price > 0 ? index.price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '--'}
                        </span>
                        <span className={`text-xs font-bold ${getChangeColor(index.changePercent)}`}>
                          {index.changePercent >= 0 ? '+' : ''}
                          {index.changePercent.toFixed(2)}% ({index.change >= 0 ? '+' : ''}
                          {index.change.toFixed(1)})
                        </span>
                      </div>

                      {/* Day Range if available and valid (> 0) */}
                      {index.dayHigh !== undefined && index.dayLow !== undefined && index.dayHigh > 0 && index.dayLow > 0 && (
                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                          <span>L: {index.dayLow.toLocaleString('en-US', { maximumFractionDigits: 1 })}</span>
                          <span>H: {index.dayHigh.toLocaleString('en-US', { maximumFractionDigits: 1 })}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-700/60 rounded-lg">
                  <p className="text-[11px] text-slate-400">Quotes for {title} syncing...</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassCard>
  );
};

export default GlobalIndicesCard;
