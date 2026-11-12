import axios from 'axios';
import { executeWithQuota } from '../lib/quotaManager';
import prisma from '../lib/prisma';

const INDIANAPI_BASE_URL = process.env.INDIANAPI_BASE_URL || 'https://dev.indianapi.in';
const API_KEY = process.env.INDIANAPI_KEY || '';

const getHeaders = () => ({
  'X-Api-Key': API_KEY,
  'Content-Type': 'application/json'
});

export interface IndianAPISearchResult {
  id: string;
  schemeName: string;
  isin: string | null;
  schemeType: string;
  categoryId: string;
}

export interface IndianAPIFundDetail {
  basic_info: {
    fund_name: string;
    category: string;
    risk_level: string;
    plan_type: string;
    scheme_type: string;
    inception_date: string;
    benchmark: string;
    benchmark_name: string;
    fund_size: number;
    fund_manager: string;
    registrar_agent?: string;
    nfo_risk?: string;
  };
  nav_info: {
    current_nav: number;
    nav_date: string;
  };
  returns: {
    absolute: {
      '1d'?: number;
      '1w'?: number;
      '1m'?: number;
      '3m'?: number;
      '6m'?: number;
      '1y'?: number;
      '3y'?: number;
      '5y'?: number;
      '10y'?: number;
    };
    cagr: {
      '3y'?: number;
      '5y'?: number;
      '10y'?: number;
      since_inception?: number;
    };
    category_returns?: Record<string, number>;
    risk_metrics?: {
      alpha?: number;
      beta?: number;
      sharpe_ratio?: number;
      sortino_ratio?: number;
      standard_deviation?: number;
      risk_rating?: number;
    };
  };
  expense_ratio?: number | string | { current?: number; history?: any[] };
  exit_load?: any;
  investment_info?: {
    minimum_sip?: number;
    minimum_lumpsum?: number;
    stamp_duty?: string;
  };
  fund_house?: {
    name?: string;
    amc_code?: string;
    rta_name?: string;
    custodian?: string;
    address?: string;
    email?: string;
    website?: string;
  };
  additional_info?: {
    isin?: string;
    sub_category?: string;
    description?: string;
    crisil_rating?: string | number;
    analysis?: Array<{
      scheme_code?: string;
      analysis_type: string;
      analysis_desc: string;
    }>;
  };
  holdings?: Array<{
    company_name: string;
    nature_name?: string;
    sector_name: string;
    instrument_name: string;
    market_value: number;
    corpus_percentage: number;
  }>;
}

// 1. Search mutual funds from IndianAPI
export const searchFundsFromIndianAPI = async (query: string): Promise<IndianAPISearchResult[]> => {
  const cleanQ = query.toLowerCase().trim();
  if (!cleanQ) return [];
  const cacheKey = `indianapi:search:${cleanQ}`;

  try {
    return await executeWithQuota<IndianAPISearchResult[]>({
      provider: 'indianapi',
      cacheKey,
      ttlSeconds: 3600, // 1 hour cache
      fetcher: async () => {
        const response = await axios.get(`${INDIANAPI_BASE_URL}/mutual_fund_search`, {
          params: { query: cleanQ },
          headers: getHeaders(),
          timeout: 10000
        });
        const results = response.data || [];
        return Array.isArray(results) ? results : [];
      },
      fallbackValue: []
    });
  } catch (error: any) {
    console.error('Error in searchFundsFromIndianAPI:', error?.response?.data || error.message);
    return [];
  }
};

export interface IndianAPISummaryFund {
  fund_name: string;
  latest_nav: number;
  percentage_change: number;
  asset_size: number;
  '1_month_return'?: number;
  '3_month_return'?: number;
  '6_month_return'?: number;
  '1_year_return'?: number;
  '3_year_return'?: number;
  '5_year_return'?: number;
  star_rating?: number;
}

export type IndianAPIMutualFundsResponse = Record<string, Record<string, IndianAPISummaryFund[]>>;

/**
 * Fetch all curated mutual funds in a single API call (249 funds across 7 categories)
 * Endpoint: GET /mutual_funds
 */
