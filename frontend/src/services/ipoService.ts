import api, { clearApiCache } from './api';
import type { IPO } from '../types';

export interface IPOFilters {
  status?: string;
  segment?: string;
  search?: string;
}

// Local and In-Memory cache for 0ms instant navigation & offline resilience
const CACHE_KEY = 'moneylogger_ipos_cache_v10';
const LAST_API_SYNC_KEY = 'moneylogger_ipo_last_api_sync';

// Immediately purge legacy stale caches from localStorage on client startup
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    [
      'moneylogger_ipos_cache',
      'moneylogger_ipos_cache_v2',
      'moneylogger_ipos_cache_v3',
      'moneylogger_ipos_cache_v4',
      'moneylogger_ipos_cache_v5',
      'moneylogger_ipos_cache_v6',
      'moneylogger_ipos_cache_v7',
      'moneylogger_ipos_cache_v8',
      'moneylogger_ipos_cache_v9',
    ].forEach((k) => localStorage.removeItem(k));
  }
} catch {
  // Ignore storage errors
}

// =========================================================================
// IN-MEMORY CLIENT CACHE & LOCAL STORAGE FALLBACK
// 2-minute freshness window (Phase 7.1)
// =========================================================================
let inMemoryIpos: IPO[] | null = null;
let inMemoryIposTimestamp: number = 0;
const inMemoryIpoDetail = new Map<string, { data: IPO; timestamp: number }>();
const CLIENT_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes fresh in-memory (Phase 7.1)

export const clearIpoClientCache = (): void => {
  inMemoryIpos = null;
  inMemoryIposTimestamp = 0;
  inMemoryIpoDetail.clear();
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem('moneylogger_ipos_cache');
    localStorage.removeItem('moneylogger_ipos_cache_v2');
    localStorage.removeItem('moneylogger_ipos_cache_v3');
    localStorage.removeItem('moneylogger_ipos_cache_v4');
    localStorage.removeItem('moneylogger_ipos_cache_v5');
    localStorage.removeItem('moneylogger_ipos_cache_v6');
  } catch {
    // Ignore storage errors
  }
};

export const getLastIpoApiSyncTime = (): string | null => {
  return localStorage.getItem(LAST_API_SYNC_KEY);
};

export const setLastIpoApiSyncTime = (timestamp: string): void => {
  try {
    localStorage.setItem(LAST_API_SYNC_KEY, timestamp);
  } catch {
    // Ignore storage errors
  }
};

export interface CachedIPOResponse {
  data: IPO[];
  timestamp: number;
  version?: string;
  count?: number;
}

export const getCachedIPOs = (): CachedIPOResponse | null => {
  // 1. Check in-memory cache first (0ms, valid within 2 mins)
  if (inMemoryIpos && inMemoryIpos.length > 0 && Date.now() - inMemoryIposTimestamp < CLIENT_CACHE_TTL_MS) {
    return {
      data: inMemoryIpos,
      timestamp: inMemoryIposTimestamp,
      count: inMemoryIpos.length,
    };
  }

  // 2. Check localStorage fallback snapshot
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
      inMemoryIpos = parsed.data;
      inMemoryIposTimestamp = parsed.timestamp || Date.now();
      return parsed;
    }
  } catch {
    // Ignore storage parse errors
  }
  return null;
};

export const getCachedIPOById = (id: string): IPO | null => {
  const cleanId = id.toLowerCase().trim();

  // 1. Check detail map in-memory first (0ms, within 2 mins)
  const memDetail = inMemoryIpoDetail.get(cleanId);
  if (memDetail && Date.now() - memDetail.timestamp < CLIENT_CACHE_TTL_MS) {
    return {
      ...memDetail.data,
      status: computeIPOStatus(memDetail.data.timeline, memDetail.data.status),
    };
  }

  // 2. Check cached IPO list for instant initial display only (without persisting detail to localStorage)
  const cached = getCachedIPOs();
  if (cached && Array.isArray(cached.data)) {
    const found = cached.data.find(
      (i) => i.id?.toLowerCase() === cleanId || i.symbol?.toLowerCase() === cleanId
    );
    if (found) {
      return {
        ...found,
        status: computeIPOStatus(found.timeline, found.status),
      };
    }
  }
  return null;
};

