/**
 * FII/DII Activity & Market Sentiment Summary Card
 * Layout:
 * - Row 1: Daily Cash Market Activity (₹ Crores) organized into a balanced 2-column grid
 * - Row 2: Synthesis & Market Sentiment with narrative & domestic liquidity cushion
 * - Verified previous trading day indicator & real-time sync timestamp banner
 */

import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, Scale, CheckCircle2, Info, Calendar, Clock } from 'lucide-react';
import type { FIIDIIFlow } from '../../types';
import GlassCard from '../ui/GlassCard';

interface FIIDIISentimentCardProps {
  fiiDiiFlows: FIIDIIFlow[];
  sentimentSummary: string;
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  isDarkMode?: boolean;
  lastUpdated?: string;
}

const getSentimentColor = (sentiment: 'bullish' | 'bearish' | 'neutral') => {
  switch (sentiment) {
    case 'bullish':
      return 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200';
    case 'bearish':
      return 'bg-rose-100 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200';
    default:
      return 'bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200';
  }
};

const getSentimentEmoji = (sentiment: 'bullish' | 'bearish' | 'neutral') => {
  switch (sentiment) {
    case 'bullish':
      return { emoji: '🚀', text: 'Bullish Institutional Bias' };
    case 'bearish':
      return { emoji: '⚠️', text: 'Bearish Institutional Caution' };
    default:
      return { emoji: '⚖️', text: 'Neutral / Rangebound Flow' };
  }
};

