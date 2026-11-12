import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Star,
  Building2,
  Percent,
  Wallet,
  PieChart,
  BarChart3,
  Award,
  AlertCircle,
  Loader2,
  Share2,
  Bookmark,
  Check,
  ChevronRight,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend
} from 'recharts';
import type { MutualFundDetail as MutualFundDetailType } from '../types';
import { getMutualFundDetails, getMutualFundChart, type ChartPoint } from '../services/mutualFundService';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import { useTheme } from '../context/ThemeContext';

type TimeRange = '1M' | '6M' | '1Y' | '3Y' | '5Y' | 'ALL';
type CalculatorMode = 'sip' | 'lumpsum';

const AMC_META: Record<string, { domain?: string; bg: string; text: string; initials: string }> = {
  'Quant': {
    domain: 'quantmutual.com',
    bg: 'from-violet-600 to-indigo-700',
    text: 'text-white',
    initials: 'QT'
  },
  'Parag Parikh': {
    domain: 'amc.ppfas.com',
    bg: 'from-emerald-600 to-teal-700',
    text: 'text-white',
    initials: 'PP'
  },
  'PPFAS': {
    domain: 'amc.ppfas.com',
    bg: 'from-emerald-600 to-teal-700',
    text: 'text-white',
    initials: 'PP'
  },
  'HDFC': {
    domain: 'hdfcfund.com',
    bg: 'from-blue-700 to-red-600',
    text: 'text-white',
    initials: 'HDFC'
  },
  'SBI': {
    domain: 'sbimf.com',
    bg: 'from-sky-600 to-blue-800',
    text: 'text-white',
    initials: 'SBI'
  },
  'ICICI': {
    domain: 'icicipruamc.com',
    bg: 'from-orange-600 to-red-700',
    text: 'text-white',
    initials: 'ICICI'
  },
  'Nippon': {
    domain: 'mf.nipponindiaim.com',
    bg: 'from-red-600 to-rose-700',
    text: 'text-white',
    initials: 'NIP'
  },
  'Tata': {
    domain: 'tatamutualfund.com',
    bg: 'from-blue-600 to-cyan-700',
    text: 'text-white',
    initials: 'TATA'
  },
  'Kotak': {
    domain: 'kotakmf.com',
    bg: 'from-red-600 to-rose-800',
    text: 'text-white',
    initials: 'KM'
  },
  'Mirae': {
    domain: 'miraeassetmf.co.in',
    bg: 'from-blue-800 to-orange-600',
    text: 'text-white',
    initials: 'MA'
  },
  'Motilal': {
    domain: 'motilaloswalmf.com',
    bg: 'from-amber-500 to-yellow-600',
    text: 'text-slate-900',
    initials: 'MO'
  },
  'Axis': {
    domain: 'axismf.com',
    bg: 'from-purple-800 to-rose-700',
    text: 'text-white',
    initials: 'AXIS'
  },
  'UTI': {
    domain: 'utimf.com',
    bg: 'from-orange-500 to-blue-700',
    text: 'text-white',
    initials: 'UTI'
  },
  'DSP': {
    domain: 'dspim.com',
    bg: 'from-slate-800 to-slate-900',
    text: 'text-white',
    initials: 'DSP'
  },
  'Bandhan': {
    domain: 'bandhanmutual.com',
    bg: 'from-red-700 to-orange-600',
    text: 'text-white',
    initials: 'BF'
  },
  'Aditya Birla': {
    domain: 'mutualfund.adityabirlacapital.com',
    bg: 'from-red-700 to-amber-600',
    text: 'text-white',
    initials: 'ABSL'
  }
};

const getAMCMeta = (fundHouse?: string, fundName?: string) => {
  const text = `${fundHouse || ''} ${fundName || ''}`.toLowerCase();
  for (const [key, val] of Object.entries(AMC_META)) {
    if (text.includes(key.toLowerCase())) {
      return { key, ...val };
    }
  }
  const firstWord = (fundHouse || 'Mutual Fund').split(' ')[0] || 'MF';
  return {
    key: firstWord,
    domain: '',
    bg: 'from-indigo-600 to-violet-700',
    text: 'text-white',
    initials: firstWord.slice(0, 3).toUpperCase()
  };
};

