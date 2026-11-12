import { Request, Response } from 'express';
import axios from 'axios';
import * as stockService from '../services/stockService';
import * as chartService from '../services/chartService';
import { setCache, getCache } from '../lib/redis';
import { getUpstoxAccessToken, invalidateUpstoxToken } from '../services/upstoxService';

// Get top gainers
export const getTopGainers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const gainers = await stockService.getTopGainers();
    res.json(gainers);
  } catch (error: any) {
    console.error('Error in getTopGainers controller:', error.message);
    res.status(500).json({ message: 'Server error fetching top gainers', error: error.message });
  }
};

// Get top losers
export const getTopLosers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const losers = await stockService.getTopLosers();
    res.json(losers);
  } catch (error: any) {
    console.error('Error in getTopLosers controller:', error.message);
    res.status(500).json({ message: 'Server error fetching top losers', error: error.message });
  }
};

// Get most active stocks
export const getMostActive = async (_req: Request, res: Response): Promise<void> => {
  try {
    const active = await stockService.getMostActive();
    res.json(active);
  } catch (error: any) {
    console.error('Error in getMostActive controller:', error.message);
    res.status(500).json({ message: 'Server error fetching most active stocks', error: error.message });
  }
};

// Get 52-week high breakouts
export const getBreakouts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const breakouts = await stockService.getBreakouts();
    res.json(breakouts);
  } catch (error: any) {
    console.error('Error in getBreakouts controller:', error.message);
    res.status(500).json({ message: 'Server error fetching breakouts', error: error.message });
  }
};

// Get market indices
export const getMarketIndices = async (_req: Request, res: Response): Promise<void> => {
  try {
    const indices = await stockService.getMarketIndices();
    res.json(indices);
  } catch (error: any) {
    console.error('Error in getMarketIndices controller:', error.message);
    res.status(500).json({ message: 'Server error fetching market indices', error: error.message });
  }
};

// Get historical chart data for indices or stocks
export const getChartData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { symbol } = req.params;
    const range = (req.query.range as string) || '1mo';
    const interval = req.query.interval as string | undefined;

    const data = await chartService.getHistoricalChartData(symbol, range, interval);
    res.json(data);
  } catch (error: any) {
    console.error('Error in getChartData controller:', error.message);
    res.status(500).json({ message: 'Server error fetching chart data', error: error.message });
  }
};

// Get latest news
export const getLatestNews = async (_req: Request, res: Response): Promise<void> => {
  try {
    const news = await stockService.getLatestNews();
    res.json(news);
  } catch (error: any) {
    console.error('Error in getLatestNews controller:', error.message);
    res.status(500).json({ message: 'Server error fetching latest news', error: error.message });
  }
};

// Search stocks
export const searchStocks = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      res.status(400).json({ message: 'Query parameter is required' });
      return;
    }
    
    const results = await stockService.searchStocks(query);
    res.json(results);
  } catch (error: any) {
    console.error('Error in searchStocks controller:', error.message);
    res.status(500).json({ message: 'Server error searching stocks', error: error.message });
  }
};

// Get Upstox official OAuth Login URL
export const getUpstoxAuthUrl = (_req: Request, res: Response): void => {
  const apiKey = process.env.UPSTOX_API_KEY;
  const redirectUri = encodeURIComponent(process.env.UPSTOX_REDIRECT_URI || 'http://localhost:5000/api/v1/stocks/upstox/callback');
  if (!apiKey) {
    res.status(400).json({ success: false, message: 'UPSTOX_API_KEY not configured in backend environment' });
    return;
  }
  const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${apiKey}&redirect_uri=${redirectUri}`;
  res.json({ success: true, url });
};

// Handle Upstox OAuth redirect callback to exchange code for access_token
export const handleUpstoxCallback = async (req: Request, res: Response): Promise<void> => {
  const { code } = req.query;
  if (!code || typeof code !== 'string') {
    res.status(400).send('Authorization code missing from Upstox redirect');
    return;
  }
  try {
    const redirectUri = process.env.UPSTOX_REDIRECT_URI || 'http://localhost:5000/api/v1/stocks/upstox/callback';
    const params = new URLSearchParams({
      code,
      client_id: process.env.UPSTOX_API_KEY || '',
      client_secret: process.env.UPSTOX_API_SECRET || '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    });

    const response = await axios.post('https://api.upstox.com/v2/login/authorization/token', params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    });

    const token = response.data?.access_token;
    if (token) {
      process.env.UPSTOX_ACCESS_TOKEN = token;
      // Persist across worker restarts and Redis
      await setCache('upstox:auth:access_token', token, 86400);
      await setCache('upstox:auth:token_info', {
        status: 'ACTIVE',
        obtainedAt: new Date().toISOString(),
        expiresIn: response.data?.expires_in || 86400
      }, 86400);

      res.send(`
        <html>
          <head>
            <title>Upstox Connected - MoneyLogger</title>
          </head>
          <body style="font-family:system-ui, -apple-system, sans-serif; text-align:center; padding: 50px; background:#0f172a; color:#f8fafc;">
            <div style="max-width: 480px; margin: 0 auto; background: #1e293b; padding: 32px; border-radius: 16px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
              <div style="font-size: 40px; margin-bottom: 12px;">✅</div>
              <h1 style="color:#10b981; font-size: 22px; margin-bottom: 8px;">Upstox Token Refreshed Successfully!</h1>
              <p style="color:#94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">Your session token is active for today's trading day (expires at 03:30 AM IST tomorrow).</p>
              <p><a href="/admin/ipo" style="display:inline-block; background:#4f46e5; color:#ffffff; padding: 10px 20px; border-radius: 8px; font-weight:600; text-decoration:none; font-size:14px;">Return to Admin Console</a></p>
              <p style="color:#64748b; font-size: 12px; margin-top: 16px;">This window will close automatically...</p>
            </div>
            <script>
              try {
                if (window.opener) {
                  window.opener.postMessage({ type: 'UPSTOX_AUTH_SUCCESS' }, '*');
                  setTimeout(() => window.close(), 1200);
                }
              } catch (e) {}
            </script>
          </body>
        </html>
      `);
      return;
    }
    res.status(500).send('Failed to obtain access token from Upstox');
  } catch (err: any) {
    console.error('Error in Upstox callback:', err.response?.data || err.message);
    res.status(500).send('Upstox Authentication Error: ' + (err.response?.data?.message || err.message));
  }
};

// Check Upstox Authentication and Token Health Status
export const getUpstoxStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const token = await getUpstoxAccessToken();
    const tokenInfo = await getCache<any>('upstox:auth:token_info');
    res.json({
      success: true,
      configured: !!process.env.UPSTOX_API_KEY,
      hasActiveToken: !!token,
      tokenInfo: tokenInfo || null,
      message: token
        ? 'Upstox session token is active and ready for live market queries.'
        : 'Upstox session token is expired or not configured. Re-authenticate via /api/v1/stocks/upstox/auth-url.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error checking Upstox status', error: error.message });
  }
};

// Disconnect / Invalidate Upstox Session Token
export const disconnectUpstox = async (_req: Request, res: Response): Promise<void> => {
  try {
    await invalidateUpstoxToken();
    res.json({
      success: true,
      message: 'Upstox session disconnected successfully.'
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Error disconnecting Upstox session', error: error.message });
  }
};
