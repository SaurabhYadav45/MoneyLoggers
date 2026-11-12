import { Router } from 'express';
import {
  getGlobalSentiments,
  getFIIDIIActivity,
  getGiftNiftyGap
} from '../controllers/globalSentimentController';

const router = Router();

// Full global sentiment dataset
router.get('/', getGlobalSentiments);

// Sub-endpoints for fast widgets
router.get('/fii-dii', getFIIDIIActivity);
router.get('/gift-nifty-gap', getGiftNiftyGap);

export default router;
