import axios from 'axios';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { getCache, setCache, deleteCache, deleteCachePattern } from '../lib/redis';
import { executeWithQuota, getQuotaStatus, QuotaExceededError } from '../lib/quotaManager';
import { computeIPOStatus } from './ipoService';

const INDIANAPI_BASE_URL = process.env.INDIANAPI_BASE_URL || 'https://dev.indianapi.in';
const API_KEY = process.env.INDIANAPI_KEY || '';

// Detail page freshness interval: 30 minutes
export const DETAIL_FRESHNESS_MS = 30 * 60 * 1000;
// Detail refresh failure backoff cooldown: 5 minutes
export const DETAIL_FAILURE_COOLDOWN_MS = 5 * 60 * 1000;

export interface IndianAPIRawIPO {
  id?: string;
  symbol: string | null;
  name: string;
  status: string;
  issueType?: string; // 'Mainboard' | 'SME'
  is_sme?: boolean;
  industry?: string;
  isin?: string;
  faceValue?: number;
  nseEnabled?: boolean;
  bseEnabled?: boolean;
  listingExchange?: string;
  additional_text?: string | null;
  minimumPrice?: number | null;
  maximumPrice?: number | null;
  cutOffPrice?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  issue_price?: number | null;
  issueSize?: number | { total: number; fresh: number; ofs: number } | null;
  lotSize?: number | null;
  lot_size?: number | null;
  minimumQuantity?: number | null;
  biddingStartDate?: string | null;
  biddingEndDate?: string | null;
  bidding_start_date?: string | null;
  bidding_end_date?: string | null;
  listingDate?: string | null;
  listing_date?: string | null;
  rhpUrl?: string | null;
  allotmentLinkUrl?: string | null;
  totalSubscription?: string | number | null;
  document_url?: string | null;
  listing_gains?: number | null;
  listing_price?: number | null;
  timeline?: {
    preApplyStartDate?: string;
    applicationStartDate?: string;
    applicationEndDate?: string;
    allotmentStartDate?: string;
    refundInitiationDate?: string;
    allotmentDate?: string;
    listingDate?: string;
    mandateEndDate?: string;
  };
}

/**
 * Calculates standard SEBI T+1 allotment and T+3 listing dates if not provided
 */
export const deriveTimelineDates = (
  startDate?: string | null,
  endDate?: string | null,
  listingDate?: string | null
) => {
  const cleanStart = (startDate && startDate.trim()) || '';
  const cleanEnd = (endDate && endDate.trim()) || '';
  const cleanListing = (listingDate && listingDate.trim()) || '';

  if (!cleanStart && !cleanEnd) {
    return {
      openDate: '',
      closeDate: '',
      allotmentDate: '',
      refundsDate: '',
      creditDate: '',
      listingDate: cleanListing,
    };
  }

  const openDate = cleanStart || cleanEnd;
  let closeDate = cleanEnd;

  if (!closeDate && cleanStart) {
    try {
      if (cleanListing) {
        const listD = new Date(cleanListing);
        if (!isNaN(listD.getTime())) {
          const c = new Date(listD);
          let count = 0;
          while (count < 3) {
            c.setDate(c.getDate() - 1);
            if (c.getDay() !== 0 && c.getDay() !== 6) count++;
          }
          closeDate = c.toISOString().split('T')[0];
        }
      }
      if (!closeDate || closeDate < openDate) {
        const startD = new Date(cleanStart);
        if (!isNaN(startD.getTime())) {
          const c = new Date(startD);
          let count = 1;
          while (count < 3) {
            c.setDate(c.getDate() + 1);
            if (c.getDay() !== 0 && c.getDay() !== 6) count++;
          }
          closeDate = c.toISOString().split('T')[0];
        }
      }
    } catch {
      closeDate = cleanStart;
    }
  }
  if (!closeDate) closeDate = openDate;

  let allotmentDate = closeDate;
  try {
    const close = new Date(closeDate);
    if (!isNaN(close.getTime())) {
      const allot = new Date(close);
      allot.setDate(allot.getDate() + 1);
      while (allot.getDay() === 0 || allot.getDay() === 6) {
        allot.setDate(allot.getDate() + 1);
      }
      allotmentDate = allot.toISOString().split('T')[0];
    }
  } catch {
    allotmentDate = closeDate;
  }

  let finalListingDate = cleanListing;
  if (!finalListingDate && closeDate) {
    try {
      const close = new Date(closeDate);
      if (!isNaN(close.getTime())) {
        const list = new Date(close);
        let count = 0;
        while (count < 3) {
          list.setDate(list.getDate() + 1);
          if (list.getDay() !== 0 && list.getDay() !== 6) count++;
        }
        finalListingDate = list.toISOString().split('T')[0];
      }
    } catch {
      finalListingDate = allotmentDate;
    }
  }

  return {
    openDate,
    closeDate,
    allotmentDate,
    refundsDate: allotmentDate,
    creditDate: allotmentDate,
    listingDate: finalListingDate,
  };
};

