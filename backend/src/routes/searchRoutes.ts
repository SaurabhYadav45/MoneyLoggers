import express from 'express';
import { omniSearchHandler } from '../controllers/omniSearchController';

const router = express.Router();

// GET /api/v1/search?q={query}
router.get('/', omniSearchHandler);

export default router;
