import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Ticker from './Ticker';
import { useTheme } from '../../context/ThemeContext';

const MainLayout: React.FC = () => {
  const { isDark } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });

  return (
    <div id="main-layout" className="min-h-screen font-sans transition-colors duration-300 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      
      {/* Ambient Background Glows */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[128px] opacity-40 transition-colors duration-500 ${isDark ? 'bg-indigo-950/60' : 'bg-indigo-200/50'}`} />
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[128px] opacity-40 transition-colors duration-500 ${isDark ? 'bg-emerald-950/60' : 'bg-emerald-200/50'}`} />
      </div>

      <Navbar 
        toggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        sidebarOpen={sidebarOpen} 
      />
      
      <Ticker />
      
      <div className="flex pt-0 h-[calc(100vh-104px)] md:h-[calc(100dvh-104px)] relative">
        <Sidebar sidebarOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 p-3 sm:p-5 md:p-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
