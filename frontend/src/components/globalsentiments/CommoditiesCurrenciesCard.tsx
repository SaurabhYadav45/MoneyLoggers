/**
 * Commodities & Currencies Card Component
 * Displays:
 * - Domestic MCX commodities (Gold, Silver, Crude Oil, Natural Gas) in INR
 * - International benchmarks (Brent Crude, COMEX Gold)
 * - Major Currency Crosses (USD/INR, EUR/INR, GBP/INR, JPY/INR) & US Dollar Index (DXY)
 * - Top 4 cards shown by default with smooth "Show All / Show Less" accordion toggle and category filter pills
 */

import React, { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Coins, DollarSign, ChevronDown, ChevronUp } from 'lucide-react';
import type { Commodity, Currency } from '../../types';
import GlassCard from '../ui/GlassCard';

interface CommoditiesCurrenciesCardProps {
  commodities: Commodity[];
  currencies: Currency[];
  isDarkMode?: boolean;
}

const getChangeColor = (changePercent: number) => {
  if (changePercent > 0) return 'text-emerald-600 dark:text-emerald-400';
  if (changePercent < 0) return 'text-rose-600 dark:text-rose-400';
  return 'text-slate-600 dark:text-slate-400';
};

const CommoditiesCurrenciesCard: React.FC<CommoditiesCurrenciesCardProps> = ({
  commodities,
  currencies,
}) => {
  const [commodityFilter, setCommodityFilter] = useState<'ALL' | 'MCX' | 'INTL'>('ALL');
  const [showAllCommodities, setShowAllCommodities] = useState(false);
  const [showAllCurrencies, setShowAllCurrencies] = useState(false);

  // Filter commodities based on category
  const filteredCommodities = useMemo(() => {
    if (commodityFilter === 'MCX') {
      return commodities.filter((c) => c.source === 'MCX');
    }
    if (commodityFilter === 'INTL') {
      return commodities.filter((c) => c.source === 'International' || !c.source);
    }
    return commodities;
  }, [commodities, commodityFilter]);

  // Display top 4 by default, or all if expanded
  const displayedCommodities = showAllCommodities ? filteredCommodities : filteredCommodities.slice(0, 4);
  const displayedCurrencies = showAllCurrencies ? currencies : currencies.slice(0, 4);

  const mcxCount = commodities.filter((c) => c.source === 'MCX').length;
  const intlCount = commodities.filter((c) => c.source !== 'MCX').length;

  return (
    <GlassCard>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Coins className="w-6 h-6 text-amber-500" />
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">Commodities & Forex Matrix</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
            NYMEX & ICE Benchmarks: 10m Auto-Sync
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            Forex Pairs: 10m Auto-Sync
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
        {/* ========================================================= */}
        {/* COLUMN 1: COMMODITIES (Compact with Category Pills & Accordion) */}
        {/* ========================================================= */}
        <div className="flex flex-col justify-between">
          <div className="border-b border-slate-200 dark:border-slate-700 pb-2.5 mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Energy & Metals
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Showing {displayedCommodities.length} of {filteredCommodities.length} instruments
              </p>
            </div>

            {/* Category Filter Pills */}
            {mcxCount > 0 && (
              <div className="flex items-center gap-1 p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700 text-[10px] font-semibold">
                <button
                  onClick={() => setCommodityFilter('ALL')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    commodityFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({commodities.length})
                </button>
                <button
                  onClick={() => setCommodityFilter('MCX')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    commodityFilter === 'MCX'
                      ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  MCX ({mcxCount})
                </button>
                <button
                  onClick={() => setCommodityFilter('INTL')}
                  className={`px-2 py-0.5 rounded-md transition-all ${
                    commodityFilter === 'INTL'
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Intl ({intlCount})
                </button>
              </div>
            )}
          </div>

          {displayedCommodities.length > 0 ? (
            <div className="space-y-2.5">
              {displayedCommodities.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/70 dark:border-slate-700/60 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{item.name}</p>
                      {item.source && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          item.source === 'MCX'
                            ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                            : 'bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                        }`}>
                          {item.source}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.changePercent >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <span className={`text-xs font-bold ${getChangeColor(item.changePercent)}`}>
                        {item.changePercent >= 0 ? '+' : ''}
                        {item.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mt-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {item.symbol} • {item.unit}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
                        {item.unit.includes('₹') ? '₹' : '$'}
                        {item.price > 0 ? item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 }) : '--'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        ({item.change >= 0 ? '+' : ''}{item.change.toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {item.sentimentImpact && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-1">
                      {item.sentimentImpact}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No commodity contracts in this category.
              </p>
            </div>
          )}

          {/* Accordion Expand / Collapse Button */}
          {filteredCommodities.length > 4 && (
            <button
              onClick={() => setShowAllCommodities(!showAllCommodities)}
              className="mt-3 w-full py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
            >
              {showAllCommodities ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Show Less (Top 4 Only)</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>View All {filteredCommodities.length} Commodities ({filteredCommodities.length - 4} more)</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: CURRENCIES & FOREX (Compact with Accordion)     */}
        {/* ========================================================= */}
        <div className="flex flex-col justify-between">
          <div className="border-b border-slate-200 dark:border-slate-700 pb-2.5 mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                Currencies & Dollar Index (DXY)
              </h3>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Showing {displayedCurrencies.length} of {currencies.length} Forex spot rates
              </p>
            </div>
            <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              Live FX Spot
            </span>
          </div>

          {displayedCurrencies.length > 0 ? (
            <div className="space-y-2.5">
              {displayedCurrencies.map((curr) => (
                <div
                  key={curr.id}
                  className="p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/70 dark:border-slate-700/60 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-indigo-500" />
                      <p className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">{curr.pair}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {curr.changePercent >= 0 ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                      )}
                      <span className={`text-xs font-bold ${getChangeColor(curr.changePercent)}`}>
                        {curr.changePercent >= 0 ? '+' : ''}
                        {curr.changePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between mt-1.5 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/40">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      Rate: {curr.pair.includes('USD/INR') || curr.pair.includes('EUR/INR') || curr.pair.includes('GBP/INR') ? 'INR' : 'Index'}
                    </span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white font-mono">
                        {curr.pair.includes('USD/INR') || curr.pair.includes('EUR/INR') || curr.pair.includes('GBP/INR') ? '₹' : ''}
                        {curr.price > 0 ? curr.price.toFixed(curr.pair.includes('JPY') ? 4 : 2) : '--'}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        ({curr.change >= 0 ? '+' : ''}{curr.change.toFixed(2)})
                      </span>
                    </div>
                  </div>

                  {curr.impact && (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 italic line-clamp-1">
                      {curr.impact}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Forex spot rates currently updating from exchange feeds.
              </p>
            </div>
          )}

          {/* Accordion Expand / Collapse Button for Currencies if more than 4 */}
          {currencies.length > 4 && (
            <button
              onClick={() => setShowAllCurrencies(!showAllCurrencies)}
              className="mt-3 w-full py-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
            >
              {showAllCurrencies ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5" />
                  <span>Show Less (Top 4 Only)</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5" />
                  <span>View All {currencies.length} Forex Pairs ({currencies.length - 4} more)</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </GlassCard>
  );
};

export default CommoditiesCurrenciesCard;