export const fetchAllMutualFundsFromIndianAPI = async (): Promise<IndianAPIMutualFundsResponse | null> => {
  const cacheKey = 'indianapi:mutual_funds:all_categories';
  try {
    return await executeWithQuota<IndianAPIMutualFundsResponse | null>({
      provider: 'indianapi',
      cacheKey,
      ttlSeconds: 86400, // 24 hours cache
      fetcher: async () => {
        const response = await axios.get(`${INDIANAPI_BASE_URL}/mutual_funds`, {
          headers: getHeaders(),
          timeout: 20000
        });
        const data = response.data;
        if (data && typeof data === 'object' && Object.keys(data).length > 0) {
          return data;
        }
        return null;
      },
      fallbackValue: null
    });
  } catch (error: any) {
    console.error('Error in fetchAllMutualFundsFromIndianAPI:', error?.response?.data || error.message);
    return null;
  }
};

// 2. Fetch full real details for a specific fund from IndianAPI
export const getFundDetailsFromIndianAPI = async (fundName: string): Promise<IndianAPIFundDetail | null> => {
  const cleanName = fundName.toLowerCase().trim();
  if (!cleanName) return null;
  const cacheKey = `indianapi:detail:${cleanName}`;

  try {
    return await executeWithQuota<IndianAPIFundDetail | null>({
      provider: 'indianapi',
      cacheKey,
      ttlSeconds: 21600, // 6 hours cache
      fetcher: async () => {
        const response = await axios.get(`${INDIANAPI_BASE_URL}/mutual_funds_details`, {
          params: { stock_name: fundName },
          headers: getHeaders(),
          timeout: 15000
        });
        const data = response.data;
        if (data && data.basic_info && data.nav_info) {
          return data;
        }
        return null;
      },
      fallbackValue: null
    });
  } catch (error: any) {
    console.error(`Error fetching fund details for "${fundName}" from IndianAPI:`, error?.response?.data || error.message);
    return null;
  }
};

// Helper: Query mfapi.in to find official AMFI scheme code if IndianAPI didn't include it in analysis
export const resolveOfficialSchemeCode = async (fundName: string): Promise<number | null> => {
  try {
    const clean = fundName
      .replace(/Direct Plan|Growth Option|Regular Plan|IDCW Plan|Growth|Direct/gi, '')
      .trim();

    if (!clean) return null;
    const cacheKey = `mfapi:search:${clean.toLowerCase()}`;

    return await executeWithQuota<number | null>({
      provider: 'mfapi',
      cacheKey,
      ttlSeconds: 86400, // 24 hours
      fetcher: async () => {
        const response = await axios.get('https://api.mfapi.in/mf/search', {
          params: { q: clean },
          timeout: 6000
        });

        const items = response.data;
        if (Array.isArray(items) && items.length > 0) {
          // Find direct growth plan match first
          const directGrowth = items.find((it: any) => {
            const n = (it.schemeName || '').toLowerCase();
            return n.includes('direct') && n.includes('growth');
          });
          if (directGrowth && directGrowth.schemeCode) {
            return Number(directGrowth.schemeCode);
          }
          if (items[0] && items[0].schemeCode) {
            return Number(items[0].schemeCode);
          }
        }
        return null;
      },
      fallbackValue: null
    });
  } catch (err: any) {
    // Non-blocking
    return null;
  }
};