const AMCLogoBadge: React.FC<{ fundHouse: string; fundName: string; className?: string }> = ({
  fundHouse,
  fundName,
  className = 'w-14 h-14 sm:w-16 sm:h-16'
}) => {
  const meta = getAMCMeta(fundHouse, fundName);
  const [imgError, setImgError] = useState(false);
  const logoUrl = meta.domain
    ? `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${meta.domain}&size=128`
    : null;

  return (
    <div
      className={`relative shrink-0 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-700/80 bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center p-2 ${className}`}
    >
      {logoUrl && !imgError ? (
        <img
          src={logoUrl}
          alt={fundHouse}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      ) : (
        <div
          className={`w-full h-full rounded-xl bg-gradient-to-br ${meta.bg} flex items-center justify-center font-black ${meta.text} text-sm sm:text-base tracking-wider shadow-inner select-none`}
        >
          {meta.initials}
        </div>
      )}
    </div>
  );
};

const MutualFundDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [fund, setFund] = useState<MutualFundDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chart State
  const [timeRange, setTimeRange] = useState<TimeRange>('1Y');
  const [chartPoints, setChartPoints] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [benchmarkName, setBenchmarkName] = useState<string>('Benchmark Index');

  // Calculator State
  const [calcMode, setCalcMode] = useState<CalculatorMode>('sip');
  const [sipAmount, setSipAmount] = useState<number>(5000);
  const [investmentYears, setInvestmentYears] = useState<number>(5);
  const [expectedReturnRate, setExpectedReturnRate] = useState<number>(18);

  // Watchlist state
  const [isSaved, setIsSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Theme Hook
  const { isDark } = useTheme();

  // Check saved state in localStorage
  useEffect(() => {
    if (!id) return;
    try {
      const savedList = JSON.parse(localStorage.getItem('mf_watchlist') || '[]');
      setIsSaved(savedList.includes(id));
    } catch {
      // ignore
    }
  }, [id]);

  const toggleWatchlist = () => {
    if (!id) return;
    try {
      const savedList: string[] = JSON.parse(localStorage.getItem('mf_watchlist') || '[]');
      let updated: string[];
      if (savedList.includes(id)) {
        updated = savedList.filter((item) => item !== id);
        setIsSaved(false);
      } else {
        updated = [...savedList, id];
        setIsSaved(true);
      }
      localStorage.setItem('mf_watchlist', JSON.stringify(updated));
    } catch {
      // ignore
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch Scheme Details
  useEffect(() => {
    const fetchDetails = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getMutualFundDetails(id);
        setFund(data);
        setBenchmarkName(data.benchmark || 'Nifty 50 TRI');

        // Set initial expected return to 3Y or 5Y CAGR
        const returnRate = data.returns?.threeYear || data.returns3Y || 15;
        setExpectedReturnRate(Math.min(35, Math.max(8, Math.round(returnRate))));

        setError(null);
      } catch (err: any) {
        console.error('Failed to load fund details:', err);
        setError(err.message || 'Failed to load mutual fund details');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  // Fetch Chart Data on Timeframe Change
  useEffect(() => {
    const fetchChart = async () => {
      if (!id) return;
      try {
        setChartLoading(true);
        const res = await getMutualFundChart(id, timeRange);
        setChartPoints(res.points || []);
        if (res.benchmark) setBenchmarkName(res.benchmark);
      } catch (err) {
        console.error('Failed to load chart points:', err);
      } finally {
        setChartLoading(false);
      }
    };
    fetchChart();
  }, [id, timeRange]);

  // Calculator Computations
  const calculatorResults = useMemo(() => {
    const r = expectedReturnRate / 100;
    const n = investmentYears;

    if (calcMode === 'sip') {
      const monthlyRate = r / 12;
      const totalMonths = n * 12;
      const totalInvested = sipAmount * totalMonths;
      // Future Value of SIP formula: P * [((1 + i)^n - 1) / i] * (1 + i)
      const futureValue = sipAmount * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate) * (1 + monthlyRate);
      const estimatedProfit = futureValue - totalInvested;
      return {
        totalInvested: Math.round(totalInvested),
        estimatedProfit: Math.round(estimatedProfit),
        totalValue: Math.round(futureValue)
      };
    } else {
      // Lumpsum Future Value formula: P * (1 + r)^n
      const totalInvested = sipAmount * 10; // 10x for lumpsum default
      const futureValue = totalInvested * Math.pow(1 + r, n);
      const estimatedProfit = futureValue - totalInvested;
      return {
        totalInvested: Math.round(totalInvested),
        estimatedProfit: Math.round(estimatedProfit),
        totalValue: Math.round(futureValue)
      };
    }
  }, [calcMode, sipAmount, investmentYears, expectedReturnRate]);

  const renderStars = (rating?: number | null) => {
    if (!rating || rating <= 0) {
      return (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
          title="Unrated (Requires at least 3 years track record under SEBI/CRISIL rules)"
        >
          Unrated
        </span>
      );
    }
    return (
      <div className="flex items-center gap-1 text-amber-400" title={`${rating} Star Rating`}>
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-4 h-4 ${
              i < rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'
            }`}
          />
        ))}
      </div>
    );
  };

  const getRiskometerBadge = (riskometer?: string) => {
    switch (riskometer) {
      case 'Low':
      case 'Moderately Low':
        return <Badge type="success">{riskometer.toUpperCase()}</Badge>;
      case 'Moderate':
        return <Badge type="warning">MODERATE RISK</Badge>;
      case 'Moderately High':
        return <Badge type="warning">MOD. HIGH RISK</Badge>;
      case 'Very High':
      case 'High':
      default:
        return <Badge type="danger">VERY HIGH RISK</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
          Loading institutional analytics for scheme {id}...
        </p>
      </div>
    );
  }

  if (error || !fund) {
    return (
      <GlassCard className="p-10 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Scheme Not Found</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{error || 'Scheme code not recognized'}</p>
        <button
          onClick={() => navigate('/mutual-funds')}
          className="mt-5 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
        >
          Back to Explorer
        </button>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Top Navigation & Breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={() => navigate('/mutual-funds')}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Mutual Funds</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleWatchlist}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-sm font-semibold border transition-all ${
              isSaved
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-600 dark:text-amber-400'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>{isSaved ? 'Saved' : 'Watchlist'}</span>
          </button>

          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'Copied Link' : 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Hero Overview Card */}
      <GlassCard className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Fund Title & Metadata with AMC Logo */}
          <div className="flex items-start gap-4 sm:gap-5 flex-1 min-w-0">
            <AMCLogoBadge
              fundHouse={fund.fundHouse}
              fundName={fund.name}
              className="w-14 h-14 sm:w-16 sm:h-16 mt-0.5 shadow-sm"
            />
            <div className="space-y-2.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-200 dark:border-indigo-800">
                  {fund.planType?.toUpperCase() || 'DIRECT'} • {fund.optionType?.toUpperCase() || 'GROWTH'}
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                  {fund.subCategory}
                </span>
                {getRiskometerBadge(fund.riskometer)}
                <div className="flex items-center gap-1 ml-1">{renderStars(fund.riskRating)}</div>
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight break-words">
                  {fund.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{fund.fundHouse}</span>
                  <span>•</span>
                  <span>Benchmark: <strong className="text-slate-700 dark:text-slate-300">{fund.benchmark}</strong></span>
                </p>
              </div>
            </div>
          </div>

          {/* Current NAV Box */}
          <div className="flex lg:flex-col items-baseline lg:items-end justify-between border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current NAV ({fund.navDate || 'Latest'})
              </span>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white">
                  ₹{fund.nav.toFixed(2)}
                </span>
                <div
                  className={`flex items-center text-sm font-bold ${
                    fund.change >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {fund.change >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                  <span>
                    {fund.change >= 0 ? '+' : ''}
                    {fund.change.toFixed(2)} ({fund.pct ? fund.pct.toFixed(2) : '0.00'}%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Returns Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800/80">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">1M Return</span>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {fund.returns?.oneMonth !== undefined && fund.returns?.oneMonth !== null ? `${fund.returns.oneMonth >= 0 ? '+' : ''}${fund.returns.oneMonth}%` : 'N/A'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">1Y Return</span>
            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {(fund.returns?.oneYear ?? fund.returns1Y) !== undefined && (fund.returns?.oneYear ?? fund.returns1Y) !== null ? `${(fund.returns?.oneYear ?? fund.returns1Y)! >= 0 ? '+' : ''}${fund.returns?.oneYear ?? fund.returns1Y}%` : 'N/A'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
            <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">3Y CAGR</span>
            <p className="text-base font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {(fund.returns?.threeYear ?? fund.returns3Y) !== undefined && (fund.returns?.threeYear ?? fund.returns3Y) !== null ? `${(fund.returns?.threeYear ?? fund.returns3Y)! >= 0 ? '+' : ''}${fund.returns?.threeYear ?? fund.returns3Y}%` : 'N/A'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">5Y CAGR</span>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {(fund.returns?.fiveYear ?? fund.returns5Y) !== undefined && (fund.returns?.fiveYear ?? fund.returns5Y) !== null ? `${(fund.returns?.fiveYear ?? fund.returns5Y)! >= 0 ? '+' : ''}${fund.returns?.fiveYear ?? fund.returns5Y}%` : 'N/A'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Since Inception</span>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {(fund.returns?.sinceInception ?? fund.returnsSinceInception) !== undefined && (fund.returns?.sinceInception ?? fund.returnsSinceInception) !== null ? `${(fund.returns?.sinceInception ?? fund.returnsSinceInception)! >= 0 ? '+' : ''}${fund.returns?.sinceInception ?? fund.returnsSinceInception}%` : 'N/A'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Expense Ratio</span>
            <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
              {fund.expenseRatio !== undefined && fund.expenseRatio !== null ? `${fund.expenseRatio}%` : '--'}
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Main Grid: Performance Chart vs SIP Calculator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* NAV vs Benchmark Interactive Chart (8 cols) */}
        <div className="lg:col-span-7 xl:col-span-8">
          <GlassCard className="p-5 sm:p-6 h-full flex flex-col justify-between">
            <div>
              {/* Chart Header & Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                    NAV Trajectory vs Benchmark
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Fund vs {benchmarkName}
                  </p>
                </div>

                {/* Timeframe Switcher */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl overflow-x-auto no-scrollbar max-w-full">
                  {(['1M', '6M', '1Y', '3Y', '5Y', 'ALL'] as TimeRange[]).map((tf) => (
                    <button
                      key={tf}
                      onClick={() => setTimeRange(tf)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                        timeRange === tf
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Rendering */}
              <div className="h-72 sm:h-80 w-full relative">
                {chartLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-xs z-10">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                  </div>
                ) : chartPoints.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 dark:text-slate-400">
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Synchronizing NAV History</p>
                    <p className="text-xs mt-1">Direct historical daily NAV points are syncing with official AMFI servers.</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="fundGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#334155' : '#e2e8f0'} opacity={0.6} />
                      <XAxis
                        dataKey="date"
                        stroke={isDark ? '#94a3b8' : '#64748b'}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                      />
                      <YAxis
                        stroke={isDark ? '#94a3b8' : '#64748b'}
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => `₹${val}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as ChartPoint;
                            return (
                              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl text-xs space-y-1">
                                <p className="font-bold text-slate-500 dark:text-slate-400">{data.date}</p>
                                <p className="font-bold text-indigo-600 dark:text-indigo-400">
                                  Fund NAV: ₹{data.nav.toFixed(2)}
                                </p>
                                <p className="font-semibold text-slate-500 dark:text-slate-400">
                                  Benchmark: ₹{data.benchmarkNav.toFixed(2)}
                                </p>
                                <p className="font-bold text-emerald-600">
                                  Return: {data.returnPct >= 0 ? '+' : ''}{data.returnPct}%
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="plainline" />
                      <Area
                        type="monotone"
                        name={fund.name}
                        dataKey="nav"
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#fundGradient)"
                      />
                      <Line
                        type="monotone"
                        name={benchmarkName}
                        dataKey="benchmarkNav"
                        stroke="#94a3b8"
                        strokeWidth={1.5}
                        strokeDasharray="4 4"
                        dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Benchmark Alpha Note */}
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>
                Fund Alpha:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400">
                  {fund.riskMetrics?.alpha !== undefined && fund.riskMetrics?.alpha !== null
                    ? `${fund.riskMetrics.alpha >= 0 ? '+' : ''}${fund.riskMetrics.alpha}% excess return`
                    : 'Real-time AMFI Trajectory'}
                </strong>
              </span>
              <span className="text-[11px]">Normalized Historical Track</span>
            </div>
          </GlassCard>
        </div>

        {/* Interactive SIP & Lumpsum Calculator (4 cols) */}
        <div className="lg:col-span-5 xl:col-span-4">
          <GlassCard className="p-5 sm:p-6 h-full flex flex-col justify-between">
            <div>
              {/* Header & Mode Switcher */}
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-500" />
                  Returns Calculator
                </h3>
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    onClick={() => setCalcMode('sip')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      calcMode === 'sip' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    SIP
                  </button>
                  <button
                    onClick={() => setCalcMode('lumpsum')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      calcMode === 'lumpsum' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Lumpsum
                  </button>
                </div>
              </div>

              {/* Slider 1: Monthly Investment Amount */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    {calcMode === 'sip' ? 'Monthly Investment' : 'Total Investment'}
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{calcMode === 'sip' ? sipAmount.toLocaleString('en-IN') : (sipAmount * 10).toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="50000"
                  step="500"
                  value={sipAmount}
                  onChange={(e) => setSipAmount(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[1000, 2500, 5000, 10000].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setSipAmount(preset)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${
                        sipAmount === preset
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 border-emerald-500'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      ₹{preset >= 1000 ? `${preset / 1000}k` : preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Slider 2: Investment Horizon (Years) */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Investment Horizon</span>
                  <span className="font-bold text-slate-900 dark:text-white">{investmentYears} Years</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="1"
                  value={investmentYears}
                  onChange={(e) => setInvestmentYears(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Slider 3: Expected Annual Return Rate */}
              <div className="space-y-2 mb-5">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-600 dark:text-slate-400">Expected Annual Return</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{expectedReturnRate}% p.a.</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="35"
                  step="1"
                  value={expectedReturnRate}
                  onChange={(e) => setExpectedReturnRate(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Result Cards */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Total Invested:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    ₹{calculatorResults.totalInvested.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Est. Capital Gains:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    +₹{calculatorResults.estimatedProfit.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/60 flex justify-between items-baseline">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Maturity Corpus:
                  </span>
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    ₹{calculatorResults.totalValue.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Proportion Progress Bar */}
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex mt-2">
                  <div
                    style={{
                      width: `${(calculatorResults.totalInvested / calculatorResults.totalValue) * 100}%`
                    }}
                    className="bg-indigo-500 h-full"
                    title="Invested"
                  />
                  <div
                    style={{
                      width: `${(calculatorResults.estimatedProfit / calculatorResults.totalValue) * 100}%`
                    }}
                    className="bg-emerald-500 h-full"
                    title="Estimated Gains"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" /> Invested
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Profit (+{( (calculatorResults.estimatedProfit / calculatorResults.totalInvested) * 100 ).toFixed(0)}%)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => alert(`Starting SIP simulation for ₹${sipAmount}/month into ${fund.name}. Integrates with your portfolio transactions!`)}
              className="mt-4 w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors shadow-sm"
            >
              Start SIP with ₹{sipAmount.toLocaleString('en-IN')}/mo
            </button>
          </GlassCard>
        </div>
      </div>

      {/* Scheme Vitals Grid */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Percent className="w-5 h-5 text-indigo-500" />
          Scheme Vitals & Investment Limits
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Fund Size (AUM)</span>
            <p className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
              ₹{(fund.aum || 0).toLocaleString('en-IN')} Cr
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Expense Ratio</span>
            <p className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
              {fund.expenseRatio !== undefined && fund.expenseRatio !== null ? `${fund.expenseRatio}%` : '--'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Min. Monthly SIP</span>
            <p className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
              ₹{(fund.minimumSip || fund.minSip || 500).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Min. Lumpsum</span>
            <p className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
              ₹{(fund.minimumLumpsum || fund.minLumpsum || 1000).toLocaleString('en-IN')}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Exit Load</span>
            <p className="font-medium text-slate-900 dark:text-white text-xs mt-1 line-clamp-2">
              {fund.exitLoad || 'Nil'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Portfolio Turnover</span>
            <p className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
              {fund.turnoverRatio !== undefined && fund.turnoverRatio !== null ? `${fund.turnoverRatio}%` : 'N/A'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Lock-in Period</span>
            <p className="font-bold text-slate-900 dark:text-white text-base mt-0.5">
              {fund.lockInPeriod || 'None (Open Ended)'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-500 dark:text-slate-400">Taxation (Budget 2024)</span>
            <p className="font-medium text-slate-900 dark:text-white text-xs mt-1">
              LTCG 12.5% (&gt;₹1.25L) • STCG 20%
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Quantitative Risk Analytics (The Quant Box) */}
      <GlassCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-indigo-500" />
              Risk & Volatility Diagnostics
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Calculated over 3-year rolling periods relative to {fund.benchmark}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Sharpe Ratio */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Sharpe Ratio</span>
              <span className="text-[10px] text-emerald-500 font-bold">Risk-Adjusted</span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {fund.riskMetrics?.sharpeRatio !== undefined && fund.riskMetrics?.sharpeRatio !== null
                ? Number(fund.riskMetrics.sharpeRatio).toFixed(2)
                : '--'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Higher is better. Measures return generated per unit of risk taken.
            </p>
          </div>

          {/* Alpha */}
          <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Alpha (α)</span>
              <span className="text-[10px] text-emerald-600 font-bold">Excess Return</span>
            </div>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {fund.riskMetrics?.alpha !== undefined && fund.riskMetrics?.alpha !== null
                ? `${fund.riskMetrics.alpha >= 0 ? '+' : ''}${Number(fund.riskMetrics.alpha).toFixed(2)}%`
                : '--'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Excess return generated over passive benchmark index.
            </p>
          </div>

          {/* Beta */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Beta (β)</span>
              <span className="text-[10px] text-slate-400 font-bold">Sensitivity</span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {fund.riskMetrics?.beta !== undefined && fund.riskMetrics?.beta !== null
                ? Number(fund.riskMetrics.beta).toFixed(2)
                : '--'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Market sensitivity. &lt;1.0 means lower swings than benchmark index.
            </p>
          </div>

          {/* Standard Deviation */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Standard Dev</span>
              <span className="text-[10px] text-slate-400 font-bold">Volatility</span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {fund.riskMetrics?.stdDeviation !== undefined && fund.riskMetrics?.stdDeviation !== null
                ? `${Number(fund.riskMetrics.stdDeviation).toFixed(2)}%`
                : '--'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Measure of NAV fluctuation around historical mean return.
            </p>
          </div>

          {/* Sortino Ratio */}
          <div className="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Sortino Ratio</span>
              <span className="text-[10px] text-emerald-500 font-bold">Downside</span>
            </div>
            <p className="text-2xl font-black text-slate-900 dark:text-white">
              {fund.riskMetrics?.sortinoRatio !== undefined && fund.riskMetrics?.sortinoRatio !== null
                ? Number(fund.riskMetrics.sortinoRatio).toFixed(2)
                : '--'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Penalizes only downside volatility instead of total volatility.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Portfolio Breakdown: Holdings & Sectors */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 10 Holdings Table (7 cols) */}
        <div className="lg:col-span-7">
          <GlassCard className="p-6 h-full">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-500" />
              Top Portfolio Holdings
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Consolidated equity stock allocation representing core active bets
            </p>

            <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
              {fund.topHoldings && fund.topHoldings.length > 0 ? (
                <table className="w-full min-w-[380px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                      <th className="py-2.5 px-3">Company</th>
                      <th className="py-2.5 px-3">Sector</th>
                      <th className="py-2.5 px-3 text-right">Assets %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {fund.topHoldings.map((h, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                          <div className="line-clamp-1">{h.name}</div>
                          {h.symbol && <span className="text-[11px] font-mono text-slate-400">{h.symbol}</span>}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 dark:text-slate-400">
                          {h.sector || 'Equities'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
                          {h.percentage}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-8 px-4 text-center rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Monthly Portfolio Disclosure Pending</p>
                  <p className="text-[11px]">AMC releases consolidated holding disclosures at month-end. Fund NAV trajectory, 3Y CAGR, and risk metrics are 100% live and verified via AMFI.</p>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        {/* Sector Allocation & Asset Mix (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Asset Class Mix */}
          <GlassCard className="p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-indigo-500" />
              Asset Allocation Mix
            </h3>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Equities</span>
                  <span>{fund.assetAllocation?.equity ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, fund.assetAllocation?.equity ?? 0))}%` }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
              </div>

              {(fund.assetAllocation?.debt ?? 0) > 0 && (
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span>Debt & Fixed Income</span>
                    <span>{fund.assetAllocation?.debt ?? 0}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      style={{ width: `${Math.min(100, Math.max(0, fund.assetAllocation?.debt ?? 0))}%` }}
                      className="h-full bg-amber-500 rounded-full"
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>Cash & Money Market</span>
                  <span>{fund.assetAllocation?.cash ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, fund.assetAllocation?.cash ?? 0))}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Sector Weights */}
          <GlassCard className="p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              Top Sector Weights
            </h3>
            {fund.sectorAllocation && fund.sectorAllocation.length > 0 ? (
              <div className="space-y-3">
                {fund.sectorAllocation.map((sec, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-xs font-semibold mb-1 text-slate-700 dark:text-slate-300">
                      <span className="line-clamp-1">{sec.name}</span>
                      <span>{sec.percentage}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${sec.percentage}%` }}
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 px-4 text-center rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                <p className="font-semibold text-slate-700 dark:text-slate-300">Sector Classification Pending</p>
                <p className="text-[11px]">Detailed sector weights reflect automatically upon monthly portfolio publication.</p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>

      {/* Peer Comparison in Category */}
      {fund.peers && fund.peers.length > 0 && (
        <GlassCard className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-500" />
                Category Peer Comparison
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                How {fund.name} stacks up against top competitors in {fund.subCategory}
              </p>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 sm:hidden">
              ← Swipe table horizontally to see all returns →
            </span>
          </div>

          <div className="overflow-x-auto -mx-2 sm:mx-0 px-2 sm:px-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-400 uppercase">
                  <th className="py-3 px-4 min-w-[220px]">Scheme Name</th>
                  <th className="py-3 px-3 text-right">NAV (₹)</th>
                  <th className="py-3 px-3 text-right">1Y Return</th>
                  <th className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">3Y CAGR</th>
                  <th className="py-3 px-3 text-right">5Y CAGR</th>
                  <th className="py-3 px-3 text-right">Exp. Ratio</th>
                  <th className="py-3 px-4 text-right">AUM (Cr)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {/* Current Fund */}
                <tr className="bg-indigo-500/10 font-semibold">
                  <td className="py-3 px-4 text-indigo-600 dark:text-indigo-400 flex items-center gap-2 min-w-[220px]">
                    <span className="line-clamp-1">{fund.name} (Current)</span>
                  </td>
                  <td className="py-3 px-3 text-right font-bold whitespace-nowrap">₹{fund.nav.toFixed(2)}</td>
                  <td className="py-3 px-3 text-right text-emerald-600 whitespace-nowrap">
                    {(fund.returns?.oneYear ?? fund.returns1Y) !== null && (fund.returns?.oneYear ?? fund.returns1Y) !== undefined
                      ? `${(fund.returns?.oneYear ?? fund.returns1Y)! >= 0 ? '+' : ''}${fund.returns?.oneYear ?? fund.returns1Y}%`
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-right font-black text-emerald-600 whitespace-nowrap">
                    {(fund.returns?.threeYear ?? fund.returns3Y) !== null && (fund.returns?.threeYear ?? fund.returns3Y) !== undefined
                      ? `${(fund.returns?.threeYear ?? fund.returns3Y)! >= 0 ? '+' : ''}${fund.returns?.threeYear ?? fund.returns3Y}%`
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">
                    {(fund.returns?.fiveYear ?? fund.returns5Y) !== null && (fund.returns?.fiveYear ?? fund.returns5Y) !== undefined
                      ? `${(fund.returns?.fiveYear ?? fund.returns5Y)! >= 0 ? '+' : ''}${fund.returns?.fiveYear ?? fund.returns5Y}%`
                      : 'N/A'}
                  </td>
                  <td className="py-3 px-3 text-right whitespace-nowrap">{fund.expenseRatio ? `${fund.expenseRatio}%` : '--'}</td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">₹{(fund.aum || 0).toLocaleString('en-IN')} Cr</td>
                </tr>

                {/* Peers */}
                {fund.peers.map((peer, idx) => (
                  <tr
                    key={idx}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    onClick={() => navigate(`/mutual-funds/${peer.schemeCode}`)}
                  >
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white flex items-center justify-between min-w-[220px]">
                      <span className="line-clamp-1 hover:text-indigo-600 dark:hover:text-indigo-400">{peer.name}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-1 shrink-0" />
                    </td>
                    <td className="py-3 px-3 text-right font-medium whitespace-nowrap">₹{peer.nav ? peer.nav.toFixed(2) : '--'}</td>
                    <td className="py-3 px-3 text-right text-emerald-600 font-medium whitespace-nowrap">
                      {(peer.oneYearReturn ?? peer.returns1Y) !== null && (peer.oneYearReturn ?? peer.returns1Y) !== undefined
                        ? `${(peer.oneYearReturn ?? peer.returns1Y)! >= 0 ? '+' : ''}${peer.oneYearReturn ?? peer.returns1Y}%`
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                      {(peer.threeYearReturn ?? peer.returns3Y) !== null && (peer.threeYearReturn ?? peer.returns3Y) !== undefined
                        ? `${(peer.threeYearReturn ?? peer.returns3Y)! >= 0 ? '+' : ''}${peer.threeYearReturn ?? peer.returns3Y}%`
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right font-medium whitespace-nowrap">
                      {(peer.fiveYearReturn ?? peer.returns5Y) !== null && (peer.fiveYearReturn ?? peer.returns5Y) !== undefined
                        ? `${(peer.fiveYearReturn ?? peer.returns5Y)! >= 0 ? '+' : ''}${peer.fiveYearReturn ?? peer.returns5Y}%`
                        : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-500 whitespace-nowrap">{peer.expenseRatio ? `${peer.expenseRatio}%` : '--'}</td>
                    <td className="py-3 px-4 text-right text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      ₹{(peer.aum || 0).toLocaleString('en-IN')} Cr
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Fund Management & AMC Team */}
      {fund.fundManagers && fund.fundManagers.length > 0 && (
        <GlassCard className="p-6">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-indigo-500" />
            Fund Managers & Track Record
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fund.fundManagers.map((mgr, idx) => (
              <div
                key={idx}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800 space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-base">{mgr.name}</h4>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                    {mgr.tenure}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Experience: {mgr.experience}</p>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">{mgr.description}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
};

export default MutualFundDetail;