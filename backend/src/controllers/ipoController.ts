import { Request, Response } from 'express';
import * as ipoService from '../services/ipoService';
import { syncIPOList, fetchAndPersistIpoDetail, DETAIL_FRESHNESS_MS } from '../services/ipoSyncService';
import { getCache, deleteCachePattern } from '../lib/redis';
import { getQuotaStatus } from '../lib/quotaManager';
import { getSchedulerStatus } from '../lib/scheduler';
import prisma from '../lib/prisma';

// Get list of IPOs with filtering
export const getIPOs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, segment, search, skipCache } = req.query;
    const ipos = await ipoService.getIPOs(
      {
        status: status as string,
        segment: segment as string,
        search: search as string,
      },
      { skipCache: skipCache === 'true' }
    );

    const lastSyncFromCache = await getCache<string>('indianapi:ipo:last_sync_timestamp');
    let lastSyncTimestamp = lastSyncFromCache;
    if (!lastSyncTimestamp) {
      const latestIpo = await prisma.iPO.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      });
      lastSyncTimestamp = latestIpo?.updatedAt?.toISOString() || null;
    }

    res.json({
      success: true,
      data: ipos,
      count: ipos.length,
      lastSyncTimestamp,
    });
  } catch (error: any) {
    console.error('Error fetching IPOs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPOs',
      error: error.message,
    });
  }
};

// Get single IPO by ID or symbol (On-demand refresh only when missing or stale > 30m)
export const getIPOById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { skipCache, enrich, force } = req.query;
    if (!id) {
      res.status(400).json({ success: false, message: 'IPO id or symbol is required' });
      return;
    }

    const cleanId = id.toLowerCase().trim();
    let ipo = await ipoService.getIPOByIdOrSymbol(cleanId, { skipCache: skipCache === 'true' });

    // Case D: Record does not exist in DB or cache -> On-demand fetch
    if (!ipo) {
      const fetchResult = await fetchAndPersistIpoDetail(cleanId).catch(() => null);
      if (fetchResult?.data) {
        ipo = await ipoService.getIPOByIdOrSymbol(cleanId, { skipCache: true });
      }
    }

    if (!ipo) {
      res.status(404).json({ success: false, message: `IPO "${id}" not found` });
      return;
    }

    // Determine freshness (30-minute policy)
    const now = Date.now();
    const lastFetched = ipo.lastFetchedAt ? new Date(ipo.lastFetchedAt).getTime() : 0;
    const isStale = !lastFetched || (now - lastFetched) >= DETAIL_FRESHNESS_MS;
    let refreshFailed = ipo.lastRefreshStatus === 'FAILED';

    const sub = (ipo.subscription as any) || {};
    const hasDetailedData = Boolean(
      (Array.isArray(sub.daily) && sub.daily.length > 0) ||
      sub.latestCategories != null ||
      sub.qib != null ||
      sub.nii != null ||
      sub.rii != null ||
      (ipo.registrar as any)?.contact?.person ||
      (ipo.valuation as any)?.rhpUrl
    );

    // Case C: Stale data (> 30m), missing detailed subscription/registrar data, or explicit force refresh -> Trigger controlled on-demand refresh
    if ((isStale || !hasDetailedData || force === 'true') && (enrich !== 'false')) {
      const refreshedResult = await fetchAndPersistIpoDetail(cleanId, { force: force === 'true' || !hasDetailedData }).catch((err) => ({
        data: null,
        isStale: true,
        refreshFailed: true,
        error: err.message,
      }));

      if (refreshedResult?.data) {
        const refreshed = await ipoService.getIPOByIdOrSymbol(cleanId, { skipCache: true });
        if (refreshed) {
          ipo = refreshed;
          refreshFailed = false;
        }
      } else if (refreshedResult?.refreshFailed) {
        refreshFailed = true;
      }
    }

    res.json({
      success: true,
      data: {
        ...ipo,
        isStale,
        refreshFailed,
      },
    });
  } catch (error: any) {
    console.error(`Error fetching IPO ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch IPO details',
      error: error.message,
    });
  }
};

// Get Grey Market Premium (GMP) summary
export const getGMPSummary = async (_req: Request, res: Response): Promise<void> => {
  try {
    const gmpList = await ipoService.getGMPSummary();
    res.json({
      success: true,
      data: gmpList,
    });
  } catch (error: any) {
    console.error('Error fetching GMP summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GMP summary',
      error: error.message,
    });
  }
};

// Create new IPO (Admin)
export const createIPO = async (req: Request, res: Response): Promise<void> => {
  try {
    const newIPO = await ipoService.createIPO(req.body);
    res.status(201).json({
      success: true,
      message: 'IPO created successfully',
      data: newIPO,
    });
  } catch (error: any) {
    console.error('Error creating IPO:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create IPO',
      error: error.message,
    });
  }
};

// Update existing IPO (Admin)
export const updateIPO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updated = await ipoService.updateIPO(id, req.body);
    if (!updated) {
      res.status(404).json({ success: false, message: `IPO "${id}" not found` });
      return;
    }
    res.json({
      success: true,
      message: 'IPO updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error(`Error updating IPO ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to update IPO',
      error: error.message,
    });
  }
};

