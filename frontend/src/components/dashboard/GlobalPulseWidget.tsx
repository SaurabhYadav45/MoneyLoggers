import React from 'react';
import { 
  Globe, 
  ArrowUpRight, 
  ArrowDownRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
import type { GlobalSentimentsData } from '../../types';

interface GlobalPulseWidgetProps {
  loading?: boolean;
  data?: Partial<GlobalSentimentsData>;
}

interface EssentialCue {
  name: string;
  symbol: string;
  price: number;
  change: number;
  pct: number;
  unit?: string;
  impactTag: string;
}

const DEFAULT_CUES: EssentialCue[] = [
  {
    name: 'GIFT Nifty 50',
    symbol: 'NSEIX',
    price: 24965.50,
    change: 48.00,
    pct: 0.19,
    impactTag: 'Gap Up Bias'
  },
  {
    name: 'Nasdaq 100 Fut',
    symbol: 'NQ=F',
    price: 20435.25,
    change: 68.50,
    pct: 0.34,
    impactTag: 'Tech Lead'
  },
  {
    name: 'Brent Crude',
    symbol: 'BZ=F',
    price: 74.60,
    unit: '$/bbl',
    change: -0.42,
    pct: -0.56,
    impactTag: 'Favorable'
  },
  {
    name: 'USD / INR',
    symbol: 'USDINR',
    price: 84.06,
    unit: '₹',
    change: 0.03,
    pct: 0.04,
    impactTag: 'Rupee Resilient'
  },
  {
    name: 'Nikkei 225',
    symbol: '^N225',
    price: 38981.75,
    change: -112.50,
    pct: -0.29,
    impactTag: 'Asian Drag'
  }
];

const GlobalPulseWidget: React.FC<GlobalPulseWidgetProps> = ({ loading = false, data }) => {
  const navigate = useNavigate();

  // Always retain all 5 essential drivers (GIFT Nifty + US Futures + Brent Crude + USD/INR + Asia)
  // Merges live API data when available; falls back to default reference values so all 5 boxes always render.
  const essentialCues = React.useMemo<EssentialCue[]>(() => {
    const cues = DEFAULT_CUES.map(cue => ({ ...cue }));

    if (!data) return cues;

    // 1. GIFT Nifty 50
    if (data.giftNiftyGap && data.giftNiftyGap.giftNiftyPrice) {
      cues[0] = {
        name: 'GIFT Nifty 50',
        symbol: 'NSEIX',
        price: data.giftNiftyGap.giftNiftyPrice,
        change: data.giftNiftyGap.spreadPoints ?? 0,
        pct: data.giftNiftyGap.spreadPercent ?? 0,
        impactTag: (data.giftNiftyGap.spreadPoints ?? 0) >= 0 ? 'Gap Up Bias' : 'Gap Down Bias'
      };
    } else if (data.indices && data.indices.length > 0) {
      const gift = data.indices.find(i => i.symbol === 'NSEIX' || i.name.toLowerCase().includes('gift') || i.name.toLowerCase().includes('sgx'));
      if (gift && gift.price) {
        cues[0] = {
          name: 'GIFT Nifty 50',
          symbol: gift.symbol || 'NSEIX',
          price: gift.price,
          change: gift.change ?? 0,
          pct: gift.changePercent ?? 0,
          impactTag: (gift.changePercent ?? 0) >= 0 ? 'Gap Up Bias' : 'Gap Down Bias'
        };
      }
    }

    // 2. US Futures (Nasdaq 100 or S&P 500)
    if (data.futures && data.futures.length > 0) {
      const nq = data.futures.find(f => f.symbol === 'NQ=F' || f.name.toLowerCase().includes('nasdaq')) || data.futures[0];
      if (nq && nq.price) {
        cues[1] = {
          name: nq.name.includes('Nasdaq') ? 'Nasdaq 100 Fut' : (nq.name || 'Nasdaq 100 Fut'),
          symbol: nq.symbol || 'NQ=F',
          price: nq.price,
          change: nq.change ?? 0,
          pct: nq.changePercent ?? 0,
          impactTag: (nq.changePercent ?? 0) >= 0 ? 'Tech Lead' : 'Tech Pressure'
        };
      }
    }

    // 3. Brent Crude Oil (Strictly International USD benchmark, or properly labelled MCX in ₹)
    if (data.commodities && data.commodities.length > 0) {
      const brent = data.commodities.find(
        c => c.symbol === 'BZ=F' || c.id === 'brent' || (c.source === 'International' && c.name.toLowerCase().includes('crude'))
      ) || data.commodities.find(c => c.symbol === 'CL=F' || c.id === 'wti');

      if (brent && brent.price) {
        cues[2] = {
          name: 'Brent Crude',
          symbol: brent.symbol || 'BZ=F',
          price: brent.price,
          unit: brent.unit?.includes('₹') ? '₹/bbl' : '$/bbl',
          change: brent.change ?? 0,
          pct: brent.changePercent ?? 0,
          impactTag: (brent.change ?? 0) <= 0 ? 'Favorable' : 'Inflation'
        };
      } else {
        const mcxCrude = data.commodities.find(c => c.symbol === 'CRUDEOIL' || c.id === 'mcx-crudeoil');
        if (mcxCrude && mcxCrude.price) {
          cues[2] = {
            name: 'MCX Crude Oil',
            symbol: 'CRUDEOIL',
            price: mcxCrude.price,
            unit: '₹/bbl',
            change: mcxCrude.change ?? 0,
            pct: mcxCrude.changePercent ?? 0,
            impactTag: (mcxCrude.change ?? 0) <= 0 ? 'Favorable' : 'Inflation'
          };
        }
      }
    }

    // 4. USD / INR (Strictly match usdinr or USD/INR pair, avoid matching EUR/INR 95.11)
    if (data.currencies && data.currencies.length > 0) {
      const usdinr = data.currencies.find(
        c => c.id === 'usdinr' || c.pair === 'USD/INR' || c.pair === 'USDINR' || (c.pair.includes('USD') && c.pair.includes('INR'))
      );
      if (usdinr && usdinr.price) {
        cues[3] = {
          name: 'USD / INR',
          symbol: usdinr.pair || 'USDINR',
          price: usdinr.price,
          unit: '₹',
          change: usdinr.change ?? 0,
          pct: usdinr.changePercent ?? 0,
          impactTag: (usdinr.change ?? 0) <= 0 ? 'Rupee Resilient' : 'Rupee Weakness'
        };
      }
    }

    // 5. Asian Benchmarks (Nikkei 225)
    if (data.indices && data.indices.length > 0) {
      const nikkei = data.indices.find(i => i.symbol === '^N225' || i.name.toLowerCase().includes('nikkei') || i.region === 'Asia') || data.indices[0];
      if (nikkei && nikkei.price) {
        cues[4] = {
          name: nikkei.name.includes('Nikkei') ? 'Nikkei 225' : nikkei.name,
          symbol: nikkei.symbol || '^N225',
          price: nikkei.price,
          change: nikkei.change ?? 0,
          pct: nikkei.changePercent ?? 0,
          impactTag: (nikkei.changePercent ?? 0) >= 0 ? 'Asian Boost' : 'Asian Drag'
        };
      }
    }

    return cues;
  }, [data]);

  return (
    <GlassCard className="p-0 overflow-hidden border-slate-200/80 dark:border-slate-800 flex flex-col justify-between h-full" noPadding>
      {/* Compact Clean Header */}
      <div className="px-4 py-2.5 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Globe className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white text-sm">
            Key Global Cues
          </span>
        </div>
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
          5 Drivers
        </span>
      </div>

      {/* 5 Essential Drivers List */}
      <div className="p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 sm:gap-2.5 flex-1 content-between">
        {loading ? (
          <>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-11 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </>
        ) : (
          essentialCues.map((cue, idx) => {
            const isUp = cue.pct >= 0;
            return (
              <div
                key={cue.name}
                className={`py-2 px-3 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/50 flex items-center justify-between gap-2 transition-all hover:border-slate-300 dark:hover:border-slate-700 ${
                  idx === 4 ? 'sm:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                      {cue.name}
                    </span>
                    <span className="text-[9px] font-semibold text-slate-600 dark:text-slate-300 px-1 py-0.2 rounded bg-slate-200/60 dark:bg-slate-700/60 shrink-0 whitespace-nowrap hidden xs:inline-block">
                      {cue.impactTag}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 font-medium">
                    {cue.symbol}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white">
                    {cue.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    {cue.unit && <span className="text-[9px] font-normal text-slate-400 ml-0.5">{cue.unit}</span>}
                  </div>
                  <div className={`text-[10px] font-extrabold flex items-center justify-end gap-0.5 ${
                    isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}>
                    {isUp ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                    {isUp ? '+' : ''}{cue.pct.toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Link */}
      <div className="py-2 px-4 bg-slate-50/70 dark:bg-slate-800/40 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
        <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
          World Indices & Futures
        </span>
        <button
          onClick={() => navigate('/global-sentiments')}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          <span>All Cues</span>
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </GlassCard>
  );
};

export default GlobalPulseWidget;