export const setCachedIPOs = (data: IPO[]): void => {
  if (!Array.isArray(data) || data.length === 0) {
    // Do not overwrite a good snapshot with an empty list or invalid payload
    return;
  }

  const now = Date.now();
  inMemoryIpos = data;
  inMemoryIposTimestamp = now;

  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        version: 'v10',
        timestamp: now,
        count: data.length,
        data,
      })
    );
  } catch {
    // Ignore quota errors
  }
};

// Deprecated: No hardcoded mock dataset. Kept as empty array for backwards compatibility.
export const fallbackIPOs: IPO[] = [];

// Dynamically computes IPO status from timeline dates & Indian Standard Time (IST)
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

export const deduplicateIPOs = (items: IPO[]): IPO[] => {
  const normalizeKey = (name: string, symbol: string): string => {
    const cleanName = (name || '')
      .toLowerCase()
      .replace(/\b(limited|ltd|pvt|private|india|technologies|technology|engineering|engineers|engineer|enterprises|enterprise|solutions|industries|industry|infra|infrastructure)\b/gi, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
    return cleanName || (symbol || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  const map = new Map<string, IPO>();
  for (const item of items) {
    const key = normalizeKey(item.name, item.symbol);
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
    } else {
      const preferCurrent = (item.lotSize > 1 && existing.lotSize <= 1) ||
        (item.timeline?.closeDate && item.timeline.closeDate !== item.timeline.openDate && existing.timeline?.closeDate === existing.timeline?.openDate) ||
        ((item.symbol || '').length < (existing.symbol || '').length && !item.symbol.includes('-'));

      const existingIssueTotal = typeof existing.issueSize === 'object' && existing.issueSize !== null ? Number(existing.issueSize.total) || 0 : Number(existing.issueSize) || 0;
      const itemIssueTotal = typeof item.issueSize === 'object' && item.issueSize !== null ? Number(item.issueSize.total) || 0 : Number(item.issueSize) || 0;
      const finalIssueSize = itemIssueTotal > 0 ? item.issueSize : (existingIssueTotal > 0 ? existing.issueSize : item.issueSize);

      const existingSubTotal = typeof existing.subscription?.total === 'number' ? existing.subscription.total : Number(existing.subscription?.total || existing.totalSubscription) || 0;
      const itemSubTotal = typeof item.subscription?.total === 'number' ? item.subscription.total : Number(item.subscription?.total || item.totalSubscription) || 0;
      const finalSubscription = itemSubTotal > 0 ? item.subscription : (existingSubTotal > 0 ? existing.subscription : item.subscription);
      const finalTotalSub = itemSubTotal > 0 ? itemSubTotal : existingSubTotal;

      const base = preferCurrent ? { ...existing, ...item } : { ...item, ...existing };
      map.set(key, {
        ...base,
        lotSize: (preferCurrent && item.lotSize > 1) ? item.lotSize : (existing.lotSize > 1 ? existing.lotSize : item.lotSize),
        issueSize: finalIssueSize,
        subscription: finalSubscription,
        totalSubscription: finalTotalSub,
        gmpData: existing.gmpData?.currentGmp ? existing.gmpData : item.gmpData,
      });
    }
  }
  return Array.from(map.values());
};

// Fetch IPOs from API with local & in-memory cache resilience (2-minute freshness)
export const getIPOs = async (filters?: IPOFilters, options?: { skipCache?: boolean }): Promise<IPO[]> => {
  // If fresh in-memory query cache exists and skipCache is not forced, return cached results directly
  if (!options?.skipCache && inMemoryIpos && inMemoryIpos.length > 0 && (Date.now() - inMemoryIposTimestamp < CLIENT_CACHE_TTL_MS)) {
    let result = inMemoryIpos;
    if (filters?.status && filters.status !== 'all') {
      result = result.filter(item => item.status === filters.status);
    }
    if (filters?.segment && filters.segment !== 'all') {
      result = result.filter(item => item.segment === filters.segment);
    }
    if (filters?.search) {
      const s = filters.search.toLowerCase().trim();
      result = result.filter(
        item => item.name.toLowerCase().includes(s) || item.symbol.toLowerCase().includes(s)
      );
    }
    return sortIPOsByLatest(result, filters?.status);
  }

  if (options?.skipCache) {
    inMemoryIpos = null;
    inMemoryIposTimestamp = 0;
  }

  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
  if (filters?.segment && filters.segment !== 'all') params.append('segment', filters.segment);
  if (filters?.search) params.append('search', filters.search);
  if (options?.skipCache) params.append('skipCache', 'true');

  const queryString = params.toString() ? `?${params.toString()}` : '';

  try {
    const response = await api.get(`/ipos${queryString}`, { skipCache: options?.skipCache });
    if (response.data?.success && Array.isArray(response.data.data)) {
      if (response.data.lastSyncTimestamp) {
        setLastIpoApiSyncTime(response.data.lastSyncTimestamp);
      }

      const mapped = response.data.data.map((item: IPO) => ({
        ...item,
        status: computeIPOStatus(item.timeline, item.status),
      }));

      const liveItems = deduplicateIPOs(mapped);

      // Cache full list in memory & localStorage only when no partial filtering is applied
      if (!filters || (!filters.status && !filters.segment && !filters.search)) {
        if (liveItems.length > 0) {
          setCachedIPOs(liveItems);
        }
      }
      return sortIPOsByLatest(liveItems, filters?.status);
    }
    throw new Error('Invalid response structure received from API');
  } catch (error: any) {
    console.warn('API error fetching IPOs, checking local cache:', error?.message || error);

    // If real previously fetched data exists in localStorage, serve it as offline fallback
    const cached = getCachedIPOs();
    if (cached && cached.data.length > 0) {
      const deduplicatedCache = deduplicateIPOs(cached.data);
      let result = deduplicatedCache.map(item => ({
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
        const s = filters.search.toLowerCase().trim();
        result = result.filter(
          item => item.name.toLowerCase().includes(s) || item.symbol.toLowerCase().includes(s)
        );
      }
      return sortIPOsByLatest(result, filters?.status);
    }

    throw new Error('Unable to connect to live IPO market service. Please verify your connection.');
  }
};

// Force Sync IPOs with Live API
export const syncIPOs = async (): Promise<IPO[]> => {
  try {
    const response = await api.post('/ipos/sync');
    if (response.data?.success && Array.isArray(response.data.data)) {
      if (response.data.lastSyncTimestamp) {
        setLastIpoApiSyncTime(response.data.lastSyncTimestamp);
      }
      const liveItems = deduplicateIPOs(response.data.data.map((item: IPO) => ({
        ...item,
        status: computeIPOStatus(item.timeline, item.status),
      })));
      setCachedIPOs(liveItems);
      return sortIPOsByLatest(liveItems);
    }
  } catch (error) {
    console.warn('Force sync failed, attempting standard fetch:', error);
  }
  return getIPOs(undefined, { skipCache: true });
};

// Fetch single IPO by ID or symbol (On-demand with 2-minute client query cache)
export const getIPOById = async (id: string, options?: { skipCache?: boolean; force?: boolean }): Promise<IPO | null> => {
  const cleanId = id.toLowerCase().trim();

  // If not explicitly skipping cache, check in-memory detail cache (2 mins)
  if (!options?.skipCache && !options?.force) {
    const memDetail = inMemoryIpoDetail.get(cleanId);
    if (memDetail && Date.now() - memDetail.timestamp < CLIENT_CACHE_TTL_MS) {
      return {
        ...memDetail.data,
        status: computeIPOStatus(memDetail.data.timeline, memDetail.data.status),
      };
    }
  }

  try {
    const queryParams = new URLSearchParams();
    if (options?.skipCache) queryParams.append('skipCache', 'true');
    if (options?.force) queryParams.append('force', 'true');
    const qs = queryParams.toString() ? `?${queryParams.toString()}` : '';

    const response = await api.get(`/ipos/${encodeURIComponent(id)}${qs}`, { skipCache: options?.skipCache });
    if (response.data?.success && response.data.data) {
      const item: IPO = {
        ...response.data.data,
        status: computeIPOStatus(response.data.data.timeline, response.data.data.status),
      };
      const now = Date.now();
      inMemoryIpoDetail.set(cleanId, { data: item, timestamp: now });
      if (item.symbol) {
        inMemoryIpoDetail.set(item.symbol.toLowerCase().trim(), { data: item, timestamp: now });
      }
      return item;
    }
  } catch (error) {
    console.warn(`API error fetching IPO ${id}, checking cache:`, error);
  }

  return getCachedIPOById(id);
};

// Create IPO (Admin)
export const createIPO = async (ipoData: Partial<IPO>): Promise<IPO> => {
  const issuePrice = ipoData.issuePrice || (ipoData.priceRange?.max || 100);
  const lotSize = ipoData.lotSize || 100;
  const currentGmp = ipoData.gmpData?.currentGmp || 0;
  const estimatedListingPrice = issuePrice + currentGmp;
  const estimatedGainPercent = issuePrice > 0 ? (currentGmp / issuePrice) * 100 : 0;
  const todayStr = new Date().toISOString().split('T')[0];
  const id = ipoData.id || (ipoData.symbol ? ipoData.symbol.toLowerCase().replace(/[^a-z0-9]/g, '-') : `ipo-${Date.now()}`);

  const newIPO: IPO = {
    id,
    name: ipoData.name || 'New IPO',
    symbol: (ipoData.symbol || id).toUpperCase(),
    segment: ipoData.segment || 'mainboard',
    status: ipoData.status || 'upcoming',
    priceRange: ipoData.priceRange || { min: issuePrice, max: issuePrice },
    priceBand: ipoData.priceBand || `₹${issuePrice}`,
    issuePrice,
    lotSize,
    minInvestment: ipoData.minInvestment || (issuePrice * lotSize),
    issueSize: ipoData.issueSize || { total: 0, fresh: 0, ofs: 0 },
    timeline: ipoData.timeline || {
      openDate: '',
      closeDate: '',
      allotmentDate: '',
      listingDate: '',
    },
    gmpData: {
      currentGmp,
      estimatedListingPrice,
      estimatedGainPercent,
      updatedAt: new Date().toISOString(),
      history: ipoData.gmpData?.history || [{ date: todayStr, gmp: currentGmp, instantGainPercent: estimatedGainPercent }],
    },
    subscription: ipoData.subscription || {
      qib: 0,
      nii: 0,
      bHni: 0,
      sHni: 0,
      rii: 0,
      employee: 0,
      total: 0,
    },
    financials: ipoData.financials || [],
    valuation: ipoData.valuation || {},
    about: ipoData.about || '',
    strengths: ipoData.strengths || [],
    risks: ipoData.risks || [],
    verdict: ipoData.verdict || {
      recommendation: 'May Apply',
      summary: 'Analysis pending review.',
    },
    objectsOfIssue: ipoData.objectsOfIssue || [],
    registrar: ipoData.registrar || {
      name: 'Link Intime India Private Limited',
      website: 'https://linkintime.co.in',
      allotmentUrl: 'https://linkintime.co.in/initial_offer/public-issues.html',
    },
  };

  const response = await api.post('/ipos', newIPO);
  if (response.data?.success && response.data.data) {
    const created = response.data.data;
    clearApiCache('/ipos');
    const cached = getCachedIPOs();
    if (cached) {
      setCachedIPOs([created, ...cached.data]);
    }
    return created;
  }
  throw new Error(response.data?.message || 'Failed to create IPO');
};

// Update IPO (Admin)
export const updateIPO = async (id: string, updates: Partial<IPO>): Promise<IPO> => {
  const response = await api.put(`/ipos/${encodeURIComponent(id)}`, updates);
  if (response.data?.success && response.data.data) {
    const updated = response.data.data;
    clearApiCache('/ipos');
    inMemoryIpos = null;
    inMemoryIposTimestamp = 0;
    const cleanId = id.toLowerCase().trim();
    inMemoryIpoDetail.delete(cleanId);
    if (updated.symbol) {
      inMemoryIpoDetail.delete(updated.symbol.toLowerCase().trim());
    }

    const cached = getCachedIPOs();
    if (cached) {
      const idx = cached.data.findIndex(i => i.id === id || i.symbol.toLowerCase() === id.toLowerCase());
      if (idx >= 0) {
        cached.data[idx] = updated;
        setCachedIPOs(cached.data);
      }
    }
    return updated;
  }
  throw new Error(response.data?.message || `Failed to update IPO ${id}`);
};

// Delete IPO (Admin)
export const deleteIPO = async (id: string): Promise<boolean> => {
  const response = await api.delete(`/ipos/${encodeURIComponent(id)}`);
  if (response.data?.success) {
    clearApiCache('/ipos');
    inMemoryIpos = null;
    inMemoryIposTimestamp = 0;
    inMemoryIpoDetail.delete(id.toLowerCase().trim());
    const cached = getCachedIPOs();
    if (cached) {
      const remaining = cached.data.filter(i => i.id !== id && i.symbol.toLowerCase() !== id.toLowerCase());
      setCachedIPOs(remaining);
    }
    return true;
  }
  throw new Error(response.data?.message || `Failed to delete IPO ${id}`);
};

// Quick GMP Update (Admin)
export const updateIPOGmp = async (id: string, gmp: number, date?: string): Promise<IPO> => {
  const targetDate = date || new Date().toISOString().split('T')[0];
  const response = await api.patch(`/ipos/${encodeURIComponent(id)}/gmp`, { gmp, date: targetDate });
  if (response.data?.success && response.data.data) {
    const updated = response.data.data;
    clearApiCache('/ipos');
    inMemoryIpos = null;
    inMemoryIposTimestamp = 0;
    const cleanId = id.toLowerCase().trim();
    inMemoryIpoDetail.delete(cleanId);
    if (updated.symbol) {
      inMemoryIpoDetail.delete(updated.symbol.toLowerCase().trim());
    }

    const cached = getCachedIPOs();
    if (cached) {
      const idx = cached.data.findIndex(i => i.id === id || i.symbol.toLowerCase() === id.toLowerCase());
      if (idx >= 0) {
        cached.data[idx] = updated;
        setCachedIPOs(cached.data);
      }
    }
    return updated;
  }
  throw new Error(response.data?.message || `Failed to update GMP for IPO ${id}`);
};

// Verify Admin Passcode
export const verifyAdminPasscode = async (passcode: string): Promise<{ success: boolean; message?: string; locked?: boolean }> => {
  try {
    const response = await api.post('/ipos/admin/verify', {}, {
      headers: { 'x-admin-key': passcode }
    });
    if (response.data?.success) {
      sessionStorage.setItem('moneylogger_admin_key', passcode);
      return { success: true };
    }
    return { success: false, message: 'Invalid Admin Security Passcode' };
  } catch (error: any) {
    if (error.response?.data?.message) {
      return { 
        success: false, 
        message: error.response.data.message,
        locked: error.response.data.locked 
      };
    }
    return { success: false, message: 'Authentication failed. Please verify server connection.' };
  }
};
