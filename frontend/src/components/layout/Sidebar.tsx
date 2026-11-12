import React from 'react';
import { 
  LayoutDashboard, 
  Layers, 
  Newspaper, 
  PieChart, 
  Briefcase, 
  BrainCircuit, 
  Globe, 
  X 
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';

interface SidebarProps {
  sidebarOpen: boolean;
  onClose?: () => void;
}

interface NavItem {
  path: string;
  label: string;
  icon: any;
  badge?: string;
  badgeType?: 'success' | 'danger' | 'neutral' | 'warning' | 'primary' | 'secondary';
  hasDividerBefore?: boolean;
}

const mainNavItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ipo', label: 'IPO Hub', icon: Briefcase },
  { path: '/screeners', label: 'Stock Screeners', icon: Layers },
  { path: '/mutual-funds', label: 'Mutual Funds', icon: PieChart },
  { path: '/etfs', label: 'ETF Zone', icon: Briefcase, badge: 'Soon', badgeType: 'warning' },
  { path: '/prediction', label: 'AI Prediction', icon: BrainCircuit, badge: 'Soon', badgeType: 'warning' },
  { path: '/global-sentiments', label: 'Global Sentiments', icon: Globe },
  { path: '/news', label: 'News Analysis', icon: Newspaper },
];

const portfolioItem: NavItem = {
  path: '/portfolio',
  label: 'Portfolio',
  icon: Briefcase,
  badge: 'Soon',
  badgeType: 'warning'
};

const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNavClick = (path: string) => {
    navigate(path);
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* 1. MOBILE & TABLET DRAWER (< lg screens: Phones, iPad, Tablets) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          {/* Dimmed backdrop - covers the whole screen outside drawer */}
          <div 
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer container - strictly left-aligned with a solid background and clear width */}
          <aside className="fixed inset-y-0 left-0 z-50 w-72 max-w-[82vw] bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full transform transition-transform duration-300 ease-in-out">
            {/* Header: Logo, Title, and Close Button */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200/80 dark:border-slate-800">
              <div 
                onClick={() => handleNavClick('/')}
                className="flex items-center gap-2.5 cursor-pointer"
              >
                <img 
                  src="/logo.png" 
                  alt="MoneyLogger" 
                  className="w-7 h-7 rounded-lg shadow-sm object-cover" 
                />
                <span className="font-black text-lg bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 dark:from-indigo-400 dark:via-cyan-300 dark:to-emerald-400">
                  MoneyLoggers
                </span>
              </div>

              <button 
                onClick={onClose}
                aria-label="Close sidebar"
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Navigation List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              {mainNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => handleNavClick(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-left cursor-pointer ${
                      isActive
                        ? 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                    }`}
                  >
                    <item.icon
                      size={20}
                      className={
                        isActive
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors'
                      }
                    />
                    <span className="flex-1 truncate text-sm">{item.label}</span>
                    {item.badge && <Badge type={item.badgeType || 'primary'}>{item.badge}</Badge>}
                  </button>
                );
              })}
            </div>

            {/* Bottom Portfolio Button */}
            <div className="p-3 border-t border-slate-200/80 dark:border-slate-800">
              <button
                onClick={() => handleNavClick(portfolioItem.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group text-left cursor-pointer ${
                  location.pathname === portfolioItem.path
                    ? 'bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60 font-medium'
                }`}
              >
                <portfolioItem.icon
                  size={20}
                  className={
                    location.pathname === portfolioItem.path
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors'
                  }
                />
                <span className="flex-1 truncate text-sm">{portfolioItem.label}</span>
                {portfolioItem.badge && <Badge type={portfolioItem.badgeType || 'primary'}>{portfolioItem.badge}</Badge>}
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* 2. DESKTOP PERMANENT SIDEBAR (>= lg screens: Laptops & Desktops) */}
      <aside className={`hidden lg:flex flex-col h-full bg-white/70 dark:bg-slate-950/80 backdrop-blur-md border-r border-slate-200/60 dark:border-slate-800/80 transition-all duration-300 select-none ${
        sidebarOpen ? 'w-64' : 'w-20'
      }`}>
        <div className="flex flex-col h-full py-6 px-3">
          {/* Main Navigation (Top) */}
          <div className="space-y-1.5 flex-1 overflow-y-auto scrollbar-none">
            {mainNavItems.map((item) => {
              const isActive = location.pathname === item.path;

              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer ${
                    isActive
                      ? 'bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60 font-medium'
                  }`}
                >
                  <item.icon
                    size={20}
                    className={
                      isActive
                        ? 'text-indigo-600 dark:text-indigo-400'
                        : 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors'
                    }
                  />
                  {sidebarOpen && <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis text-sm">{item.label}</span>}
                  {sidebarOpen && item.badge && <Badge type={item.badgeType || 'primary'}>{item.badge}</Badge>}
                </button>
              );
            })}
          </div>

          {/* Bottom Portfolio Item */}
          <div className="pt-3 border-t border-slate-200/50 dark:border-slate-800/80">
            <button
              onClick={() => navigate(portfolioItem.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group cursor-pointer ${
                location.pathname === portfolioItem.path
                  ? 'bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800/60 font-medium'
              }`}
            >
              <portfolioItem.icon
                size={20}
                className={
                  location.pathname === portfolioItem.path
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-300 transition-colors'
                }
              />
              {sidebarOpen && <span className="flex-1 text-left whitespace-nowrap overflow-hidden text-ellipsis text-sm">{portfolioItem.label}</span>}
              {sidebarOpen && portfolioItem.badge && <Badge type={portfolioItem.badgeType || 'primary'}>{portfolioItem.badge}</Badge>}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
