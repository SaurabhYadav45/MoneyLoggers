export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  pct: number;
}

export interface MarketIndex {
  name: string;
  value: number;
  change: number;
  pct: number;
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  imageUrl?: string | null;
  publishedAt: string;
  timestamp?: string;
  category: string;
  sector: string;
  relatedSymbols: string[];
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  impact: 'HIGH' | 'NORMAL';
  isBreaking?: boolean;
  tag?: string;
}

export interface NewsSentimentSummary {
  total: number;
  bullish: { count: number; percentage: number };
  bearish: { count: number; percentage: number };
  neutral: { count: number; percentage: number };
  overallMood: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export interface NewsFeedResponse {
  items: NewsItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  lastSyncedAt?: string;
  isSyncing?: boolean;
  nextSyncInSeconds?: number;
}

export interface NewsFilterParams {
  page?: number;
  limit?: number;
  category?: string;
  sector?: string;
  symbol?: string;
  sentiment?: string;
  search?: string;
}

export interface IPOGmpHistory {
  date: string;
  gmp: number;
  instantGainPercent: number;
}

export interface IPOFinancial {
  period: string;
  revenue: number;
  expense?: number;
  pat: number;
  netWorth: number;
  borrowing?: number;
}

export interface IPODailySubscriptionCategory {
  applied: string;
  reserved: string;
  times: string;
  timesFormatted?: string;
}

export interface IPODailySubscription {
  date: string;
  categories: {
    retailIndividual?: IPODailySubscriptionCategory;
    qualifiedInstitutional?: IPODailySubscriptionCategory;
    nonInstitutional?: IPODailySubscriptionCategory;
    overall?: IPODailySubscriptionCategory;
  };
}

export interface IPOReservation {
  retail?: number;
  nonInstitutional?: number;
  qualifiedInstitutional?: number;
}

export interface IPORegistrarContact {
  person?: string;
  email?: string;
  phone?: string;
}

export interface IPO {
  id: string;
  name: string;
  symbol: string;
  segment?: 'mainboard' | 'sme';
  status: 'upcoming' | 'open' | 'closed' | 'listed';
  openDate?: string;
  closeDate?: string;
  listingDate?: string;
  priceRange?: { min: number; max: number };
  priceBand?: string;
  issuePrice: number;
  lotSize: number;
  minInvestment?: number;
  issueSize?: { total: number; fresh: number; ofs: number } | number;
  type?: string;
  timeline?: {
    anchorDate?: string;
    openDate: string;
    closeDate: string;
    allotmentDate: string;
    refundsDate?: string;
    creditDate?: string;
    listingDate: string;
    preApplyStartDate?: string;
    applicationStartDate?: string;
    applicationEndDate?: string;
    allotmentStartDate?: string;
    refundInitiationDate?: string;
    mandateEndDate?: string;
    preApplicationStart?: string;
    biddingStart?: string;
    biddingEnd?: string;
    allotmentProcessStart?: string;
    refundInitiation?: string;
    allotmentFinalization?: string;
    listingDay?: string;
    mandateEnd?: string;
  };
  gmpData?: {
    currentGmp: number;
    estimatedListingPrice: number;
    estimatedGainPercent: number;
    updatedAt: string;
    history: IPOGmpHistory[];
  };
  subscription?: {
    qib: number;
    nii: number;
    bHni?: number;
    sHni?: number;
    rii: number;
    employee?: number;
    total: number;
    overallFormatted?: string;
    daily?: IPODailySubscription[];
    reservation?: IPOReservation;
    updatedAt?: string;
  };
  retailSubscription?: number;
  totalSubscription?: number;
  financials?: IPOFinancial[];
  valuation?: {
    peRatio?: number;
    postPeRatio?: number;
    marketCap?: number;
    eps?: number;
    ronw?: number;
    industry?: string;
    isin?: string;
    faceValue?: number;
    rhpUrl?: string;
    allotmentLinkUrl?: string;
    exchanges?: { primary?: string; nse?: boolean; bse?: boolean };
    reservation?: IPOReservation;
  };
  listingDetails?: {
    listingPrice?: number;
    listingGainPercent?: number;
    currentMarketPrice?: number;
    gain?: {
      percentage?: number;
      absolute?: number;
    };
  };
  listingPrice?: number;
  listingGain?: number;
  currentPrice?: number;
  about?: string;
  strengths?: string[];
  risks?: string[];
  verdict?: {
    recommendation: 'Subscribe' | 'Subscribe for Long Term' | 'Subscribe for Listing Gains' | 'May Apply' | 'Neutral' | 'Avoid';
    summary: string;
  };
  youtubeVideoUrl?: string;
  objectsOfIssue?: string[];
  leadManagers?: string[];
  registrar?: {
    name: string;
    website?: string;
    allotmentUrl?: string;
    contact?: IPORegistrarContact;
  };
  industry?: string;
  isin?: string;
  faceValue?: number;
  rhpUrl?: string;
  allotmentLinkUrl?: string;
  exchanges?: { primary?: string; nse?: boolean; bse?: boolean };
  reservation?: IPOReservation;
  links?: {
    prospectus?: { rhp?: string };
    allotment?: string;
  };
  performance?: {
    price?: { ipo?: number; listing?: number };
    gain?: {
      absolute?: number;
      percentage?: number;
      formatted?: string;
    };
  };
  isPreApply?: boolean;
  lastFetchedAt?: string | null;
  lastAttemptedAt?: string | null;
  nextRefreshAt?: string | null;
  lastRefreshStatus?: string | null;
  lastRefreshError?: string | null;
  providerUpdatedAt?: string | null;
  isStale?: boolean;
  refreshFailed?: boolean;
}

export interface MutualFund {
  id: string;
  schemeCode?: number | string;
  name: string;
  schemeName?: string;
  fundHouse: string;
  category: string; // 'Equity' | 'Debt' | 'Hybrid' | 'Index' | 'Solution Oriented'
  subCategory: string; // 'Small Cap' | 'Mid Cap' | 'Large Cap' | 'Flexi Cap' | 'ELSS' | 'Balanced Advantage' | 'Liquid' etc.
  planType?: 'Direct' | 'Regular';
  optionType?: 'Growth' | 'IDCW';
  nav: number;
  navDate?: string;
  change: number;
  pct: number;
  aum: number; // in Crores
  expenseRatio?: number | null;
  riskRating?: number | null; // 1 to 5 Stars
  riskometer?: 'Low' | 'Moderately Low' | 'Moderate' | 'Moderately High' | 'High' | 'Very High' | string;
  returnsSinceInception?: number | null;
  dayChange?: number;
  dayChangePct?: number;
  returns1Y?: number | null;
  returns3Y?: number | null;
  returns5Y?: number | null;
  benchmark?: string;
  tags?: string[];
}

export interface MutualFundDetail extends MutualFund {
  type?: string;
  amc?: string;
  benchmark: string;
  launchDate: string;
  riskLevel?: 'low' | 'moderate' | 'high';
  expenseRatio: number;
  exitLoad: string | number;
  minimumSip: number;
  minSip?: number;
  minimumLumpsum: number;
  minLumpsum?: number;
  lockInPeriod?: string;
  turnoverRatio?: number;
  returns: {
    oneMonth: number;
    threeMonth?: number;
    sixMonth?: number;
    oneYear: number;
    threeYear?: number | null;
    fiveYear?: number | null;
    sinceInception: number;
  };
  benchmarkReturns?: {
    oneYear: number;
    threeYear: number;
    fiveYear: number;
  };
  riskMetrics: {
    stdDeviation: number;
    beta: number;
    alpha: number;
    sharpeRatio: number;
    sortinoRatio?: number;
  };
  assetAllocation?: {
    equity: number;
    debt: number;
    cash: number;
    others?: number;
  };
  marketCapAllocation?: any;
  topHoldings: Array<{
    symbol?: string;
    name: string;
    sector?: string;
    percentage: number;
  }>;
  sectorAllocation: Array<{
    name: string;
    percentage: number;
  }>;
  fundManagers?: Array<{
    name: string;
    experience?: string;
    tenure: string;
    description?: string;
  }>;
  navHistory: Array<{
    date: string;
    nav: number;
    benchmarkNav?: number;
  }>;
  peers: Array<{
    schemeCode?: number | string;
    name: string;
    category?: string;
    nav?: number;
    oneYearReturn?: number;
    threeYearReturn?: number;
    fiveYearReturn?: number;
    returns1Y?: number;
    returns3Y?: number;
    returns5Y?: number;
    expenseRatio: number;
    aum?: number;
    riskRating?: number;
  }>;
}

export interface ETF {
  id: string;
  name: string;
  symbol: string;
  category: string;
  underlyingIndex: string;
  nav: number;
  change: number;
  pct: number;
  aum: number;
  expenseRatio: number;
  trackingError: number;
  oneYearReturn: number;
  threeYearReturn: number;
  fiveYearReturn: number;
}

export interface ETFDetail extends ETF {
  amc: string;
  launchDate: string;
  benchmark: string;
  unitsOutstanding: number;
  returns: {
    oneDay: number;
    oneMonth: number;
    threeMonth: number;
    sixMonth: number;
    oneYear: number;
    threeYear: number;
    fiveYear: number;
    sinceInception: number;
  };
  navHistory: Array<{
    date: string;
    nav: number;
  }>;
  topHoldings: Array<{
    symbol: string;
    name: string;
    percentage: number;
  }>;
  sectorAllocation: Array<{
    name: string;
    percentage: number;
  }>;
  marketCapAllocation: Array<{
    name: string;
    percentage: number;
  }>;
  performanceMetrics: {
    trackingError: number;
    trackingDifference: number;
    expenseRatio: number;
    stdDeviation: number;
    sharpeRatio: number;
  };
  tradingMetrics: {
    volume: number;
    turnover: number;
    bidAskSpread: number;
    high52w: number;
    low52w: number;
  };
  peers: Array<{
    name: string;
    oneYearReturn: number;
    expenseRatio: number;
    trackingError: number;
  }>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface PortfolioHolding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  investedAmount: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
}

export interface ScreenerStock {
  id: string;
  name: string;
  symbol: string;
  sector: string;
  industry?: string;
  marketCapCategory?: 'Large' | 'Mid' | 'Small' | 'Micro';
  price: number;
  marketCap: number;
  dayChange: number;
  dayChangePercent: number;
  volume?: number;
  oneWeekReturn?: number;
  oneMonthReturn?: number;
  oneYearReturn: number;
  threeYearReturn?: number;
  high52w: number;
  low52w: number;
  high52wPercent?: number;
  peRatio: number;
  sectorPe?: number;
  pbRatio: number;
  evEbitda?: number;
  pegRatio?: number;
  dividendYield: number;
  bookValue?: number;
  eps?: number;
  roe: number;
  roce: number;
  opm?: number;
  npm?: number;
  debtToEquity: number;
  interestCoverage?: number;
  currentRatio?: number;
  revenueGrowth3y: number;
  profitGrowth3y: number;
  revenueGrowth5y?: number;
  profitGrowth5y?: number;
  rsi: number;
  above50dma?: boolean;
  above200dma: boolean;
  sma50?: number;
  sma200?: number;
  beta?: number;
  promoterHolding?: number;
  promoterPledge?: number;
  fiiHolding?: number;
  diiHolding?: number;
  publicHolding?: number;
  analystRating?: string;
  sparkline?: number[];
  peers?: ScreenerStock[];
}

export interface ScreenerFilters {
  search?: string;
  priceRange: [number, number];
  marketCap: 'all' | 'small' | 'mid' | 'large';
  sector: string | null;
  peRatioRange: [number, number];
  pbRatioRange: [number, number];
  roeRange: [number, number];
  roceRange: [number, number];
  deRange: [number, number];
  revenueGrowthRange: [number, number];
  profitGrowthRange: [number, number];
  dividendYieldRange: [number, number];
  high52wPercent: [number, number];
  rsiRange: [number, number];
  above200dma: boolean | null;
  above50dma?: boolean | null;
  customQuery?: string;
  preset?: string | null;
}

export interface ScreenerPreset {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  badge: string;
  description: string;
  gradient: string;
}

export type ScreenerTableView = 'overview' | 'valuation' | 'profitability' | 'technicals' | 'ownership';


// Global Sentiments Types
export interface GlobalIndex {
  id: string;
  name: string;
  symbol: string;
  region: 'US' | 'Europe' | 'Asia';
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  dayHigh?: number;
  dayLow?: number;
  status?: 'Open' | 'Closed' | 'Pre-Market';
}

export interface Commodity {
  id: string;
  name: string;
  symbol: string;
  price: number;
  unit: string;
  change: number;
  changePercent: number;
  source?: 'MCX' | 'International';
  sentimentImpact?: string;
}

export interface Currency {
  id: string;
  pair: string;
  price: number;
  change: number;
  changePercent: number;
  impact?: string;
}

export interface BondYield {
  id: string;
  name: string;
  country: string;
  yield: number;
  change: number;
  interpretation?: string;
  isCalculated?: boolean;
  source?: string;
}

export interface VolatilityIndex {
  id: string;
  name: string;
  value: number;
  change: number;
  interpretation: string;
}

export interface FIIDIIFlow {
  date: string;
  fiiNet: number;
  diiNet: number;
  fiiBuy?: number;
  fiiSell?: number;
  diiBuy?: number;
  diiSell?: number;
}

export interface GlobalFuture {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high?: number;
  low?: number;
}

export interface MacroEvent {
  id: string;
  date: string;
  title: string;
  country: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface GiftNiftyGapAnalysis {
  giftNiftyPrice: number;
  nifty50PreviousClose: number;
  spreadPoints: number;
  spreadPercent: number;
  projectedOpening: number;
  sentiment: 'Strong Gap Up' | 'Mild Gap Up' | 'Flat' | 'Mild Gap Down' | 'Strong Gap Down';
  sentimentBias: 'bullish' | 'bearish' | 'neutral';
  lastUpdated: string;
  isCalculated?: boolean;
  calculationMethod?: string;
}

export interface MarketBreadthData {
  advances: number;
  declines: number;
  unchanged: number;
  total: number;
  ratio: number;
  source: string;
}

export interface GlobalSentimentsData {
  giftNiftyGap: GiftNiftyGapAnalysis;
  indices: GlobalIndex[];
  futures: GlobalFuture[];
  commodities: Commodity[];
  currencies: Currency[];
  volatility: VolatilityIndex[];
  bonds: BondYield[];
  fiiDiiFlows: FIIDIIFlow[];
  marketBreadth?: MarketBreadthData;
  sentimentSummary: string;
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  macroEvents: MacroEvent[];
  lastUpdated: string;
}

// Portfolio Optimization Types
export interface PortfolioAsset {
  id: string;
  name: string;
  symbol: string;
  type: 'stock' | 'etf' | 'mutualFund';
  units: number;
  weight: number;
  currentValue: number;
  returnPercent: number;
  volatility: number;
  beta: number;
  riskContribution: number;
  sector: string;
  marketCap: 'large' | 'mid' | 'small';
  assetClass: 'equity' | 'debt' | 'gold' | 'international' | 'cash';
}

export interface PortfolioInput {
  assets: PortfolioAsset[];
  timeHorizon: '1Y' | '3Y' | '5Y';
  riskPreference: 'low' | 'medium' | 'high';
  monthlySIP?: number;
  investmentGoal?: string;
}

export interface PortfolioStats {
  totalValue: number;
  totalProfitLoss: number;
  absoluteReturn: number;
  cagr: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
  riskCategory: 'low' | 'medium' | 'high';
}

export interface Allocation {
  name: string;
  percentage: number;
}

export interface OptimizationSuggestion {
  assetName: string;
  currentWeight: number;
  suggestedWeight: number;
  changeRequired: number;
}

export interface EfficientFrontierPoint {
  risk: number;
  return: number;
  isUserPortfolio: boolean;
  isOptimalPortfolio: boolean;
}

export interface PortfolioOptimizationResult {
  suggestedPortfolio: OptimizationSuggestion[];
  expectedReturn: number;
  expectedVolatility: number;
  expectedSharpeRatio: number;
  bestCaseReturn: number;
  worstCaseReturn: number;
  riskReductionSuggestions: string[];
  efficientFrontier: EfficientFrontierPoint[];
}

// AI Prediction Model Types
export interface AIPrediction {
  stockInfo: {
    name: string;
    symbol: string;
    currentPrice: number;
  };
  predictionSummary: {
    overall: 'Bullish' | 'Bearish' | 'Neutral';
    shortTermTrend: 'Up' | 'Down' | 'Sideways';
    mediumTermTrend: 'Bullish' | 'Bearish' | 'Neutral';
  };
  probability: {
    bullish: number;
    bearish: number;
    neutral: number;
    modelConfidence: 'Low' | 'Medium' | 'High';
  };
  pricePrediction: {
    expectedLow: number;
    expectedHigh: number;
    mostLikelyRange: [number, number];
  };
  shortTerm: {
    trend: 'Up' | 'Down' | 'Sideways';
    volatility: 'High' | 'Medium' | 'Low';
    sentiment: 'Positive' | 'Negative' | 'Neutral';
  };
  mediumTerm: {
    outlook: 'Bullish' | 'Bearish' | 'Neutral';
    momentum: 'Increasing' | 'Decreasing';
    expectedRange: [number, number];
  };
  technicalIndicators: {
    rsi: number;
    macd: 'Bullish Crossover' | 'Bearish Crossover' | 'Neutral';
    movingAverages: {
      priceVs50DMA: 'Above' | 'Below' | 'Near';
      priceVs200DMA: 'Above' | 'Below' | 'Near';
    };
    volumeTrend: 'Increasing' | 'Decreasing' | 'Stable';
    support: number;
    resistance: number;
    pattern?: string;
  };
  sentiment: {
    newsSentiment: { score: number; label: 'Positive' | 'Negative' | 'Neutral' };
    socialSentiment: { score: number; label: 'Positive' | 'Negative' | 'Neutral' };
    overall: 'Positive' | 'Negative' | 'Neutral';
  };
  risk: {
    level: 'Low' | 'Medium' | 'High';
    volatilityScore: number;
    eventRisk: 'Low' | 'Medium' | 'High';
    eventDescription?: string;
  };
  supportingFactors: string[];
  chartData: {
    priceHistory: Array<{ date: string; price: number }>;
    predictedRange: Array<{ date: string; predictedLow: number; predictedHigh: number }>;
  };
}