export const normalizeCompanyName = (name: string): string => {
  return (name || '')
    .toLowerCase()
    .replace(/\b(limited|ltd|pvt|private|india|technologies|technology|engineering|engineers|engineer|enterprises|enterprise|solutions|industries|industry|infra|infrastructure)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export const getNormalizedSymbol = (item: IndianAPIRawIPO): string => {
  if (item.symbol && item.symbol.trim()) {
    return item.symbol.trim().toUpperCase();
  }
  return item.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase();
};

export interface SyncResult {
  success: boolean;
  jobId: string;
  trigger: 'SCHEDULED' | 'ADMIN';
  totalFetched: number;
  syncedCount: number;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  message: string;
  datasets: Record<string, { status: 'SUCCESS' | 'FAILED'; count: number; error?: string }>;
  providerRequestsAttempted: number;
}

/**
 * Master IPO List Synchronization Service
 * Shared by both scheduled cycle and authenticated admin execution.
 * 
 * Enforces:
 * 1. Distributed mutex lock (prevents overlapping jobs).
 * 2. Shared daily quota reservation with protected scheduled budget.
 * 3. 4 independent dataset requests (Open, Closed, Upcoming, Listed).
 * 4. Safe upserts preserving existing data on single-endpoint failures.
 * 5. Full audit history in IPOSyncJob and per-dataset state in IPODatasetSync.
 * 6. Clean cache invalidation (Redis + L1 memory).
 */
export const syncIPOList = async (
  trigger: 'SCHEDULED' | 'ADMIN' = 'SCHEDULED',
  initiatedBy?: string
): Promise<SyncResult> => {
  const syncLockKey = 'lock:sync:ipo_list';
  const lockTtlSeconds = 600; // 10 minutes maximum job duration lock

  // 1. Acquire distributed sync lock
  const existingLock = await getCache<string>(syncLockKey);
  if (existingLock) {
    return {
      success: false,
      jobId: '',
      trigger,
      totalFetched: 0,
      syncedCount: 0,
      status: 'SKIPPED',
      message: 'A synchronization job is already running on the system.',
      datasets: {},
      providerRequestsAttempted: 0,
    };
  }

  await setCache(syncLockKey, trigger, lockTtlSeconds);

  const jobId = crypto.randomUUID();
  const startedAt = new Date();
  const isScheduled = trigger === 'SCHEDULED';
  const datasets = ['open', 'closed', 'upcoming', 'listed'] as const;

  // Record job in database as RUNNING
  let syncJobRecord: any = null;
  try {
    syncJobRecord = await prisma.iPOSyncJob.create({
      data: {
        jobId,
        trigger,
        initiatedBy: initiatedBy || (isScheduled ? 'SYSTEM_SCHEDULER' : 'ADMIN_USER'),
        startedAt,
        status: 'RUNNING',
        datasets: [...datasets],
        requestsAttempted: 0,
        requestsSuccess: 0,
        requestsFailed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
      },
    });
  } catch (err: any) {
    console.warn('[IPOSyncService] Could not persist initial IPOSyncJob record:', err.message);
  }

  if (!API_KEY) {
    await deleteCache(syncLockKey);
    const msg = 'INDIANAPI_KEY is not configured in server environment.';
    if (syncJobRecord) {
      await prisma.iPOSyncJob.update({
        where: { id: syncJobRecord.id },
        data: { status: 'FAILED', completedAt: new Date(), errorSummary: msg },
      }).catch(() => {});
    }
    return {
      success: false,
      jobId,
      trigger,
      totalFetched: 0,
      syncedCount: 0,
      status: 'FAILED',
      message: msg,
      datasets: {},
      providerRequestsAttempted: 0,
    };
  }

  // 2. Check quota availability
  const quotaStatus = await getQuotaStatus('indianapi');
  if (!isScheduled && quotaStatus.availableForNonScheduled < 4) {
    await deleteCache(syncLockKey);
    const msg = `Daily provider quota (${quotaStatus.currentUsage}/${quotaStatus.limit}) cannot accommodate manual sync while protecting the ${quotaStatus.reservedForSchedule} requests reserved for scheduled cycles.`;
    if (syncJobRecord) {
      await prisma.iPOSyncJob.update({
        where: { id: syncJobRecord.id },
        data: { status: 'FAILED', completedAt: new Date(), errorSummary: msg },
      }).catch(() => {});
    }
    return {
      success: false,
      jobId,
      trigger,
      totalFetched: 0,
      syncedCount: 0,
      status: 'FAILED',
      message: msg,
      datasets: {},
      providerRequestsAttempted: 0,
    };
  }

  let totalFetched = 0;
  let syncedCount = 0;
  let recordsInserted = 0;
  let recordsUpdated = 0;
  let requestsAttempted = 0;
  let requestsSuccess = 0;
  let requestsFailed = 0;
  const datasetOutcomes: Record<string, { status: 'SUCCESS' | 'FAILED'; count: number; error?: string }> = {};

  try {
    // 3. Fetch each of the 4 datasets independently
    // A failure in one endpoint must NOT destroy or mark other datasets as failed
    for (const category of datasets) {
      requestsAttempted++;
      await prisma.iPODatasetSync.upsert({
        where: { dataset: category },
        create: { dataset: category, lastAttemptedAt: new Date(), lastStatus: 'IDLE' },
        update: { lastAttemptedAt: new Date() },
      }).catch(() => {});

      let categoryItems: IndianAPIRawIPO[] = [];
      let categoryError: string | null = null;

      try {
        const rawResponse = await executeWithQuota<{ ipos?: IndianAPIRawIPO[]; data?: IndianAPIRawIPO[] }>({
          provider: 'indianapi',
          cacheKey: `indianapi:raw_feed:${category}`,
          ttlSeconds: 900,
          skipCache: true, // List sync is the authoritative cache-builder
          isScheduled,
          fetcher: async () => {
            const res = await axios.get(`${INDIANAPI_BASE_URL}/ipo/v2?status=${category}`, {
              headers: {
                'X-Api-Key': API_KEY,
                'Content-Type': 'application/json',
              },
              timeout: 15000,
            });
            return res.data;
          },
        });

        if (rawResponse && Array.isArray(rawResponse.ipos)) {
          categoryItems = rawResponse.ipos;
        } else if (rawResponse && Array.isArray(rawResponse.data)) {
          categoryItems = rawResponse.data;
        } else if (Array.isArray(rawResponse)) {
          categoryItems = rawResponse as any;
        } else {
          throw new Error(`Unexpected response structure for category: ${category}`);
        }

        requestsSuccess++;
        datasetOutcomes[category] = { status: 'SUCCESS', count: categoryItems.length };

        await prisma.iPODatasetSync.upsert({
          where: { dataset: category },
          create: {
            dataset: category,
            lastFetchedAt: new Date(),
            lastAttemptedAt: new Date(),
            lastStatus: 'SUCCESS',
            recordCount: categoryItems.length,
          },
          update: {
            lastFetchedAt: new Date(),
            lastAttemptedAt: new Date(),
            lastStatus: 'SUCCESS',
            recordCount: categoryItems.length,
            lastError: null,
          },
        }).catch(() => {});
      } catch (catErr: any) {
        requestsFailed++;
        categoryError = catErr.message || 'Unknown network/provider error';
        console.warn(`[IPOSyncService] Endpoint /ipo/v2?status=${category} failed:`, categoryError);
        datasetOutcomes[category] = { status: 'FAILED', count: 0, error: categoryError || undefined };

        // Mark dataset attempt as failed in DB while preserving existing records
        await prisma.iPODatasetSync.upsert({
          where: { dataset: category },
          create: {
            dataset: category,
            lastAttemptedAt: new Date(),
            lastStatus: 'FAILED',
            lastError: categoryError,
          },
          update: {
            lastAttemptedAt: new Date(),
            lastStatus: 'FAILED',
            lastError: categoryError,
          },
        }).catch(() => {});
      }

      if (categoryItems.length > 0) {
        totalFetched += categoryItems.length;

        // Persist valid results to PostgreSQL using safe upserts
        for (const item of categoryItems) {
          if (!item.name || !item.name.trim()) continue;

          const symbol = getNormalizedSymbol(item);
          const segment = (item.issueType?.toLowerCase() === 'sme' || item.is_sme) ? 'sme' : 'mainboard';
          const industry = item.industry || '';
          const isin = item.isin || '';
          const faceValue = item.faceValue != null ? Number(item.faceValue) : undefined;
          const rhpUrl = item.rhpUrl || item.document_url || '';
          const allotmentLinkUrl = item.allotmentLinkUrl || '';

          let issueSizeCr = 0;
          if (typeof item.issueSize === 'number') {
            issueSizeCr = item.issueSize;
          } else if (item.issueSize && typeof item.issueSize === 'object') {
            issueSizeCr = Number((item.issueSize as any).total) || 0;
          }

          let totalSub: number | undefined = undefined;
          if (item.totalSubscription != null && item.totalSubscription !== '') {
            const parsed = Number(item.totalSubscription);
            if (!isNaN(parsed)) totalSub = parsed;
          }

          const exchanges = {
            primary: item.listingExchange || 'BSE,NSE',
            nse: item.nseEnabled ?? true,
            bse: item.bseEnabled ?? true,
          };

          const startDate = item.timeline?.applicationStartDate || item.biddingStartDate || item.bidding_start_date;
          const endDate = item.timeline?.applicationEndDate || item.biddingEndDate || item.bidding_end_date;
          const listingDate = item.timeline?.listingDate || item.listingDate || item.listing_date;
          const timeline = deriveTimelineDates(startDate, endDate, listingDate);
          const isUnannounced = !startDate && !endDate;

          let rawStatus: 'upcoming' | 'open' | 'closed' | 'listed' = 'upcoming';
          const itemStatus = (item.status || category || '').toLowerCase();
          if (itemStatus === 'active' || itemStatus === 'open') rawStatus = 'open';
          else if (itemStatus === 'listed') rawStatus = 'listed';
          else if (itemStatus === 'closed') rawStatus = 'closed';
          else rawStatus = 'upcoming';

          const computedStatus = isUnannounced ? 'upcoming' : computeIPOStatus(timeline, rawStatus);

          const existing = await prisma.iPO.findFirst({
            where: {
              OR: [
                { symbol: { equals: symbol, mode: 'insensitive' } },
                { name: { equals: item.name, mode: 'insensitive' } },
              ],
            },
          });

          const issuePrice = item.cutOffPrice || item.issue_price || item.maximumPrice || item.max_price || item.minimumPrice || item.min_price || (existing ? Number(existing.issuePrice) : 100);
          const minPrice = item.minimumPrice || item.min_price || issuePrice;
          const maxPrice = item.maximumPrice || item.max_price || issuePrice;
          const priceRange = { min: minPrice, max: maxPrice };

          const resolvedLotSize = (item.lotSize && item.lotSize > 1) || (item.lot_size && item.lot_size > 1)
            ? (item.lotSize || item.lot_size)
            : (existing?.lotSize && existing.lotSize > 1 ? existing.lotSize : (item.minimumQuantity || item.lot_size || item.lotSize || 1));
          const lotSize = Math.max(1, Number(resolvedLotSize) || 1);
          const minInvestment = issuePrice * lotSize;

          const listingPrice = item.listing_price != null ? Number(item.listing_price) : (item.listing_gains != null && issuePrice > 0 ? Number((issuePrice * (1 + item.listing_gains / 100)).toFixed(2)) : undefined);
          const listingGainPercent = item.listing_gains != null ? Number(item.listing_gains) : (item.listing_price != null && issuePrice > 0 ? Number((((item.listing_price - issuePrice) / issuePrice) * 100).toFixed(2)) : undefined);
          const listingDetails = (listingPrice != null || listingGainPercent != null) ? {
            listingPrice,
            listingGainPercent,
          } : undefined;

          const now = new Date();

          if (existing) {
            const existingTimeline: any = existing.timeline || {};
            const existingValuation: any = existing.valuation || {};
            const existingSubscription: any = existing.subscription || {};
            const existingRegistrar: any = existing.registrar || {};
            const existingIssueSize: any = existing.issueSize || {};

            const finalIssueSizeCr = issueSizeCr > 0 ? issueSizeCr : (Number(existingIssueSize?.total) || 0);
            const mergedIssueSize = {
              total: finalIssueSizeCr,
              fresh: finalIssueSizeCr,
              ofs: Number(existingIssueSize?.ofs) || 0,
            };

            const existingTotalSub = Number(existingSubscription.total) || 0;
            const finalTotalSub = (totalSub != null && totalSub > 0) ? totalSub : existingTotalSub;

            const mergedSubscription = {
              ...existingSubscription,
              total: finalTotalSub,
              overallFormatted: finalTotalSub > 0 ? `${finalTotalSub}x` : existingSubscription.overallFormatted,
              updatedAt: now.toISOString(),
            };

            const mergedTimeline = isUnannounced
              ? {
                  openDate: '',
                  closeDate: '',
                  allotmentDate: '',
                  refundsDate: '',
                  creditDate: '',
                  listingDate: listingDate || existingTimeline.listingDate || '',
                  preApplyStartDate: item.timeline?.preApplyStartDate || existingTimeline.preApplyStartDate || '',
                  mandateEndDate: item.timeline?.mandateEndDate || existingTimeline.mandateEndDate || '',
                }
              : {
                  openDate: timeline.openDate || existingTimeline.openDate,
                  closeDate: (endDate ? timeline.closeDate : (existingTimeline.closeDate && existingTimeline.closeDate !== existingTimeline.openDate ? existingTimeline.closeDate : timeline.closeDate)),
                  allotmentDate: item.timeline?.allotmentDate || existingTimeline.allotmentDate || timeline.allotmentDate,
                  refundsDate: item.timeline?.refundInitiationDate || existingTimeline.refundsDate || timeline.refundsDate,
                  creditDate: existingTimeline.creditDate || timeline.creditDate,
                  listingDate: listingDate || existingTimeline.listingDate || timeline.listingDate,
                  preApplyStartDate: item.timeline?.preApplyStartDate || existingTimeline.preApplyStartDate || '',
                  mandateEndDate: item.timeline?.mandateEndDate || existingTimeline.mandateEndDate || '',
                };

            const mergedValuation = {
              ...existingValuation,
              apiId: item.id || existingValuation.apiId || '',
              slug: item.id || existingValuation.slug || '',
              industry: industry || existingValuation.industry,
              isin: isin || existingValuation.isin,
              faceValue: faceValue ?? existingValuation.faceValue,
              rhpUrl: rhpUrl || existingValuation.rhpUrl,
              allotmentLinkUrl: allotmentLinkUrl || existingValuation.allotmentLinkUrl,
              exchanges: exchanges || existingValuation.exchanges,
            };

            const mergedRegistrar = {
              ...existingRegistrar,
              allotmentUrl: allotmentLinkUrl || existingRegistrar.allotmentUrl || 'https://linkintime.co.in/initial_offer/public-issues.html',
            };

            await prisma.iPO.update({
              where: { id: existing.id },
              data: {
                symbol,
                name: item.name,
                segment,
                status: isUnannounced ? 'upcoming' : computedStatus,
                issuePrice,
                lotSize,
                minInvestment,
                openDate: mergedTimeline.openDate,
                closeDate: mergedTimeline.closeDate,
                listingDate: mergedTimeline.listingDate,
                priceRange,
                issueSize: mergedIssueSize,
                timeline: mergedTimeline,
                valuation: mergedValuation,
                registrar: mergedRegistrar,
                subscription: mergedSubscription,
                ...(listingDetails ? { listingDetails } : {}),
                lastFetchedAt: now,
                lastAttemptedAt: now,
                lastRefreshStatus: 'SUCCESS',
                lastRefreshError: null,
                updatedAt: now,
              },
            });
            recordsUpdated++;
          } else {
            const initialGmpData = {
              currentGmp: 0,
              estimatedListingPrice: issuePrice,
              estimatedGainPercent: 0,
              updatedAt: now.toISOString(),
              history: [],
            };

            const initialSubscription = {
              qib: 0,
              nii: 0,
              rii: 0,
              total: totalSub || 0,
              overallFormatted: (totalSub && totalSub > 0) ? `${totalSub}x` : undefined,
              updatedAt: now.toISOString(),
            };

            const initialValuation = {
              apiId: item.id || '',
              slug: item.id || '',
              industry,
              isin,
              faceValue,
              rhpUrl,
              allotmentLinkUrl,
              exchanges,
            };

            const initialIssueSize = {
              total: issueSizeCr,
              fresh: issueSizeCr,
              ofs: 0,
            };

            await prisma.iPO.create({
              data: {
                symbol,
                name: item.name,
                segment,
                status: computedStatus,
                issuePrice,
                lotSize,
                minInvestment,
                openDate: timeline.openDate,
                closeDate: timeline.closeDate,
                listingDate: timeline.listingDate,
                priceRange,
                issueSize: initialIssueSize,
                timeline,
                gmpData: initialGmpData,
                subscription: initialSubscription,
                financials: [],
                valuation: initialValuation,
                listingDetails: listingDetails ? (listingDetails as any) : undefined,
                about: `${item.name} is entering the capital markets on the ${segment === 'sme' ? 'SME' : 'Mainboard'} platform.`,
                strengths: [],
                risks: [],
                verdict: undefined,
                registrar: {
                  name: 'Link Intime / KFintech',
                  website: 'https://linkintime.co.in',
                  allotmentUrl: allotmentLinkUrl || 'https://linkintime.co.in/initial_offer/public-issues.html',
                },
                lastFetchedAt: now,
                lastAttemptedAt: now,
                lastRefreshStatus: 'SUCCESS',
                lastRefreshError: null,
              },
            });
            recordsInserted++;
          }
          syncedCount++;
        }
      }
    }

    // 4. Invalidate Cache Layers after successful database updates
    await deleteCachePattern('ipo:list:*');
    await deleteCachePattern('ipos:list:*');
    await deleteCachePattern('indianapi:ipo:*');
    await setCache('indianapi:ipo:last_sync_timestamp', new Date().toISOString(), 900);

    const finalStatus: 'SUCCESS' | 'PARTIAL' | 'FAILED' =
      requestsFailed === 0 ? 'SUCCESS' : (requestsSuccess > 0 ? 'PARTIAL' : 'FAILED');

    // Update IPOSyncJob record
    if (syncJobRecord) {
      await prisma.iPOSyncJob.update({
        where: { id: syncJobRecord.id },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          requestsAttempted,
          requestsSuccess,
          requestsFailed,
          recordsInserted,
          recordsUpdated,
          recordsSkipped: 0,
          errorSummary: requestsFailed > 0 ? `${requestsFailed} endpoints failed during synchronization.` : undefined,
          metadata: { datasetOutcomes },
        },
      }).catch(() => {});
    }

    return {
      success: finalStatus !== 'FAILED',
      jobId,
      trigger,
      totalFetched,
      syncedCount,
      status: finalStatus,
      message: `Synchronized ${syncedCount} records across ${requestsSuccess}/${requestsAttempted} endpoints.`,
      datasets: datasetOutcomes,
      providerRequestsAttempted: requestsAttempted,
    };
  } finally {
    // 5. Always safely release sync lock
    await deleteCache(syncLockKey);
  }
};

/**
 * On-Demand IPO Detail Synchronization
 * Strictly on-demand: NO scheduler or admin trigger.
 * 
 * Rules:
 * - Freshness interval: 30 minutes.
 * - If fresh in DB: returns DB record, 0 provider calls.
 * - If stale/missing: acquires per-IPO lock, checks shared quota, fetches provider detail.
 * - On failure: preserves previous PostgreSQL data, applies 5-min cooldown backoff, returns stale record.
 */
export const fetchAndPersistIpoDetail = async (
  idOrSymbol: string,
  options?: { force?: boolean }
): Promise<{ data: any | null; isStale: boolean; refreshFailed: boolean; error?: string }> => {
  if (!API_KEY) {
    return { data: null, isStale: false, refreshFailed: true, error: 'INDIANAPI_KEY is not configured' };
  }

  const cleanId = idOrSymbol.toLowerCase().trim();

  // 1. Look up existing IPO in PostgreSQL
  const existing = await prisma.iPO.findFirst({
    where: {
      OR: [
        { symbol: { equals: cleanId, mode: 'insensitive' } },
        { id: cleanId },
        { name: { contains: cleanId, mode: 'insensitive' } },
      ],
    },
  });

  const now = Date.now();
  const lastFetched = existing?.lastFetchedAt ? new Date(existing.lastFetchedAt).getTime() : 0;
  const isFresh = lastFetched > 0 && (now - lastFetched) < DETAIL_FRESHNESS_MS;

  // Case A/B: Fresh in database and not forced -> Return immediately without upstream call
  if (existing && isFresh && !options?.force) {
    return { data: existing, isStale: false, refreshFailed: false };
  }

  // Cooldown check on previous failure: prevent repeated burst calls when provider is down
  if (
    existing &&
    existing.lastRefreshStatus === 'FAILED' &&
    existing.nextRefreshAt &&
    new Date() < new Date(existing.nextRefreshAt) &&
    !options?.force
  ) {
    return {
      data: existing,
      isStale: true,
      refreshFailed: true,
      error: existing.lastRefreshError || 'Recent refresh failed; adhering to cooldown backoff.',
    };
  }

  // Check quota before acquiring per-IPO lock
  const quota = await getQuotaStatus('indianapi');
  if (quota.availableForNonScheduled < 1) {
    if (existing) {
      return {
        data: existing,
        isStale: true,
        refreshFailed: true,
        error: 'Quota exhausted or reserved for scheduled operations; serving cached record.',
      };
    }
    throw new QuotaExceededError('indianapi');
  }

  // 2. Per-IPO Concurrency Lock (distributed via Redis)
  const lockKey = `lock:ipo:detail:${cleanId}`;
  const lockAcquired = await getCache<string>(lockKey);
  if (lockAcquired) {
    // If another request is currently refreshing this IPO, wait briefly or serve existing stale record
    if (existing) {
      return { data: existing, isStale: true, refreshFailed: false };
    }
    // Wait up to 2 seconds for the leader to complete
    await new Promise((r) => setTimeout(r, 1500));
    const refreshed = await prisma.iPO.findFirst({
      where: {
        OR: [
          { symbol: { equals: cleanId, mode: 'insensitive' } },
          { id: cleanId },
        ],
      },
    });
    if (refreshed) {
      return { data: refreshed, isStale: false, refreshFailed: false };
    }
  }

  await setCache(lockKey, 'LOCKED', 45); // 45 seconds lease

  try {
    const val = (existing?.valuation as any) || {};
    let targetSlug = val.apiId || val.slug || (cleanId.includes('-') ? cleanId : '');
    if (!targetSlug && existing?.name) {
      targetSlug = existing.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-ipo';
    }
    if (!targetSlug) targetSlug = cleanId;

    const detailPayload = await executeWithQuota<any>({
      provider: 'indianapi',
      cacheKey: `ipos:detail:upstream:${targetSlug}`,
      ttlSeconds: 900,
      skipCache: true,
      isScheduled: false,
      fetcher: async () => {
        let resData: any = null;
        try {
          const res = await axios.get(`${INDIANAPI_BASE_URL}/ipo/${encodeURIComponent(targetSlug)}`, {
            headers: {
              'X-Api-Key': API_KEY,
              'Content-Type': 'application/json',
            },
            timeout: 10000,
          });
          if (res.data && res.data.status !== 'error' && res.data.data) {
            resData = res.data;
          }
        } catch (err: any) {
          if (targetSlug !== cleanId) {
            const fallbackRes = await axios.get(`${INDIANAPI_BASE_URL}/ipo/${encodeURIComponent(cleanId)}`, {
              headers: {
                'X-Api-Key': API_KEY,
                'Content-Type': 'application/json',
              },
              timeout: 10000,
            });
            if (fallbackRes.data && fallbackRes.data.status !== 'error' && fallbackRes.data.data) {
              resData = fallbackRes.data;
            }
          }
        }
        return resData;
      },
      fallbackValue: null,
    });

    const d = detailPayload?.data;
    if (d && typeof d === 'object') {
      const symbol = d.basic?.symbol?.trim().toUpperCase() || cleanId.toUpperCase();
      const targetRecord = existing || await prisma.iPO.findFirst({
        where: {
          OR: [
            { symbol: { equals: symbol, mode: 'insensitive' } },
            { symbol: { equals: cleanId, mode: 'insensitive' } },
            { id: cleanId },
          ],
        },
      });

      if (targetRecord) {
        const existingValuation = (targetRecord.valuation as any) || {};
        const existingSubscription = (targetRecord.subscription as any) || {};
        const existingTimeline = (targetRecord.timeline as any) || {};
        const existingRegistrar = (targetRecord.registrar as any) || {};

        const dailyArr = d.subscription?.daily || existingSubscription.daily || [];
        let latestQib = Number(d.subscription?.qib ?? d.subscription?.categories?.qualifiedInstitutional?.times ?? existingSubscription.qib ?? 0);
        let latestNii = Number(d.subscription?.nii ?? d.subscription?.categories?.nonInstitutional?.times ?? existingSubscription.nii ?? 0);
        let latestRii = Number(d.subscription?.rii ?? d.subscription?.retail ?? d.subscription?.categories?.retailIndividual?.times ?? existingSubscription.rii ?? 0);
        let latestDateStr = d.subscription?.date || '';
        let latestCategories: any = null;

        const parseSubscriptionDateStr = (dateStr?: string): number => {
          if (!dateStr || typeof dateStr !== 'string') return 0;
          const clean = dateStr.trim();
          if (!clean) return 0;
          const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          if (dmyMatch) {
            return new Date(Number(dmyMatch[3]), Number(dmyMatch[2]) - 1, Number(dmyMatch[1])).getTime();
          }
          const parsed = new Date(clean).getTime();
          return isNaN(parsed) ? 0 : parsed;
        };

        if (Array.isArray(dailyArr) && dailyArr.length > 0) {
          const sortedDaily = [...dailyArr].sort((a: any, b: any) => {
            const dateA = parseSubscriptionDateStr(a.date);
            const dateB = parseSubscriptionDateStr(b.date);
            if (dateA && dateB && dateA !== dateB) return dateB - dateA;
            const dayA = Number(a.day || a.dayNumber || 0);
            const dayB = Number(b.day || b.dayNumber || 0);
            return dayB - dayA;
          });
          const topDay = sortedDaily[0];
          latestDateStr = topDay?.date || latestDateStr;
          const topCats = topDay?.categories || (topDay as any);
          latestCategories = topCats;

          const qibObj = topCats?.qualifiedInstitutional || topCats?.qib;
          if (qibObj?.times != null) latestQib = Number(qibObj.times);
          else if (typeof qibObj === 'number') latestQib = qibObj;

          const niiObj = topCats?.nonInstitutional || topCats?.nii || topCats?.hni;
          if (niiObj?.times != null) latestNii = Number(niiObj.times);
          else if (typeof niiObj === 'number') latestNii = niiObj;

          const riiObj = topCats?.retailIndividual || topCats?.retail || topCats?.rii;
          if (riiObj?.times != null) latestRii = Number(riiObj.times);
          else if (typeof riiObj === 'number') latestRii = riiObj;
        }

        const overallRaw = d.subscription?.overall != null ? String(d.subscription.overall) : '';
        const totalNum = overallRaw !== '' ? Number(overallRaw) : (typeof existingSubscription.total === 'number' ? existingSubscription.total : 0);
        const overallFormatted = d.subscription?.overallFormatted || (totalNum > 0 ? `${totalNum}x` : (overallRaw === '0' ? '0.00x' : existingSubscription.overallFormatted || '0.00x'));

        const mergedSubscription = {
          ...existingSubscription,
          qib: latestQib,
          nii: latestNii,
          rii: latestRii,
          total: totalNum,
          overallFormatted: overallFormatted,
          daily: dailyArr,
          latestDate: latestDateStr,
          latestCategories: latestCategories || existingSubscription.latestCategories,
          reservation: d.reservation || existingSubscription.reservation,
          updatedAt: new Date().toISOString(),
        };

        const regContact = d.registrar?.contact || {};
        const mergedRegistrar = {
          ...existingRegistrar,
          name: (d.registrar?.name && d.registrar.name.trim()) || existingRegistrar.name,
          website: (d.registrar?.website && d.registrar.website.trim()) || existingRegistrar.website,
          allotmentUrl: d.links?.allotment || d.registrar?.allotmentUrl || existingRegistrar.allotmentUrl,
          contact: {
            person: (regContact.person && regContact.person.trim()) || d.registrar?.person || existingRegistrar.contact?.person || '',
            email: (regContact.email && regContact.email.trim()) || d.registrar?.email || existingRegistrar.contact?.email || '',
            phone: (regContact.phone && regContact.phone.trim()) || d.registrar?.phone || existingRegistrar.contact?.phone || '',
          },
        };

        const mergedTimeline = {
          ...existingTimeline,
          openDate: d.timeline?.biddingStart || d.dates?.bidding?.start || existingTimeline.openDate,
          closeDate: d.timeline?.biddingEnd || d.dates?.bidding?.end || existingTimeline.closeDate,
          listingDate: d.timeline?.listingDay || d.dates?.listing || existingTimeline.listingDate,
          allotmentDate: d.timeline?.allotmentFinalization || d.timeline?.allotmentProcessStart || d.dates?.allotment || existingTimeline.allotmentDate,
          refundsDate: d.timeline?.refundInitiation || existingTimeline.refundsDate,
          creditDate: d.timeline?.allotmentFinalization || existingTimeline.creditDate,
          preApplyStartDate: d.timeline?.preApplicationStart || existingTimeline.preApplyStartDate,
          mandateEndDate: d.timeline?.mandateEnd || existingTimeline.mandateEndDate,
        };

        const mergedValuation = {
          ...existingValuation,
          industry: d.basic?.industry || existingValuation.industry,
          faceValue: d.pricing?.faceValue != null ? Number(d.pricing.faceValue) : existingValuation.faceValue,
          rhpUrl: d.links?.prospectus?.rhp || existingValuation.rhpUrl,
          allotmentLinkUrl: d.links?.allotment || existingValuation.allotmentLinkUrl,
          exchanges: d.exchanges || existingValuation.exchanges,
          reservation: d.reservation || existingValuation.reservation,
          links: d.links || existingValuation.links,
        };

        const issuePrice = d.pricing?.priceRange?.cutOff || d.performance?.price?.ipo || d.pricing?.priceRange?.max || Number(targetRecord.issuePrice);
        const lotSize = Math.max(1, Number(d.issue?.lotSize || d.issue?.minimumQuantity || targetRecord.lotSize) || 1);
        const minInvestment = d.issue?.minimumInvestment ? Number(String(d.issue.minimumInvestment).replace(/[^0-9.]/g, '')) : (issuePrice * lotSize);

        const listingPrice = d.performance?.price?.listing != null ? Number(d.performance.price.listing) : (d.performance?.price?.ipo != null ? Number(d.performance.price.ipo) : undefined);
        const listingGainPercent = d.performance?.gain?.percentage != null ? Number(d.performance.gain.percentage) : undefined;
        const mergedListingDetails = (listingPrice != null || listingGainPercent != null) ? {
          listingPrice,
          listingGainPercent,
          currentMarketPrice: listingPrice ?? (targetRecord.listingDetails as any)?.currentMarketPrice,
          ipoPrice: d.performance?.price?.ipo != null ? Number(d.performance.price.ipo) : issuePrice,
          gain: d.performance?.gain || (targetRecord.listingDetails as any)?.gain,
        } : (targetRecord.listingDetails as any);

        const issueSizeCr = d.issue?.size != null ? Number(d.issue.size) : (targetRecord.issueSize as any)?.total || 0;
        const successNow = new Date();

        const updated = await prisma.iPO.update({
          where: { id: targetRecord.id },
          data: {
            issuePrice,
            lotSize,
            minInvestment,
            openDate: mergedTimeline.openDate,
            closeDate: mergedTimeline.closeDate,
            listingDate: mergedTimeline.listingDate,
            issueSize: (issueSizeCr > 0 ? {
              total: issueSizeCr,
              fresh: issueSizeCr,
              ofs: (targetRecord.issueSize as any)?.ofs || 0,
            } : targetRecord.issueSize) as any,
            timeline: mergedTimeline,
            subscription: mergedSubscription,
            registrar: mergedRegistrar,
            valuation: mergedValuation,
            ...(mergedListingDetails ? { listingDetails: mergedListingDetails } : {}),
            lastFetchedAt: successNow,
            lastAttemptedAt: successNow,
            nextRefreshAt: new Date(successNow.getTime() + DETAIL_FRESHNESS_MS),
            lastRefreshStatus: 'SUCCESS',
            lastRefreshError: null,
            updatedAt: successNow,
          },
        });

        // Invalidate specific detail cache key in Redis and L1 memory
        await deleteCache(`ipos:detail:v1:${cleanId}`);
        await deleteCache(`ipo:detail:${cleanId}`);

        return { data: updated, isStale: false, refreshFailed: false };
      }
    }

    throw new Error('Provider returned empty or invalid detail payload');
  } catch (err: any) {
    console.warn(`[IPOSyncService] Detail fetch failed for "${cleanId}":`, err.message);

    if (existing) {
      // Preserve existing valid data, record failure, and set 5-minute cooldown
      const failNow = new Date();
      await prisma.iPO.update({
        where: { id: existing.id },
        data: {
          lastAttemptedAt: failNow,
          nextRefreshAt: new Date(failNow.getTime() + DETAIL_FAILURE_COOLDOWN_MS),
          lastRefreshStatus: 'FAILED',
          lastRefreshError: err.message,
        },
      }).catch(() => {});

      return {
        data: existing,
        isStale: true,
        refreshFailed: true,
        error: err.message || 'Failed to refresh from live provider; serving preserved data.',
      };
    }

    return { data: null, isStale: false, refreshFailed: true, error: err.message };
  } finally {
    await deleteCache(lockKey);
  }
};
