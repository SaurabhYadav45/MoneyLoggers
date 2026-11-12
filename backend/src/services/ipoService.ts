import prisma from '../lib/prisma';
import { getCache, setCache, deleteCachePattern } from '../lib/redis';

export interface IPOSummaryItem {
  id: string;
  name: string;
  symbol: string;
  segment: 'mainboard' | 'sme';
  status: 'upcoming' | 'open' | 'closed' | 'listed';
  priceRange: { min: number; max: number };
  issuePrice: number;
  lotSize: number;
  minInvestment: number;
  issueSize: { total: number; fresh: number; ofs: number };
  timeline: {
    anchorDate?: string;
    openDate: string;
    closeDate: string;
    allotmentDate: string;
    refundsDate?: string;
    creditDate?: string;
    listingDate: string;
    preApplyStartDate?: string;
    mandateEndDate?: string;
    preApplicationStart?: string;
    biddingStart?: string;
    biddingEnd?: string;
    allotmentProcessStart?: string;
    refundInitiation?: string;
    allotmentFinalization?: string;
    listingDay?: string;
    mandateEnd?: string;
  };
  gmpData: {
    currentGmp: number;
    estimatedListingPrice: number;
    estimatedGainPercent: number;
    updatedAt: string;
    history: Array<{ date: string; gmp: number; instantGainPercent: number }>;
  };
  subscription: {
    qib: number;
    nii: number;
    bHni?: number;
    sHni?: number;
    rii: number;
    employee?: number;
    total: number;
    overallFormatted?: string;
    daily?: Array<{
      date: string;
      categories: {
        retailIndividual?: { applied: string; reserved: string; times: string; timesFormatted?: string };
        qualifiedInstitutional?: { applied: string; reserved: string; times: string; timesFormatted?: string };
        nonInstitutional?: { applied: string; reserved: string; times: string; timesFormatted?: string };
        overall?: { applied: string; reserved: string; times: string; timesFormatted?: string };
      };
    }>;
    reservation?: {
      retail?: number;
      nonInstitutional?: number;
      qualifiedInstitutional?: number;
    };
    latestDate?: string;
    updatedAt?: string;
  };
  totalSubscription?: number;
  financials: Array<{
    period: string;
    revenue: number;
    expense?: number;
    pat: number;
    netWorth: number;
    borrowing?: number;
  }>;
  valuation: {
    peRatio?: number;
    postPeRatio?: number;
    marketCap?: number;
    eps?: number;
    ronw?: number;
    industry?: string;
    isin?: string;
    faceValue?: number;
    rhpUrl?: string;
    allotmentLinkUrl?: string;
    exchanges?: { primary?: string; nse?: boolean; bse?: boolean };
    reservation?: {
      retail?: number;
      nonInstitutional?: number;
      qualifiedInstitutional?: number;
    };
  };
  listingDetails?: {
    listingPrice?: number;
    listingGainPercent?: number;
    currentMarketPrice?: number;
    ipoPrice?: number;
    gain?: {
      percentage?: number;
      absolute?: number;
      formatted?: string;
    };
  };
  about: string;
  strengths?: string[];
  risks?: string[];
  verdict?: {
    recommendation: 'Subscribe' | 'Subscribe for Long Term' | 'Subscribe for Listing Gains' | 'May Apply' | 'Neutral' | 'Avoid';
    summary: string;
    youtubeVideoUrl?: string;
  };
  youtubeVideoUrl?: string;
  objectsOfIssue?: string[];
  leadManagers?: string[];
  registrar: {
    name: string;
    website?: string;
    allotmentUrl?: string;
    contact?: {
      person?: string;
      email?: string;
      phone?: string;
    };
  };
  industry?: string;
  isin?: string;
  faceValue?: number;
  rhpUrl?: string;
  allotmentLinkUrl?: string;
  exchanges?: { primary?: string; nse?: boolean; bse?: boolean };
  reservation?: {
    retail?: number;
    nonInstitutional?: number;
    qualifiedInstitutional?: number;
  };
  links?: {
    prospectus?: { rhp?: string };
    allotment?: string;
  };
  performance?: {
    price?: { ipo?: number; listing?: number };
    gain?: {
      absolute?: number;
      percentage?: number;
      formatted?: string;
    };
  };
  isPreApply?: boolean;
  // Freshness & synchronization metadata
  lastFetchedAt?: string | null;
  lastAttemptedAt?: string | null;
  nextRefreshAt?: string | null;
  lastRefreshStatus?: string | null;
  lastRefreshError?: string | null;
  providerUpdatedAt?: string | null;
  isStale?: boolean;
  refreshFailed?: boolean;
  isRefreshing?: boolean;
}