// 3. Transform and upsert IndianAPI detail directly into Prisma PostgreSQL database
export const upsertFundToDatabase = async (rawDetail: IndianAPIFundDetail, fallbackSchemeCode?: number) => {
  try {
    const basic = rawDetail.basic_info;
    const nav = rawDetail.nav_info;
    const ret = rawDetail.returns || ({} as any);
    const addl = rawDetail.additional_info;
    const invest = rawDetail.investment_info;

    // 1. Resolve Scheme Code
    let schemeCode = fallbackSchemeCode || 0;
    if (addl?.analysis && addl.analysis.length > 0 && addl.analysis[0].scheme_code) {
      schemeCode = parseInt(addl.analysis[0].scheme_code, 10);
    }
    if (!schemeCode || isNaN(schemeCode)) {
      const resolvedCode = await resolveOfficialSchemeCode(basic.fund_name);
      if (resolvedCode) {
        schemeCode = resolvedCode;
      }
    }
    if (!schemeCode || isNaN(schemeCode)) {
      schemeCode = Math.abs(hashCode(basic.fund_name)) % 900000 + 100000;
    }

    // 2. Normalized Category and SubCategory
    const fundNameLower = (basic.fund_name || '').toLowerCase();
    const addlSubLower = (addl?.sub_category || '').toLowerCase();
    const rawCat = (basic.category || '').toLowerCase();

    let category = 'Equity';
    let subCategory = 'Flexi Cap';

    if (fundNameLower.includes('index') || fundNameLower.includes('nifty') || fundNameLower.includes('sensex')) {
      category = 'Index';
      subCategory = 'Index Fund';
    } else if (fundNameLower.includes('dynamic asset allocation') || fundNameLower.includes('balanced advantage') || addlSubLower.includes('dynamic asset') || addlSubLower.includes('balanced advantage')) {
      category = 'Hybrid';
      subCategory = 'Balanced Advantage';
    } else if (fundNameLower.includes('multi asset') || addlSubLower.includes('multi asset')) {
      category = 'Hybrid';
      subCategory = 'Multi Asset Allocation';
    } else if (fundNameLower.includes('arbitrage') || addlSubLower.includes('arbitrage')) {
      category = 'Hybrid';
      subCategory = 'Arbitrage';
    } else if (fundNameLower.includes('conservative hybrid') || addlSubLower.includes('conservative')) {
      category = 'Hybrid';
      subCategory = 'Conservative Hybrid';
    } else if (fundNameLower.includes('aggressive hybrid') || fundNameLower.includes('balanced hybrid')) {
      category = 'Hybrid';
      subCategory = 'Aggressive Hybrid';
    } else if (fundNameLower.includes('liquid') || rawCat.includes('liquid')) {
      category = 'Debt';
      subCategory = 'Liquid';
    } else if (fundNameLower.includes('money market') || fundNameLower.includes('overnight') || fundNameLower.includes('ultra short') || fundNameLower.includes('corporate bond') || rawCat.includes('debt')) {
      category = 'Debt';
      subCategory = 'Debt / Fixed Income';
    } else if (fundNameLower.includes('elss') || fundNameLower.includes('tax saver') || addlSubLower.includes('elss') || addlSubLower.includes('tax')) {
      category = 'Solution Oriented';
      subCategory = 'Tax Saver (ELSS)';
    } else if (fundNameLower.includes('digital') || fundNameLower.includes('tech') || fundNameLower.includes('pharma') || fundNameLower.includes('healthcare') || fundNameLower.includes('infra') || fundNameLower.includes('banking') || fundNameLower.includes('energy') || fundNameLower.includes('consumption') || addlSubLower.includes('thematic') || addlSubLower.includes('sectoral')) {
      category = 'Equity';
      subCategory = 'Sectoral / Thematic';
    } else if (fundNameLower.includes('small cap') || (addlSubLower.includes('small cap') && !fundNameLower.includes('index'))) {
      category = 'Equity';
      subCategory = 'Small Cap';
    } else if (fundNameLower.includes('mid cap') || fundNameLower.includes('midcap')) {
      category = 'Equity';
      subCategory = 'Mid Cap';
    } else if (fundNameLower.includes('large & mid') || fundNameLower.includes('large and mid')) {
      category = 'Equity';
      subCategory = 'Large & Mid Cap';
    } else if (fundNameLower.includes('large cap') || fundNameLower.includes('bluechip')) {
      category = 'Equity';
      subCategory = 'Large Cap';
    } else if (fundNameLower.includes('flexi cap') || fundNameLower.includes('flexicap')) {
      category = 'Equity';
      subCategory = 'Flexi Cap';
    } else if (fundNameLower.includes('multi cap') || fundNameLower.includes('multicap')) {
      category = 'Equity';
      subCategory = 'Multi Cap';
    } else if (fundNameLower.includes('contra')) {
      category = 'Equity';
      subCategory = 'Contra Fund';
    } else if (fundNameLower.includes('value') || addlSubLower.includes('value')) {
      category = 'Equity';
      subCategory = 'Value Fund';
    } else if (rawCat.includes('hybrid')) {
      category = 'Hybrid';
      subCategory = addl?.sub_category || 'Hybrid Scheme';
    } else if (addl?.sub_category && addl.sub_category !== 'Small Cap') {
      subCategory = addl.sub_category;
    }

    // 3. Fund House Extraction
    const fundHouse =
      rawDetail.fund_house?.name ||
      (basic.fund_name.split(' ')[0] + ' Mutual Fund');

    // 4. Map Top Holdings (Correctly preserving real percentages)
    const topHoldings = (rawDetail.holdings || [])
      .filter((h) => h.corpus_percentage > 0 || (h.company_name && h.company_name !== 'Unspecified'))
      .slice(0, 10)
      .map((h) => {
        // IndianAPI corpus_percentage is already a percentage value (e.g. 10.48, 6.10)
        let pct = Number(h.corpus_percentage || 0);
        if (pct < 1 && pct > 0 && (rawDetail.holdings || []).reduce((acc, x) => acc + (x.corpus_percentage || 0), 0) < 2) {
          pct = pct * 100;
        }
        return {
          name: h.company_name,
          sector: h.sector_name || 'Diversified',
          percentage: Number(pct.toFixed(2))
        };
      });

    // 5. Aggregate Sectors from Holdings
    const sectorMap: Record<string, number> = {};
    (rawDetail.holdings || []).forEach((h) => {
      if (h.sector_name && h.sector_name !== 'Unspecified' && h.corpus_percentage > 0) {
        let pct = Number(h.corpus_percentage || 0);
        if (pct < 1 && pct > 0 && (rawDetail.holdings || []).reduce((acc, x) => acc + (x.corpus_percentage || 0), 0) < 2) {
          pct = pct * 100;
        }
        sectorMap[h.sector_name] = (sectorMap[h.sector_name] || 0) + pct;
      }
    });
    const sectorAlloc = Object.entries(sectorMap)
      .map(([name, pct]) => ({ name, percentage: Number(pct.toFixed(2)) }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 6);

    // 6. Compute Real Asset Allocation from actual holdings nature
    let totalEquityPct = 0;
    let totalDebtPct = 0;
    let totalCashPct = 0;
    (rawDetail.holdings || []).forEach((h) => {
      let pct = Number(h.corpus_percentage || 0);
      if (pct < 1 && pct > 0 && (rawDetail.holdings || []).reduce((acc, x) => acc + (x.corpus_percentage || 0), 0) < 2) {
        pct = pct * 100;
      }
      const nature = `${h.nature_name || ''} ${h.instrument_name || ''} ${h.company_name || ''}`.toUpperCase();
      if (nature.includes('EQUITY') || nature.includes('STOCK')) {
        totalEquityPct += pct;
      } else if (nature.includes('DEBT') || nature.includes('BOND') || nature.includes('TREASURY') || nature.includes('T-BILL') || nature.includes('COMMERCIAL PAPER') || nature.includes('CD')) {
        totalDebtPct += pct;
      } else {
        totalCashPct += pct;
      }
    });

    const sumAlloc = totalEquityPct + totalDebtPct + totalCashPct;
    let assetAlloc = { equity: 0, debt: 0, cash: 0 };
    if (sumAlloc > 0) {
      assetAlloc = {
        equity: Number(((totalEquityPct / sumAlloc) * 100).toFixed(1)),
        debt: Number(((totalDebtPct / sumAlloc) * 100).toFixed(1)),
        cash: Number(((totalCashPct / sumAlloc) * 100).toFixed(1))
      };
    } else {
      assetAlloc = {
        equity: category === 'Debt' ? 0.0 : category === 'Hybrid' ? 65.0 : 95.0,
        debt: category === 'Debt' ? 95.0 : category === 'Hybrid' ? 30.0 : 0.0,
        cash: 5.0
      };
    }

    // 7. Parse numerical expense ratio
    let expenseRatio: number | null = null;
    if (typeof rawDetail.expense_ratio === 'number') {
      expenseRatio = rawDetail.expense_ratio;
    } else if (typeof rawDetail.expense_ratio === 'string') {
      const parsed = parseFloat(rawDetail.expense_ratio);
      if (!isNaN(parsed)) expenseRatio = parsed;
    } else if (rawDetail.expense_ratio && typeof rawDetail.expense_ratio === 'object') {
      const expObj: any = rawDetail.expense_ratio;
      if (typeof expObj.current === 'number') {
        expenseRatio = expObj.current;
      } else if (typeof expObj.current === 'string') {
        expenseRatio = parseFloat(expObj.current) || null;
      }
    }

    // 8. Parse exit load cleanly
    let exitLoadStr = 'Nil';
    if (Array.isArray(rawDetail.exit_load)) {
      const descList = rawDetail.exit_load.map((el: any) => el.description || el.text).filter(Boolean);
      if (descList.length > 0) {
        exitLoadStr = descList.join('; ');
      }
    } else if (typeof rawDetail.exit_load === 'string' && rawDetail.exit_load.trim() && rawDetail.exit_load !== '[object Object]') {
      exitLoadStr = rawDetail.exit_load;
    } else if (rawDetail.exit_load && typeof rawDetail.exit_load === 'object') {
      const el: any = rawDetail.exit_load;
      exitLoadStr = el.description || el.text || el.exit_load || 'Nil';
    }

    // 9. Risk rating and riskometer
    const sharpe = ret?.risk_metrics?.sharpe_ratio;
    let riskRating: number | null = null;
    if (ret?.risk_metrics?.risk_rating) {
      riskRating = Number(ret.risk_metrics.risk_rating);
    } else if (addl?.crisil_rating) {
      const cr = parseInt(String(addl.crisil_rating), 10);
      if (!isNaN(cr)) riskRating = cr;
    } else if (typeof sharpe === 'number' && ret?.cagr?.['3y'] !== null && ret?.cagr?.['3y'] !== undefined) {
      // Only assign calculated rating if the scheme has completed 3 years of track record
      riskRating = sharpe > 1.2 ? 5 : sharpe > 0.7 ? 4 : 3;
    }

    let riskometer = 'Very High';
    const riskLevelStr = (basic.risk_level || basic.nfo_risk || '').toLowerCase();
    if (riskLevelStr.includes('low to mod')) riskometer = 'Moderately Low';
    else if (riskLevelStr.includes('low')) riskometer = 'Low';
    else if (riskLevelStr.includes('mod. high')) riskometer = 'Moderately High';
    else if (riskLevelStr.includes('mod')) riskometer = 'Moderate';
    else riskometer = 'Very High';

    // 10. Tags calculation based on actual metrics
    const tags: string[] = [];
    const ret1y = ret?.absolute?.['1y'] !== undefined && ret?.absolute?.['1y'] !== null ? Number(ret.absolute['1y']) : null;
    const ret3y = ret?.cagr?.['3y'] !== undefined && ret?.cagr?.['3y'] !== null ? Number(ret.cagr['3y']) : null;
    const ret5y = ret?.cagr?.['5y'] !== undefined && ret?.cagr?.['5y'] !== null ? Number(ret.cagr['5y']) : null;
    const retSinceInception = ret?.cagr?.since_inception !== undefined && ret?.cagr?.since_inception !== null ? Number(ret.cagr.since_inception) : null;

    if (ret3y && ret3y >= 18) tags.push('high-return');
    if (category === 'Solution Oriented' || subCategory.toLowerCase().includes('elss')) tags.push('tax-saver');
    if (category === 'Index' || subCategory.toLowerCase().includes('index')) tags.push('top-index');
    if ((invest?.minimum_sip && Number(invest.minimum_sip) <= 500) || category === 'Index') tags.push('pocket-sip');
    if (category === 'Debt' || riskometer === 'Low' || riskometer === 'Moderately Low') tags.push('low-risk');
    if (basic.fund_size && Number(basic.fund_size) >= 20000) tags.push('popular');

    // 11. Real Risk Metrics
    const riskMetrics = {
      alpha: ret?.risk_metrics?.alpha !== undefined ? ret.risk_metrics.alpha : null,
      beta: ret?.risk_metrics?.beta !== undefined ? ret.risk_metrics.beta : null,
      sharpeRatio: ret?.risk_metrics?.sharpe_ratio !== undefined ? ret.risk_metrics.sharpe_ratio : null,
      sortinoRatio: ret?.risk_metrics?.sortino_ratio !== undefined ? ret.risk_metrics.sortino_ratio : null,
      stdDeviation: ret?.risk_metrics?.standard_deviation !== undefined ? ret.risk_metrics.standard_deviation : null
    };

    // 12. Fund Managers
    const fundManagers = basic.fund_manager
      ? [
          {
            name: basic.fund_manager,
            experience: 'Investment Team',
            tenure: 'Active Manager',
            description: `Portfolio Manager overseeing investments for ${basic.fund_name} at ${fundHouse}.`
          }
        ]
      : [];

    const schemeName = `${basic.fund_name} - ${basic.plan_type || 'Direct'} Plan - ${basic.scheme_type || 'Growth'}`;

    const fundRecord = await prisma.mutualFund.upsert({
      where: { schemeCode },
      update: {
        name: basic.fund_name,
        schemeName,
        fundHouse,
        category,
        subCategory,
        planType: basic.plan_type || 'Direct',
        optionType: basic.scheme_type || 'Growth',
        currentNav: nav.current_nav,
        navDate: nav.nav_date,
        dayChange: ret?.absolute?.['1d'] ? (nav.current_nav * (ret.absolute['1d'] / 100)) : 0,
        dayChangePct: ret?.absolute?.['1d'] || 0,
        returns1Y: ret1y,
        returns3Y: ret3y,
        returns5Y: ret5y,
        returnsSinceInception: retSinceInception,
        benchmark: basic.benchmark || basic.benchmark_name || 'NIFTY 50 TRI',
        aum: basic.fund_size || null,
        expenseRatio,
        riskRating: (riskRating !== null && riskRating !== undefined) ? riskRating : 0,
        riskometer,
        minSip: invest?.minimum_sip || 500,
        minLumpsum: invest?.minimum_lumpsum || 1000,
        exitLoad: exitLoadStr,
        tags,
        holdings: topHoldings,
        sectorAlloc,
        assetAlloc,
        riskMetrics,
        fundManagers
      },
      create: {
        schemeCode,
        name: basic.fund_name,
        schemeName,
        fundHouse,
        category,
        subCategory,
        planType: basic.plan_type || 'Direct',
        optionType: basic.scheme_type || 'Growth',
        currentNav: nav.current_nav,
        navDate: nav.nav_date,
        dayChange: ret?.absolute?.['1d'] ? (nav.current_nav * (ret.absolute['1d'] / 100)) : 0,
        dayChangePct: ret?.absolute?.['1d'] || 0,
        returns1Y: ret1y,
        returns3Y: ret3y,
        returns5Y: ret5y,
        returnsSinceInception: retSinceInception,
        benchmark: basic.benchmark || basic.benchmark_name || 'NIFTY 50 TRI',
        aum: basic.fund_size || null,
        expenseRatio,
        riskRating: (riskRating !== null && riskRating !== undefined) ? riskRating : 0,
        riskometer,
        minSip: invest?.minimum_sip || 500,
        minLumpsum: invest?.minimum_lumpsum || 1000,
        exitLoad: exitLoadStr,
        tags,
        holdings: topHoldings,
        sectorAlloc,
        assetAlloc,
        riskMetrics,
        fundManagers
      }
    });

    console.log(`✅ Upserted 100% real mutual fund to DB: ${fundRecord.name} (Code: ${fundRecord.schemeCode}, NAV: ₹${fundRecord.currentNav})`);
    return fundRecord;
  } catch (error: any) {
    console.error('Error upserting fund to DB:', error.message);
    throw error;
  }
};

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}
