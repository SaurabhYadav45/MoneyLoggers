import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Search, User } from 'lucide-react';
import { OmniSearchModal } from './OmniSearchModal';
import { ThemeToggle } from '../ui/ThemeToggle';

interface NavbarProps {
  toggleSidebar: () => void;
  sidebarOpen: boolean;
}

const Navbar: React.FC<NavbarProps> = ({ toggleSidebar, sidebarOpen }) => {
  const navigate = useNavigate();
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  // Global Ctrl + K / Cmd + K keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
        <div className="max-w-[1920px] mx-auto px-3 sm:px-4">
          <div className="flex items-center justify-between h-16">
            {/* Left: Hamburger + Brand Logo */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={toggleSidebar} 
                aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
                className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Menu size={20} />
              </button>
              
              <div 
                onClick={() => navigate('/')}
                className="flex items-center gap-2 sm:gap-2.5 cursor-pointer group select-none"
              >
                <img 
                  src="/logo.png" 
                  alt="MoneyLogger" 
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-md group-hover:scale-105 transition-transform object-cover ring-1 ring-slate-200/50 dark:ring-slate-700/50" 
                />
                <span className="text-lg sm:text-xl font-black bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-indigo-500 to-emerald-500 dark:from-indigo-400 dark:via-cyan-300 dark:to-emerald-400">
                  MoneyLoggers
                </span>
              </div>
            </div>

            {/* Middle: Interactive Omni-Search Trigger Bar (Desktop / Tablet) */}
            <div 
              onClick={() => setSearchModalOpen(true)}
              className="hidden md:flex flex-1 max-w-md mx-6 lg:mx-8 relative cursor-pointer group"
            >
              <div className="w-full flex items-center justify-between pl-10 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-white dark:hover:bg-slate-800 transition-all shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-hover:text-indigo-500 transition-colors">
                  <Search className="h-4 w-4" />
                </div>
                <span className="text-sm text-slate-500 dark:text-slate-300 font-normal truncate">
                  Search stocks, mutual funds, IPOs...
                </span>
                <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 shadow-xs">
                  Ctrl K
                </kbd>
              </div>
            </div>

            {/* Right: Mobile Search Trigger + Theme Toggle + User Profile */}
            <div className="flex items-center gap-1.5 sm:gap-2.5">
              {/* Mobile Search Button */}
              <button
                onClick={() => setSearchModalOpen(true)}
                aria-label="Open search"
                className="md:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Enterprise Theme Switcher */}
              <ThemeToggle />
              
              <div className="w-8 h-8 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-bold shadow-md cursor-pointer hover:scale-105 transition-transform">
                <User size={16} />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Unified Omni-Search Command Palette Modal */}
      <OmniSearchModal 
        isOpen={searchModalOpen} 
        onClose={() => setSearchModalOpen(false)} 
      />
    </>
  );
};

export default Navbar;