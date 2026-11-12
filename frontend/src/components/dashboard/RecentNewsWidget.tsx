import React, { useState } from 'react';
import { 
  Newspaper, 
  ArrowUpRight, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../ui/GlassCard';
import Badge from '../ui/Badge';
import type { NewsItem } from '../../types';

interface RecentNewsWidgetProps {
  loading?: boolean;
  news?: NewsItem[];
  onSelectNews?: (item: NewsItem) => void;
}

const RecentNewsWidget: React.FC<RecentNewsWidgetProps> = ({ 
  loading = false,
  news = [],
  onSelectNews
}) => {
  const navigate = useNavigate();

  const getSentimentPill = (sentiment?: string) => {
    const s = sentiment?.toUpperCase();
    if (s === 'BULLISH' || s === 'POSITIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/90 text-white shadow-xs">
          <TrendingUp className="w-2.5 h-2.5" /> Bullish
        </span>
      );
    }
    if (s === 'BEARISH' || s === 'NEGATIVE') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/90 text-white shadow-xs">
          <TrendingDown className="w-2.5 h-2.5" /> Bearish
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/80 text-white shadow-xs">
        <Minus className="w-2.5 h-2.5" /> Neutral
      </span>
    );
  };

  const [renderTimestamp] = useState(() => Date.now());

  const formatRelativeTime = (timeStr?: string) => {
    if (!timeStr) return 'Just now';
    try {
      const diffMs = renderTimestamp - new Date(timeStr).getTime();
      const diffMins = Math.floor(diffMs / (60 * 1000));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${Math.floor(diffHours / 24)}d ago`;
    } catch {
      return 'Recent';
    }
  };

  const handleCardClick = (e: React.MouseEvent<HTMLAnchorElement>, item: NewsItem) => {
    if (onSelectNews) {
      e.preventDefault();
      onSelectNews(item);
      return;
    }
    if (!item.url || item.url === '#') {
      e.preventDefault();
      navigate('/news');
    }
  };

  return (
    <GlassCard className="p-0 overflow-hidden border-slate-200/80 dark:border-slate-800" noPadding>
      {/* Header */}
      <div className="p-4 sm:p-5 pb-3 border-b border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
            <Newspaper className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Live Market Wire & Impact Radar
              </h3>
              <Badge type="primary">LIVE FEED</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real-time Indian financial news with NLP sentiment scoring
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/news')}
          className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 inline-flex items-center gap-1 self-start sm:self-auto transition-colors"
        >
          <span>View More</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* News Cards Grid */}
      <div className="p-3.5 sm:p-5">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 p-4 space-y-3 animate-pulse">
                <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl" />
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full" />
              </div>
            ))}
          </div>
        ) : news.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Market News Articles Available</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Real-time news wire is currently quiet or waiting for new publications.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {news.slice(0, 4).map((item) => (
              <a
                key={item.id}
                href={item.url || '#'}
                target={item.url && item.url !== '#' ? '_blank' : '_self'}
                rel="noopener noreferrer"
                onClick={(e) => handleCardClick(e, item)}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-500/80 transition-all duration-300 cursor-pointer group flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-xl hover:-translate-y-1 block text-inherit no-underline"
              >
                {/* Top Cover Image with Floating Source & Sentiment Overlays */}
                <div className="relative h-40 w-full overflow-hidden bg-slate-900 shrink-0">
                  <img
                    src={item.imageUrl || 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80'}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent) {
                        parent.className = 'relative h-40 w-full bg-gradient-to-br from-indigo-50/90 via-slate-100 to-indigo-100/60 dark:from-slate-900 dark:via-indigo-950/70 dark:to-slate-900 p-4 flex flex-col justify-between shrink-0';
                      }
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Floating Top Bar on image */}
                  <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between gap-2 z-10">
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950/75 backdrop-blur-md text-white border border-white/10 shadow-xs truncate max-w-[130px]">
                      {item.source}
                    </span>
                    <div>
                      {getSentimentPill(item.sentiment)}
                    </div>
                  </div>

                  {/* Floating Bottom Bar on image (Timestamp) */}
                  <div className="absolute bottom-2.5 left-2.5 z-10 flex items-center gap-1 text-[10px] text-slate-300 font-medium bg-black/45 backdrop-blur-md px-2 py-0.5 rounded-md">
                    <Clock className="w-2.5 h-2.5 text-slate-400" />
                    <span>{formatRelativeTime(item.timestamp || item.publishedAt)}</span>
                  </div>
                </div>

                {/* Card Content Below Image */}
                <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2 leading-snug flex-1">
                        {item.title}
                      </h4>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 opacity-60 group-hover:opacity-100 transition-all shrink-0 mt-0.5" />
                    </div>

                    {item.summary && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {item.summary}
                      </p>
                    )}
                  </div>

                  {/* Card Footer: Sector & Tickers */}
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/70 flex items-center justify-between gap-2 text-[10px]">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 truncate">
                      {item.category || item.sector || 'Market News'}
                    </span>
                    {item.relatedSymbols && item.relatedSymbols.length > 0 && (
                      <div className="flex items-center gap-1">
                        {item.relatedSymbols.slice(0, 2).map((sym) => (
                          <span
                            key={sym}
                            className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400"
                          >
                            {sym}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default RecentNewsWidget;
