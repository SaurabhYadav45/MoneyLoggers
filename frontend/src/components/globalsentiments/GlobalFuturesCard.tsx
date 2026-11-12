/**
 * Global Futures Card Component
 * Displays live futures indices that track GIFT Nifty, US, and Asian markets
 * Includes the GIFT Nifty Gap Predictor & Implied Opening Analysis
 * Balanced, high-density layout with zero dead whitespace
 */

import React from 'react';
import { TrendingUp, TrendingDown, Zap, Compass, Clock, BarChart2, Sparkles } from 'lucide-react';
import type { GlobalFuture, GiftNiftyGapAnalysis } from '../../types';
import GlassCard from '../ui/GlassCard';

interface GlobalFuturesCardProps {
  futures: GlobalFuture[];
  gapAnalysis?: GiftNiftyGapAnalysis;
  isDarkMode?: boolean;
}

const getChangeColor = (changePercent: number) => {
  if (changePercent > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (changePercent < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-slate-600 dark:text-slate-400';
};

// Helper for metadata per futures ticker
const getFutureMeta = (symbol: string, name: string) => {
  if (symbol.includes('NQ') || name.includes('Nasdaq')) {
    return {
      category: 'US Tech',
      exchange: 'CME Globex',
      tagColor: 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
      insight: 'Key driver for Indian IT & tech stocks'
    };
  }
  if (symbol.includes('ES') || name.includes('S&P')) {
    return {
      category: 'US Broad Market',
      exchange: 'CME Globex',
      tagColor: 'bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
      insight: 'Global institutional equity benchmark'
    };
  }
  if (symbol.includes('YM') || name.includes('Dow')) {
    return {
      category: 'US Industrials',
      exchange: 'CBOT',
      tagColor: 'bg-purple-100 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
      insight: 'Old economy & manufacturing sentiment'
    };
  }
  if (symbol.includes('RTY') || name.includes('Russell')) {
    return {
      category: 'US Small-Cap',
      exchange: 'CME',
      tagColor: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      insight: 'High-beta domestic economic barometer'
    };
  }
  if (symbol.includes('NIY') || symbol.includes('NK') || name.includes('Nikkei')) {
    return {
      category: 'Japan / Asia',
      exchange: 'OSE / CME',
      tagColor: 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      insight: 'Early morning Tokyo export & currency cue'
    };
  }
  return {
    category: 'Global Derivative',
    exchange: 'Exchange',
    tagColor: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    insight: 'Overnight trading and hedge volume'
  };
};

const GlobalFuturesCard: React.FC<GlobalFuturesCardProps> = ({ futures, gapAnalysis }) => {
  // All international contracts directly from exchange APIs
  const internationalFutures = futures.filter((f) => f.id !== 'gift-nifty' && !f.name.toLowerCase().includes('gift'));

  // Calculate pre-market average momentum
  const avgMomentum = internationalFutures.length > 0
    ? internationalFutures.reduce((acc, f) => acc + f.changePercent, 0) / internationalFutures.length
    : 0;

  return (
    <GlassCard>
      {/* ===== CARD HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Global Futures & Pre-Market Radar</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 font-medium">
          <Clock className="w-3.5 h-3.5 text-purple-500" />
          <span>Continuous Trading • CME Globex & World Exchanges</span>
        </div>
      </div>

      {/* ===== 1. FLAGSHIP GIFT NIFTY OPENING GAP PREDICTOR RADAR ===== */}
      {gapAnalysis && (
        <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/60 dark:from-slate-900/90 dark:via-indigo-950/40 dark:to-slate-900 border border-indigo-200/90 dark:border-indigo-800/60 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-indigo-100 dark:border-indigo-900/50">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white shadow-xs">
                <Sparkles className="w-3 h-3" />
                FLAGSHIP PRE-MARKET CUE
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>GIFT NIFTY 50 (NSE IX)</span>
              </h3>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">
                NSE IX • GIFT City
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                gapAnalysis.spreadPoints >= 15
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : gapAnalysis.spreadPoints <= -15
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}>
                {gapAnalysis.sentiment.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Col 1: GIFT Nifty Quote */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                GIFT Nifty Price
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
                  {gapAnalysis.giftNiftyPrice ? gapAnalysis.giftNiftyPrice.toLocaleString('en-IN') : '--'}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                Live Futures Contract
              </span>
            </div>

            {/* Col 2: Opening Gap / Spread */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Implied Opening Gap
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className={`text-lg sm:text-xl font-black font-mono ${
                  gapAnalysis.spreadPoints >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {gapAnalysis.spreadPoints >= 0 ? '+' : ''}{gapAnalysis.spreadPoints.toFixed(1)} pts
                </span>
              </div>
              <span className={`text-[10px] font-bold ${
                gapAnalysis.spreadPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}>
                ({gapAnalysis.spreadPercent >= 0 ? '+' : ''}{gapAnalysis.spreadPercent.toFixed(2)}% Implied Gap)
              </span>
            </div>

            {/* Col 3: Projected NIFTY 50 Opening */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Projected Nifty 50 Open
              </span>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-white font-mono">
                  {gapAnalysis.projectedOpening ? gapAnalysis.projectedOpening.toLocaleString('en-IN') : '--'}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                Prev Close: {gapAnalysis.nifty50PreviousClose ? gapAnalysis.nifty50PreviousClose.toLocaleString('en-IN') : '--'}
              </span>
            </div>

            {/* Col 4: Market Bias / Action */}
            <div className="p-3 rounded-xl bg-white/90 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 shadow-2xs flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Opening Session Bias
              </span>
              <div className="mt-1 flex items-center gap-1.5">
                {gapAnalysis.spreadPoints >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                )}
                <span className={`text-sm sm:text-base font-extrabold ${
                  gapAnalysis.spreadPoints >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}>
                  {gapAnalysis.spreadPoints >= 30 ? 'Strong Bullish' : gapAnalysis.spreadPoints >= 0 ? 'Mild Bullish' : gapAnalysis.spreadPoints <= -30 ? 'Strong Bearish' : 'Mild Bearish'}
                </span>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mt-1">
                {gapAnalysis.calculationMethod || 'NSE IX • GIFT City'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===== 2. UNIFIED BALANCED FUTURES COMMAND GRID ===== */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-indigo-500" />
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              International Futures Benchmarks
            </h3>
          </div>
          {internationalFutures.length > 0 && (
            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Global Average: <strong className={avgMomentum >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {avgMomentum >= 0 ? '+' : ''}{avgMomentum.toFixed(2)}%
              </strong>
            </span>
          )}
        </div>

        {/* Responsive, equal-height card grid */}
        {internationalFutures.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3.5">
            {internationalFutures.map((future) => {
              const meta = getFutureMeta(future.symbol, future.name);

              return (
                <div
                  key={future.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-between group shadow-sm hover:shadow"
                >
                  <div>
                    {/* Category and Exchange Badge */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.tagColor}`}>
                        {meta.category}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                        {meta.exchange}
                      </span>
                    </div>

                    {/* Future Name and Symbol */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {future.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                          {future.symbol}
                        </p>
                      </div>

                      {future.changePercent >= 0 ? (
                        <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/50">
                    {/* Price and Percentage Change */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-extrabold text-slate-900 dark:text-white font-mono">
                        {future.price > 0 ? future.price.toLocaleString('en-US', { maximumFractionDigits: 1 }) : '--'}
                      </span>
                      <span className={`text-xs font-bold ${getChangeColor(future.changePercent)}`}>
                        {future.changePercent >= 0 ? '+' : ''}
                        {future.changePercent.toFixed(2)}%
                      </span>
                    </div>

                    {/* Change points */}
                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>Change:</span>
                      <span className={`font-semibold ${getChangeColor(future.changePercent)}`}>
                        {future.change >= 0 ? '+' : ''}
                        {future.change.toFixed(1)} pts
                      </span>
                    </div>

                    {/* Context note */}
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 line-clamp-1 italic">
                      {meta.insight}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              International futures quotes currently syncing from CME Globex / OSE.
            </p>
          </div>
        )}
      </div>

      {/* ===== INSTITUTIONAL TRADING INSIGHT FOOTER ===== */}
      <div className="mt-5 p-3.5 bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/40 rounded-xl flex items-start gap-3">
        <Compass className="w-4 h-4 text-purple-600 dark:text-purple-400 mt-0.5 shrink-0" />
        <p className="text-xs text-purple-950 dark:text-purple-200 leading-relaxed">
          <strong>Institutional Pre-Market Reading:</strong> A positive GIFT Nifty spread (&gt; +40 pts) coupled with green Nasdaq 100 futures indicates strong opening appetite for Indian IT and large-cap financials. Weakness on S&P and Nikkei often triggers pre-market profit-taking at resistance levels.
        </p>
      </div>
    </GlassCard>
  );
};

export default GlobalFuturesCard;
