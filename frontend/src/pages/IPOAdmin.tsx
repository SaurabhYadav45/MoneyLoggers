import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Zap, 
  ExternalLink,
  Search,
  Building2,
  Calendar,
  Sparkles,
  X,
  Save,
  Loader2,
  Lock,
  Unlock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  BarChart3,
  PieChart,
  TrendingUp,
  RefreshCw,
  Video,
  FileText,
  Users
} from 'lucide-react';
import type { IPO } from '../types';
import { getIPOs, getIPOById, createIPO, updateIPO, deleteIPO, updateIPOGmp, verifyAdminPasscode, syncIPOs, sortIPOsByLatest } from '../services/ipoService';
import { syncMutualFunds } from '../services/mutualFundService';
import GlassCard from '../components/ui/GlassCard';
import Button from '../components/ui/Button';
import UpstoxSessionCard from '../components/admin/UpstoxSessionCard';

const IPOAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('open');
  const [segmentFilter, setSegmentFilter] = useState('all');
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingIpo, setEditingIpo] = useState<Partial<IPO> | null>(null);
  const [activeTab, setActiveTab] = useState<'basics' | 'timeline' | 'proscons' | 'gmp' | 'financials'>('basics');
  
  // Quick GMP Modal State
  const [isGmpModalOpen, setIsGmpModalOpen] = useState(false);
  const [gmpTargetIpo, setGmpTargetIpo] = useState<IPO | null>(null);
  const [quickGmpValue, setQuickGmpValue] = useState<number>(0);

  // Temporary state for adding strength/risk bullet points
  const [newStrengthInput, setNewStrengthInput] = useState('');
  const [newRiskInput, setNewRiskInput] = useState('');

  // Temporary state for adding Objects of the Issue & Lead Managers
  const [newObjectInput, setNewObjectInput] = useState('');
  const [newLeadManagerInput, setNewLeadManagerInput] = useState('');

  // Temporary state for adding GMP history points
  const [newGmpDate, setNewGmpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newGmpPrice, setNewGmpPrice] = useState<number | ''>('');

  // Temporary state for adding financial year records
  const [newFinPeriod, setNewFinPeriod] = useState('FY26');
  const [newFinRev, setNewFinRev] = useState<number | ''>('');
  const [newFinPat, setNewFinPat] = useState<number | ''>('');
  const [newFinNetWorth, setNewFinNetWorth] = useState<number | ''>('');
  const [newFinBorrowing, setNewFinBorrowing] = useState<number | ''>('');

  // Input helpers to prevent stuck '0' values and allow clean clearing / overwriting
  const numVal = (val: any) => {
    if (val === undefined || val === null || val === '') return '';
    return val;
  };

  const handleNumFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (e.target.value === '0') {
      e.target.select();
    }
  };

  const toNum = (val: any, fallback = 0) => {
    if (val === '' || val === null || val === undefined || isNaN(Number(val))) return fallback;
    return Number(val);
  };

  const optNum = (val: any): number | undefined => {
    if (val === '' || val === null || val === undefined || isNaN(Number(val))) return undefined;
    return Number(val);
  };

  // Syncing state
  const [syncingApi, setSyncingApi] = useState(false);
  const [syncingMf, setSyncingMf] = useState(false);

  // Delete confirmation
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Security Passcode Protection
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return Boolean(sessionStorage.getItem('moneylogger_admin_key'));
  });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);

  const handleUnlockConsole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcodeInput.trim()) {
      setUnlockError('Please enter the Admin Security Passcode');
      return;
    }

    setUnlockLoading(true);
    setUnlockError(null);
    const res = await verifyAdminPasscode(passcodeInput.trim());
    setUnlockLoading(false);

    if (res.success) {
      setIsUnlocked(true);
      setPasscodeInput('');
      showNotification('success', 'Admin Console Unlocked');
      loadData();
    } else {
      setUnlockError(res.message || 'Invalid passcode. Access Denied.');
    }
  };

  const handleLockConsole = () => {
    sessionStorage.removeItem('moneylogger_admin_key');
    setIsUnlocked(false);
    showNotification('success', 'Admin Console Locked');
  };

  const loadData = async (forceSkipCache = false) => {
    try {
      setLoading(true);
      const data = await getIPOs({
        status: statusFilter,
        segment: segmentFilter,
        search,
      }, { skipCache: forceSkipCache });
      setIpos(sortIPOsByLatest(data, statusFilter));
    } catch (err) {
      console.error('Error loading IPOs in Admin:', err);
      showNotification('error', 'Failed to fetch IPOs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      loadData();
    }
  }, [statusFilter, segmentFilter, search, isUnlocked]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Open Editor for Creating
  const handleOpenCreate = () => {
    const today = new Date().toISOString().split('T')[0];
    setEditingIpo({
      name: '',
      symbol: '',
      segment: 'mainboard',
      status: 'upcoming',
      issuePrice: 100,
      priceRange: { min: 95, max: 100 },
      priceBand: '₹95 - ₹100',
      lotSize: 100,
      minInvestment: 10000,
      issueSize: { total: 500, fresh: 400, ofs: 100 },
      timeline: {
        openDate: today,
        closeDate: today,
        allotmentDate: today,
        refundsDate: today,
        creditDate: today,
        listingDate: today,
        anchorDate: '',
      },
      gmpData: {
        currentGmp: 0,
        estimatedListingPrice: 100,
        estimatedGainPercent: 0,
        updatedAt: new Date().toISOString(),
        history: [{ date: today, gmp: 0, instantGainPercent: 0 }],
      },
      subscription: {
        qib: 0,
        nii: 0,
        bHni: 0,
        sHni: 0,
        rii: 0,
        employee: 0,
        total: 0,
      },
      financials: [],
      valuation: {},
      strengths: [],
      risks: [],
      objectsOfIssue: [],
      leadManagers: [],
      verdict: {
        recommendation: 'Subscribe for Long Term',
        summary: '',
      },
      about: '',
      youtubeVideoUrl: '',
      registrar: {
        name: 'Link Intime India Private Limited',
        website: 'https://linkintime.co.in',
        allotmentUrl: 'https://linkintime.co.in/initial_offer/public-issues.html',
      },
    });
    setActiveTab('basics');
    setIsEditorOpen(true);
  };

  // Open Editor for Editing (Pre-populates all previously saved data)
  const handleOpenEdit = async (ipo: IPO) => {
    // 1. Immediately clone row data so modal opens without lag
    const clone = JSON.parse(JSON.stringify(ipo));
    setEditingIpo(clone);
    setActiveTab('basics');
    setIsEditorOpen(true);

    // 2. Fetch full detail from backend (bypass cache) to ensure all detailed objects (registrar contacts, video link, verdict, etc.) are 100% prefilled
    try {
      const fullDetail = await getIPOById(ipo.id || ipo.symbol, { skipCache: true });
      if (fullDetail) {
        setEditingIpo((prev) => {
          if (!prev || (prev.id !== ipo.id && prev.symbol !== ipo.symbol)) return prev;
          return {
            ...fullDetail,
            ...prev,
            // Ensure deep objects preserve any saved properties
            youtubeVideoUrl: fullDetail.youtubeVideoUrl || prev.youtubeVideoUrl || '',
            registrar: {
              ...(fullDetail.registrar || {}),
              ...(prev.registrar || {}),
              contact: {
                ...(fullDetail.registrar?.contact || {}),
                ...(prev.registrar?.contact || {}),
              },
            },
            timeline: {
              ...(fullDetail.timeline || {}),
              ...(prev.timeline || {}),
            },
            gmpData: {
              ...(fullDetail.gmpData || {}),
              ...(prev.gmpData || {}),
            },
            subscription: {
              ...(fullDetail.subscription || {}),
              ...(prev.subscription || {}),
            },
            valuation: {
              ...(fullDetail.valuation || {}),
              ...(prev.valuation || {}),
            },
            financials: (fullDetail.financials && fullDetail.financials.length > 0) ? fullDetail.financials : (prev.financials || []),
            strengths: (fullDetail.strengths && fullDetail.strengths.length > 0) ? fullDetail.strengths : (prev.strengths || []),
            risks: (fullDetail.risks && fullDetail.risks.length > 0) ? fullDetail.risks : (prev.risks || []),
            objectsOfIssue: (fullDetail.objectsOfIssue && fullDetail.objectsOfIssue.length > 0) ? fullDetail.objectsOfIssue : (prev.objectsOfIssue || []),
            leadManagers: (fullDetail.leadManagers && fullDetail.leadManagers.length > 0) ? fullDetail.leadManagers : (prev.leadManagers || []),
          } as Partial<IPO>;
        });
      }
    } catch (err) {
      console.warn('Could not fetch single IPO detail in admin edit, relying on row data:', err);
    }
  };

  // Save IPO (Create or Update)
  const handleSaveIPO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIpo || !editingIpo.name || !editingIpo.symbol) {
      showNotification('error', 'Company name and symbol are required');
      return;
    }

    const issuePrice = toNum(editingIpo.issuePrice, 100);
    const lotSize = toNum(editingIpo.lotSize, 100);
    const minInvestment = toNum(editingIpo.minInvestment, issuePrice * lotSize);
    const totalSize = toNum(typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.total : editingIpo.issueSize, 0);
    const freshSize = toNum(typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.fresh : totalSize, totalSize);
    const ofsSize = toNum(typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.ofs : 0, 0);
    const currentGmp = toNum(editingIpo.gmpData?.currentGmp, 0);
    const estListingPrice = issuePrice + currentGmp;
    const estGainPct = issuePrice > 0 ? Number(((currentGmp / issuePrice) * 100).toFixed(2)) : 0;

    const sanitizedIpo: Partial<IPO> = {
      ...editingIpo,
      youtubeVideoUrl: editingIpo.youtubeVideoUrl?.trim() || '',
      issuePrice,
      lotSize,
      minInvestment,
      priceRange: {
        min: toNum(editingIpo.priceRange?.min, issuePrice),
        max: toNum(editingIpo.priceRange?.max, issuePrice),
      },
      issueSize: {
        total: totalSize,
        fresh: freshSize,
        ofs: ofsSize,
      },
      timeline: {
        openDate: editingIpo.timeline?.openDate || '',
        closeDate: editingIpo.timeline?.closeDate || '',
        allotmentDate: editingIpo.timeline?.allotmentDate || '',
        refundsDate: editingIpo.timeline?.refundsDate || '',
        creditDate: editingIpo.timeline?.creditDate || '',
        listingDate: editingIpo.timeline?.listingDate || '',
        anchorDate: editingIpo.timeline?.anchorDate || undefined,
      },
      gmpData: {
        ...(editingIpo.gmpData || ({} as any)),
        currentGmp,
        estimatedListingPrice: estListingPrice,
        estimatedGainPercent: estGainPct,
        updatedAt: new Date().toISOString(),
        history: editingIpo.gmpData?.history || [],
      },
      subscription: {
        qib: toNum(editingIpo.subscription?.qib, 0),
        nii: toNum(editingIpo.subscription?.nii, 0),
        bHni: optNum(editingIpo.subscription?.bHni),
        sHni: optNum(editingIpo.subscription?.sHni),
        rii: toNum(editingIpo.subscription?.rii, 0),
        employee: optNum(editingIpo.subscription?.employee),
        total: toNum(editingIpo.subscription?.total, 0),
      },
      valuation: {
        peRatio: optNum(editingIpo.valuation?.peRatio),
        postPeRatio: optNum(editingIpo.valuation?.postPeRatio),
        eps: optNum(editingIpo.valuation?.eps),
        ronw: optNum(editingIpo.valuation?.ronw),
        marketCap: optNum(editingIpo.valuation?.marketCap),
      },
      registrar: {
        name: editingIpo.registrar?.name || '',
        website: editingIpo.registrar?.website || '',
        allotmentUrl: editingIpo.registrar?.allotmentUrl || '',
        contact: {
          person: editingIpo.registrar?.contact?.person || '',
          phone: editingIpo.registrar?.contact?.phone || '',
          email: editingIpo.registrar?.contact?.email || '',
        },
      },
      objectsOfIssue: editingIpo.objectsOfIssue || [],
      leadManagers: editingIpo.leadManagers || [],
      strengths: editingIpo.strengths || [],
      risks: editingIpo.risks || [],
      financials: editingIpo.financials || [],
    };

    try {
      if (sanitizedIpo.id) {
        await updateIPO(sanitizedIpo.id, sanitizedIpo);
        showNotification('success', `Updated "${sanitizedIpo.name}" successfully`);
      } else {
        await createIPO(sanitizedIpo);
        showNotification('success', `Created "${sanitizedIpo.name}" successfully`);
      }
      setIsEditorOpen(false);
      loadData(true);
    } catch (err: any) {
      console.error('Error saving IPO:', err);
      showNotification('error', err.message || 'Failed to save IPO');
    }
  };

  // Quick GMP Modal Open
  const handleOpenQuickGmp = (ipo: IPO) => {
    setGmpTargetIpo(ipo);
    setQuickGmpValue(ipo.gmpData?.currentGmp || 0);
    setIsGmpModalOpen(true);
  };

  // Submit Quick GMP
  const handleSaveQuickGmp = async () => {
    if (!gmpTargetIpo) return;
    try {
      const gmp = toNum(quickGmpValue, 0);
      await updateIPOGmp(gmpTargetIpo.id, gmp);
      showNotification('success', `Updated GMP for ${gmpTargetIpo.symbol} to ₹${gmp}`);
      setIsGmpModalOpen(false);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update GMP');
    }
  };

  // Quick Status Change directly from table
  const handleQuickStatusChange = async (ipo: IPO, newStatus: any) => {
    try {
      await updateIPO(ipo.id, { status: newStatus });
      showNotification('success', `Status updated to ${newStatus.toUpperCase()}`);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to update status');
    }
  };

  // Delete IPO
  const handleConfirmDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteIPO(deleteTargetId);
      showNotification('success', 'IPO removed successfully');
      setDeleteTargetId(null);
      loadData();
    } catch (err: any) {
      showNotification('error', err.message || 'Failed to delete IPO');
    }
  };

  // Dynamic Strengths (Advantages) helpers
  const handleAddStrength = () => {
    if (!newStrengthInput.trim() || !editingIpo) return;
    const current = editingIpo.strengths || [];
    setEditingIpo({
      ...editingIpo,
      strengths: [...current, newStrengthInput.trim()],
    });
    setNewStrengthInput('');
  };

  const handleRemoveStrength = (index: number) => {
    if (!editingIpo) return;
    const current = [...(editingIpo.strengths || [])];
    current.splice(index, 1);
    setEditingIpo({ ...editingIpo, strengths: current });
  };

  // Dynamic Risks (Cons) helpers
  const handleAddRisk = () => {
    if (!newRiskInput.trim() || !editingIpo) return;
    const current = editingIpo.risks || [];
    setEditingIpo({
      ...editingIpo,
      risks: [...current, newRiskInput.trim()],
    });
    setNewRiskInput('');
  };

  const handleRemoveRisk = (index: number) => {
    if (!editingIpo) return;
    const current = [...(editingIpo.risks || [])];
    current.splice(index, 1);
    setEditingIpo({ ...editingIpo, risks: current });
  };

  // Dynamic Objects of Issue helpers
  const handleAddObjectOfIssue = () => {
    if (!newObjectInput.trim() || !editingIpo) return;
    const current = editingIpo.objectsOfIssue || [];
    setEditingIpo({
      ...editingIpo,
      objectsOfIssue: [...current, newObjectInput.trim()],
    });
    setNewObjectInput('');
  };

  const handleRemoveObjectOfIssue = (index: number) => {
    if (!editingIpo) return;
    const current = [...(editingIpo.objectsOfIssue || [])];
    current.splice(index, 1);
    setEditingIpo({ ...editingIpo, objectsOfIssue: current });
  };

  // Dynamic Lead Managers helpers
  const handleAddLeadManager = () => {
    if (!newLeadManagerInput.trim() || !editingIpo) return;
    const current = editingIpo.leadManagers || [];
    setEditingIpo({
      ...editingIpo,
      leadManagers: [...current, newLeadManagerInput.trim()],
    });
    setNewLeadManagerInput('');
  };

  const handleRemoveLeadManager = (index: number) => {
    if (!editingIpo) return;
    const current = [...(editingIpo.leadManagers || [])];
    current.splice(index, 1);
    setEditingIpo({ ...editingIpo, leadManagers: current });
  };

  // Sync with IndianAPI
  const handleSyncFromAPI = async () => {
    try {
      setSyncingApi(true);
      const res = await syncIPOs();
      setIpos(sortIPOsByLatest(res, statusFilter));
      showNotification('success', `Synced ${res.length} IPOs successfully from live IndianAPI`);
    } catch (err: any) {
      console.error('Sync failed:', err);
      showNotification('error', err.message || 'Failed to sync with IndianAPI');
    } finally {
      setSyncingApi(false);
    }
  };

  // Sync Mutual Funds with IndianAPI
  const handleSyncMutualFunds = async () => {
    try {
      setSyncingMf(true);
      const res = await syncMutualFunds();
      const count = res.data?.updated || res.data?.total || 249;
      showNotification('success', `Synced ${count} Mutual Funds successfully from IndianAPI into database!`);
    } catch (err: any) {
      console.error('Mutual funds sync failed:', err);
      showNotification('error', err.response?.data?.message || err.message || 'Failed to sync mutual funds with IndianAPI');
    } finally {
      setSyncingMf(false);
    }
  };

  // GMP History Helpers
  const handleAddGmpHistory = () => {
    if (newGmpPrice === '' || isNaN(Number(newGmpPrice)) || !editingIpo) {
      showNotification('error', 'Please enter a valid GMP price');
      return;
    }
    const gmpVal = Number(newGmpPrice);
    const issue = editingIpo.issuePrice || (editingIpo.priceRange?.max || 100);
    const instantGain = issue > 0 ? Number(((gmpVal / issue) * 100).toFixed(2)) : 0;
    const existingHistory = [...(editingIpo.gmpData?.history || [])];

    const existingIdx = existingHistory.findIndex(h => h.date === newGmpDate);
    if (existingIdx >= 0) {
      existingHistory[existingIdx] = { date: newGmpDate, gmp: gmpVal, instantGainPercent: instantGain };
    } else {
      existingHistory.push({ date: newGmpDate, gmp: gmpVal, instantGainPercent: instantGain });
    }
    existingHistory.sort((a, b) => a.date.localeCompare(b.date));

    setEditingIpo({
      ...editingIpo,
      gmpData: {
        ...(editingIpo.gmpData || {} as any),
        currentGmp: gmpVal,
        estimatedListingPrice: issue + gmpVal,
        estimatedGainPercent: instantGain,
        updatedAt: new Date().toISOString(),
        history: existingHistory,
      },
    });
    setNewGmpPrice('');
    showNotification('success', `Added GMP history entry for ${newGmpDate}`);
  };

  const handleRemoveGmpHistory = (index: number) => {
    if (!editingIpo) return;
    const existingHistory = [...(editingIpo.gmpData?.history || [])];
    existingHistory.splice(index, 1);
    setEditingIpo({
      ...editingIpo,
      gmpData: {
        ...(editingIpo.gmpData || {} as any),
        history: existingHistory,
      },
    });
  };

  // Financials Row Helpers
  const handleAddFinancialRow = () => {
    if (!newFinPeriod.trim() || !editingIpo) {
      showNotification('error', 'Period is required (e.g. FY26)');
      return;
    }
    const newRow = {
      period: newFinPeriod.trim(),
      revenue: Number(newFinRev) || 0,
      pat: Number(newFinPat) || 0,
      netWorth: Number(newFinNetWorth) || 0,
      borrowing: newFinBorrowing === '' ? undefined : Number(newFinBorrowing),
    };
    const current = [...(editingIpo.financials || [])];
    current.push(newRow);
    setEditingIpo({
      ...editingIpo,
      financials: current,
    });
    setNewFinRev('');
    setNewFinPat('');
    setNewFinNetWorth('');
    setNewFinBorrowing('');
    showNotification('success', `Added financials row for ${newFinPeriod}`);
  };

  const handleRemoveFinancialRow = (index: number) => {
    if (!editingIpo) return;
    const current = [...(editingIpo.financials || [])];
    current.splice(index, 1);
    setEditingIpo({
      ...editingIpo,
      financials: current,
    });
  };

  // Stats
  const totalCount = ipos.length;
  const openCount = ipos.filter(i => i.status === 'open').length;
  const upcomingCount = ipos.filter(i => i.status === 'upcoming').length;
  const avgGmpPercent = totalCount > 0 
    ? (ipos.reduce((acc, i) => acc + (i.gmpData?.estimatedGainPercent || 0), 0) / totalCount).toFixed(1)
    : '0';

  if (!isUnlocked) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <GlassCard 
          className="max-w-md w-full p-8 text-center border-slate-200 dark:border-slate-800 shadow-2xl relative overflow-hidden" 
         
        >
          {/* Glowing security icon */}
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 mx-auto flex items-center justify-center mb-5 border border-indigo-500/20 shadow-inner">
            <Lock className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-black text-slate-900 dark:text-white">
            Restricted Admin Area
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-6 leading-relaxed">
            The IPO Management Console is protected against unauthorized access. Enter your Admin Security Passcode to manage issues, pros/cons, and live GMP.
          </p>

          {unlockError && (
            <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2 text-left">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{unlockError}</span>
            </div>
          )}

          <form onSubmit={handleUnlockConsole} className="space-y-4">
            <div className="relative">
              <KeyRound className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPasscode ? 'text' : 'password'}
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value);
                  setUnlockError(null);
                }}
                placeholder="Enter Admin Security Passcode"
                autoFocus
                className="w-full pl-10 pr-10 py-3 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => setShowPasscode(!showPasscode)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={unlockLoading}
              className="py-3 flex items-center justify-center gap-2 text-sm font-bold shadow-lg shadow-indigo-600/30"
            >
              {unlockLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Verifying Passcode...
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" /> Unlock Console
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <button
              onClick={() => navigate('/ipo')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Public Tracker
            </button>
            <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-3 h-3" /> End-to-end Protected
            </span>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-sm font-semibold shadow-lg transition-all ${
          notification.type === 'success' 
            ? 'bg-emerald-600 text-white' 
            : 'bg-rose-600 text-white'
        }`}>
          <span>{notification.message}</span>
          <button onClick={() => setNotification(null)} className="p-1 hover:opacity-80">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header & Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/ipo')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Public IPO Tracker
          </button>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            IPO Admin Management Console
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Admin Portal
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish upcoming issues, manage Grey Market Premium (GMP), edit Advantages & Risks, and set analyst recommendations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <Button
            onClick={handleSyncFromAPI}
            disabled={syncingApi}
            variant="secondary"
            className="flex items-center gap-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30"
            title="Fetch live IPOs from IndianAPI"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncingApi ? 'animate-spin' : ''}`} />
            {syncingApi ? 'Syncing IPOs...' : 'Sync IPOs (IndianAPI)'}
          </Button>

          <Button
            onClick={handleSyncMutualFunds}
            disabled={syncingMf}
            variant="secondary"
            className="flex items-center gap-1.5 text-xs font-bold text-white shadow-md shadow-purple-600/30"
            title="Sync all 249 curated mutual funds from IndianAPI"
          >
            <Sparkles className={`w-3.5 h-3.5 ${syncingMf ? 'animate-spin' : ''}`} />
            {syncingMf ? 'Syncing MFs...' : 'Sync Mutual Funds (IndianAPI)'}
          </Button>

          <Button
            onClick={handleLockConsole}
            variant="ghost"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-white hover:text-rose-600 dark:hover:text-rose-400 border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80"
            title="Lock Admin Console"
          >
            <Lock className="w-3.5 h-3.5" /> Lock Console
          </Button>

          <Button
            onClick={handleOpenCreate}
            variant="primary"
            className="flex items-center gap-2 text-white font-bold shadow-md shadow-indigo-600/30"
          >
            <Plus className="w-4 h-4" /> Create New IPO
          </Button>
        </div>
      </div>

      {/* Upstox Live Session Integration Console */}
      <UpstoxSessionCard onNotification={showNotification} />

      {/* KPI Stats Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total IPOs Tracked</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{totalCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Database & in-memory synced</p>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Open for Bidding</p>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{openCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Accepting live retail bids</p>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Upcoming Issues</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{upcomingCount}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Bidding opening soon</p>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">Avg. Listing Premium</p>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">+{avgGmpPercent}%</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Across current grey market</p>
        </GlassCard>
      </div>

      {/* Filter & Search Bar */}
      <GlassCard className="p-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Search */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search company or symbol..."
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Segment & Status Filters */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Segment */}
            <select
              value={segmentFilter}
              onChange={(e) => setSegmentFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Segments</option>
              <option value="mainboard">Mainboard</option>
              <option value="sme">SME Segment</option>
            </select>

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="listed">Listed</option>
              <option value="upcoming">Upcoming</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Main IPO Admin Management Table */}
      <GlassCard className="p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
            <p className="text-sm">Loading IPO records...</p>
          </div>
        ) : ipos.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <p className="text-sm font-medium">No IPOs matched your filter criteria or database is empty.</p>
            <p className="text-xs text-slate-500 mt-1">Click "Sync from IndianAPI" above to populate live IPOs or "Create New IPO" to add one manually.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold">
                <tr>
                  <th className="py-3 px-4">Company & Symbol</th>
                  <th className="py-3 px-3">Segment</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Price Band</th>
                  <th className="py-3 px-3 text-right">Current GMP</th>
                  <th className="py-3 px-3 text-right">Est. Gain</th>
                  <th className="py-3 px-3 text-center">Advantages / Risks</th>
                  <th className="py-3 px-3">Verdict</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                {ipos.map((ipo) => {
                  const gmp = ipo.gmpData?.currentGmp || 0;
                  const estGain = ipo.gmpData?.estimatedGainPercent || 0;
                  const strengthsCount = ipo.strengths?.length || 0;
                  const risksCount = ipo.risks?.length || 0;

                  return (
                    <tr key={ipo.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      {/* Name & Symbol */}
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white line-clamp-1">{ipo.name}</p>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {ipo.symbol}
                          </span>
                        </div>
                      </td>

                      {/* Segment */}
                      <td className="py-3 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          ipo.segment === 'sme'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                        }`}>
                          {ipo.segment || 'MAINBOARD'}
                        </span>
                      </td>

                      {/* Status Dropdown */}
                      <td className="py-3 px-3">
                        <select
                          value={ipo.status}
                          onChange={(e) => handleQuickStatusChange(ipo, e.target.value)}
                          className="text-xs font-semibold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 focus:outline-none"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="open">Open</option>
                          <option value="closed">Closed</option>
                          <option value="listed">Listed</option>
                        </select>
                      </td>

                      {/* Price Band */}
                      <td className="py-3 px-3 text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {ipo.priceBand || `₹${ipo.issuePrice}`}
                      </td>

                      {/* Current GMP with 1-click Quick Edit */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className={`font-bold ${gmp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                            {gmp >= 0 ? `+₹${gmp}` : `-₹${Math.abs(gmp)}`}
                          </span>
                          <button
                            onClick={() => handleOpenQuickGmp(ipo)}
                            className="p-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-slate-500 hover:text-indigo-600 transition-colors"
                            title="Quick Update GMP"
                          >
                            <Zap className="w-3 h-3 text-amber-500" />
                          </button>
                        </div>
                      </td>

                      {/* Estimated Gain */}
                      <td className="py-3 px-3 text-right">
                        <span className={`font-bold ${estGain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}`}>
                          {estGain >= 0 ? '+' : ''}{estGain.toFixed(1)}%
                        </span>
                      </td>

                      {/* Advantages & Risks Count */}
                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold">
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                            ✓ {strengthsCount}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                            ⚠ {risksCount}
                          </span>
                        </div>
                      </td>

                      {/* Verdict / Rating */}
                      <td className="py-3 px-3">
                        {ipo.verdict?.recommendation ? (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            ipo.verdict.recommendation.toLowerCase().includes('subscribe')
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              : ipo.verdict.recommendation.toLowerCase().includes('avoid')
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          }`}>
                            {ipo.verdict.recommendation}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Awaiting
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => navigate(`/ipo/${ipo.id}`)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                            title="View Public Page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(ipo)}
                            className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 transition-colors"
                            title="Edit Full IPO"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteTargetId(ipo.id)}
                            className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 transition-colors"
                            title="Delete IPO"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* ============================================================== */}
      {/* FULL IPO CREATE / EDIT MODAL                                   */}
      {/* ============================================================== */}
      {isEditorOpen && editingIpo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">
                  {editingIpo.id ? `Edit IPO: ${editingIpo.name || editingIpo.symbol}` : 'Create New IPO Issue'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Configure offer details, Strengths & Risks (Pros/Cons), timeline, and sentiment
                </p>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-5 gap-2 sm:gap-4 overflow-x-auto whitespace-nowrap">
              <button
                type="button"
                onClick={() => setActiveTab('basics')}
                className={`py-3 px-1 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                  activeTab === 'basics'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Building2 className="w-4 h-4" /> 1. Offer & Basics
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`py-3 px-1 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                  activeTab === 'timeline'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Calendar className="w-4 h-4" /> 2. Timeline Schedule
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('proscons')}
                className={`py-3 px-1 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                  activeTab === 'proscons'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" /> 3. Advantages & Risks
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('gmp')}
                className={`py-3 px-1 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                  activeTab === 'gmp'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-4 h-4 text-amber-500" /> 4. GMP & Subscription
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('financials')}
                className={`py-3 px-1 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                  activeTab === 'financials'
                    ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-purple-500" /> 5. Financials & Valuation
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSaveIPO} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: BASICS & OFFER */}
              {activeTab === 'basics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Company Name *</label>
                      <input
                        type="text"
                        required
                        value={editingIpo.name || ''}
                        onChange={(e) => setEditingIpo({ ...editingIpo, name: e.target.value })}
                        placeholder="e.g. Paras Healthcare Limited"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Symbol / Ticker *</label>
                      <input
                        type="text"
                        required
                        value={editingIpo.symbol || ''}
                        onChange={(e) => setEditingIpo({ ...editingIpo, symbol: e.target.value.toUpperCase() })}
                        placeholder="e.g. PARASHLTH"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Segment</label>
                      <select
                        value={editingIpo.segment || 'mainboard'}
                        onChange={(e) => setEditingIpo({ ...editingIpo, segment: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="mainboard">Mainboard</option>
                        <option value="sme">SME</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Status</label>
                      <select
                        value={editingIpo.status || 'upcoming'}
                        onChange={(e) => setEditingIpo({ ...editingIpo, status: e.target.value as any })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="upcoming">Upcoming</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="listed">Listed</option>
                      </select>
                    </div>
                  </div>

                  {/* Price & Lot Size Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Min Price (₹)</label>
                      <input
                        type="number"
                        value={numVal(editingIpo.priceRange?.min)}
                        onFocus={handleNumFocus}
                        onChange={(e) => {
                          const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                          setEditingIpo({
                            ...editingIpo,
                            priceRange: {
                              min: val,
                              max: editingIpo.priceRange?.max ?? editingIpo.issuePrice ?? val,
                            },
                          });
                        }}
                        placeholder="e.g. 660"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Max Price / Issue (₹) *</label>
                      <input
                        type="number"
                        value={numVal(editingIpo.issuePrice)}
                        onFocus={handleNumFocus}
                        onChange={(e) => {
                          const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                          setEditingIpo({ 
                            ...editingIpo, 
                            issuePrice: val,
                            priceRange: {
                              min: editingIpo.priceRange?.min ?? val,
                              max: val,
                            },
                            minInvestment: val && editingIpo.lotSize ? Number(val) * Number(editingIpo.lotSize) : editingIpo.minInvestment
                          });
                        }}
                        placeholder="e.g. 693"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lot Size (Shares) *</label>
                      <input
                        type="number"
                        value={numVal(editingIpo.lotSize)}
                        onFocus={handleNumFocus}
                        onChange={(e) => {
                          const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                          setEditingIpo({ 
                            ...editingIpo, 
                            lotSize: val,
                            minInvestment: val && editingIpo.issuePrice ? Number(editingIpo.issuePrice) * Number(val) : editingIpo.minInvestment
                          });
                        }}
                        placeholder="e.g. 21"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Min Investment (₹)</label>
                      <input
                        type="number"
                        value={numVal(editingIpo.minInvestment)}
                        onFocus={handleNumFocus}
                        onChange={(e) => {
                          const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                          setEditingIpo({ ...editingIpo, minInvestment: val });
                        }}
                        placeholder={editingIpo.issuePrice && editingIpo.lotSize ? String(Number(editingIpo.issuePrice) * Number(editingIpo.lotSize)) : 'e.g. 14553'}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Price Band Label & Issue Size Breakdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Price Band Label</label>
                      <input
                        type="text"
                        value={editingIpo.priceBand || ''}
                        onChange={(e) => setEditingIpo({ ...editingIpo, priceBand: e.target.value })}
                        placeholder="e.g. ₹660 - ₹693"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Total Issue Size (₹ Cr)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.total : editingIpo.issueSize)}
                        onFocus={handleNumFocus}
                        onChange={(e) => {
                          const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                          const curFresh = typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.fresh : val;
                          const curOfs = typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.ofs : 0;
                          setEditingIpo({
                            ...editingIpo,
                            issueSize: { total: val, fresh: curFresh, ofs: curOfs }
                          });
                        }}
                        placeholder="e.g. 1450.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Fresh Issue (₹ Cr)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.fresh : '')}
                        onFocus={handleNumFocus}
                        onChange={(e) => {
                          const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                          const curTotal = typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.total : 0;
                          const curOfs = typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.ofs : 0;
                          setEditingIpo({
                            ...editingIpo,
                            issueSize: { total: curTotal, fresh: val, ofs: curOfs }
                          });
                        }}
                        placeholder="e.g. 500.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Offer for Sale / OFS (₹ Cr)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.ofs : '')}
                        onFocus={handleNumFocus}
                        onChange={(e) => {
                          const val = e.target.value === '' ? ('' as any) : Number(e.target.value);
                          const curTotal = typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.total : 0;
                          const curFresh = typeof editingIpo.issueSize === 'object' ? editingIpo.issueSize.fresh : 0;
                          setEditingIpo({
                            ...editingIpo,
                            issueSize: { total: curTotal, fresh: curFresh, ofs: val }
                          });
                        }}
                        placeholder="e.g. 950.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">About Company Profile</label>
                    <textarea
                      rows={3}
                      value={editingIpo.about || ''}
                      onChange={(e) => setEditingIpo({ ...editingIpo, about: e.target.value })}
                      placeholder="Brief overview of company operations, business model, regional footprint, and key services..."
                      className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Registrar Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Registrar Name</label>
                      <input
                        type="text"
                        value={editingIpo.registrar?.name || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          registrar: { ...(editingIpo.registrar || { name: '' }), name: e.target.value }
                        })}
                        placeholder="e.g. Link Intime India Private Limited"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Registrar Website URL</label>
                      <input
                        type="text"
                        value={editingIpo.registrar?.website || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          registrar: { ...(editingIpo.registrar || { name: '' }), website: e.target.value }
                        })}
                        placeholder="https://linkintime.co.in"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Allotment Status URL</label>
                      <input
                        type="text"
                        value={editingIpo.registrar?.allotmentUrl || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          registrar: { ...(editingIpo.registrar || { name: '' }), allotmentUrl: e.target.value }
                        })}
                        placeholder="https://linkintime.co.in/initial_offer/public-issues.html"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Registrar Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Registrar Contact Person</label>
                      <input
                        type="text"
                        value={editingIpo.registrar?.contact?.person || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          registrar: {
                            ...(editingIpo.registrar || { name: '' }),
                            contact: {
                              ...(editingIpo.registrar?.contact || {}),
                              person: e.target.value,
                            },
                          },
                        })}
                        placeholder="e.g. Williams R / Shanti Prasad"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Registrar Helpline Phone</label>
                      <input
                        type="text"
                        value={editingIpo.registrar?.contact?.phone || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          registrar: {
                            ...(editingIpo.registrar || { name: '' }),
                            contact: {
                              ...(editingIpo.registrar?.contact || {}),
                              phone: e.target.value,
                            },
                          },
                        })}
                        placeholder="+91 406 716 2222 / 1800 309 4001"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Registrar Support Email</label>
                      <input
                        type="email"
                        value={editingIpo.registrar?.contact?.email || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          registrar: {
                            ...(editingIpo.registrar || { name: '' }),
                            contact: {
                              ...(editingIpo.registrar?.contact || {}),
                              email: e.target.value,
                            },
                          },
                        })}
                        placeholder="ipo.support@kfintech.com"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Actual Listing Details (For Listed issues or updating post-listing return) */}
                  <div className="p-4 bg-indigo-50/40 dark:bg-slate-800/60 rounded-xl border border-indigo-200/80 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
                        Actual Listing Details (Recently Listed)
                      </h4>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">
                        Displays in "Recently Listed" tab & cards
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Actual Listing Price (₹)
                        </label>
                        <input
                          type="number"
                          value={numVal(editingIpo.listingDetails?.listingPrice)}
                          onFocus={handleNumFocus}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const issue = toNum(editingIpo.issuePrice, 0);
                            const gainPct = (val != null && issue > 0)
                              ? Number((((val - issue) / issue) * 100).toFixed(2))
                              : editingIpo.listingDetails?.listingGainPercent;
                            setEditingIpo({
                              ...editingIpo,
                              listingDetails: {
                                ...(editingIpo.listingDetails || {}),
                                listingPrice: val,
                                listingGainPercent: gainPct,
                              }
                            });
                          }}
                          placeholder="e.g. 705"
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                          Listing Gain (%)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={numVal(editingIpo.listingDetails?.listingGainPercent)}
                          onFocus={handleNumFocus}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : Number(e.target.value);
                            const issue = toNum(editingIpo.issuePrice, 0);
                            const listPrice = (val != null && issue > 0)
                              ? Number((issue * (1 + val / 100)).toFixed(2))
                              : editingIpo.listingDetails?.listingPrice;
                            setEditingIpo({
                              ...editingIpo,
                              listingDetails: {
                                ...(editingIpo.listingDetails || {}),
                                listingGainPercent: val,
                                listingPrice: listPrice,
                              }
                            });
                          }}
                          placeholder="e.g. 5.5"
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TIMELINE SCHEDULE */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-slate-800/60 border border-indigo-200/80 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>Set all key SEBI issue milestone dates. These dates dynamically update the timeline stepper on the IPO Detail page and compute whether the issue is upcoming, open, closed, or listed.</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">1. Bidding Opens Date *</label>
                      <input
                        type="date"
                        value={editingIpo.timeline?.openDate || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          timeline: { ...(editingIpo.timeline || {} as any), openDate: e.target.value }
                        })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">2. Bidding Closes Date *</label>
                      <input
                        type="date"
                        value={editingIpo.timeline?.closeDate || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          timeline: { ...(editingIpo.timeline || {} as any), closeDate: e.target.value }
                        })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">3. Basis of Allotment Date</label>
                      <input
                        type="date"
                        value={editingIpo.timeline?.allotmentDate || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          timeline: { ...(editingIpo.timeline || {} as any), allotmentDate: e.target.value }
                        })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">4. Initiation of Refunds Date</label>
                      <input
                        type="date"
                        value={editingIpo.timeline?.refundsDate || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          timeline: { ...(editingIpo.timeline || {} as any), refundsDate: e.target.value }
                        })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">5. Demat Transfer / Credit Date</label>
                      <input
                        type="date"
                        value={editingIpo.timeline?.creditDate || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          timeline: { ...(editingIpo.timeline || {} as any), creditDate: e.target.value }
                        })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">6. Listing Date on NSE/BSE</label>
                      <input
                        type="date"
                        value={editingIpo.timeline?.listingDate || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          timeline: { ...(editingIpo.timeline || {} as any), listingDate: e.target.value }
                        })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Anchor Bidding Date (Optional)</label>
                      <input
                        type="date"
                        value={editingIpo.timeline?.anchorDate || ''}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          timeline: { ...(editingIpo.timeline || {} as any), anchorDate: e.target.value }
                        })}
                        className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: PROS & CONS (STRENGTHS, RISKS, OBJECTIVES, LEAD MANAGERS) */}
              {activeTab === 'proscons' && (
                <div className="space-y-6">
                  {/* Research Verdict */}
                  <div className="p-4 bg-indigo-50/50 dark:bg-slate-800/50 border border-indigo-200 dark:border-slate-700 rounded-xl space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">
                      Analyst Recommendation / Verdict
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Verdict Badge</label>
                        <select
                          value={editingIpo.verdict?.recommendation || ''}
                          onChange={(e) => setEditingIpo({
                            ...editingIpo,
                            verdict: e.target.value ? {
                              recommendation: e.target.value as any,
                              summary: editingIpo.verdict?.summary || ''
                            } : undefined
                          })}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          <option value="">-- Awaiting (No Rating Yet) --</option>
                          <option value="Subscribe for Long Term">★ 4.8 - Subscribe for Long Term</option>
                          <option value="Subscribe for Listing Gains">★ 4.5 - Subscribe for Listing Gains</option>
                          <option value="Subscribe">★ 4.8 - Subscribe</option>
                          <option value="May Apply">★ 3.5 - May Apply</option>
                          <option value="Neutral">★ 3.0 - Neutral</option>
                          <option value="Avoid">★ 1.5 - Avoid</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Verdict Summary / Rationale</label>
                        <input
                          type="text"
                          value={editingIpo.verdict?.summary || ''}
                          onChange={(e) => setEditingIpo({
                            ...editingIpo,
                            verdict: {
                              recommendation: editingIpo.verdict?.recommendation || 'Subscribe',
                              summary: e.target.value
                            }
                          })}
                          placeholder="e.g. Robust order book and market leadership provide long-term visibility."
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* STRENGTHS (ADVANTAGES / WHAT IS GOOD) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        Strengths & Key Advantages (What is Good)
                      </h4>
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                        {editingIpo.strengths?.length || 0} Added
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newStrengthInput}
                        onChange={(e) => setNewStrengthInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddStrength(); }}}
                        placeholder="Add a new strength / competitive moat (e.g. Turnaround in FY26 profitability)..."
                        className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                      <Button type="button" size="sm" variant="secondary" onClick={handleAddStrength} className="text-white font-bold">
                        Add
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(editingIpo.strengths || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20 text-xs">
                          <span className="text-slate-800 dark:text-slate-200 flex-1">{item}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveStrength(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* RISKS (VULNERABILITIES / WHAT IS BAD) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                        Risks & Vulnerabilities (What is Bad / Red Flags)
                      </h4>
                      <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
                        {editingIpo.risks?.length || 0} Added
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newRiskInput}
                        onChange={(e) => setNewRiskInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddRisk(); }}}
                        placeholder="Add a key risk / red flag (e.g. Outstanding debt of ₹854 Cr before issue)..."
                        className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                      <Button type="button" size="sm" variant="primary" onClick={handleAddRisk} className="text-white font-bold">
                        Add
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(editingIpo.risks || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-500/20 text-xs">
                          <span className="text-slate-800 dark:text-slate-200 flex-1">{item}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveRisk(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* OBJECTS OF THE ISSUE (FUND UTILIZATION) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-indigo-500" />
                        Objects of the Issue (Fund Utilization)
                      </h4>
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                        {editingIpo.objectsOfIssue?.length || 0} Added
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newObjectInput}
                        onChange={(e) => setNewObjectInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddObjectOfIssue(); }}}
                        placeholder="e.g. Prepayment or repayment of debt availed by company (₹400 Cr)..."
                        className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                      <Button type="button" size="sm" variant="primary" onClick={handleAddObjectOfIssue} className="text-white font-bold">
                        Add
                      </Button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {(editingIpo.objectsOfIssue || []).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-500/20 text-xs">
                          <span className="text-slate-800 dark:text-slate-200 flex-1">{item}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveObjectOfIssue(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* BOOK RUNNING LEAD MANAGERS (BRLMs) */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-purple-500" />
                        Book Running Lead Managers (BRLMs)
                      </h4>
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">
                        {editingIpo.leadManagers?.length || 0} Added
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLeadManagerInput}
                        onChange={(e) => setNewLeadManagerInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLeadManager(); }}}
                        placeholder="e.g. ICICI Securities Limited, Kotak Mahindra Capital..."
                        className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                      <Button type="button" size="sm" variant="secondary" onClick={handleAddLeadManager} className="text-white font-bold">
                        Add
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {(editingIpo.leadManagers || []).map((item, idx) => (
                        <div key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-500/30 text-xs font-semibold text-purple-900 dark:text-purple-200">
                          <span>{item}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLeadManager(idx)}
                            className="text-purple-400 hover:text-rose-600 dark:hover:text-rose-400 ml-1"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* YOUTUBE ANALYSIS VIDEO LINK */}
                  <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Video className="w-4 h-4 text-rose-500" />
                        YouTube Analysis Video Link
                      </h4>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        Appears on IPO Detail Page
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Paste the YouTube link for this IPO (e.g. your review, analysis, or application strategy video).
                    </p>
                    <input
                      type="url"
                      value={editingIpo.youtubeVideoUrl || ''}
                      onChange={(e) => setEditingIpo({
                        ...editingIpo,
                        youtubeVideoUrl: e.target.value
                      })}
                      placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or https://youtu.be/..."
                      className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                    {editingIpo.youtubeVideoUrl && (
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Video link attached — embeds responsive click-to-play player in 2nd column next to Strengths &amp; Weaknesses on the detail page.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: GMP & SUBSCRIPTION */}
              {activeTab === 'gmp' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                      Grey Market Premium (GMP) Sentiment
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Current GMP (₹)</label>
                        <input
                          type="number"
                          value={numVal(editingIpo.gmpData?.currentGmp)}
                          onFocus={handleNumFocus}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const val = raw === '' ? ('' as any) : Number(raw);
                            const calcVal = toNum(raw, 0);
                            const issue = toNum(editingIpo.issuePrice, 100);
                            setEditingIpo({
                              ...editingIpo,
                              gmpData: {
                                ...(editingIpo.gmpData || {} as any),
                                currentGmp: val,
                                estimatedListingPrice: issue + calcVal,
                                estimatedGainPercent: issue > 0 ? (calcVal / issue) * 100 : 0
                              }
                            });
                          }}
                          className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Estimated Listing Price</p>
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-2">
                          ₹{(toNum(editingIpo.issuePrice, 100) + toNum(editingIpo.gmpData?.currentGmp, 0)).toFixed(0)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Estimated Listing Gain %</p>
                        <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-2">
                          {toNum(editingIpo.gmpData?.currentGmp, 0) >= 0 ? '+' : ''}
                          {(((toNum(editingIpo.gmpData?.currentGmp, 0)) / (toNum(editingIpo.issuePrice, 1) || 1)) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 pt-2">
                    Live Subscription Multipliers (x times)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">QIB (x)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(editingIpo.subscription?.qib)}
                        onFocus={handleNumFocus}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          subscription: { ...(editingIpo.subscription || {} as any), qib: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                        })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">sHNI (&lt; ₹10L)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(editingIpo.subscription?.sHni)}
                        onFocus={handleNumFocus}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          subscription: { ...(editingIpo.subscription || {} as any), sHni: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                        })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">bHNI (&gt; ₹10L)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(editingIpo.subscription?.bHni)}
                        onFocus={handleNumFocus}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          subscription: { ...(editingIpo.subscription || {} as any), bHni: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                        })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Total NII (x)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(editingIpo.subscription?.nii)}
                        onFocus={handleNumFocus}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          subscription: { ...(editingIpo.subscription || {} as any), nii: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                        })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Retail RII (x)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(editingIpo.subscription?.rii)}
                        onFocus={handleNumFocus}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          subscription: { ...(editingIpo.subscription || {} as any), rii: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                        })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Employee (x)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(editingIpo.subscription?.employee)}
                        onFocus={handleNumFocus}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          subscription: { ...(editingIpo.subscription || {} as any), employee: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                        })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Total Sub (x)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={numVal(editingIpo.subscription?.total)}
                        onFocus={handleNumFocus}
                        onChange={(e) => setEditingIpo({
                          ...editingIpo,
                          subscription: { ...(editingIpo.subscription || {} as any), total: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                        })}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Interactive GMP Historical Trend Points (Powers Detail Page Chart) */}
                  <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                          <TrendingUp className="w-4 h-4 text-emerald-500" />
                          GMP History Trend Points (For Recharts Graph on Detail Page)
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Add date-by-date premium points to plot the interactive 5-7 day trend line chart
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                        {(editingIpo.gmpData?.history || []).length} Days Recorded
                      </span>
                    </div>

                    {/* Add History Point Bar */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Date</label>
                        <input
                          type="date"
                          value={newGmpDate}
                          onChange={(e) => setNewGmpDate(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">GMP on this Date (₹)</label>
                        <input
                          type="number"
                          placeholder="e.g. 45"
                          value={numVal(newGmpPrice)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setNewGmpPrice(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={handleAddGmpHistory}
                        className="flex items-center justify-center gap-1.5 h-[34px] text-white font-bold bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Point
                      </Button>
                    </div>

                    {/* Recorded History Table */}
                    {(editingIpo.gmpData?.history || []).length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="py-2.5 px-3">Date</th>
                              <th className="py-2.5 px-3 text-right">GMP (₹)</th>
                              <th className="py-2.5 px-3 text-right">Instant Gain %</th>
                              <th className="py-2.5 px-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60 font-medium">
                            {(editingIpo.gmpData?.history || []).map((h, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">{h.date}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">+₹{h.gmp}</td>
                                <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">+{h.instantGainPercent?.toFixed(1)}%</td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveGmpHistory(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                    title="Delete history entry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No historical GMP trend points added yet. Add points above to plot the chart.</p>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 5: FINANCIALS & VALUATION (3-Year P&L & Prospectus Multiples) */}
              {activeTab === 'financials' && (
                <div className="space-y-6">
                  {/* Financial Statements (P&L) Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <BarChart3 className="w-4 h-4 text-purple-500" />
                          Financial Performance Table (₹ in Crores)
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Historical figures from the Red Herring Prospectus (RHP)
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                        {(editingIpo.financials || []).length} Years Logged
                      </span>
                    </div>

                    {/* Add Financial Year Row Bar */}
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 items-end">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Period</label>
                        <input
                          type="text"
                          placeholder="e.g. FY26"
                          value={newFinPeriod}
                          onChange={(e) => setNewFinPeriod(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Revenue (₹ Cr)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={numVal(newFinRev)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setNewFinRev(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">PAT (₹ Cr)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={numVal(newFinPat)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setNewFinPat(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Net Worth (₹ Cr)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={numVal(newFinNetWorth)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setNewFinNetWorth(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">Borrowings (₹ Cr)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Optional"
                          value={numVal(newFinBorrowing)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setNewFinBorrowing(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={handleAddFinancialRow}
                        className="flex items-center justify-center gap-1 h-[34px] text-white font-bold bg-indigo-600 hover:bg-indigo-700 shadow-sm col-span-2 sm:col-span-1"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add Year
                      </Button>
                    </div>

                    {/* Recorded Financials Table */}
                    {(editingIpo.financials || []).length > 0 ? (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="py-2.5 px-3">Period</th>
                              <th className="py-2.5 px-3 text-right">Revenue</th>
                              <th className="py-2.5 px-3 text-right">Profit After Tax (PAT)</th>
                              <th className="py-2.5 px-3 text-right">Net Worth</th>
                              <th className="py-2.5 px-3 text-right">Borrowings</th>
                              <th className="py-2.5 px-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/60 font-medium">
                            {(editingIpo.financials || []).map((fin, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{fin.period}</td>
                                <td className="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200">₹{fin.revenue?.toLocaleString()} Cr</td>
                                <td className={`py-2.5 px-3 text-right font-bold ${fin.pat >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  ₹{fin.pat?.toLocaleString()} Cr
                                </td>
                                <td className="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200">₹{fin.netWorth?.toLocaleString()} Cr</td>
                                <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">
                                  {fin.borrowing ? `₹${fin.borrowing.toLocaleString()} Cr` : '--'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFinancialRow(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                    title="Delete year"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No historical financial statements logged yet. Add years above.</p>
                    )}
                  </div>

                  {/* Valuation & Multiples Section */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <PieChart className="w-4 h-4 text-indigo-500" />
                      Valuation Multiples & Post-Issue Ratios
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ratios computed from issue price & post-offer share capital
                    </p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">P/E Ratio (Pre-Issue)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 24.5"
                          value={numVal(editingIpo.valuation?.peRatio)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setEditingIpo({
                            ...editingIpo,
                            valuation: { ...(editingIpo.valuation || {}), peRatio: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                          })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Post-Issue P/E (x)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 28.2"
                          value={numVal(editingIpo.valuation?.postPeRatio)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setEditingIpo({
                            ...editingIpo,
                            valuation: { ...(editingIpo.valuation || {}), postPeRatio: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                          })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">EPS (₹/share)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 14.2"
                          value={numVal(editingIpo.valuation?.eps)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setEditingIpo({
                            ...editingIpo,
                            valuation: { ...(editingIpo.valuation || {}), eps: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                          })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">RoNW (%)</label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="e.g. 18.5"
                          value={numVal(editingIpo.valuation?.ronw)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setEditingIpo({
                            ...editingIpo,
                            valuation: { ...(editingIpo.valuation || {}), ronw: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                          })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">Market Cap (₹ Cr)</label>
                        <input
                          type="number"
                          step="1"
                          placeholder="e.g. 4500"
                          value={numVal(editingIpo.valuation?.marketCap)}
                          onFocus={handleNumFocus}
                          onChange={(e) => setEditingIpo({
                            ...editingIpo,
                            valuation: { ...(editingIpo.valuation || {}), marketCap: e.target.value === '' ? ('' as any) : Number(e.target.value) }
                          })}
                          className="w-full px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => setIsEditorOpen(false)}
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  className="flex items-center gap-1.5 text-white font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30"
                >
                  <Save className="w-4 h-4" /> Save IPO
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* QUICK GMP UPDATE MODAL (Fast 2-Second Updater)                 */}
      {/* ============================================================== */}
      {isGmpModalOpen && gmpTargetIpo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500" /> Quick GMP Update
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">{gmpTargetIpo.name} ({gmpTargetIpo.symbol})</p>
              </div>
              <button onClick={() => setIsGmpModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Today's Grey Market Premium (₹)
                </label>
                <input
                  type="number"
                  value={numVal(quickGmpValue)}
                  onFocus={handleNumFocus}
                  onChange={(e) => setQuickGmpValue(e.target.value === '' ? ('' as any) : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl text-base font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-1.5 text-xs border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Cutoff Price:</span>
                  <span className="font-bold text-slate-900 dark:text-white">₹{gmpTargetIpo.issuePrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Estimated Listing:</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    ₹{(toNum(gmpTargetIpo.issuePrice, 100) + toNum(quickGmpValue, 0)).toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Estimated Gain:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {toNum(quickGmpValue, 0) >= 0 ? '+' : ''}{((toNum(quickGmpValue, 0) / (toNum(gmpTargetIpo.issuePrice, 1) || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  variant="ghost" 
                  onClick={() => setIsGmpModalOpen(false)}
                  className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  onClick={handleSaveQuickGmp}
                  className="text-white font-bold bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/30"
                >
                  Save & Update Chart
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* DELETE CONFIRMATION MODAL                                      */}
      {/* ============================================================== */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Delete IPO Record</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Are you sure you want to permanently remove this IPO? This action will remove it from both the public IPO tracker and the database.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="ghost" onClick={() => setDeleteTargetId(null)}>
                Cancel
              </Button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IPOAdmin;
