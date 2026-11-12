import React, { useState, useEffect } from 'react';
import { Globe2 } from 'lucide-react';

interface MarketClock {
  name: string;
  city: string;
  exchange: string;
  timezone: string;
  openUtc: number; // in decimal UTC hours (e.g. 13.5 is 13:30)
  closeUtc: number;
}

const MARKETS: MarketClock[] = [
  { name: 'Tokyo', city: 'Tokyo', exchange: 'TSE', timezone: 'Asia/Tokyo', openUtc: 0, closeUtc: 6 },
  { name: 'GIFT City', city: 'Gandhinagar', exchange: 'NSE IX', timezone: 'Asia/Kolkata', openUtc: 1.0, closeUtc: 21.25 },
  { name: 'Mumbai', city: 'Mumbai', exchange: 'NSE/BSE', timezone: 'Asia/Kolkata', openUtc: 3.75, closeUtc: 10.0 },
  { name: 'London', city: 'London', exchange: 'LSE', timezone: 'Europe/London', openUtc: 8.0, closeUtc: 16.5 },
  { name: 'New York', city: 'New York', exchange: 'NYSE', timezone: 'America/New_York', openUtc: 13.5, closeUtc: 20.0 },
];

export const MarketClocksBar: React.FC = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const getMarketSession = (m: MarketClock) => {
    const utcHour = time.getUTCHours() + time.getUTCMinutes() / 60;
    const day = time.getUTCDay();
    // Weekend check
    if (day === 0 || day === 6) return { status: 'Closed', color: 'text-slate-400 bg-slate-100 dark:bg-slate-800' };

    if (utcHour >= m.openUtc && utcHour < m.closeUtc) {
      return { status: 'Active', color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700' };
    }
    if (utcHour >= m.openUtc - 1 && utcHour < m.openUtc) {
      return { status: 'Pre-Mkt', color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700' };
    }
    return { status: 'Closed', color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700' };
  };

  return (
    <div className="p-3.5 bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-800 backdrop-blur-md">
      <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        <Globe2 className="w-3.5 h-3.5 text-indigo-500" />
        <span>Global Exchange Market Clocks & Live Status</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {MARKETS.map((m) => {
          const session = getMarketSession(m);
          const localTimeStr = time.toLocaleTimeString('en-US', {
            timeZone: m.timezone,
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          });

          return (
            <div
              key={m.name}
              className="p-2.5 rounded-lg bg-white/80 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 flex flex-col justify-between last:col-span-2 sm:last:col-span-1"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{m.name}</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${session.color}`}>
                  {session.status}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                  {localTimeStr}
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500">{m.exchange}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MarketClocksBar;
