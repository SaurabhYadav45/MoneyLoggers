import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getCache, setCache } from '../lib/redis';

interface PlatformPage {
  title: string;
  description: string;
  path: string;
  category: string;
  keywords: string[];
}

const PLATFORM_PAGES: PlatformPage[] = [
  {
    title: 'Market Dashboard',
    description: 'Indices, market turnover, sector performance & top gainers/losers',
    path: '/',
    category: 'Overview',
    keywords: ['dashboard', 'home', 'market', 'indices', 'nifty', 'sensex', 'turnover', 'gainers', 'losers']
  },
  {
    title: 'Institutional Stock Screener',
    description: '40+ fundamental, valuation & technical metrics with custom formula builder',
    path: '/screeners',
    category: 'Equities',
    keywords: ['screener', 'stocks', 'equities', 'pe ratio', 'roe', 'formula', 'filter', 'preset', 'valuation', 'scanner']
  },
  {
    title: 'Mutual Funds Explorer',
    description: '100% real NAVs, 3Y returns, curated collections & multi-scheme compare',
    path: '/mutual-funds',
    category: 'Funds',
    keywords: ['mutual funds', 'mf', 'sip', 'nav', 'returns', 'quant', 'parag parikh', 'elss', 'direct growth', 'compare']
  },
  {
    title: 'IPO Intelligence Hub',
    description: 'Live & upcoming Mainboard/SME IPOs, Grey Market Premiums (GMP) & allotment',
    path: '/ipo',
    category: 'Primary Market',
    keywords: ['ipo', 'initial public offering', 'gmp', 'grey market', 'bidding', 'allotment', 'subscription', 'sme', 'mainboard']
  },
  {
    title: 'Portfolio Tracker',
    description: 'Holdings overview, total net worth, unrealized P&L & asset allocation breakdown',
    path: '/portfolio',
    category: 'Portfolio',
    keywords: ['portfolio', 'holdings', 'net worth', 'pnl', 'profit', 'investment', 'tracking']
  },
  {
    title: 'Portfolio AI Optimization',
    description: 'Markowitz Modern Portfolio Theory, Sharpe ratio maximization & rebalancing',
    path: '/portfolio-optimization',
    category: 'Portfolio',
    keywords: ['optimization', 'markowitz', 'sharpe', 'efficient frontier', 'risk', 'rebalance', 'ai']
  },
  {
    title: 'ETFs Explorer',
    description: 'Index ETFs, Gold, Silver, Debt & Global ETFs listed on NSE/BSE',
    path: '/etfs',
    category: 'Funds',
    keywords: ['etf', 'exchange traded fund', 'gold', 'silver', 'nifty beES', 'index fund']
  },
  {
    title: 'Global Sentiments',
    description: 'FII/DII institutional cash flow, Global Futures, Commodities & Bond Yields',
    path: '/global-sentiments',
    category: 'Market Pulse',
    keywords: ['sentiment', 'fii', 'dii', 'global', 'crude', 'dollar', 'us 10y', 'bonds', 'nasdaq', 'dow']
  },
  {
    title: 'Financial News Feed',
    description: 'Real-time corporate announcements, macroeconomic trends & sector updates',
    path: '/news',
    category: 'Insights',
    keywords: ['news', 'headlines', 'macro', 'rbi', 'fed', 'announcements', 'earnings']
  },
  {
    title: 'Market Prediction',
    description: 'AI sentiment predictions & volatility index forecasts',
    path: '/prediction',
    category: 'Insights',
    keywords: ['prediction', 'forecast', 'ai prediction', 'trend', 'bullish', 'bearish']
  }
];