export const LIST_CACHE_TTL = 900; // 15 mins (Phase 7.1)
export const DETAIL_CACHE_TTL = 900; // 15 mins (Phase 7.1)
export const IN_MEMORY_CACHE_TTL = 60; // 60s (Phase 7.1)

export const mockIPODataset: IPOSummaryItem[] = [];

export const DEFAULT_IPO_VIDEOS: Record<string, string> = {
  paras: 'https://www.youtube.com/watch?v=49Q_vezv17k',
};

export const resolveIpoVideoUrl = (name?: string, symbol?: string, explicitUrl?: string): string => {
  if (explicitUrl && typeof explicitUrl === 'string' && explicitUrl.trim()) {
    return explicitUrl.trim();
  }
  const n = (name || '').toLowerCase();
  const s = (symbol || '').toLowerCase();
  for (const [k, v] of Object.entries(DEFAULT_IPO_VIDEOS)) {
    if (n.includes(k) || s.includes(k)) return v;
  }
  return '';
};

/**
 * Automatically computes IPO status dynamically based on timeline dates & current Indian Standard Time (IST)
 */
export const computeIPOStatus = (
  timeline?: { openDate?: string; closeDate?: string; listingDate?: string },
  fallbackStatus?: string
): 'upcoming' | 'open' | 'closed' | 'listed' => {
  if (!timeline) return (fallbackStatus as any) || 'upcoming';
  
  // Calculate current date and time in IST (UTC + 5:30)
  const now = new Date();
  const istDate = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const todayStr = istDate.toISOString().split('T')[0];
  const currentIstMinutes = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();

  const parseDateStr = (d?: string): string | null => {
    if (!d || !d.trim()) return null;
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return null;
    return parsed.toISOString().split('T')[0];
  };

  const openStr = parseDateStr(timeline.openDate);
  const closeStr = parseDateStr(timeline.closeDate);
  const listingStr = parseDateStr(timeline.listingDate);

  // 1. If explicitly listed or listing date has arrived
  if (fallbackStatus === 'listed' || (listingStr && todayStr >= listingStr)) {
    return 'listed';
  }

  // 2. If unannounced dates (both open & close missing), strictly respect fallback or upcoming
  if (!openStr && !closeStr) {
    if (fallbackStatus && ['upcoming', 'open', 'closed', 'listed'].includes(fallbackStatus)) {
      return fallbackStatus as any;
    }
    return 'upcoming';
  }

  // 3. If close date exists and has passed:
  if (closeStr) {
    if (todayStr > closeStr) {
      return 'closed';
    }
    if (todayStr === closeStr) {
      // Bidding closes at 17:00 IST (1020 minutes)
      if (currentIstMinutes >= 17 * 60) {
        return 'closed';
      }
    }
  }

  // 4. If open date exists:
  if (openStr) {
    if (todayStr < openStr) {
      return 'upcoming';
    }
    // If today >= openStr and closeStr has not expired:
    return 'open';
  }

  if (fallbackStatus && ['upcoming', 'open', 'closed', 'listed'].includes(fallbackStatus)) {
    return fallbackStatus as any;
  }

  return 'upcoming';
};

/**
 * Sorts IPOs in descending order so the latest/most recent date is at the top across all categories
 */
export const sortIPOsByLatest = <T extends {
  timeline?: { openDate?: string; closeDate?: string; listingDate?: string };
  openDate?: string;
  closeDate?: string;
  listingDate?: string;
  createdAt?: any;
  updatedAt?: any;
  name?: string;
}>(items: T[], category?: string): T[] => {
  return [...items].sort((a, b) => {
    const getEffectiveDate = (item: T): string => {
      const t = item.timeline || {};
      if (category === 'listed') {
        return item.listingDate || t.listingDate || item.closeDate || t.closeDate || '';
      }
      if (category === 'closed') {
        return item.closeDate || t.closeDate || item.openDate || t.openDate || '';
      }
      if (category === 'open') {
        return item.openDate || t.openDate || item.closeDate || t.closeDate || '';
      }
      if (category === 'upcoming') {
        return item.openDate || t.openDate || item.closeDate || t.closeDate || '';
      }
      // 'all' or default: prefer listingDate, then closeDate, then openDate
      return (
        item.listingDate ||
        t.listingDate ||
        item.closeDate ||
        t.closeDate ||
        item.openDate ||
        t.openDate ||
        ''
      );
    };

    const dateA = getEffectiveDate(a);
    const dateB = getEffectiveDate(b);

    // If both have valid date strings, compare descending (latest date first)
    if (dateA && dateB) {
      const cmp = dateB.localeCompare(dateA);
      if (cmp !== 0) return cmp;
    }
    // Items with confirmed dates come before unannounced/TBA items
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;

    // Secondary fallback: updatedAt or createdAt descending
    const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    if (timeA !== timeB && !isNaN(timeA) && !isNaN(timeB)) {
      return timeB - timeA;
    }

    // Tertiary fallback: alphabetical by name
    return (a.name || '').localeCompare(b.name || '');
  });
};

