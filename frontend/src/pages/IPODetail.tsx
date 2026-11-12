import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Users, 
  Building2, 
  ExternalLink, 
  AlertCircle,
  Loader2,
  FileText,
  PieChart,
  BarChart3,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Video,
  Play,
  Maximize2,
  X,
  XCircle,
  Check,
  Calculator,
  Minus,
  Plus,
  FileDown,
  Copy,
  Phone,
  Mail,
  Layers3,
  Briefcase,
  User
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  Cell,
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid 
} from 'recharts';
import type { IPO } from '../types';
import { getIPOById, getCachedIPOById } from '../services/ipoService';
import GlassCard from '../components/ui/GlassCard';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { useTheme } from '../context/ThemeContext';

const IPODetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // Initialize synchronously with cached IPO data if available (0ms instant render, no spinner)
  const [ipo, setIpo] = useState<IPO | null>(() => {
    return id ? getCachedIPOById(id) : null;
  });
  const [loading, setLoading] = useState<boolean>(() => {
    return !id || !getCachedIPOById(id);
  });
  const { isDark } = useTheme();
  const [factorsTab, setFactorsTab] = useState<'strengths' | 'risks'>('strengths');
  const [financialMetric, setFinancialMetric] = useState<'revenue' | 'pat' | 'netWorth'>('revenue');
  const [isCinemaOpen, setIsCinemaOpen] = useState(false);
  const [isPlayingVideo, setIsPlayingVideo] = useState(false);
  const [selectedLots, setSelectedLots] = useState(1);
  const [bidCategory, setBidCategory] = useState<'retail' | 'sHNI' | 'bHNI'>('retail');
  const [copiedIsin, setCopiedIsin] = useState(false);

  // Reset video playback state when navigating between IPOs
  useEffect(() => {
    setIsPlayingVideo(false);
  }, [id]);

  // Close cinema mode on Escape key and prevent background body scrolling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isCinemaOpen) {
        setIsCinemaOpen(false);
      }
    };
    if (isCinemaOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCinemaOpen]);

  const getResolvedVideoUrl = (ipoData: IPO | null): string => {
    if (!ipoData) return '';
    const explicit = ipoData.youtubeVideoUrl || (ipoData as any).youtubeUrl || (ipoData.verdict as any)?.youtubeVideoUrl || (ipoData.valuation as any)?.youtubeVideoUrl;
    if (explicit && typeof explicit === 'string' && explicit.trim()) return explicit.trim();
    return '';
  };



  const getYouTubeVideoId = (url?: string): string | null => {
    if (!url || typeof url !== 'string') return null;
    const clean = url.trim();
    if (!clean) return null;

    // 1. Direct 11-char YouTube video ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(clean)) return clean;

    // 2. Iframe snippet or embed URL
    const embedMatch = clean.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
    if (embedMatch && embedMatch[1]) return embedMatch[1];

    // 3. Standard watch URL (?v=... or &v=...)
    const vMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
    if (vMatch && vMatch[1]) return vMatch[1];

    // 4. Short URL (youtu.be/...)
    const shortMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (shortMatch && shortMatch[1]) return shortMatch[1];

    // 5. Shorts, Live, or v path
    const pathMatch = clean.match(/\/(?:shorts|live|v)\/([a-zA-Z0-9_-]{11})/i);
    if (pathMatch && pathMatch[1]) return pathMatch[1];

    // 6. Generic regex extraction for any 11-char sequence if it mentions youtu
    if (clean.includes('youtu')) {
      const broadMatch = clean.match(/([a-zA-Z0-9_-]{11})/);
      if (broadMatch && broadMatch[1]) return broadMatch[1];
    }

    return null;
  };

  const getYouTubeEmbedUrl = (url?: string, autoplay = false): string | null => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1${autoplay ? '&autoplay=1' : ''}`;
  };

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      try {
        const cachedSummary = getCachedIPOById(id);
        if (cachedSummary && !ipo) {
          setIpo(cachedSummary);
        } else if (!ipo) {
          setLoading(true);
        }

        // Determine if cached record lacks detailed subscription breakdown
        const sub = (cachedSummary?.subscription as any) || (ipo?.subscription as any) || {};
        const hasCategories = Boolean(
          (Array.isArray(sub.daily) && sub.daily.length > 0) ||
          sub.latestCategories != null ||
          sub.qib != null ||
          sub.rii != null
        );

        const data = await getIPOById(id, { skipCache: !hasCategories, force: !hasCategories });
        if (data) {
          setIpo(data);
        }
      } catch (err) {
        console.error('Failed to load IPO details:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const formatDate = (dateStr?: string) => {
    if (!dateStr || !dateStr.trim() || dateStr === 'TBA') return 'TBA';
    try {
      const parsed = new Date(dateStr);
      if (isNaN(parsed.getTime())) return 'TBA';
      return parsed.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'TBA';
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'open':
        return <Badge type="success">LIVE NOW</Badge>;
      case 'upcoming':
        return <Badge type="warning">UPCOMING</Badge>;
      case 'closed':
        return <Badge type="neutral">CLOSED</Badge>;
      case 'listed':
        return <Badge type="primary">LISTED</Badge>;
      default:
        return <Badge type="neutral">{status?.toUpperCase() || 'IPO'}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400 font-medium">Loading IPO analysis & GMP trend...</p>
      </div>
    );
  }

  if (!ipo) {
    return (
      <GlassCard className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">IPO Not Found</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">
          The requested IPO could not be found or has not been listed yet.
        </p>
        <Button
          className="mt-6"
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/ipo');
            }
          }}
        >
          Back to All IPOs
        </Button>
      </GlassCard>
    );
  }

  const gmp = ipo.gmpData?.currentGmp ?? 0;
  const estGain = ipo.gmpData?.estimatedGainPercent ?? 0;
  const estListingPrice = ipo.gmpData?.estimatedListingPrice ?? (ipo.issuePrice + gmp);
  const gmpHistory = ipo.gmpData?.history ?? [];
  const minInv = ipo.minInvestment || (ipo.lotSize * ipo.issuePrice);
  const singleLotInvestment = ipo.issuePrice > 0 ? (ipo.issuePrice * (ipo.lotSize || 1)) : minInv;
  
  // SEBI Allocation & Lot Thresholds
  const maxRetailLots = singleLotInvestment > 0 ? Math.max(1, Math.floor(200000 / singleLotInvestment)) : 13;
  const minShniLots = singleLotInvestment > 0 ? Math.max(maxRetailLots + 1, Math.ceil(200001 / singleLotInvestment)) : 14;
  const maxShniLots = singleLotInvestment > 0 ? Math.max(minShniLots, Math.floor(1000000 / singleLotInvestment)) : 67;
  const minBhniLots = singleLotInvestment > 0 ? Math.max(maxShniLots + 1, Math.ceil(1000001 / singleLotInvestment)) : 68;

  const handleCategorySwitch = (cat: 'retail' | 'sHNI' | 'bHNI') => {
    setBidCategory(cat);
    if (cat === 'retail') {
      setSelectedLots(1);
    } else if (cat === 'sHNI') {
      setSelectedLots(minShniLots);
    } else {
      setSelectedLots(minBhniLots);
    }
  };

  const handleStepLots = (delta: number) => {
    setSelectedLots(prev => {
      const target = prev + delta;
      if (bidCategory === 'retail') {
        return Math.min(maxRetailLots, Math.max(1, target));
      } else if (bidCategory === 'sHNI') {
        return Math.min(maxShniLots, Math.max(minShniLots, target));
      } else {
        return Math.max(minBhniLots, target);
      }
    });
  };

  // Enriched top-level metadata
  const industry = ipo.industry || ipo.valuation?.industry;
  const isin = ipo.isin || ipo.valuation?.isin;
  const faceValue = ipo.faceValue ?? ipo.valuation?.faceValue;
  const exchanges = ipo.exchanges || ipo.valuation?.exchanges || { primary: 'BSE,NSE', nse: true, bse: true };
  const rhpUrl = ipo.links?.prospectus?.rhp || ipo.rhpUrl || ipo.valuation?.rhpUrl;
  const allotmentLinkUrl = ipo.links?.allotment || ipo.allotmentLinkUrl || ipo.registrar?.allotmentUrl;
  const reservation = ipo.reservation || ipo.valuation?.reservation || ipo.subscription?.reservation;

  const totalShares = selectedLots * (ipo.lotSize || 1);
  const totalInvestment = selectedLots * singleLotInvestment;
  const totalEstListingValue = selectedLots * (ipo.lotSize || 1) * estListingPrice;
  const totalEstListingGain = selectedLots * (ipo.lotSize || 1) * gmp;
  const rawDetailIssue = ipo.issueSize;
  const parsedDetailIssue = (typeof rawDetailIssue === 'object' && rawDetailIssue !== null) ? (rawDetailIssue as any).total : rawDetailIssue;
  const totalIssueSize = Number(parsedDetailIssue) || 0;
  const freshIssue = (typeof rawDetailIssue === 'object' && rawDetailIssue !== null) ? Number((rawDetailIssue as any).fresh) || totalIssueSize : totalIssueSize;
  const ofsIssue = (typeof rawDetailIssue === 'object' && rawDetailIssue !== null) ? Number((rawDetailIssue as any).ofs) || 0 : 0;
  const sub = ipo.subscription;

  // Actual listing details & Performance from IndianAPI / Admin
  const perf = ipo.performance || (ipo.listingDetails as any)?.performance;
  const actualListingPrice = perf?.price?.listing ?? ipo.listingDetails?.listingPrice ?? ipo.listingPrice ?? null;
  const actualIpoPrice = perf?.price?.ipo ?? ipo.issuePrice;
  const actualGainPercent = perf?.gain?.percentage ?? ipo.listingDetails?.listingGainPercent ?? ipo.listingGain ?? (
    actualListingPrice && actualIpoPrice > 0
      ? Number((((actualListingPrice - actualIpoPrice) / actualIpoPrice) * 100).toFixed(2))
      : null
  );
  const actualGainValue = perf?.gain?.absolute ?? (actualListingPrice && actualIpoPrice > 0 ? (actualListingPrice - actualIpoPrice) : null);
  const actualGainFormatted = perf?.gain?.formatted ?? (actualGainPercent != null ? `${actualGainPercent >= 0 ? '+' : ''}${actualGainPercent.toFixed(2)}%` : null);

  // Timeline events normalized across IndianAPI detailed & bulk v2
  const rawTimeline = (ipo.timeline as any) || {};
  const timelineSteps = [
    { label: 'Pre-Apply Period', date: rawTimeline.preApplicationStart || rawTimeline.preApplyStartDate },
    { label: 'Bidding Starts', date: rawTimeline.biddingStart || rawTimeline.applicationStartDate || rawTimeline.openDate || ipo.openDate },
    { label: 'Bidding Closes', date: rawTimeline.biddingEnd || rawTimeline.applicationEndDate || rawTimeline.closeDate || ipo.closeDate },
    { label: 'Allotment Processing', date: rawTimeline.allotmentProcessStart || rawTimeline.allotmentStartDate },
    { label: 'Allotment Finalized', date: rawTimeline.allotmentFinalization || rawTimeline.allotmentDate },
    { label: 'Refunds / Demat Credit', date: rawTimeline.refundInitiation || rawTimeline.refundInitiationDate || rawTimeline.refundsDate || rawTimeline.creditDate },
    { label: 'Listing Day (NSE/BSE)', date: rawTimeline.listingDay || rawTimeline.listingDate || ipo.listingDate },
    { label: 'Mandate End', date: rawTimeline.mandateEnd || rawTimeline.mandateEndDate },
  ].filter(step => Boolean(step.date));

  // Helper to parse dates in DD-MM-YYYY, YYYY-MM-DD, or slash formats into unix milliseconds
  const parseSubscriptionDate = (dateStr?: string): number => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const clean = dateStr.trim();
    if (!clean) return 0;
    const dmy = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (dmy) {
      return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])).getTime();
    }
    const t = new Date(clean).getTime();
    return isNaN(t) ? 0 : t;
  };

  // Safe number parser for strings with commas or units (e.g. "679200", "0.37", "0.37x")
  const parseNumericShares = (val: any): number | null => {
    if (val == null) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    const cleaned = String(val).replace(/,/g, '').replace(/x$/i, '').trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return isNaN(num) ? null : num;
  };

  // Sequence-wise subscription parsing (latest date first)
  const dailyArr: any[] = (sub as any)?.daily || [];
  const sortedDaily = Array.isArray(dailyArr) ? [...dailyArr].sort((a: any, b: any) => {
    const dateA = parseSubscriptionDate(a.date);
    const dateB = parseSubscriptionDate(b.date);
    if (dateA && dateB && dateA !== dateB) return dateB - dateA;
    const dayA = Number(a.day || a.dayNumber || 0);
    const dayB = Number(b.day || b.dayNumber || 0);
    return dayB - dayA;
  }) : [];
  const topDay = sortedDaily.length > 0 ? sortedDaily[0] : null;
  const topCats = topDay?.categories || (sub as any)?.latestCategories || (sub as any)?.categories || (topDay as any);
  const latestDateStr = topDay?.date || (sub as any)?.latestDate || (sub as any)?.date || '';

  // Category Multipliers and Applied/Reserved Shares
  // 1. Retail (RII)
  const riiObj = topCats?.retailIndividual || topCats?.retail || topCats?.rii;
  const riiApplied = riiObj?.applied != null ? parseNumericShares(riiObj.applied) : null;
  const riiReserved = riiObj?.reserved != null 
    ? parseNumericShares(riiObj.reserved) 
    : (reservation?.retail ? parseNumericShares(reservation.retail) : null);
  const riiRawVal = riiObj?.times ?? (typeof riiObj === 'number' || (typeof riiObj === 'string' && !isNaN(Number(riiObj))) ? riiObj : null) ?? sub?.rii ?? (sub as any)?.retail;
  const riiTimesNum = riiRawVal != null ? (parseNumericShares(riiRawVal) ?? 0) : 0;
  const riiTimesFormatted = riiObj?.timesFormatted || (riiRawVal != null ? `${riiTimesNum.toFixed(2)}x` : (ipo.status === 'open' ? '0.00x' : '--'));

  // 2. Non-Institutional (NII / HNI)
  const niiObj = topCats?.nonInstitutional || topCats?.nii || topCats?.hni;
  const niiApplied = niiObj?.applied != null ? parseNumericShares(niiObj.applied) : null;
  const niiReserved = niiObj?.reserved != null 
    ? parseNumericShares(niiObj.reserved) 
    : (reservation?.nonInstitutional ? parseNumericShares(reservation.nonInstitutional) : null);
  const niiRawVal = niiObj?.times ?? (typeof niiObj === 'number' || (typeof niiObj === 'string' && !isNaN(Number(niiObj))) ? niiObj : null) ?? sub?.nii;
  const niiTimesNum = niiRawVal != null ? (parseNumericShares(niiRawVal) ?? 0) : 0;
  const niiTimesFormatted = niiObj?.timesFormatted || (niiRawVal != null ? `${niiTimesNum.toFixed(2)}x` : (ipo.status === 'open' ? '0.00x' : '--'));

  // 3. Qualified Institutional (QIB)
  const qibObj = topCats?.qualifiedInstitutional || topCats?.qib;
  const qibApplied = qibObj?.applied != null ? parseNumericShares(qibObj.applied) : null;
  const qibReserved = qibObj?.reserved != null 
    ? parseNumericShares(qibObj.reserved) 
    : (reservation?.qualifiedInstitutional ? parseNumericShares(reservation.qualifiedInstitutional) : null);
  const qibRawVal = qibObj?.times ?? (typeof qibObj === 'number' || (typeof qibObj === 'string' && !isNaN(Number(qibObj))) ? qibObj : null) ?? sub?.qib;
  const qibTimesNum = qibRawVal != null ? (parseNumericShares(qibRawVal) ?? 0) : 0;
  const qibTimesFormatted = qibObj?.timesFormatted || (qibRawVal != null ? `${qibTimesNum.toFixed(2)}x` : (ipo.status === 'open' ? '0.00x' : '--'));

  // 4. Overall
  const overallObj = topCats?.overall;
  const overallApplied = overallObj?.applied != null ? parseNumericShares(overallObj.applied) : null;
  const overallReserved = overallObj?.reserved != null 
    ? parseNumericShares(overallObj.reserved) 
    : ((riiReserved != null && niiReserved != null && qibReserved != null) ? (riiReserved + niiReserved + qibReserved) : null);
  const overallRawVal = overallObj?.times ?? (sub as any)?.overall ?? sub?.total ?? ipo.totalSubscription;
  const overallTimesNum = overallRawVal != null ? (parseNumericShares(overallRawVal) ?? 0) : 0;
  const overallTimesFormatted = overallObj?.timesFormatted || (sub as any)?.overallFormatted || (overallRawVal != null ? `${overallTimesNum.toFixed(2)}x` : (ipo.status === 'open' ? '0.00x' : 'Awaiting Bids'));

  const retailShares = reservation?.retail ? Number(reservation.retail) : 0;
  const niiShares = reservation?.nonInstitutional ? Number(reservation.nonInstitutional) : 0;
  const qibShares = reservation?.qualifiedInstitutional ? Number(reservation.qualifiedInstitutional) : 0;
  const totalReservedShares = retailShares + niiShares + qibShares;

  const getRatingInfo = () => {
    const rec = ipo?.verdict?.recommendation;
    if (rec && rec.trim()) {
      const lower = rec.toLowerCase();
      if (lower.includes('listing gains')) {
        return { stars: '4.5', label: 'Listing Gains', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      }
      if (lower.includes('subscribe')) {
        return { stars: '4.8', label: 'Subscribe', bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' };
      }
      if (lower.includes('may apply')) {
        return { stars: '3.5', label: 'May Apply', bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' };
      }
      if (lower.includes('neutral')) {
        return { stars: '3.0', label: 'Neutral', bg: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30' };
      }
      if (lower.includes('avoid')) {
        return { stars: '1.5', label: 'Avoid', bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30' };
      }
    }
    return { stars: null, label: 'Pending Review', bg: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' };
  };
  const ratingInfo = getRatingInfo();

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back Button & Top Meta */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate('/ipo');
            }
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to IPO Tracker
        </button>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
            ipo.segment === 'sme'
              ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
              : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
          }`}>
            {ipo.segment?.toUpperCase() || 'MAINBOARD'} IPO
          </span>
          {getStatusBadge(ipo.status)}
        </div>
      </div>

      {/* Hero Overview Card */}
      <GlassCard className="p-6 lg:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white">
              {ipo.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2.5 mt-2.5">
              <span className="text-sm font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-md">
                NSE/BSE: {ipo.symbol}
              </span>
              {industry && (
                <span className="inline-flex items-center gap-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-md font-semibold">
                  <Briefcase className="w-3 h-3 text-indigo-500" />
                  {industry}
                </span>
              )}
              {isin && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(isin);
                    setCopiedIsin(true);
                    setTimeout(() => setCopiedIsin(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-mono bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-md transition-all cursor-pointer"
                  title="Click to copy ISIN code"
                >
                  <span>ISIN: {isin}</span>
                  {copiedIsin ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 text-slate-400" />}
                </button>
              )}
              {faceValue != null && (
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Face Value: <strong>₹{faceValue}</strong>
                </span>
              )}
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Lot: <strong>{ipo.lotSize} shares</strong>
              </span>
              {exchanges?.primary && (
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                  {exchanges.primary}
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons: Prospectus & Allotment */}
          <div className="flex flex-wrap items-center gap-3">
            {rhpUrl && (
              <a
                href={rhpUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white transition-all shadow-xs"
              >
                <FileDown className="w-4 h-4 text-rose-500" /> Download Prospectus (RHP)
              </a>
            )}
            {allotmentLinkUrl && (
              <a
                href={allotmentLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 transition-all"
              >
                Check Allotment Status <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Key Offer Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Price Band</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {ipo.priceBand || `₹${ipo.issuePrice}`}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Cutoff: ₹{ipo.issuePrice}</p>
          </div>

          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Min Investment (1 Lot)</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              ₹{minInv.toLocaleString()}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{ipo.lotSize} Shares / Lot</p>
          </div>

          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Issue Size</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {totalIssueSize > 0 ? `₹${totalIssueSize.toLocaleString()} Cr` : '--'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {totalIssueSize > 0 ? `Fresh: ₹${freshIssue.toLocaleString()} Cr${ofsIssue > 0 ? ` • OFS: ₹${ofsIssue.toLocaleString()} Cr` : ''}` : 'Pending RHP filing'}
            </p>
          </div>

          <div className="p-4 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Bidding Dates</p>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mt-1">
              Opens: {formatDate(ipo.timeline?.openDate || ipo.openDate)}
            </p>
            <div className="mt-1 inline-block px-2 py-0.5 rounded font-bold text-xs bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40">
              Closes: {formatDate(ipo.timeline?.closeDate || ipo.closeDate)}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* ============================================================== */}
      {/* GREY MARKET PREMIUM (GMP) & ESTIMATED LISTING GAINS SECTION    */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Listing Performance (if listed) OR GMP Highlights & Est. Price */}
        <div className="lg:col-span-5 space-y-4">
          <GlassCard className="p-6 h-full flex flex-col justify-between">
            {ipo.status === 'listed' ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Listing Performance</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Official listing return on NSE / BSE</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 rounded-full">
                    LISTED
                  </span>
                </div>

                {/* Big Listing Numbers */}
                <div className="p-5 bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-transparent border border-indigo-500/30 rounded-2xl mb-5">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">Listing Price</p>
                      <p className="text-4xl font-black text-slate-900 dark:text-white mt-1">
                        {actualListingPrice != null && actualListingPrice > 0 ? `₹${Number(actualListingPrice).toFixed(2)}` : '--'}
                      </p>
                    </div>
                    <div className="text-right">
                      {actualGainPercent != null ? (
                        <>
                          <span className={`inline-flex items-center gap-1 text-sm font-extrabold px-3 py-1 rounded-full ${
                            actualGainPercent >= 0 ? 'bg-emerald-600 text-white shadow-md' : 'bg-rose-600 text-white shadow-md'
                          }`}>
                            {actualGainPercent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {actualGainFormatted || `${actualGainPercent >= 0 ? '+' : ''}${actualGainPercent.toFixed(2)}%`}
                          </span>
                          {actualGainValue != null && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                              ({actualGainValue >= 0 ? '+' : ''}₹{Math.abs(actualGainValue).toFixed(2)} / share)
                            </p>
                          )}
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">Awaiting Listing Data</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Breakdown Formula: Issue Price vs Listing Price */}
                <div className="space-y-3 bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">IPO Issue Price</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{actualIpoPrice}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Actual Listing Price</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {actualListingPrice != null && actualListingPrice > 0 ? `₹${Number(actualListingPrice).toFixed(2)}` : '--'}
                    </span>
                  </div>
                  {actualGainValue != null && ipo.lotSize && (
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-600 dark:text-slate-400">1-Lot Listing Profit</span>
                      <span className={`font-bold ${actualGainValue >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {actualGainValue >= 0 ? '+' : ''}₹{Math.round(actualGainValue * ipo.lotSize).toLocaleString()} ({ipo.lotSize} shares)
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">Listing Date</span>
                    <span className="text-sm font-black text-slate-800 dark:text-slate-200">
                      {formatDate(ipo.listingDate || ipo.timeline?.listingDate || rawTimeline.listingDay)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Grey Market Premium (GMP)</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Real-time unofficial market sentiment</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 rounded-full">
                    LIVE
                  </span>
                </div>

                {/* Big GMP Numbers */}
                <div className="p-5 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border border-emerald-500/30 rounded-2xl mb-5">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider">Current GMP</p>
                      <p className="text-4xl font-black text-emerald-700 dark:text-emerald-400 mt-1">
                        {gmp > 0 ? `+₹${gmp}` : gmp < 0 ? `-₹${Math.abs(gmp)}` : 'Awaited / At Par'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1 text-sm font-extrabold px-3 py-1 rounded-full ${
                        gmp !== 0 ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {gmp !== 0 && <TrendingUp className="w-4 h-4" />} {gmp !== 0 ? `+${estGain.toFixed(1)}%` : 'At Par (0%)'}
                      </span>
                      <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1">Est. Listing Gain</p>
                    </div>
                  </div>
                </div>

                {/* Breakdown Formula: Cutoff + GMP = Est Listing Price */}
                <div className="space-y-3 bg-slate-50/80 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Issue / Cutoff Price</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{ipo.issuePrice}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Current GMP</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">+₹{gmp}</span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">Estimated Listing Price</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      ₹{estListingPrice.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
              * Note: Grey Market Premium (GMP) is an unofficial indication of market demand before listing and is subject to market volatility.
            </p>
          </GlassCard>
        </div>

        {/* Right: 5-7 Day GMP Trend Chart */}
        <div className="lg:col-span-7">
          <GlassCard className="p-6 h-full flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" /> GMP Trend History (Last 5–7 Days)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Track whether premium demand is increasing or falling</p>
              </div>
              <Badge type="primary">{gmpHistory.length} Days Recorded</Badge>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-56 w-full pt-2">
              {gmpHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gmpHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gmpGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                      tickFormatter={(val) => val.slice(5)}
                    />
                    <YAxis 
                      tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                      unit="₹"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: isDark ? '#0f172a' : '#ffffff', 
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value: any) => [`₹${value}`, 'GMP (Premium)']}
                      labelFormatter={(label) => `Date: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="gmp" 
                      stroke="#10b981" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#gmpGradient)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No historical GMP data recorded yet.
                </div>
              )}
            </div>

            {/* Day-by-day mini grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              {gmpHistory.map((item, index) => (
                <div key={index} className="text-center p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">{item.date.slice(5)}</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">₹{item.gmp}</p>
                  <p className="text-[9px] text-slate-400">+{item.instantGainPercent.toFixed(1)}%</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SUBSCRIPTION STATUS TRACKER & TIMELINE STEPPER                 */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Subscription Tracker */}
        <div className="lg:col-span-7">
          <GlassCard className="p-6 h-full flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-indigo-500" /> Live Subscription Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Category demand based on latest exchange bidding data{latestDateStr ? ` (As of ${latestDateStr})` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-extrabold px-3 py-1 rounded-full border ${
                    overallTimesNum >= 1
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                      : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-500/30'
                  }`}>
                    Overall: {overallTimesFormatted !== '--' ? overallTimesFormatted : (ipo.totalSubscription ? `${ipo.totalSubscription}x` : 'N/A')}
                  </span>
                </div>
              </div>

              {/* Overall Bidding Banner if Applied/Reserved available */}
              {(overallApplied != null || overallReserved != null) && (
                <div className="mb-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Total Applied Bids: </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {overallApplied != null ? overallApplied.toLocaleString() : '--'} shares
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Total Offered: </span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {overallReserved != null ? overallReserved.toLocaleString() : '--'} shares
                    </span>
                  </div>
                  <div className="font-bold text-indigo-600 dark:text-indigo-400">
                    {overallReserved && overallApplied ? `${((overallApplied / overallReserved) * 100).toFixed(1)}% Subscribed` : overallTimesFormatted}
                  </div>
                </div>
              )}

              {/* Category Breakdown Progress Bars */}
              <div className="space-y-4">
                {/* Retail (RII) */}
                <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                  <div className="flex justify-between items-baseline text-sm mb-1.5 font-medium">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Retail Individual Investors (RII)</span>
                      {riiApplied != null && riiReserved != null && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Applied: {riiApplied.toLocaleString()} / Reserved: {riiReserved.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className={`font-black ${riiTimesNum >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-purple-600 dark:text-purple-400'}`}>
                      {riiTimesFormatted}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200/70 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, Math.max(
                          riiReserved && riiApplied ? (riiApplied / riiReserved) * 100 : (riiTimesNum * 100)
                        ))}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                    <span>Retail allocation limit: Up to ₹2,00,000</span>
                    {riiReserved && riiApplied ? (
                      <span>{((riiApplied / riiReserved) * 100).toFixed(1)}% filled</span>
                    ) : (
                      <span>{riiTimesNum > 0 ? `${riiTimesNum}x subscribed` : 'Awaiting bids'}</span>
                    )}
                  </div>
                </div>

                {/* NII / HNI */}
                <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                  <div className="flex justify-between items-baseline text-sm mb-1.5 font-medium">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Non-Institutional Investors (NII / HNI)
                        {sub?.bHni && <span className="text-xs text-slate-500 font-normal ml-1.5">(bHNI: {sub.bHni}x • sHNI: {sub.sHni}x)</span>}
                      </span>
                      {niiApplied != null && niiReserved != null && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Applied: {niiApplied.toLocaleString()} / Reserved: {niiReserved.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className={`font-black ${niiTimesNum >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-teal-600 dark:text-teal-400'}`}>
                      {niiTimesFormatted}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200/70 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, Math.max(
                          niiReserved && niiApplied ? (niiApplied / niiReserved) * 100 : (niiTimesNum * 100)
                        ))}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                    <span>HNI quota: ₹2L to ₹10L (sHNI) &amp; &gt;₹10L (bHNI)</span>
                    {niiReserved && niiApplied ? (
                      <span>{((niiApplied / niiReserved) * 100).toFixed(1)}% filled</span>
                    ) : (
                      <span>{niiTimesNum > 0 ? `${niiTimesNum}x subscribed` : 'Awaiting bids'}</span>
                    )}
                  </div>
                </div>

                {/* QIB */}
                <div className="p-3.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80">
                  <div className="flex justify-between items-baseline text-sm mb-1.5 font-medium">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">Qualified Institutional Buyers (QIB)</span>
                      {qibApplied != null && qibReserved != null && (
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Applied: {qibApplied.toLocaleString()} / Reserved: {qibReserved.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <span className={`font-black ${qibTimesNum >= 1 ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {qibTimesFormatted}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-200/70 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.min(100, Math.max(
                          qibReserved && qibApplied ? (qibApplied / qibReserved) * 100 : (qibTimesNum * 100)
                        ))}%` 
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                    <span>Institutional funds, Mutual funds, Banks</span>
                    {qibReserved && qibApplied ? (
                      <span>{((qibApplied / qibReserved) * 100).toFixed(1)}% filled</span>
                    ) : (
                      <span>{qibTimesNum > 0 ? `${qibTimesNum}x subscribed` : 'Awaiting bids'}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Share Reservation Quotas Section */}
              <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Layers3 className="w-4 h-4 text-indigo-500" /> Share Reservation Quotas (SEBI Offer Structure)
                  </span>
                  {totalReservedShares > 0 ? (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Total Offer: {totalReservedShares.toLocaleString()} shares
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-semibold">
                      Statutory SEBI Quota Allocation
                    </span>
                  )}
                </div>

                {/* Proportional Quota Distribution Bar */}
                {totalReservedShares > 0 && (
                  <div className="h-2.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex mb-3">
                    {retailShares > 0 && (
                      <div 
                        className="h-full bg-purple-500" 
                        style={{ width: `${(retailShares / totalReservedShares) * 100}%` }}
                        title={`Retail: ${((retailShares / totalReservedShares) * 100).toFixed(1)}%`}
                      />
                    )}
                    {niiShares > 0 && (
                      <div 
                        className="h-full bg-teal-500" 
                        style={{ width: `${(niiShares / totalReservedShares) * 100}%` }}
                        title={`NII: ${((niiShares / totalReservedShares) * 100).toFixed(1)}%`}
                      />
                    )}
                    {qibShares > 0 && (
                      <div 
                        className="h-full bg-blue-600" 
                        style={{ width: `${(qibShares / totalReservedShares) * 100}%` }}
                        title={`QIB: ${((qibShares / totalReservedShares) * 100).toFixed(1)}%`}
                      />
                    )}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40 text-center">
                    <p className="text-[10px] text-purple-700 dark:text-purple-300 font-bold uppercase tracking-wider">Retail (RII)</p>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                      {retailShares > 0 ? retailShares.toLocaleString() : '35% – 50%'}
                    </p>
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium">
                      {totalReservedShares > 0 && retailShares > 0 ? `${((retailShares / totalReservedShares) * 100).toFixed(1)}% quota` : 'Max bid ₹2,00,000'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-teal-500/5 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-800/40 text-center">
                    <p className="text-[10px] text-teal-700 dark:text-teal-300 font-bold uppercase tracking-wider">NII / HNI</p>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                      {niiShares > 0 ? niiShares.toLocaleString() : '15%'}
                    </p>
                    <span className="text-[10px] text-teal-600 dark:text-teal-400 font-medium">
                      {totalReservedShares > 0 && niiShares > 0 ? `${((niiShares / totalReservedShares) * 100).toFixed(1)}% quota` : '₹2L – ₹10L+ quota'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-blue-500/5 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 text-center">
                    <p className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase tracking-wider">QIB</p>
                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white mt-0.5">
                      {qibShares > 0 ? qibShares.toLocaleString() : 'Up to 50%'}
                    </p>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      {totalReservedShares > 0 && qibShares > 0 ? `${((qibShares / totalReservedShares) * 100).toFixed(1)}% quota` : 'Institutional quota'}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </GlassCard>
        </div>

        {/* Issue Timeline Schedule */}
        <div className="lg:col-span-5">
          <GlassCard className="p-6 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-500" /> Issue Timeline Schedule
              </h3>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                {timelineSteps.map((step, index) => (
                  <div key={index} className="relative group">
                    <div className="absolute -left-6 top-1 w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{step.label}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold mt-0.5">
                        {formatDate(step.date)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ============================================================== */}
      {/* ROW: OFFICIAL ISSUE REGISTRAR & RESEARCH VERDICT               */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left: Official Issue Registrar */}
        <GlassCard className="p-6 h-full flex flex-col justify-between border-slate-200 dark:border-slate-800 shadow-md">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Official Issue Registrar
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    SEBI registered registrar &amp; allotment processing authority
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                Official RTA
              </span>
            </div>

            {/* Registrar Name Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 mb-3.5">
              <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block mb-1">
                Registrar to the Offer
              </span>
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                {ipo.registrar?.name || 'Registrar to the Offer'}
              </p>
              {ipo.registrar?.contact?.person && (
                <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mt-2">
                  <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>Contact Officer: <strong className="text-slate-900 dark:text-white">{ipo.registrar.contact.person}</strong></span>
                </div>
              )}
            </div>

            {/* Contact Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {ipo.registrar?.contact?.phone ? (
                <a
                  href={`tel:${ipo.registrar.contact.phone.replace(/[^0-9+]/g, '')}`}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  title={ipo.registrar.contact.phone}
                >
                  <Phone className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 block font-medium">Helpline Phone</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{ipo.registrar.contact.phone}</span>
                  </div>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 text-slate-400">
                  <Phone className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  <div className="truncate">
                    <span className="text-[10px] block font-medium">Helpline Phone</span>
                    <span className="italic text-[11px]">Contact via registrar website</span>
                  </div>
                </div>
              )}

              {ipo.registrar?.contact?.email ? (
                <a
                  href={`mailto:${ipo.registrar.contact.email.trim()}`}
                  className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                  title={ipo.registrar.contact.email}
                >
                  <Mail className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div className="truncate">
                    <span className="text-[10px] text-slate-400 block font-medium">Support Email</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">{ipo.registrar.contact.email}</span>
                  </div>
                </a>
              ) : (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50/60 dark:bg-slate-800/20 border border-slate-100 dark:border-slate-800 text-slate-400">
                  <Mail className="w-4 h-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  <div className="truncate">
                    <span className="text-[10px] block font-medium">Support Email</span>
                    <span className="italic text-[11px]">Available on prospectus</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
            {ipo.registrar?.website && (
              <a
                href={ipo.registrar.website}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all"
              >
                Registrar Portal <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            )}
            <a
              href={allotmentLinkUrl || ipo.registrar?.allotmentUrl || ipo.registrar?.website || 'https://linkintime.co.in/initial_offer/public-issues.html'}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-all"
            >
              Check Allotment Status <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </GlassCard>

        {/* Right: Research Verdict & Takeaway */}
        <GlassCard className="p-6 border-slate-200 dark:border-slate-800 shadow-md h-full flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Research Verdict &amp; Takeaway
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Comprehensive analyst stance and strategy
                  </p>
                </div>
              </div>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full border ${ratingInfo.bg}`}>
                {ratingInfo.label}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Analyst Recommendation</span>
                <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">
                  {ipo.verdict?.recommendation || 'Awaiting Issue Review'}
                </span>
              </div>
              <p className="text-xs sm:text-[13px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                {ipo.verdict?.summary ||
                  'Official research verdict and recommendation rating will be published by the equity research desk once detailed DRHP / RHP financials and anchor investor book details are formally finalized.'}
              </p>
            </div>

            {/* Key Lead Managers */}
            {ipo.leadManagers && ipo.leadManagers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Lead Managers (BRLMs)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ipo.leadManagers.map((lm, idx) => (
                    <span key={idx} className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                      {lm}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Research Stance: {ipo.verdict?.recommendation ? 'Independent Evaluation' : 'Pending Filing'}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-300">MoneyLogger Research</span>
          </div>
        </GlassCard>
      </div>

      {/* ============================================================== */}
      {/* COMPANY STRENGTHS & WEAKNESSES + VIDEO ANALYSIS                */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* COLUMN 1: Company Strengths & Weaknesses */}
        <GlassCard className="p-4 sm:p-6 border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between h-full">
          <div>
            {/* Header with Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-500 shrink-0" />
                  <span>Company Strengths &amp; Weaknesses</span>
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Growth drivers vs risk factors to evaluate
                </p>
              </div>

              {/* Tab Switcher Pills */}
              <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 w-fit self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setFactorsTab('strengths')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    factorsTab === 'strengths'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Strengths</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    factorsTab === 'strengths'
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  }`}>
                    {ipo.strengths?.length || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFactorsTab('risks')}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    factorsTab === 'risks'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Weaknesses</span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    factorsTab === 'risks'
                      ? 'bg-white/20 text-white'
                      : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                  }`}>
                    {ipo.risks?.length || 0}
                  </span>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="pt-3 sm:pt-4">
              {factorsTab === 'strengths' ? (
                <div>
                  {ipo.strengths && ipo.strengths.length > 0 ? (
                    <ul className="space-y-2 sm:space-y-2.5">
                      {ipo.strengths.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-normal leading-relaxed">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-6 sm:py-8 text-center text-slate-400 text-xs italic">
                      Key competitive strengths and moat factors will be populated upon research issuance.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {ipo.risks && ipo.risks.length > 0 ? (
                    <ul className="space-y-2 sm:space-y-2.5">
                      {ipo.risks.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-2.5">
                          <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-[13px] text-slate-700 dark:text-slate-300 font-normal leading-relaxed">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="py-6 sm:py-8 text-center text-slate-400 text-xs italic">
                      Key risk factors and vulnerabilities will be updated upon comprehensive prospectus review.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </GlassCard>

        {/* COLUMN 2: Embedded YouTube Video Analysis */}
        {(() => {
          const videoUrl = getResolvedVideoUrl(ipo);
          const videoId = getYouTubeVideoId(videoUrl);
          const embedUrl = videoId ? getYouTubeEmbedUrl(videoUrl) : null;
          const cinemaEmbedUrl = videoId ? getYouTubeEmbedUrl(videoUrl, true) : null;
          const watchUrl = videoId
            ? `https://www.youtube.com/watch?v=${videoId}`
            : (videoUrl.startsWith('http') ? videoUrl : `https://${videoUrl}`);

          return (
            <GlassCard className="p-4 sm:p-6 border-slate-200 dark:border-slate-800 shadow-md flex flex-col justify-between h-full">
              <div className="h-full flex flex-col">
                {/* Responsive Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 pb-3 sm:pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-1.5 sm:p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 shrink-0">
                      <Video className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                        <span>IPO Video Analysis</span>
                        {embedUrl && (
                          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 sm:px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                            YouTube
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        In-depth video review, valuation &amp; strategy
                      </p>
                    </div>
                  </div>

                  {embedUrl && (
                    <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 flex-wrap">
                      {/* Open in YouTube New Tab Button */}
                      <a
                        href={watchUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsPlayingVideo(false)}
                        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/60 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition-all shadow-xs cursor-pointer active:scale-95"
                        title="Open video in a new tab on YouTube"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>YouTube</span>
                      </a>

                      {/* Fullscreen Cinema Mode Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsPlayingVideo(false);
                          setIsCinemaOpen(true);
                        }}
                        className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all shadow-xs active:scale-95 cursor-pointer"
                        title="Watch in Fullscreen Cinema Overlay"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Cinema</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Video Container or Empty State Message */}
                <div className="pt-3 sm:pt-4 flex-1 flex flex-col justify-center">
                  {embedUrl && videoId ? (
                    <div className="relative aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden bg-slate-950 shadow-inner group border border-slate-200 dark:border-slate-800">
                      {isPlayingVideo ? (
                        <iframe
                          src={`${embedUrl}&autoplay=1`}
                          title={`${ipo.name} Video Analysis`}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          className="absolute inset-0 w-full h-full border-0"
                        />
                      ) : (
                        <div
                          onClick={() => setIsPlayingVideo(true)}
                          className="absolute inset-0 w-full h-full cursor-pointer overflow-hidden flex items-center justify-center select-none"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setIsPlayingVideo(true);
                            }
                          }}
                          aria-label="Play YouTube Video Analysis"
                        >
                          {/* YouTube Video Thumbnail Cover */}
                          <img
                            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                            alt={`${ipo.name} Video Thumbnail`}
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 filter brightness-90 group-hover:brightness-95"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/0.jpg`;
                            }}
                          />
                          {/* Backdrop Overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30 group-hover:via-black/20 transition-colors" />

                          {/* Responsive Click to Play Button */}
                          <div className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2">
                            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-rose-600 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-xl sm:shadow-2xl shadow-rose-600/50 transform transition-all duration-300 group-hover:scale-110 active:scale-95">
                              <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current translate-x-0.5" />
                            </div>
                            <span className="text-[10px] sm:text-xs font-semibold text-white drop-shadow-md bg-black/60 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full backdrop-blur-sm border border-white/10 group-hover:bg-black/80 transition-colors">
                              Click to Play Video
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Proper informative message if link is not available */
                    <div className="flex flex-col items-center justify-center text-center p-4 sm:p-8 rounded-xl sm:rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 min-h-[170px] sm:min-h-[220px]">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 text-rose-500 flex items-center justify-center mb-2.5 sm:mb-3">
                        <Video className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                        No Video Analysis Available
                      </h4>
                      <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 leading-relaxed">
                        A video review or analysis link hasn't been added for this IPO yet. You can paste a YouTube URL from the Admin panel to display it here.
                      </p>
                      <div className="mt-3 sm:mt-4 px-2.5 sm:px-3 py-1 rounded-full bg-slate-200/60 dark:bg-slate-800 text-[10px] sm:text-[11px] font-medium text-slate-600 dark:text-slate-400">
                        Admin &gt; Advantages &amp; Risks &gt; YouTube Analysis Video Link
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Fullscreen Cinema Backdrop Overlay */}
              {isCinemaOpen && cinemaEmbedUrl && (
                <div
                  className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-6"
                  onClick={() => setIsCinemaOpen(false)}
                >
                  <div
                    className="relative w-full max-w-4xl bg-slate-900 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between p-2.5 sm:p-3.5 bg-slate-950/80 border-b border-slate-800 text-white gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-xs font-semibold min-w-0">
                        <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 fill-current shrink-0" />
                        <span className="truncate max-w-[140px] sm:max-w-md">{ipo.name} — Video Analysis</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                        <a
                          href={watchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => {
                            setIsPlayingVideo(false);
                            setIsCinemaOpen(false);
                          }}
                          className="flex items-center gap-1 text-[11px] sm:text-xs text-slate-300 hover:text-white px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden xs:inline">Open in YouTube</span>
                          <span className="xs:hidden">YouTube</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => setIsCinemaOpen(false)}
                          className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="relative aspect-video w-full bg-black">
                      <iframe
                        src={cinemaEmbedUrl}
                        title={`${ipo.name} Video Cinema`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        className="absolute inset-0 w-full h-full border-0"
                      />
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })()}
      </div>

      {/* ============================================================== */}
      {/* RETAIL & HNI APPLICATION LOT CALCULATOR                        */}
      {/* ============================================================== */}
      <GlassCard className="p-5 sm:p-6 border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Retail &amp; HNI Bid Lot Calculator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Live calculator for Retail (RII), Small HNI (sHNI), and Big HNI (bHNI) application quotas
              </p>
            </div>
          </div>

          {/* Interactive Category Selector Pills */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => handleCategorySwitch('retail')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                bidCategory === 'retail'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400'
              }`}
            >
              Retail (RII)
            </button>
            <button
              type="button"
              onClick={() => handleCategorySwitch('sHNI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                bidCategory === 'sHNI'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400'
              }`}
            >
              Small HNI (sHNI)
            </button>
            <button
              type="button"
              onClick={() => handleCategorySwitch('bHNI')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                bidCategory === 'bHNI'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400'
              }`}
            >
              Big HNI (bHNI)
            </button>
          </div>
        </div>

        {/* SEBI Quota & Allotment Rule Guide Banner */}
        <div className={`mt-4 p-3 rounded-xl text-xs font-medium border flex items-center justify-between gap-3 ${
          bidCategory === 'retail'
            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/50'
            : bidCategory === 'sHNI'
            ? 'bg-amber-50/70 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800/50'
            : 'bg-purple-50/70 dark:bg-purple-950/30 text-purple-800 dark:text-purple-200 border-purple-200 dark:border-purple-800/50'
        }`}>
          <div>
            <span className="font-bold">
              {bidCategory === 'retail'
                ? 'Retail Individual Investor (RII):'
                : bidCategory === 'sHNI'
                ? 'Small HNI (sHNI / NII ₹2L–₹10L):'
                : 'Big HNI (bHNI / NII > ₹10L):'}
            </span>{' '}
            {bidCategory === 'retail'
              ? `Max application amount is ₹2,00,000 (1 to ${maxRetailLots} Lots). Allotment is lottery based (1 minimum lot) if oversubscribed.`
              : bidCategory === 'sHNI'
              ? `Application between ₹2,00,001 and ₹10,00,000 (${minShniLots} to ${maxShniLots} Lots). Reserved 1/3rd (33.3%) of NII quota. Allotment is lottery based (1 min sHNI lot).`
              : `Application above ₹10,00,000 (Min ${minBhniLots} Lots). Reserved 2/3rds (66.7%) of NII quota. Allotment is strictly proportionate based on subscription.`}
          </div>
          <span className="shrink-0 font-bold px-2 py-0.5 rounded-full text-[10px] bg-white/70 dark:bg-black/30">
            {bidCategory === 'retail' ? '≤ ₹2 Lakhs' : bidCategory === 'sHNI' ? '₹2L – ₹10L' : '> ₹10 Lakhs'}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4">
          {/* Controls: Stepper & Category-Specific Presets */}
          <div className="lg:col-span-5 space-y-3">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-between">
              <span>Number of Application Lots</span>
              <span className="text-[11px] text-slate-400">
                Range: {bidCategory === 'retail' ? `1 – ${maxRetailLots}` : bidCategory === 'sHNI' ? `${minShniLots} – ${maxShniLots}` : `${minBhniLots}+`} Lots
              </span>
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleStepLots(-1)}
                disabled={
                  (bidCategory === 'retail' && selectedLots <= 1) ||
                  (bidCategory === 'sHNI' && selectedLots <= minShniLots) ||
                  (bidCategory === 'bHNI' && selectedLots <= minBhniLots)
                }
                className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer"
                aria-label="Decrease lots"
              >
                <Minus className="w-4 h-4" />
              </button>
              <div className="flex-1 text-center py-2 px-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <span className="text-xl font-black text-slate-900 dark:text-white">{selectedLots}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 ml-1.5">{selectedLots === 1 ? 'Lot' : 'Lots'}</span>
              </div>
              <button
                type="button"
                onClick={() => handleStepLots(1)}
                disabled={
                  (bidCategory === 'retail' && selectedLots >= maxRetailLots) ||
                  (bidCategory === 'sHNI' && selectedLots >= maxShniLots)
                }
                className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center justify-center transition-all disabled:opacity-40 cursor-pointer"
                aria-label="Increase lots"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Dynamic Quick Presets Tailored to Active Category */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {bidCategory === 'retail' && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedLots(1)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedLots === 1
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    1 Lot (Min)
                  </button>
                  {maxRetailLots >= 2 && (
                    <button
                      type="button"
                      onClick={() => setSelectedLots(2)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedLots === 2
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      2 Lots
                    </button>
                  )}
                  {maxRetailLots >= 5 && (
                    <button
                      type="button"
                      onClick={() => setSelectedLots(5)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedLots === 5
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      5 Lots
                    </button>
                  )}
                  {maxRetailLots > 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedLots(maxRetailLots)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedLots === maxRetailLots
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      Max Retail ({maxRetailLots} Lots)
                    </button>
                  )}
                </>
              )}

              {bidCategory === 'sHNI' && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedLots(minShniLots)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedLots === minShniLots
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Min sHNI ({minShniLots} Lots)
                  </button>
                  {maxShniLots > minShniLots && (
                    <button
                      type="button"
                      onClick={() => setSelectedLots(Math.round((minShniLots + maxShniLots) / 2))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedLots === Math.round((minShniLots + maxShniLots) / 2)
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      Mid sHNI ({Math.round((minShniLots + maxShniLots) / 2)} Lots)
                    </button>
                  )}
                  {maxShniLots > minShniLots && (
                    <button
                      type="button"
                      onClick={() => setSelectedLots(maxShniLots)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedLots === maxShniLots
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      Max sHNI ({maxShniLots} Lots)
                    </button>
                  )}
                </>
              )}

              {bidCategory === 'bHNI' && (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedLots(minBhniLots)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedLots === minBhniLots
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    Min bHNI ({minBhniLots} Lots)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLots(minBhniLots + 5)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedLots === minBhniLots + 5
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {minBhniLots + 5} Lots
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLots(minBhniLots + 10)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedLots === minBhniLots + 10
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {minBhniLots + 10} Lots
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLots(minBhniLots + 25)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selectedLots === minBhniLots + 25
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    {minBhniLots + 25} Lots
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Computed Results Cards */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Shares</span>
              <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {totalShares.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400">
                {selectedLots} × {ipo.lotSize || 1} shares
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Bidding Amount</span>
              <p className={`text-lg font-black mt-0.5 ${
                bidCategory === 'retail'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : bidCategory === 'sHNI'
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-purple-600 dark:text-purple-400'
              }`}>
                ₹{totalInvestment.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400">
                Cutoff @ ₹{ipo.issuePrice}
              </span>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Est. Listing Gain (GMP)</span>
              <p className={`text-lg font-black mt-0.5 ${totalEstListingGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {totalEstListingGain >= 0 ? '+' : ''}₹{totalEstListingGain.toLocaleString()}
              </p>
              <span className="text-[10px] text-slate-400">
                {gmp !== 0 ? `Est. ₹${totalEstListingValue.toLocaleString()}` : 'GMP At Par'}
              </span>
            </div>
          </div>
        </div>
      </GlassCard>



      {/* ============================================================== */}
      {/* FINANCIALS & VALUATION                                         */}
      {/* ============================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Financial Performance Table & Groww-style Chart */}
        <div className="lg:col-span-8">
          <GlassCard className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-500" /> Financial Performance (₹ in Crores)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Historical revenue, net profit, and total assets / net worth
                </p>
              </div>

              {/* Groww-style Metric Switcher: Revenue | Profit | Total Assets */}
              {ipo.financials && ipo.financials.length > 0 && (
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-xl border border-slate-200 dark:border-slate-700/80 shrink-0">
                  <button
                    type="button"
                    onClick={() => setFinancialMetric('revenue')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      financialMetric === 'revenue'
                        ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Revenue
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinancialMetric('pat')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      financialMetric === 'pat'
                        ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Profit (PAT)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFinancialMetric('netWorth')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      financialMetric === 'netWorth'
                        ? 'bg-white dark:bg-sky-600 text-sky-600 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Total Assets
                  </button>
                </div>
              )}
            </div>

            {ipo.financials && ipo.financials.length > 0 ? (
              <div className="space-y-6">
                {/* Groww-style Column Bar Chart */}
                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ipo.financials} margin={{ top: 15, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#e2e8f0'} />
                      <XAxis
                        dataKey="period"
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12, fontWeight: 600 }}
                      />
                      <YAxis
                        tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
                        unit=" Cr"
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: isDark ? '#0f172a' : '#ffffff',
                          borderColor: isDark ? '#334155' : '#e2e8f0',
                          borderRadius: '0.75rem',
                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                        }}
                        formatter={(value: any) => [
                          `₹${Number(value).toLocaleString()} Cr`,
                          financialMetric === 'revenue'
                            ? 'Revenue'
                            : financialMetric === 'pat'
                            ? 'Profit After Tax (PAT)'
                            : 'Total Assets / Net Worth',
                        ]}
                        labelFormatter={(label) => `Period: ${label}`}
                      />
                      <Bar
                        dataKey={financialMetric}
                        radius={[6, 6, 0, 0]}
                        maxBarSize={48}
                      >
                        {ipo.financials.map((entry, index) => {
                          const barColor =
                            financialMetric === 'revenue'
                              ? '#6366f1'
                              : financialMetric === 'pat'
                              ? entry.pat < 0
                                ? '#f43f5e'
                                : '#10b981'
                              : '#0284c7';
                          return <Cell key={`cell-${index}`} fill={barColor} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Detailed Financial Breakdown Table */}
                <div className="overflow-x-auto pt-2 border-t border-slate-200 dark:border-slate-800">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        <th className="py-2.5 px-3">Period</th>
                        <th className="py-2.5 px-3 text-right">Revenue</th>
                        <th className="py-2.5 px-3 text-right">Profit After Tax (PAT)</th>
                        <th className="py-2.5 px-3 text-right">Total Assets / Net Worth</th>
                        <th className="py-2.5 px-3 text-right">Borrowings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                      {ipo.financials.map((fin, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{fin.period}</td>
                          <td className="py-3 px-3 text-right text-slate-800 dark:text-slate-200">₹{fin.revenue.toLocaleString()} Cr</td>
                          <td className={`py-3 px-3 text-right font-bold ${fin.pat >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            ₹{fin.pat.toLocaleString()} Cr
                          </td>
                          <td className="py-3 px-3 text-right text-slate-800 dark:text-slate-200">₹{fin.netWorth.toLocaleString()} Cr</td>
                          <td className="py-3 px-3 text-right text-slate-500 dark:text-slate-400">
                            {fin.borrowing ? `₹${fin.borrowing.toLocaleString()} Cr` : '--'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Financial data will be published upon RHP release.</p>
            )}
          </GlassCard>
        </div>

        {/* Valuation & Key Multiples */}
        <div className="lg:col-span-4">
          <GlassCard className="p-6 h-full flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-indigo-500" /> Valuation & Multiples
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Key valuation ratios</p>

              <div className="space-y-3">
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">P/E Ratio</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{ipo.valuation?.peRatio ? `${ipo.valuation.peRatio}x` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">EPS (Earnings / Share)</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{ipo.valuation?.eps ? `₹${ipo.valuation.eps}` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">RoNW (Return on Net Worth)</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{ipo.valuation?.ronw ? `${ipo.valuation.ronw}%` : 'N/A'}</span>
                </div>
                <div className="flex justify-between items-center p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                  <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">Estimated Market Cap</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    {ipo.valuation?.marketCap ? `₹${ipo.valuation.marketCap.toLocaleString()} Cr` : '--'}
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* ============================================================== */}
      {/* COMPANY ABOUT & OBJECTS OF ISSUE                               */}
      {/* ============================================================== */}
      <GlassCard className="p-6">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-500" /> About {ipo.name}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">
          {ipo.about || 'Details regarding business model and operations will be available in the prospectus.'}
        </p>

        {ipo.objectsOfIssue && ipo.objectsOfIssue.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-indigo-500" /> Objects of the Issue (Fund Utilization):
            </h4>
            <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
              {ipo.objectsOfIssue.map((obj, i) => (
                <li key={i}>{obj}</li>
              ))}
            </ul>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default IPODetail;
