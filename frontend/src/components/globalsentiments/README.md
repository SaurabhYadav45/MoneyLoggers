# Global Sentiments Components

This folder contains modular, reusable components for displaying global market sentiment data and international economic indicators.

## Folder Structure

```
globalsentiments/
├── GlobalIndicesCard.tsx          # Global stock market indices (US, Europe, Asia)
├── CommoditiesCurrenciesCard.tsx  # Commodities and currency pairs
├── VolatilityBondCard.tsx         # Volatility indices and bond yields
├── FIIDIISentimentCard.tsx        # FII/DII flows and market sentiment summary
├── GlobalFuturesCard.tsx          # Global futures indices
└── README.md                      # This file
```

## Components Overview

### 1. GlobalIndicesCard
**Purpose**: Display major global stock market indices organized by region

**Props**:
- `indices: GlobalIndex[]` - Array of global index data
- `isDarkMode: boolean` - Theme mode flag for styling

**Features**:
- Organized by region (US, Europe, Asia)
- Shows current price, change amount, and percentage change
- Trend indicators (up/down arrows)
- Responsive grid layout (1 column mobile, 3 columns desktop)
- Dark mode support

**Data Structure**:
```typescript
interface GlobalIndex {
  id: string;
  name: string;
  symbol: string;
  region: 'US' | 'Europe' | 'Asia';
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
}
```

---

### 2. CommoditiesCurrenciesCard
**Purpose**: Display global commodities and currency pairs that influence Indian markets

**Props**:
- `commodities: Commodity[]` - Array of commodity data
- `currencies: Currency[]` - Array of currency pair data
- `isDarkMode: boolean` - Theme mode flag

**Features**:
- Two-column layout (Commodities | Currencies)
- Supports oil (Brent, WTI), gold, silver, and currency pairs
- Unit display for commodities (USD/bbl, USD/oz)
- Trend indicators with color coding
- Responsive design

**Data Structures**:
```typescript
interface Commodity {
  id: string;
  name: string;
  symbol: string;
  price: number;
  unit: string;
  change: number;
  changePercent: number;
}

interface Currency {
  id: string;
  pair: string;
  price: number;
  change: number;
  changePercent: number;
}
```

---

### 3. VolatilityBondCard
**Purpose**: Display fear indices and bond yields that signal market risk sentiment

**Props**:
- `volatilityIndices: VolatilityIndex[]` - VIX data
- `bondYields: BondYield[]` - Bond yield data
- `isDarkMode: boolean` - Theme mode flag

**Features**:
- Color-coded volatility levels:
  - Green: Low fear (VIX < 15)
  - Yellow: Moderate (VIX 15-20)
  - Red: High fear (VIX > 20)
  - Deep red: Extreme fear (VIX > 25)
- Shows volatility interpretation text
- Bond yields with country labels
- Informational footer explaining VIX and yields
- Two-column responsive layout

**Data Structures**:
```typescript
interface VolatilityIndex {
  id: string;
  name: string;
  value: number;
  change: number;
  interpretation: string;
}

interface BondYield {
  id: string;
  name: string;
  country: string;
  yield: number;
  change: number;
}
```

---

### 4. FIIDIISentimentCard
**Purpose**: Track foreign and domestic institutional flows with overall market sentiment summary

**Props**:
- `fiiDiiFlows: FIIDIIFlow[]` - Last 5-day FII/DII activity
- `sentimentSummary: string` - Daily sentiment narrative
- `overallSentiment: 'bullish' | 'bearish' | 'neutral'` - Sentiment classification
- `isDarkMode: boolean` - Theme mode flag

**Features**:
- Last 5 days of FII/DII flows
- Color-coded sentiment badge (green/red/yellow)
- Daily sentiment summary text
- Update timestamp
- Informational note explaining FII/DII significance
- Two-column layout for flows and sentiment

**Data Structure**:
```typescript
interface FIIDIIFlow {
  date: string;
  fiiNet: number;
  diiNet: number;
}
```

---

### 5. GlobalFuturesCard
**Purpose**: Display futures indices that provide early market sentiment signals

**Props**:
- `futures: GlobalFuture[]` - Array of futures data
- `isDarkMode: boolean` - Theme mode flag