// Service functions
export const getIPOs = async (
  filters?: {
    status?: string;
    segment?: string;
    search?: string;
  },
  options?: { skipCache?: boolean }
): Promise<IPOSummaryItem[]> => {
  const cacheKey = `ipo:list:${filters?.segment || 'all'}:${filters?.status || 'all'}:${(filters?.search || '').toLowerCase().trim()}`;

  if (!options?.skipCache) {
    const cached = await getCache<IPOSummaryItem[]>(cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return cached;
    }
  }

  try {
    const where: any = {};
    if (filters?.segment && filters.segment !== 'all') {
      where.segment = filters.segment;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { symbol: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const dbItems = await prisma.iPO.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    const items = dbItems.map((ipo) => {
      const rawTimeline = (ipo.timeline as any) || {};
      const rawOpen = ipo.openDate || rawTimeline.openDate || '';
      const rawClose = ipo.closeDate || rawTimeline.closeDate || '';

      // Detect if previously corrupted with fake identical dates on unannounced issues
      const isCorruptedUnannounced =
        Boolean(rawOpen && rawClose && rawOpen === rawClose && (
          ['FLIPKART', 'PHONEPE', 'ZEPTO', 'BOAT', 'OYO', 'FABINDIA', 'PARLE'].some(s => ipo.symbol.includes(s) || ipo.name.toUpperCase().includes(s)) ||
          ipo.status === 'upcoming'
        ));

      const cleanTimeline = isCorruptedUnannounced
        ? { openDate: '', closeDate: '', listingDate: '' }
        : {
            openDate: rawOpen,
            closeDate: rawClose,
            listingDate: ipo.listingDate || rawTimeline.listingDate || '',
          };

      const computedStatus = isCorruptedUnannounced
        ? 'upcoming'
        : computeIPOStatus(cleanTimeline, ipo.status);

      // Self-heal DB status & dates asynchronously if drifted or corrupted
      if (isCorruptedUnannounced) {
        prisma.iPO.update({
          where: { id: ipo.id },
          data: {
            status: 'upcoming',
            openDate: '',
            closeDate: '',
            listingDate: '',
            timeline: {
              ...(rawTimeline || {}),
              openDate: '',
              closeDate: '',
              allotmentDate: '',
              refundsDate: '',
              creditDate: '',
              listingDate: '',
            },
          },
        }).catch(() => {});
      } else if (computedStatus !== ipo.status) {
        prisma.iPO.update({
          where: { id: ipo.id },
          data: { status: computedStatus },
        }).catch(() => {});
      }

      // Cleanse previous automated placeholder verdicts
      const isAutomatedGenericVerdict = ipo.verdict && (
        Boolean((ipo.verdict as any).summary?.includes('Issue tracked via IndianAPI')) ||
        Boolean((ipo.verdict as any).summary?.includes('prospectus review'))
      );

      if (isAutomatedGenericVerdict) {
        prisma.iPO.update({
          where: { id: ipo.id },
          data: { verdict: null as any },
        }).catch(() => {});
      }

      const cleanVerdict = isAutomatedGenericVerdict ? undefined : ((ipo.verdict as any) || undefined);
      const val = (ipo.valuation as any) || {};
      const sub = (ipo.subscription as any) || {};
      const reg = (ipo.registrar as any) || {};
      const tim = (ipo.timeline as any) || {};

      const nowIstStr = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split('T')[0];
      const preDate = tim.preApplyStartDate || tim.preApplicationStart;
      const isPreApply = (
        computedStatus === 'upcoming' &&
        Boolean(preDate) &&
        nowIstStr >= preDate &&
        (!cleanTimeline.openDate || nowIstStr < cleanTimeline.openDate)
      );

      const listingDet = (ipo.listingDetails as any) || undefined;
      const performance = listingDet?.gain ? {
        price: {
          ipo: Number(listingDet.ipoPrice || ipo.issuePrice),
          listing: Number(listingDet.listingPrice || 0),
        },
        gain: listingDet.gain,
      } : undefined;

      const links = {
        prospectus: {
          rhp: val.rhpUrl || val.links?.prospectus?.rhp || '',
        },
        allotment: val.allotmentLinkUrl || val.links?.allotment || reg.allotmentUrl || '',
      };

      return {
        id: ipo.symbol.toLowerCase(),
        name: ipo.name,
        symbol: ipo.symbol,
        segment: ipo.segment as any,
        status: computedStatus,
        priceRange: ipo.priceRange as any,
        issuePrice: Number(ipo.issuePrice),
        lotSize: ipo.lotSize,
        minInvestment: Number(ipo.minInvestment),
        issueSize: ((typeof ipo.issueSize === 'object' && ipo.issueSize !== null) ? ipo.issueSize : {
          total: Number(ipo.issueSize) || 0,
          fresh: Number(ipo.issueSize) || 0,
          ofs: 0,
        }) as any,
        timeline: ipo.timeline as any,
        gmpData: ipo.gmpData as any,
        subscription: sub,
        totalSubscription: typeof sub.total === 'number' ? sub.total : (Number(sub.total) || 0),
        financials: ipo.financials as any,
        valuation: val,
        listingDetails: listingDet,
        about: ipo.about,
        strengths: ipo.strengths,
        risks: ipo.risks,
        verdict: cleanVerdict,
        youtubeVideoUrl: resolveIpoVideoUrl(
          ipo.name,
          ipo.symbol,
          (ipo as any).youtubeVideoUrl || (ipo.verdict as any)?.youtubeVideoUrl || (ipo.valuation as any)?.youtubeVideoUrl
        ),
        objectsOfIssue: ipo.objectsOfIssue,
        leadManagers: ipo.leadManagers,
        registrar: reg,
        industry: val.industry || undefined,
        isin: val.isin || undefined,
        faceValue: val.faceValue ?? undefined,
        rhpUrl: val.rhpUrl || links.prospectus.rhp || undefined,
        allotmentLinkUrl: val.allotmentLinkUrl || links.allotment || reg.allotmentUrl || undefined,
        exchanges: val.exchanges || { primary: 'BSE,NSE', nse: true, bse: true },
        reservation: sub.reservation || val.reservation || undefined,
        links,
        performance,
        isPreApply,
        lastFetchedAt: ipo.lastFetchedAt ? ipo.lastFetchedAt.toISOString() : null,
        lastAttemptedAt: ipo.lastAttemptedAt ? ipo.lastAttemptedAt.toISOString() : null,
        nextRefreshAt: ipo.nextRefreshAt ? ipo.nextRefreshAt.toISOString() : null,
        lastRefreshStatus: ipo.lastRefreshStatus || 'SUCCESS',
        lastRefreshError: ipo.lastRefreshError || null,
        providerUpdatedAt: ipo.providerUpdatedAt ? ipo.providerUpdatedAt.toISOString() : null,
      };
    });

    // Deduplicate items by normalized company key (prevents duplicate appearances in any tab)
    const normalizeKey = (name: string, symbol: string): string => {
      const cleanName = (name || '')
        .toLowerCase()
        .replace(/\b(limited|ltd|pvt|private|india|technologies|technology|engineering|engineers|engineer|enterprises|enterprise|solutions|industries|industry|infra|infrastructure)\b/gi, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
      return cleanName || symbol.toLowerCase().replace(/[^a-z0-9]/g, '');
    };

    const uniqueMap = new Map<string, IPOSummaryItem>();
    for (const item of items) {
      const key = normalizeKey(item.name, item.symbol);
      const existing = uniqueMap.get(key);
      if (!existing) {
        uniqueMap.set(key, item);
      } else {
        // Merge preferring valid lotSize (>1), realistic dates, and official ticker
        const preferCurrent = (item.lotSize > 1 && existing.lotSize <= 1) ||
          (item.timeline?.closeDate && item.timeline.closeDate !== item.timeline.openDate && existing.timeline?.closeDate === existing.timeline?.openDate) ||
          (item.symbol.length < existing.symbol.length && !item.symbol.includes('-'));

        const existingIssueTotal = typeof existing.issueSize === 'object' && existing.issueSize !== null ? Number((existing.issueSize as any).total) || 0 : Number(existing.issueSize) || 0;
        const itemIssueTotal = typeof item.issueSize === 'object' && item.issueSize !== null ? Number((item.issueSize as any).total) || 0 : Number(item.issueSize) || 0;
        const finalIssueSize = itemIssueTotal > 0 ? item.issueSize : (existingIssueTotal > 0 ? existing.issueSize : item.issueSize);

        const existingSubTotal = typeof existing.subscription?.total === 'number' ? existing.subscription.total : Number(existing.subscription?.total || existing.totalSubscription) || 0;
        const itemSubTotal = typeof item.subscription?.total === 'number' ? item.subscription.total : Number(item.subscription?.total || item.totalSubscription) || 0;
        const finalSubscription = itemSubTotal > 0 ? item.subscription : (existingSubTotal > 0 ? existing.subscription : item.subscription);
        const finalTotalSub = itemSubTotal > 0 ? itemSubTotal : existingSubTotal;

        const base = preferCurrent ? { ...existing, ...item } : { ...item, ...existing };
        uniqueMap.set(key, {
          ...base,
          lotSize: (preferCurrent && item.lotSize > 1) ? item.lotSize : (existing.lotSize > 1 ? existing.lotSize : item.lotSize),
          minInvestment: (preferCurrent && item.minInvestment > (item.issuePrice || 100)) ? item.minInvestment : existing.minInvestment,
          issueSize: finalIssueSize as any,
          subscription: finalSubscription,
          totalSubscription: finalTotalSub,
          gmpData: existing.gmpData?.currentGmp ? existing.gmpData : item.gmpData,
          financials: (existing.financials && existing.financials.length > 0) ? existing.financials : item.financials,
          valuation: Object.keys(existing.valuation || {}).length > 0 ? existing.valuation : item.valuation,
          youtubeVideoUrl: existing.youtubeVideoUrl || item.youtubeVideoUrl,
        });
      }
    }

    const deduplicatedItems = Array.from(uniqueMap.values());

    let filtered = deduplicatedItems;
    if (filters?.status && filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }

    const sortedResult = sortIPOsByLatest(filtered, filters?.status);
    await setCache(cacheKey, sortedResult, LIST_CACHE_TTL);
    return sortedResult;
  } catch (err) {
    console.warn('PostgreSQL query error, falling back to dataset:', err);
  }

  // In-memory filter fallback
  let result = mockIPODataset.map(item => ({
    ...item,
    status: computeIPOStatus(item.timeline, item.status),
  }));
  if (filters?.status && filters.status !== 'all') {
    result = result.filter(item => item.status === filters.status);
  }
  if (filters?.segment && filters.segment !== 'all') {
    result = result.filter(item => item.segment === filters.segment);
  }
  if (filters?.search) {
    const s = filters.search.toLowerCase();
    result = result.filter(
      item => item.name.toLowerCase().includes(s) || item.symbol.toLowerCase().includes(s)
    );
  }

  return sortIPOsByLatest(result, filters?.status);
};

export const getIPOByIdOrSymbol = async (
  idOrSymbol: string,
  options?: { skipCache?: boolean }
): Promise<IPOSummaryItem | null> => {
  const cleanId = idOrSymbol.toLowerCase().trim();
  const cacheKey = `ipo:detail:${cleanId}`;

  if (!options?.skipCache) {
    const cached = await getCache<IPOSummaryItem>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  try {
    const ipo = await prisma.iPO.findFirst({
      where: {
        OR: [
          { symbol: { equals: idOrSymbol, mode: 'insensitive' } },
          { id: idOrSymbol },
          { name: { contains: idOrSymbol, mode: 'insensitive' } },
        ],
      },
    });

    if (ipo) {
      const computedStatus = computeIPOStatus(
        {
          openDate: ipo.openDate || (ipo.timeline as any)?.openDate,
          closeDate: ipo.closeDate || (ipo.timeline as any)?.closeDate,
          listingDate: ipo.listingDate || (ipo.timeline as any)?.listingDate,
        },
        ipo.status
      );

      if (computedStatus !== ipo.status) {
        prisma.iPO.update({
          where: { id: ipo.id },
          data: { status: computedStatus },
        }).catch(() => {});
      }

      const val = (ipo.valuation as any) || {};
      const sub = (ipo.subscription as any) || {};
      const reg = (ipo.registrar as any) || {};
      const tim = (ipo.timeline as any) || {};

      const nowIstStr = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().split('T')[0];
      const preDate = tim.preApplyStartDate || tim.preApplicationStart;
      const isPreApply = (
        computedStatus === 'upcoming' &&
        Boolean(preDate) &&
        nowIstStr >= preDate &&
        (!ipo.openDate || nowIstStr < ipo.openDate)
      );

      const listingDet = (ipo.listingDetails as any) || undefined;
      const performance = listingDet?.gain ? {
        price: {
          ipo: Number(listingDet.ipoPrice || ipo.issuePrice),
          listing: Number(listingDet.listingPrice || 0),
        },
        gain: listingDet.gain,
      } : undefined;

      const links = {
        prospectus: {
          rhp: val.rhpUrl || val.links?.prospectus?.rhp || '',
        },
        allotment: val.allotmentLinkUrl || val.links?.allotment || reg.allotmentUrl || '',
      };

      const result: IPOSummaryItem = {
        id: ipo.symbol.toLowerCase(),
        name: ipo.name,
        symbol: ipo.symbol,
        segment: ipo.segment as any,
        status: computedStatus,
        priceRange: ipo.priceRange as any,
        issuePrice: Number(ipo.issuePrice),
        lotSize: ipo.lotSize,
        minInvestment: Number(ipo.minInvestment),
        issueSize: ((typeof ipo.issueSize === 'object' && ipo.issueSize !== null) ? ipo.issueSize : {
          total: Number(ipo.issueSize) || 0,
          fresh: Number(ipo.issueSize) || 0,
          ofs: 0,
        }) as any,
        timeline: ipo.timeline as any,
        gmpData: ipo.gmpData as any,
        subscription: sub,
        totalSubscription: typeof sub.total === 'number' ? sub.total : (Number(sub.total) || 0),
        financials: ipo.financials as any,
        valuation: val,
        listingDetails: listingDet,
        about: ipo.about,
        strengths: ipo.strengths,
        risks: ipo.risks,
        youtubeVideoUrl: resolveIpoVideoUrl(
          ipo.name,
          ipo.symbol,
          (ipo as any).youtubeVideoUrl || (ipo.verdict as any)?.youtubeVideoUrl || (ipo.valuation as any)?.youtubeVideoUrl
        ),
        verdict: (ipo.verdict && (
          (ipo.verdict as any).summary?.includes('Issue tracked via IndianAPI') ||
          (ipo.verdict as any).summary?.includes('prospectus review')
        )) ? undefined : ((ipo.verdict as any) || undefined),
        objectsOfIssue: ipo.objectsOfIssue,
        leadManagers: ipo.leadManagers,
        registrar: reg,
        industry: val.industry || undefined,
        isin: val.isin || undefined,
        faceValue: val.faceValue ?? undefined,
        rhpUrl: val.rhpUrl || links.prospectus.rhp || undefined,
        allotmentLinkUrl: val.allotmentLinkUrl || links.allotment || reg.allotmentUrl || undefined,
        exchanges: val.exchanges || { primary: 'BSE,NSE', nse: true, bse: true },
        reservation: sub.reservation || val.reservation || undefined,
        links,
        performance,
        isPreApply,
        lastFetchedAt: ipo.lastFetchedAt ? ipo.lastFetchedAt.toISOString() : null,
        lastAttemptedAt: ipo.lastAttemptedAt ? ipo.lastAttemptedAt.toISOString() : null,
        nextRefreshAt: ipo.nextRefreshAt ? ipo.nextRefreshAt.toISOString() : null,
        lastRefreshStatus: ipo.lastRefreshStatus || 'SUCCESS',
        lastRefreshError: ipo.lastRefreshError || null,
        providerUpdatedAt: ipo.providerUpdatedAt ? ipo.providerUpdatedAt.toISOString() : null,
      };

      await setCache(cacheKey, result, DETAIL_CACHE_TTL);
      return result;
    }
  } catch (err) {
    console.warn('PostgreSQL lookup error, checking in-memory items:', err);
  }

  const match = mockIPODataset.find(
    item =>
      item.id === idOrSymbol ||
      item.symbol.toLowerCase() === idOrSymbol.toLowerCase() ||
      item.name.toLowerCase().includes(idOrSymbol.toLowerCase())
  );
  if (!match) return null;
  return {
    ...match,
    status: computeIPOStatus(match.timeline, match.status),
  };
};

export const getGMPSummary = async (): Promise<Array<{
  symbol: string;
  name: string;
  price: number;
  gmp: number;
  estListingPrice: number;
  gainPercent: number;
  history: Array<{ date: string; gmp: number; instantGainPercent: number }>;
}>> => {
  const ipos = await getIPOs();
  return ipos.map(ipo => ({
    symbol: ipo.symbol,
    name: ipo.name,
    price: ipo.issuePrice,
    gmp: ipo.gmpData.currentGmp,
    estListingPrice: ipo.gmpData.estimatedListingPrice,
    gainPercent: ipo.gmpData.estimatedGainPercent,
    history: ipo.gmpData.history,
  }));
};

// Create new IPO
export const createIPO = async (data: Partial<IPOSummaryItem>): Promise<IPOSummaryItem> => {
  const issuePrice = data.issuePrice || (data.priceRange?.max || 100);
  const lotSize = data.lotSize || 100;
  const minInvestment = data.minInvestment || (issuePrice * lotSize);
  const currentGmp = data.gmpData?.currentGmp || 0;
  const estimatedListingPrice = issuePrice + currentGmp;
  const estimatedGainPercent = issuePrice > 0 ? (currentGmp / issuePrice) * 100 : 0;
  const todayStr = new Date().toISOString().split('T')[0];

  const id = data.id || (data.symbol ? data.symbol.toLowerCase().replace(/[^a-z0-9]/g, '-') : `ipo-${Date.now()}`);

  const newIPO: IPOSummaryItem = {
    id,
    name: data.name || 'New IPO',
    symbol: (data.symbol || id).toUpperCase(),
    segment: data.segment || 'mainboard',
    status: data.status || 'upcoming',
    priceRange: data.priceRange || { min: issuePrice, max: issuePrice },
    issuePrice,
    lotSize,
    minInvestment,
    issueSize: data.issueSize || { total: 0, fresh: 0, ofs: 0 },
    timeline: data.timeline || {
      openDate: todayStr,
      closeDate: todayStr,
      allotmentDate: todayStr,
      listingDate: todayStr,
    },
    gmpData: {
      currentGmp,
      estimatedListingPrice,
      estimatedGainPercent,
      updatedAt: new Date().toISOString(),
      history: data.gmpData?.history || [{ date: todayStr, gmp: currentGmp, instantGainPercent: estimatedGainPercent }],
    },
    subscription: data.subscription || {
      qib: 0,
      nii: 0,
      bHni: 0,
      sHni: 0,
      rii: 0,
      employee: 0,
      total: 0,
    },
    financials: data.financials || [],
    valuation: data.valuation || {},
    listingDetails: data.listingDetails,
    about: data.about || '',
    strengths: data.strengths || [],
    risks: data.risks || [],
    youtubeVideoUrl: data.youtubeVideoUrl || '',
    verdict: data.verdict || {
      recommendation: 'May Apply',
      summary: 'Analysis pending review.',
    },
    objectsOfIssue: data.objectsOfIssue || [],
    leadManagers: data.leadManagers || [],
    registrar: data.registrar || {
      name: 'Link Intime India Private Limited',
      website: 'https://linkintime.co.in',
      allotmentUrl: 'https://linkintime.co.in/initial_offer/public-issues.html',
    },
  };

  try {
    await prisma.iPO.create({
      data: {
        symbol: newIPO.symbol,
        name: newIPO.name,
        segment: newIPO.segment,
        status: newIPO.status,
        issuePrice: newIPO.issuePrice,
        lotSize: newIPO.lotSize,
        minInvestment: newIPO.minInvestment,
        openDate: newIPO.timeline.openDate,
        closeDate: newIPO.timeline.closeDate,
        listingDate: newIPO.timeline.listingDate,
        priceRange: newIPO.priceRange,
        issueSize: newIPO.issueSize,
        timeline: newIPO.timeline,
        gmpData: newIPO.gmpData,
        subscription: newIPO.subscription,
        financials: newIPO.financials,
        valuation: newIPO.valuation,
        listingDetails: newIPO.listingDetails,
        about: newIPO.about,
        strengths: newIPO.strengths || [],
        risks: newIPO.risks || [],
        verdict: {
          ...((newIPO.verdict as any) || {}),
          youtubeVideoUrl: newIPO.youtubeVideoUrl,
        },
        objectsOfIssue: newIPO.objectsOfIssue || [],
        leadManagers: newIPO.leadManagers || [],
        registrar: newIPO.registrar,
      },
    });
  } catch (err) {
    console.warn('Saving to PostgreSQL error:', err);
  }

  // Prepend to in-memory dataset
  const existingIdx = mockIPODataset.findIndex(i => i.id === newIPO.id || i.symbol === newIPO.symbol);
  if (existingIdx >= 0) {
    mockIPODataset[existingIdx] = newIPO;
  } else {
    mockIPODataset.unshift(newIPO);
  }

  // Invalidate Redis and L1 caches so new IPO is visible immediately
  await deleteCachePattern('ipo:*');

  return newIPO;
};

// Update existing IPO
export const updateIPO = async (id: string, updates: Partial<IPOSummaryItem>): Promise<IPOSummaryItem | null> => {
  const existing = await getIPOByIdOrSymbol(id);
  if (!existing) return null;

  const issuePrice = updates.issuePrice ?? existing.issuePrice;
  const lotSize = updates.lotSize ?? existing.lotSize;
  const minInvestment = updates.minInvestment ?? (issuePrice * lotSize);

  let gmpData = existing.gmpData;
  if (updates.gmpData) {
    const currentGmp = updates.gmpData.currentGmp ?? existing.gmpData.currentGmp;
    const estimatedListingPrice = issuePrice + currentGmp;
    const estimatedGainPercent = issuePrice > 0 ? (currentGmp / issuePrice) * 100 : 0;
    gmpData = {
      ...existing.gmpData,
      ...updates.gmpData,
      currentGmp,
      estimatedListingPrice,
      estimatedGainPercent,
      updatedAt: new Date().toISOString(),
    };
  }

  const updated: IPOSummaryItem = {
    ...existing,
    ...updates,
    youtubeVideoUrl: updates.youtubeVideoUrl !== undefined ? updates.youtubeVideoUrl : existing.youtubeVideoUrl,
    issuePrice,
    lotSize,
    minInvestment,
    gmpData,
  };

  try {
    await prisma.iPO.updateMany({
      where: {
        OR: [
          { symbol: { equals: id, mode: 'insensitive' } },
          { id: id },
        ],
      },
      data: {
        name: updated.name,
        segment: updated.segment,
        status: updated.status,
        issuePrice: updated.issuePrice,
        lotSize: updated.lotSize,
        minInvestment: updated.minInvestment,
        openDate: updated.timeline.openDate,
        closeDate: updated.timeline.closeDate,
        listingDate: updated.timeline.listingDate,
        priceRange: updated.priceRange,
        issueSize: updated.issueSize,
        timeline: updated.timeline,
        gmpData: updated.gmpData,
        subscription: updated.subscription,
        financials: updated.financials,
        valuation: {
          ...((updated.valuation as any) || {}),
          youtubeVideoUrl: updated.youtubeVideoUrl,
        },
        listingDetails: updated.listingDetails,
        about: updated.about,
        strengths: updated.strengths || [],
        risks: updated.risks || [],
        verdict: {
          ...((updated.verdict as any) || {}),
          youtubeVideoUrl: updated.youtubeVideoUrl,
        },
        objectsOfIssue: updated.objectsOfIssue || [],
        leadManagers: updated.leadManagers || [],
        registrar: updated.registrar,
      },
    });
  } catch (err) {
    console.warn('Updating in PostgreSQL error:', err);
  }

  const idx = mockIPODataset.findIndex(i => i.id === id || i.symbol.toLowerCase() === id.toLowerCase());
  if (idx >= 0) {
    mockIPODataset[idx] = updated;
  } else {
    mockIPODataset.unshift(updated);
  }

  // Invalidate Redis and L1 caches so updated IPO is visible immediately
  await deleteCachePattern('ipo:*');

  return updated;
};

// Delete IPO
export const deleteIPO = async (id: string): Promise<boolean> => {
  try {
    await prisma.iPO.deleteMany({
      where: {
        OR: [
          { symbol: { equals: id, mode: 'insensitive' } },
          { id: id },
        ],
      },
    });
  } catch (err) {
    console.warn('Deleting in PostgreSQL error:', err);
  }

  // Invalidate Redis and L1 caches so deleted IPO is immediately removed
  await deleteCachePattern('ipo:*');

  const idx = mockIPODataset.findIndex(i => i.id === id || i.symbol.toLowerCase() === id.toLowerCase());
  if (idx >= 0) {
    mockIPODataset.splice(idx, 1);
    return true;
  }
  return false;
};

// Quick GMP Update
export const updateIPOGmp = async (id: string, newGmp: number, date?: string): Promise<IPOSummaryItem | null> => {
  const ipo = await getIPOByIdOrSymbol(id);
  if (!ipo) return null;

  const targetDate = date || new Date().toISOString().split('T')[0];
  const issuePrice = ipo.issuePrice;
  const estimatedListingPrice = issuePrice + newGmp;
  const estimatedGainPercent = issuePrice > 0 ? (newGmp / issuePrice) * 100 : 0;

  const history = [...(ipo.gmpData?.history || [])];
  const existingDateIdx = history.findIndex(h => h.date === targetDate);
  if (existingDateIdx >= 0) {
    history[existingDateIdx] = { date: targetDate, gmp: newGmp, instantGainPercent: estimatedGainPercent };
  } else {
    history.push({ date: targetDate, gmp: newGmp, instantGainPercent: estimatedGainPercent });
  }

  history.sort((a, b) => a.date.localeCompare(b.date));

  const updatedGmpData = {
    currentGmp: newGmp,
    estimatedListingPrice,
    estimatedGainPercent,
    updatedAt: new Date().toISOString(),
    history,
  };

  return updateIPO(id, { gmpData: updatedGmpData });
};
