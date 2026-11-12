/**
 * Volatility & Bond Yields Card Component
 * Displays:
 * - VIX indices (India VIX, CBOE VIX) - Market fear gauge
 * - Sovereign Bond Yields (US 10Y, India 10Y G-Sec) & Yield Spread
 */

import React from 'react';
import { TrendingUp, TrendingDown, Gauge, Landmark } from 'lucide-react';
import type { VolatilityIndex, BondYield } from '../../types';
import GlassCard from '../ui/GlassCard';

interface VolatilityBondCardProps {
  volatilityIndices: VolatilityIndex[];
  bondYields: BondYield[];
  isDarkMode?: boolean;
}

const getVolatilityColor = (value: number) => {
  if (value > 25) return 'bg-rose-100 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-900 dark:text-rose-100';
  if (value > 20) return 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-100';
  if (value > 15) return 'bg-yellow-50 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100';
  return 'bg-emerald-100 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100';
};

const getChangeColor = (change: number) => {
  if (change > 0) return 'text-rose-600 dark:text-rose-400';
  if (change < 0) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-slate-600 dark:text-slate-400';
};

const VolatilityBondCard: React.FC<VolatilityBondCardProps> = ({
  volatilityIndices,
  bondYields,
}) => {
  const usBond = bondYields.find((b) => b.country === 'United States');
  const indiaBond = bondYields.find((b) => b.country === 'India');
  const yieldSpread = usBond && indiaBond && usBond.yield > 0
    ? (indiaBond.yield - usBond.yield).toFixed(2)
    : null;

  return (
    <GlassCard>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Gauge className="w-6 h-6 text-rose-500" />
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Volatility & Sovereign Yields</h2>
        </div>
        {yieldSpread && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 dark:text-slate-400">10Y Yield Spread (India - US):</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
              +{yieldSpread}% (Calculated Spread)
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Volatility Indices */}
        <div>
          <div className="border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              Fear Gauges (VIX)
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Option Implied Volatility</span>
          </div>

          <div className="space-y-3">
            {volatilityIndices.map((vix) => (
              <div
                key={vix.id}
                className={`p-4 rounded-xl border ${getVolatilityColor(vix.value)} transition-all shadow-sm`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm">{vix.name}</p>
                    <p className="text-xs opacity-80 mt-0.5 font-medium">{vix.interpretation}</p>
                  </div>
                  {vix.change > 0 ? (
                    <TrendingUp className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold tracking-tight">{vix.value.toFixed(2)}</span>
                  <span className={`text-xs font-bold ${getChangeColor(vix.change)}`}>
                    {vix.change > 0 ? '+' : ''}
                    {vix.change.toFixed(2)} pts
                  </span>
                </div>

                {/* Progress bar visual */}
                <div className="mt-3 w-full bg-slate-200/60 dark:bg-slate-700/60 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${
                      vix.value > 20 ? 'bg-rose-500' : vix.value > 15 ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (vix.value / 35) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-700/50">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <strong>Rule of Thumb:</strong> India VIX &lt; 15 indicates comfortable bull market trends; VIX &gt; 18 warns of heightened intraday swings and option premium expansion.
            </p>
          </div>
        </div>

        {/* Bond Yields */}
        <div>
          <div className="border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
              10-Year Benchmark Sovereign Yields
            </h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">Risk-Free Rate</span>
          </div>

          <div className="space-y-3">
            {bondYields.map((bond) => (
              <div
                key={bond.id}
                className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all"
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <Landmark className="w-3.5 h-3.5 text-indigo-500" />
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{bond.name}</p>
                      {bond.isCalculated ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300">
                          Benchmark
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                          Live Market
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{bond.country} • {bond.source || 'Sovereign Benchmark'}</p>
                  </div>

                  {bond.change !== 0 ? (
                    bond.change > 0 ? (
                      <TrendingUp className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    )
                  ) : null}
                </div>

                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {bond.yield > 0 ? `${bond.yield.toFixed(3)}%` : '--'}
                  </span>
                  {bond.change !== 0 ? (
                    <span className={`text-xs font-bold ${getChangeColor(bond.change)}`}>
                      {bond.change > 0 ? '+' : ''}
                      {(bond.change * 100).toFixed(1)} bps
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-slate-400">
                      Steady
                    </span>
                  )}
                </div>

                {bond.interpretation && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50 italic">
                    {bond.interpretation}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg border border-slate-200/60 dark:border-slate-700/50">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              <strong>Macro Link:</strong> When US 10-Year yield surges toward 4.5%+, global asset managers reallocate capital from emerging markets back to dollar risk-free debt, causing FII selling in Indian equities.
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
};

export default VolatilityBondCard;