**Features**:
- Organized by region (US, Asia)
- Tracks SGX Nifty, Gift Nifty, and US futures
- Pre-market sentiment indicators
- Trend visualization with icons
- Informational footer about futures significance
- Two-column responsive layout

**Data Structure**:
```typescript
interface GlobalFuture {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
}
```

---

## Design Patterns

### 1. Color-Coded Sentiment
All components use consistent color coding:
- **Green** (`emerald-600/emerald-400`): Positive, bullish, up movement
- **Red** (`rose-600/rose-400`): Negative, bearish, down movement
- **Amber** (`amber-600/amber-400`): Neutral, warning, caution
- **Blue** (`indigo-500/indigo-400`): Information, headers, primary

### 2. Dark Mode Support
Each component:
- Accepts `isDarkMode` prop
- Uses `dark:` Tailwind prefix for dark mode classes
- Applies custom background color via inline style:
  ```typescript
  style={{ backgroundColor: isDarkMode ? 'rgb(15, 23, 42)' : undefined }}
  ```

### 3. Helper Functions
Common utility functions in each component:
- `getChangeColor()` - Returns color class based on percentage change
- `getVolatilityColor()` - Returns color based on VIX level
- `getSentimentColor()` - Returns color based on sentiment type

### 4. Reusable SubComponents
- `MetricCard` - Generic card for displaying metric pairs (Commodities, Currencies)
- Uses composition for maximum code reuse

---

## Usage Example

```typescript
// In GlobalSentiments.tsx page
import GlobalIndicesCard from '../components/globalsentiments/GlobalIndicesCard';
import type { GlobalIndex } from '../types';

const mockGlobalIndices: GlobalIndex[] = [
  {
    id: '1',
    name: 'S&P 500',
    symbol: 'GSPC',
    region: 'US',
    price: 5850.35,
    change: 45.25,
    changePercent: 0.78,
    previousClose: 5805.1,
  },
  // ... more indices
];

<GlobalIndicesCard indices={mockGlobalIndices} isDarkMode={isDarkMode} />
```

---

## Responsive Design

All components use Tailwind's responsive prefixes:
- `grid-cols-1` - 1 column on mobile
- `md:grid-cols-2` - 2 columns on tablet
- `md:grid-cols-3` or `lg:grid-cols-2` - 3/2 columns on desktop

---

## Type Definitions

All types are centralized in `src/types/index.ts`:
- `GlobalIndex`
- `Commodity`
- `Currency`
- `VolatilityIndex`
- `BondYield`
- `FIIDIIFlow`
- `GlobalFuture`
- `MacroEvent`

---

## Styling Standards

### GlassCard Component
All components wrap content in `GlassCard` for consistent glass-morphism effect:
```typescript
<GlassCard style={{ backgroundColor: isDarkMode ? 'rgb(15, 23, 42)' : undefined }}>
  {/* Content */}
</GlassCard>
```

### Text Hierarchy
- **H2** (2xl, bold): Main component title
- **H3** (lg, semibold): Section headers
- **p** (text-sm/base): Body text
- **span** (text-xs): Labels and metadata

### Spacing
- Gap between components: `space-y-6` (outer)
- Gap within components: `space-y-4` (inner sections)
- Gap within items: `space-y-3` (individual items)

---

## Update Frequency

In production, these components should receive data from:
- **Real-time APIs**: NSE, BSE, Yahoo Finance, Alpha Vantage
- **Refresh Interval**: 1-5 minutes depending on data freshness
- **WebSockets**: For live streaming data (optional advanced feature)

---

## Future Enhancements

- [ ] Add Fear & Greed Index
- [ ] Add market breadth visualization (advancers/decliners)
- [ ] Add crypto sentiment (BTC/ETH dominance)
- [ ] Implement real API integration
- [ ] Add chart visualizations for price history
- [ ] Add alerts for threshold breaches
- [ ] Implement data caching for performance

---

## Comments & Maintainability

Each component includes:
- **JSDoc comments** for functions and components
- **Inline comments** explaining complex logic
- **Data section comments** separating mock data
- **TypeScript interfaces** for type safety
- **Clear variable names** using camelCase and descriptive text

This structure ensures the codebase remains scalable and easy to maintain as new global sentiment indicators are added.
