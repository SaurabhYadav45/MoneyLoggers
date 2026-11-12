import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  TrendingUp,
  Briefcase,
  Sparkles,
  History,
  ArrowRight,
  Compass,
  Loader2,
  Trash2,
  Newspaper
} from 'lucide-react';
import {
  fetchOmniSearch,
  type OmniSearchResponse,
  type OmniSearchStockResult,
  type OmniSearchMutualFundResult,
  type OmniSearchIPOResult,
  type OmniSearchPageResult
} from '../../services/searchService';

interface OmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FlatItemType = 'stock' | 'fund' | 'ipo' | 'page' | 'news' | 'recent';

interface FlatItem {
  id: string;
  type: FlatItemType;
  title: string;
  subtitle: string;
  badge?: string;
  extra?: React.ReactNode;
  icon: React.ReactNode;
  action: () => void;
}

const RECENT_SEARCHES_KEY = 'moneylogger_recent_searches';

export const OmniSearchModal: React.FC<OmniSearchModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OmniSearchResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
      setData(null);
    }
  }, [isOpen]);

  // Save to recent searches
  const saveRecentSearch = useCallback((term: string) => {
    const cleaned = term.trim();
    if (!cleaned) return;
    setRecentSearches(prev => {
      const updated = [cleaned, ...prev.filter(item => item.toLowerCase() !== cleaned.toLowerCase())].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  // Debounced search
  useEffect(() => {
    if (!isOpen) return;

    const controller = new AbortController();
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetchOmniSearch(query, controller.signal);
        setData(res);
        setSelectedIndex(0);
      } catch (err: any) {
        if (err.name !== 'CanceledError' && err.name !== 'AbortError') {
          console.error('OmniSearch fetch failed:', err);
        }
      } finally {
        setLoading(false);
      }
    }, 150);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isOpen]);

  // Actions for item clicks
  const handleStockClick = useCallback((stock: OmniSearchStockResult) => {
    saveRecentSearch(stock.symbol);
    navigate(`/screeners?search=${encodeURIComponent(stock.symbol)}`);
    onClose();
  }, [navigate, onClose, saveRecentSearch]);

  const handleFundClick = useCallback((fund: OmniSearchMutualFundResult) => {
    saveRecentSearch(fund.name);
    navigate(`/mutual-funds?search=${encodeURIComponent(fund.name)}`);
    onClose();
  }, [navigate, onClose, saveRecentSearch]);

  const handleIpoClick = useCallback((ipo: OmniSearchIPOResult) => {
    saveRecentSearch(ipo.name);
    navigate(`/ipo?search=${encodeURIComponent(ipo.name)}`);
    onClose();
  }, [navigate, onClose, saveRecentSearch]);

  const handlePageClick = useCallback((page: OmniSearchPageResult) => {
    navigate(page.path);
    onClose();
  }, [navigate, onClose]);

  const handleRecentClick = useCallback((term: string) => {
    setQuery(term);
  }, []);

  // Flatten active results for keyboard navigation (Arrow Up/Down/Enter)
  const flatItems: FlatItem[] = useMemo(() => {
    if (!data) return [];
    const items: FlatItem[] = [];

    // Stocks
    (data.stocks || []).forEach(stock => {
      const isGain = stock.dayChangePercent >= 0;
      items.push({
        id: `stock-${stock.symbol}`,
        type: 'stock',
        title: stock.symbol,
        subtitle: `${stock.name} • ${stock.sector}`,
        badge: stock.marketCapCategory || 'Equity',
        icon: <TrendingUp className="w-4 h-4 text-emerald-500" />,
        extra: (
          <div className="text-right">
            <div className="text-xs font-bold text-slate-900 dark:text-white">
              ₹{Number(stock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className={`text-[11px] font-semibold ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {isGain ? '+' : ''}{stock.dayChangePercent.toFixed(2)}%
            </div>
          </div>
        ),
        action: () => handleStockClick(stock),
      });
    });

    // Mutual Funds
    (data.mutualFunds || []).forEach(fund => {
      items.push({
        id: `fund-${fund.id}`,
        type: 'fund',
        title: fund.name,
        subtitle: `${fund.fundHouse} • ${fund.subCategory || fund.category}`,
        badge: fund.category,
        icon: <Briefcase className="w-4 h-4 text-indigo-500" />,
        extra: (
          <div className="text-right">
            <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              3Y: +{Number(fund.returns3Y || 0).toFixed(1)}%
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              NAV: ₹{Number(fund.nav || 0).toFixed(2)}
            </div>
          </div>
        ),
        action: () => handleFundClick(fund),
      });
    });

    // IPOs
    (data.ipos || []).forEach(ipo => {
      items.push({
        id: `ipo-${ipo.id}`,
        type: 'ipo',
        title: ipo.name,
        subtitle: `${ipo.segment.toUpperCase()} IPO • Price ₹${ipo.issuePrice}`,
        badge: ipo.status.toUpperCase(),
        icon: <Sparkles className="w-4 h-4 text-amber-500" />,
        extra: (
          <div className="text-right">
            {ipo.estimatedGainPercent ? (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                +{ipo.estimatedGainPercent}% GMP
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Active</span>
            )}
          </div>
        ),
        action: () => handleIpoClick(ipo),
      });
    });

    // News Stories
    (data.news || []).forEach(n => {
      items.push({
        id: `news-${n.id}`,
        type: 'news',
        title: n.title,
        subtitle: `${n.source} • ${n.category}`,
        badge: n.sentiment,
        icon: <Newspaper className="w-4 h-4 text-rose-500" />,
        extra: <ArrowRight className="w-4 h-4 text-slate-400" />,
        action: () => {
          navigate(`/news?search=${encodeURIComponent(n.title.slice(0, 30))}`);
          onClose();
        },
      });
    });

    // Pages
    (data.pages || []).forEach(page => {
      items.push({
        id: `page-${page.path}`,
        type: 'page',
        title: page.title,
        subtitle: page.description,
        badge: page.category,
        icon: <Compass className="w-4 h-4 text-cyan-500" />,
        extra: <ArrowRight className="w-4 h-4 text-slate-400" />,
        action: () => handlePageClick(page),
      });
    });

    return items;
  }, [data, handleStockClick, handleFundClick, handleIpoClick, handlePageClick, navigate, onClose]);

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }

    if (flatItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % flatItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + flatItems.length) % flatItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = flatItems[selectedIndex];
      if (current) {
        current.action();
      }
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = document.getElementById(`search-item-${selectedIndex}`);
    if (el) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-20 p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] transition-all"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Input Bar */}
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 shrink-0">
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Search className="w-5 h-5" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search equities, direct mutual funds, IPOs, or platform tools..."
            className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-sm sm:text-base outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1.5 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-[10px] font-mono text-slate-500 dark:text-slate-400 font-semibold shadow-xs">
            ESC
          </kbd>
        </div>

        {/* Scrollable Results Area */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* Recent Searches chips if query is empty */}
          {!query && recentSearches.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" /> Recent Searches
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="hover:text-rose-500 flex items-center gap-1 normal-case font-medium text-[11px] transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Clear history
                </button>
              </div>
              <div className="flex flex-wrap gap-2 px-1">
                {recentSearches.map(term => (
                  <button
                    key={term}
                    onClick={() => handleRecentClick(term)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all flex items-center gap-1.5"
                  >
                    <span>{term}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grouped Results Display */}
          {data && flatItems.length > 0 ? (
            <div className="space-y-3">
              {/* STOCKS SECTION */}
              {data.stocks && data.stocks.length > 0 && (
                <div className="space-y-1">
                  <div className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Indian Equities ({data.stocks.length})
                  </div>
                  <div className="space-y-1">
                    {data.stocks.map(stock => {
                      const itemIndex = flatItems.findIndex(fi => fi.id === `stock-${stock.symbol}`);
                      const isSelected = selectedIndex === itemIndex;
                      const isGain = stock.dayChangePercent >= 0;

                      return (
                        <div
                          id={`search-item-${itemIndex}`}
                          key={stock.symbol}
                          onClick={() => handleStockClick(stock)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 shadow-sm'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 font-bold text-xs text-indigo-600 dark:text-indigo-400">
                              {stock.symbol.slice(0, 3)}
                            </div>
                            <div className="truncate">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {stock.symbol}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                                  {stock.sector}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {stock.name}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                              ₹{Number(stock.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </div>
                            <div className={`text-[11px] font-semibold ${isGain ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                              {isGain ? '+' : ''}{stock.dayChangePercent.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* MUTUAL FUNDS SECTION */}
              {data.mutualFunds && data.mutualFunds.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="px-2.5 py-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" /> Direct Mutual Funds ({data.mutualFunds.length})
                  </div>
                  <div className="space-y-1">
                    {data.mutualFunds.map(fund => {
                      const itemIndex = flatItems.findIndex(fi => fi.id === `fund-${fund.id}`);
                      const isSelected = selectedIndex === itemIndex;

                      return (
                        <div
                          id={`search-item-${itemIndex}`}
                          key={fund.id}
                          onClick={() => handleFundClick(fund)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-sm'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center shrink-0">
                              <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                {fund.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span>{fund.fundHouse}</span>
                                <span>•</span>
                                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                  {fund.subCategory || fund.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <div className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              3Y: +{Number(fund.returns3Y || 0).toFixed(1)}%
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                              NAV ₹{Number(fund.nav || 0).toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* IPOS SECTION */}
              {data.ipos && data.ipos.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="px-2.5 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> IPO Pipeline ({data.ipos.length})
                  </div>
                  <div className="space-y-1">
                    {data.ipos.map(ipo => {
                      const itemIndex = flatItems.findIndex(fi => fi.id === `ipo-${ipo.id}`);
                      const isSelected = selectedIndex === itemIndex;

                      return (
                        <div
                          id={`search-item-${itemIndex}`}
                          key={ipo.id}
                          onClick={() => handleIpoClick(ipo)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 shadow-sm'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center shrink-0">
                              <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                {ipo.name}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {ipo.segment.toUpperCase()} • Price Band ₹{ipo.issuePrice}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            {ipo.estimatedGainPercent ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                +{ipo.estimatedGainPercent}% GMP
                              </span>
                            ) : (
                              <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
                                {ipo.status}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* NEWS STORIES SECTION */}
              {data.news && data.news.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="px-2.5 py-1 text-[11px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Newspaper className="w-3.5 h-3.5" /> Market Intelligence & Catalysts ({data.news.length})
                  </div>
                  <div className="space-y-1">
                    {data.news.map(n => {
                      const itemIndex = flatItems.findIndex(fi => fi.id === `news-${n.id}`);
                      const isSelected = selectedIndex === itemIndex;
                      const isBullish = n.sentiment === 'BULLISH';
                      const isBearish = n.sentiment === 'BEARISH';

                      return (
                        <div
                          id={`search-item-${itemIndex}`}
                          key={n.id}
                          onClick={() => {
                            navigate(`/news?search=${encodeURIComponent(n.title.slice(0, 30))}`);
                            onClose();
                          }}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-rose-50/90 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 shadow-sm'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center shrink-0">
                              <Newspaper className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                {n.title}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span>{n.source}</span>
                                <span>•</span>
                                <span className="font-medium text-slate-600 dark:text-slate-300">
                                  {n.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                isBullish
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : isBearish
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
                              }`}
                            >
                              {n.sentiment}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* PLATFORM PAGES SECTION */}
              {data.pages && data.pages.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="px-2.5 py-1 text-[11px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" /> Platform Tools & Navigation
                  </div>
                  <div className="space-y-1">
                    {data.pages.map(page => {
                      const itemIndex = flatItems.findIndex(fi => fi.id === `page-${page.path}`);
                      const isSelected = selectedIndex === itemIndex;

                      return (
                        <div
                          id={`search-item-${itemIndex}`}
                          key={page.path}
                          onClick={() => handlePageClick(page)}
                          onMouseEnter={() => setSelectedIndex(itemIndex)}
                          className={`flex items-center justify-between p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-cyan-50/90 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800 shadow-sm'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-950/40 flex items-center justify-center shrink-0">
                              <Compass className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-sm text-slate-900 dark:text-white">
                                {page.title}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                {page.description}
                              </div>
                            </div>
                          </div>
                          <div className="shrink-0 ml-3 text-slate-400">
                            <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : !loading && query ? (
            <div className="py-12 text-center space-y-2">
              <Search className="w-8 h-8 text-slate-400 mx-auto opacity-60" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No matching results found for &ldquo;{query}&rdquo;
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Try searching by NSE symbol (e.g. TATASTEEL, WIPRO), mutual fund name (e.g. Quant), or platform features like Portfolio.
              </p>
            </div>
          ) : null}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 sm:px-6 py-2.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px]">â†‘</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px]">â†“</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px]">â†µ</kbd>
              Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-[10px]">ESC</kbd>
              Close
            </span>
          </div>
          <div className="hidden sm:block text-slate-400 text-[10px]">
            MoneyLogger Institutional Pipeline
          </div>
        </div>
      </div>
    </div>
  );
};
