import 'dotenv/config';
import dns from 'dns';

// Prefer IPv4 for DNS resolution to avoid IPv6 timeout and lookup issues (ENOTFOUND / ETIMEDOUT)
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import stockRoutes from './routes/stockRoutes';
import mutualFundRoutes from './routes/mutualFundRoutes';
import ipoRoutes from './routes/ipoRoutes';
import searchRoutes from './routes/searchRoutes';
import newsRoutes from './routes/newsRoutes';
import globalSentimentRoutes from './routes/globalSentimentRoutes';
import errorHandler from './middleware/errorHandler';
import logger from './middleware/logger';

import prisma from './lib/prisma';
import './lib/redis';
import { getQuotaStatus } from './lib/quotaManager';
import { initScheduler, getSchedulerStatus } from './lib/scheduler';

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to PostgreSQL (Neon) with auto-retry for wake-up / cold start
async function connectPostgres(retries = 3, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await prisma.$connect();
      console.log('🐘 Connected to Neon PostgreSQL');
      return;
    } catch (err: any) {
      if (attempt < retries) {
        console.warn(`⚠️ [PostgreSQL]: Connection attempt ${attempt}/${retries} failed (${err.message}). Neon may be waking up from sleep. Retrying in ${delayMs / 1000}s...`);
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        console.error('❌ PostgreSQL connection error: Could not reach database server after retries:', err.message);
        console.error('👉 Please check your internet connection or verify Neon database status at neon.tech.');
      }
    }
  }
}

connectPostgres();

// Middleware
app.use(cors());
app.use(express.json());
app.use(logger); // Request logger

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/stocks', stockRoutes);
app.use('/api/v1/mutual-funds', mutualFundRoutes);
app.use('/api/v1/ipos', ipoRoutes);
app.use('/api/v1/search', searchRoutes);
app.use('/api/v1/news', newsRoutes);
app.use('/api/v1/global-sentiments', globalSentimentRoutes);

app.get('/', (_req, res) => {
  res.json({ message: 'MoneyLogger Server is running!' });
});

app.get('/api/health', async (_req, res) => {
  try {
    const indianApiStatus = await getQuotaStatus('indianapi');
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      indianApiQuota: {
        usedToday: indianApiStatus.currentUsage,
        dailyLimit: indianApiStatus.limit,
        remaining: indianApiStatus.remaining,
        circuitBreaker: indianApiStatus.circuitState
      }
    });
  } catch (err: any) {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  }
});

app.get('/api/v1/quota', async (_req, res) => {
  try {
    const [indianapi, upstox, yahoo, mfapi] = await Promise.all([
      getQuotaStatus('indianapi'),
      getQuotaStatus('upstox'),
      getQuotaStatus('yahoo'),
      getQuotaStatus('mfapi')
    ]);
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      providers: { indianapi, upstox, yahoo, mfapi }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/v1/scheduler', (_req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    jobs: getSchedulerStatus()
  });
});

// Error handler middleware (should be last)
app.use(errorHandler);

// Start server
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT} (0.0.0.0)`);
  initScheduler();
});

export default app;
