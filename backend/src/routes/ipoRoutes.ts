import express from 'express';
import { 
  getIPOs, 
  getIPOById, 
  getGMPSummary,
  createIPO,
  updateIPO,
  deleteIPO,
  updateIPOGmp,
  verifyAdminKey,
  syncIPOs,
  getSyncStatus,
  refreshIpoCache
} from '../controllers/ipoController';
import { adminAuth, sanitizeIPOInput } from '../middleware/adminAuth';

const router = express.Router();

// Admin Status & Operational routes (Must precede /:id)
router.get('/admin/sync-status', adminAuth, getSyncStatus);
router.post('/admin/refresh-cache', adminAuth, refreshIpoCache);
router.post('/admin/verify', adminAuth, verifyAdminKey);

// Public routes (Read-only)
router.get('/gmp', getGMPSummary);
router.get('/:id', getIPOById);
router.get('/', getIPOs);

// Protected Admin mutations (Requires x-admin-key)
router.post('/sync', adminAuth, syncIPOs);
router.post('/', adminAuth, sanitizeIPOInput, createIPO);
router.put('/:id', adminAuth, sanitizeIPOInput, updateIPO);
router.delete('/:id', adminAuth, deleteIPO);
router.patch('/:id/gmp', adminAuth, updateIPOGmp);

export default router;
