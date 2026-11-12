import React, { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import * as stockService from '../../services/stockService';

interface TickerItem {
  name: string;
  val: string;
  up: boolean;
  pct: string;
}

const DEFAULT_TICKER_ITEMS: TickerItem[] = [
  { name: 'NIFTY 50', val: '24,850.25', up: true, pct: '+0.58%' },
  { name: 'SENSEX', val: '81,224.75', up: true, pct: '+0.60%' },
  { name: 'BANKNIFTY', val: '51,785.40', up: true, pct: '+0.62%' },
  { name: 'NIFTY IT', val: '41,920.80', up: false, pct: '-0.27%' },
  { name: 'USD/INR', val: '83.95', up: true, pct: '+0.02%' },
  { name: 'GOLD', val: '76,500', up: true, pct: '+0.45%' },
  { name: 'CRUDE OIL', val: '6,150', up: false, pct: '-0.30%' },
  { name: 'FTSE', val: '8,240.50', up: true, pct: '+0.35%' },
];

const Ticker: React.FC = () => {
  const [items, setItems] = useState<TickerItem[]>(DEFAULT_TICKER_ITEMS);

  useEffect(() => {
    // Inject custom animation styles for the marquee
    const style = document.createElement('style');
    style.textContent = `
      @keyframes marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-50%); }
      }
      .animate-marquee {
        animation: marquee 35s linear infinite;
      }
      .animate-marquee:hover {
        animation-play-state: paused;
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Fetch live indices on mount (uses shared cache, zero extra upstream quota cost)
  useEffect(() => {
    let isMounted = true;
    stockService.getMarketIndices().then((indices) => {
      if (!isMounted || !Array.isArray(indices) || indices.length === 0) return;

      const mapped: TickerItem[] = indices.slice(0, 10).map((idx) => {
        const pctVal = idx.pct ?? (idx as any).changePercent ?? 0;
        const isUp = pctVal >= 0;
        const formattedVal =
          idx.value >= 1000
            ? idx.value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
            : idx.value.toFixed(2);

        return {
          name: idx.name,
          val: formattedVal,
          up: isUp,
          pct: `${isUp ? '+' : ''}${pctVal.toFixed(2)}%`
        };
      });

      if (mapped.length > 0) {
        setItems(mapped);
      }
    }).catch(() => {
      // Keep default fallback items
    });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="h-10 bg-white/85 dark:bg-slate-950/90 backdrop-blur-md border-y border-slate-200/80 dark:border-slate-800/80 flex items-center overflow-hidden transition-colors">
       <div className="animate-marquee flex items-center space-x-8 px-4 whitespace-nowrap">
          {[...items, ...items, ...items].map((item, i) => (
            <div key={i} className="flex items-center space-x-2 text-xs sm:text-sm font-medium">
              <span className="text-slate-800 dark:text-slate-200 font-bold">{item.name}</span>
              <span className={`font-mono font-bold ${item.up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>{item.val}</span>
              <span className="text-slate-400">
                (
              </span>
              <span className={`text-[11px] sm:text-xs font-bold font-mono flex items-center ${item.up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {item.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span>{item.pct}</span>
              </span>
              <span className="text-slate-400">
                )
              </span>
            </div>
          ))}
       </div>
    </div>
  );
};

export default Ticker;