// Delete IPO (Admin)
export const deleteIPO = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const deleted = await ipoService.deleteIPO(id);
    if (!deleted) {
      res.status(404).json({ success: false, message: `IPO "${id}" not found` });
      return;
    }
    res.json({
      success: true,
      message: 'IPO deleted successfully',
    });
  } catch (error: any) {
    console.error(`Error deleting IPO ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete IPO',
      error: error.message,
    });
  }
};

// Quick GMP Update (Admin)
export const updateIPOGmp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { gmp, date } = req.body;
    if (gmp === undefined || typeof gmp !== 'number') {
      res.status(400).json({ success: false, message: 'Valid GMP number is required' });
      return;
    }
    const updated = await ipoService.updateIPOGmp(id, gmp, date);
    if (!updated) {
      res.status(404).json({ success: false, message: `IPO "${id}" not found` });
      return;
    }
    res.json({
      success: true,
      message: 'GMP updated successfully',
      data: updated,
    });
  } catch (error: any) {
    console.error(`Error updating GMP for IPO ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: 'Failed to update GMP',
      error: error.message,
    });
  }
};

// Verify Admin Key
export const verifyAdminKey = async (_req: Request, res: Response): Promise<void> => {
  res.json({
    success: true,
    message: 'Admin security passcode verified successfully',
  });
};

// Force Sync IPOs with API (Admin Triggered)
export const syncIPOs = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminKey = req.headers['x-admin-key'] as string;
    const initiatedBy = adminKey ? 'ADMIN_CONSOLE' : 'AUTHENTICATED_ADMIN';

    const syncResult = await syncIPOList('ADMIN', initiatedBy);
    const ipos = await ipoService.getIPOs(undefined, { skipCache: true });
    const lastSyncFromCache = await getCache<string>('indianapi:ipo:last_sync_timestamp');
    const lastSyncTimestamp = lastSyncFromCache || new Date().toISOString();

    if (!syncResult.success && syncResult.status === 'SKIPPED') {
      res.status(409).json({
        success: false,
        message: syncResult.message,
        jobId: syncResult.jobId,
        status: syncResult.status,
      });
      return;
    }

    if (!syncResult.success) {
      res.status(502).json({
        success: false,
        message: syncResult.message,
        jobId: syncResult.jobId,
        status: syncResult.status,
        datasets: syncResult.datasets,
      });
      return;
    }

    res.json({
      success: true,
      message: syncResult.message,
      jobId: syncResult.jobId,
      status: syncResult.status,
      datasets: syncResult.datasets,
      data: ipos,
      count: ipos.length,
      lastSyncTimestamp,
      providerRequestsAttempted: syncResult.providerRequestsAttempted,
    });
  } catch (error: any) {
    console.error('Error syncing IPOs from API:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync IPOs from live API',
      error: error.message,
    });
  }
};

// Admin Status View: Exposes operational quota status, recent sync jobs, and dataset health
export const getSyncStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const quota = await getQuotaStatus('indianapi');
    const scheduler = getSchedulerStatus();
    const recentJobs = await prisma.iPOSyncJob.findMany({
      take: 10,
      orderBy: { startedAt: 'desc' },
    });
    const datasetSyncs = await prisma.iPODatasetSync.findMany();

    res.json({
      success: true,
      data: {
        quota,
        scheduler,
        recentJobs,
        datasetSyncs,
      },
    });
  } catch (error: any) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve synchronization status',
      error: error.message,
    });
  }
};

// Admin Cache Refresh: Invalidates cache and reloads from PostgreSQL without making third-party API calls
export const refreshIpoCache = async (_req: Request, res: Response): Promise<void> => {
  try {
    await deleteCachePattern('ipo:list:*');
    await deleteCachePattern('ipos:list:*');
    const ipos = await ipoService.getIPOs(undefined, { skipCache: true });
    res.json({
      success: true,
      message: 'IPO cache successfully reloaded from PostgreSQL (0 third-party provider calls consumed).',
      count: ipos.length,
    });
  } catch (error: any) {
    console.error('Error refreshing IPO cache:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to refresh cache',
      error: error.message,
    });
  }
};
