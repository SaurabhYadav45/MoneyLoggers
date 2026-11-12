
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import MainLayout from './components/layout/MainLayout';

// Route-level code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Screeners = lazy(() => import('./pages/Screeners'));
const Portfolio = lazy(() => import('./pages/Portfolio'));
const Research = lazy(() => import('./pages/Research'));
const Prediction = lazy(() => import('./pages/Prediction'));
const ETFs = lazy(() => import('./pages/ETFs'));
const IPO = lazy(() => import('./pages/IPO'));
const IPODetail = lazy(() => import('./pages/IPODetail'));
const IPOAdmin = lazy(() => import('./pages/IPOAdmin'));
const MutualFunds = lazy(() => import('./pages/MutualFunds'));
const MutualFundDetail = lazy(() => import('./pages/MutualFundDetail'));
const News = lazy(() => import('./pages/News'));
const GlobalSentiments = lazy(() => import('./pages/GlobalSentiments'));

const PageFallback = () => (
  <div className="flex items-center justify-center min-h-[50vh] p-8">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin" />
      <span className="text-xs text-slate-500 font-medium">Loading view...</span>
    </div>
  </div>
);

function App() {
  return (
    <ThemeProvider defaultTheme="light">
      <BrowserRouter>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="screeners" element={<Screeners />} />
              <Route path="ipo" element={<IPO />} />
              <Route path="ipos" element={<Navigate to="/ipo" replace />} />
              <Route path="ipo/:id" element={<IPODetail />} />
              <Route path="ipos/:id" element={<IPODetail />} />
              <Route path="admin/ipo" element={<IPOAdmin />} />
              <Route path="mutual-funds" element={<MutualFunds />} />
              <Route path="mutual-funds/:id" element={<MutualFundDetail />} />
              <Route path="news" element={<News />} />
              <Route path="global-sentiments" element={<GlobalSentiments />} />
              <Route path="research" element={<Research />} />
              <Route path="portfolio" element={<Portfolio />} />
              <Route path="prediction" element={<Prediction />} />
              <Route path="etfs" element={<ETFs />} />
              <Route path="etfs/:id" element={<Navigate to="/etfs" replace />} />
              <Route path="portfolio-optimization" element={<Navigate to="/portfolio" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;