// Safe local date formatting without UTC day-shift
const formatTradingDate = (dStr?: string) => {
  if (!dStr) return 'Previous Trading Session';
  const parts = dStr.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return new Date(y, m, d).toLocaleDateString('en-IN', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return dStr;
};

const FIIDIISentimentCard: React.FC<FIIDIISentimentCardProps> = ({
  fiiDiiFlows,
  sentimentSummary,
  overallSentiment,
  lastUpdated,
}) => {
  const sentiment = getSentimentEmoji(overallSentiment);

  // Cumulative 5-day calculation
  const hasFlows = fiiDiiFlows && fiiDiiFlows.length > 0;
  const fiveDayFII = hasFlows ? fiiDiiFlows.slice(0, 5).reduce((acc, f) => acc + f.fiiNet, 0) : 0;
  const fiveDayDII = hasFlows ? fiiDiiFlows.slice(0, 5).reduce((acc, f) => acc + f.diiNet, 0) : 0;
  const netInstitutional = fiveDayFII + fiveDayDII;

  // Make sure we have up to 6 items for a balanced 2-column grid
  const displayedFlows = hasFlows ? fiiDiiFlows.slice(0, 6) : [];

  // Formatted date of previous session
  const latestSession = hasFlows ? displayedFlows[0] : null;
  const latestDateStr = latestSession?.date
    ? formatTradingDate(latestSession.date)
    : 'Previous Trading Session';

  // Formatted last updated time
  const updateTimeStr = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : null;

  return (
    <GlassCard>
      {/* ===== HEADER ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-indigo-500" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Institutional Flows (FII & DII)</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Net 5-Day Combined:</span>
          {hasFlows ? (
            <span className={`text-xs font-bold px-3 py-1 rounded-full border shadow-sm ${
              netInstitutional >= 0
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700'
            }`}>
              {netInstitutional >= 0 ? '+' : ''}₹{netInstitutional.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr
            </span>
          ) : (
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
              Provisional Window Pending
            </span>
          )}
        </div>
      </div>

      {/* ===== CERTIFIED REPORTING CONTEXT STRIP ===== */}
      <div className="mb-5 p-2.5 sm:p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-semibold text-[11px]">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            Previous Session: <strong className="font-bold">{latestDateStr}</strong>
          </span>
          {updateTimeStr && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-medium text-[11px]">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              Feed Synced: <strong>{updateTimeStr}</strong>
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Today's official provisional data releases between 05:30 PM – 06:30 PM IST</span>
        </div>
      </div>

      <div className="space-y-6">
        {/* ========================================================================= */}
        {/* ROW 1: DAILY CASH MARKET ACTIVITY (Divided into 2 columns)               */}
        {/* ========================================================================= */}
        <div>
          <div className="border-b border-slate-200 dark:border-slate-700 pb-2 mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Daily Cash Market Activity (₹ Crores)
              </h3>
              {displayedFlows.length > 0 && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  • Last {displayedFlows.length} Sessions
                </span>
              )}
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              NSE/BSE Certified
            </span>
          </div>

          {/* 2-Column Grid for Daily Activity */}
          {displayedFlows.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {displayedFlows.map((flow, index) => {
                const fiiColor = flow.fiiNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
                const diiColor = flow.diiNet >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
                const netSession = flow.fiiNet + flow.diiNet;
                const isLatest = index === 0;

                return (
                  <div
                    key={index}
                    className="p-3.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/70 dark:border-slate-700/60 shadow-xs"
                  >
                    {/* Session Date & Combined Net */}
                    <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200/60 dark:border-slate-700/50">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {formatTradingDate(flow.date)}
                        </span>
                        {isLatest && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                            Latest Closed
                          </span>
                        )}
                      </div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${netSession >= 0 ? 'bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-100/70 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'}`}>
                        Session Net: {netSession >= 0 ? '+' : ''}₹{netSession.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr
                      </span>
                    </div>

                    {/* FII vs DII Breakdown */}
                    <div className="grid grid-cols-2 gap-2.5">
                      {/* FII Net */}
                      <div className="p-2.5 bg-white/90 dark:bg-slate-900/70 rounded-lg border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">FII Net</p>
                          <span className={`font-extrabold text-sm font-mono ${fiiColor}`}>
                            {flow.fiiNet >= 0 ? '+' : ''}₹{flow.fiiNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr
                          </span>
                        </div>
                        {flow.fiiNet >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>

                      {/* DII Net */}
                      <div className="p-2.5 bg-white/90 dark:bg-slate-900/70 rounded-lg border border-slate-200/50 dark:border-slate-800 flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider">DII Net</p>
                          <span className={`font-extrabold text-sm font-mono ${diiColor}`}>
                            {flow.diiNet >= 0 ? '+' : ''}₹{flow.diiNet.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr
                          </span>
                        </div>
                        {flow.diiNet >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
                <Info className="w-4 h-4" />
                <span className="text-xs font-bold">Provisional Reporting Window</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                Official provisional FII/DII cash market trading activity is published by NSE/BSE each trading day between 05:30 PM - 06:30 PM IST. Sync will refresh as soon as the daily session data is certified.
              </p>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* ROW 2: SYNTHESIS & MARKET SENTIMENT (Full Width Row)                     */}
        {/* ========================================================================= */}
        <div className="pt-2">
          <div className="border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Synthesis & Market Sentiment
            </h3>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border shadow-sm ${getSentimentColor(overallSentiment)}`}>
              {sentiment.emoji} {sentiment.text}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Narrative Box (7 Columns) */}
            <div className="lg:col-span-7 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/70 dark:border-slate-700/60 flex flex-col justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  Macro Synthesis Overview
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-normal mt-1.5">
                  {sentimentSummary}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Official daily window: 05:30 PM - 06:30 PM IST
                </span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">NSE / BSE Certified</span>
              </div>
            </div>

            {/* Domestic Liquidity Cushion Card (5 Columns) */}
            <div className="lg:col-span-5 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/60 via-purple-50/30 to-slate-50 dark:from-indigo-950/25 dark:via-purple-950/15 dark:to-slate-900/40 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-950 dark:text-indigo-300">
                    Domestic Liquidity Cushion
                  </h4>
                </div>
                <p className="text-xs text-indigo-950/80 dark:text-indigo-200/80 leading-relaxed">
                  Systematic monthly mutual fund SIP inflows (~₹23,000+ Cr/month) empower domestic institutional investors (DIIs) to absorb foreign capital profit-taking, providing substantial structural downside support for Nifty 50 and Bank Nifty.
                </p>
              </div>

              <div className="mt-4 pt-2.5 border-t border-indigo-200/50 dark:border-indigo-900/40 flex items-center justify-between text-[11px] text-indigo-900/70 dark:text-indigo-300/70">
                <span>5-Day DII Net Absorption:</span>
                <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                  {fiveDayDII !== 0 ? `+₹${fiveDayDII.toLocaleString('en-IN', { maximumFractionDigits: 0 })} Cr` : 'Tracking Live'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default FIIDIISentimentCard;