export const omniSearchHandler = async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const cleanQuery = query.toLowerCase();

    // Cache key for popular or repeated searches (10-minute cache)
    const cacheKey = `search:omni:${cleanQuery || 'default'}`;
    const cached = await getCache<any>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 1. Match Platform Pages
    const matchedPages = PLATFORM_PAGES.filter((page) => {
      if (!cleanQuery) return true; // Show all or top 4 if empty
      return (
        page.title.toLowerCase().includes(cleanQuery) ||
        page.description.toLowerCase().includes(cleanQuery) ||
        page.keywords.some((k) => k.includes(cleanQuery))
      );
    }).slice(0, cleanQuery ? 3 : 4);

    let stocks: any[] = [];
    let mutualFunds: any[] = [];
    let ipos: any[] = [];

    if (!cleanQuery) {
      // Default / empty query suggestions (top liquid assets)
      const [topStocks, topFunds, topIpos] = await Promise.all([
        prisma.stock.findMany({
          take: 4,
          orderBy: { marketCap: 'desc' },
          select: {
            symbol: true,
            name: true,
            sector: true,
            price: true,
            dayChangePercent: true,
            marketCapCategory: true,
            marketCap: true,
          }
        }),
        prisma.mutualFund.findMany({
          take: 3,
          orderBy: { returns3Y: 'desc' },
          select: {
            id: true,
            schemeCode: true,
            name: true,
            fundHouse: true,
            category: true,
            subCategory: true,
            currentNav: true,
            returns3Y: true,
          }
        }),
        prisma.iPO.findMany({
          take: 3,
          where: {
            status: { in: ['open', 'upcoming'] }
          },
          select: {
            id: true,
            symbol: true,
            name: true,
            segment: true,
            status: true,
            issuePrice: true,
            gmpData: true,
          }
        })
      ]);

      stocks = topStocks;
      mutualFunds = topFunds;
      ipos = topIpos;
    } else {
      // Execute fast parallel Prisma queries across indexed columns
      const [stockResults, fundResults, ipoResults] = await Promise.all([
        prisma.stock.findMany({
          where: {
            OR: [
              { symbol: { contains: cleanQuery, mode: 'insensitive' } },
              { name: { contains: cleanQuery, mode: 'insensitive' } },
              { sector: { contains: cleanQuery, mode: 'insensitive' } },
              { industry: { contains: cleanQuery, mode: 'insensitive' } },
            ]
          },
          take: 5,
          orderBy: { marketCap: 'desc' },
          select: {
            symbol: true,
            name: true,
            sector: true,
            price: true,
            dayChangePercent: true,
            marketCapCategory: true,
            marketCap: true,
          }
        }),
        prisma.mutualFund.findMany({
          where: {
            OR: [
              { name: { contains: cleanQuery, mode: 'insensitive' } },
              { fundHouse: { contains: cleanQuery, mode: 'insensitive' } },
              { subCategory: { contains: cleanQuery, mode: 'insensitive' } },
              { category: { contains: cleanQuery, mode: 'insensitive' } },
            ]
          },
          take: 4,
          orderBy: { returns3Y: 'desc' },
          select: {
            id: true,
            schemeCode: true,
            name: true,
            fundHouse: true,
            category: true,
            subCategory: true,
            currentNav: true,
            returns3Y: true,
          }
        }),
        prisma.iPO.findMany({
          where: {
            OR: [
              { name: { contains: cleanQuery, mode: 'insensitive' } },
              { symbol: { contains: cleanQuery, mode: 'insensitive' } },
            ]
          },
          take: 3,
          select: {
            id: true,
            symbol: true,
            name: true,
            segment: true,
            status: true,
            issuePrice: true,
            gmpData: true,
          }
        })
      ]);

      stocks = stockResults;
      mutualFunds = fundResults;
      ipos = ipoResults;
    }

    // Format results with clean numeric conversions
    const formattedStocks = stocks.map((s) => ({
      symbol: s.symbol,
      name: s.name,
      sector: s.sector,
      price: Number(s.price || 0),
      dayChangePercent: Number(s.dayChangePercent || 0),
      marketCapCategory: s.marketCapCategory || 'Large',
      marketCap: Number(s.marketCap || 0),
    }));

    const formattedMutualFunds = mutualFunds.map((mf) => ({
      id: mf.id,
      schemeCode: mf.schemeCode,
      name: mf.name,
      fundHouse: mf.fundHouse,
      category: mf.category,
      subCategory: mf.subCategory,
      nav: Number(mf.currentNav || 0),
      returns3Y: Number(mf.returns3Y || 0),
    }));

    const formattedIpos = ipos.map((ipo) => ({
      id: ipo.id,
      symbol: ipo.symbol,
      name: ipo.name,
      segment: ipo.segment,
      status: ipo.status,
      issuePrice: Number(ipo.issuePrice || 0),
      estimatedGainPercent: Number((ipo.gmpData as any)?.estimatedGainPercent || 0),
    }));

    let newsArticles: any[] = [];
    if (!cleanQuery) {
      newsArticles = await prisma.marketNews.findMany({
        take: 3,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          source: true,
          publishedAt: true,
          sentiment: true,
          url: true,
          relatedSymbols: true
        }
      });
    } else {
      newsArticles = await prisma.marketNews.findMany({
        where: {
          OR: [
            { title: { contains: cleanQuery, mode: 'insensitive' } },
            { summary: { contains: cleanQuery, mode: 'insensitive' } },
            { relatedSymbols: { has: cleanQuery.toUpperCase() } }
          ]
        },
        take: 3,
        orderBy: { publishedAt: 'desc' },
        select: {
          id: true,
          title: true,
          category: true,
          source: true,
          publishedAt: true,
          sentiment: true,
          url: true,
          relatedSymbols: true
        }
      });
    }

    const formattedNews = newsArticles.map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      source: n.source,
      publishedAt: n.publishedAt,
      sentiment: n.sentiment,
      relatedSymbols: n.relatedSymbols || []
    }));

    const totalHits =
      formattedStocks.length +
      formattedMutualFunds.length +
      formattedIpos.length +
      matchedPages.length +
      formattedNews.length;

    const responsePayload = {
      query,
      totalHits,
      stocks: formattedStocks,
      mutualFunds: formattedMutualFunds,
      ipos: formattedIpos,
      pages: matchedPages,
      news: formattedNews
    };

    // Cache in Redis for 5 minutes (300 seconds)
    await setCache(cacheKey, responsePayload, 300);

    return res.json(responsePayload);
  } catch (error: any) {
    console.error('OmniSearch error:', error);
    return res.status(500).json({
      error: 'Failed to perform omni search',
      details: error.message
    });
  }
};
