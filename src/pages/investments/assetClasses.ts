import type { InvestmentType } from '../../store/investmentStore';

// "holdings" → tracked by symbol/qty/price (Kite-style). Invested & current
// value are derived from quantity * price.
// "lumpsum"  → entered as flat amount invested + current value.
export type TrackingMode = 'holdings' | 'lumpsum';

export interface AssetClassMeta {
  value: InvestmentType;
  label: string;
  icon: string;
  mode: TrackingMode;
  hasSector: boolean;
  // Route under /investments; undefined ⇒ no dedicated page yet (Phase 2).
  route?: string;
}

export const ASSET_CLASSES: AssetClassMeta[] = [
  { value: 'stocks', label: 'Indian Stocks', icon: '\u{1F4C8}', mode: 'holdings', hasSector: true, route: '/investments/stocks' },
  { value: 'index_fund', label: 'Index Funds', icon: '\u{1F4CA}', mode: 'holdings', hasSector: false },
  { value: 'mutual_fund', label: 'Mutual Funds', icon: '\u{1F4B9}', mode: 'holdings', hasSector: false },
  { value: 'us_stock', label: 'US Stocks', icon: '\u{1F1FA}\u{1F1F8}', mode: 'holdings', hasSector: true },
  { value: 'bond', label: 'Bonds', icon: '\u{1F4DC}', mode: 'holdings', hasSector: false },
  { value: 'fd', label: 'Fixed Deposits', icon: '\u{1F3E6}', mode: 'lumpsum', hasSector: false },
  { value: 'ppf', label: 'PPF', icon: '\u{1F3DB}️', mode: 'lumpsum', hasSector: false },
  { value: 'gold', label: 'Gold', icon: '\u{1FA99}', mode: 'lumpsum', hasSector: false },
  { value: 'real_estate', label: 'Real Estate', icon: '\u{1F3E0}', mode: 'lumpsum', hasSector: false },
  { value: 'crypto', label: 'Crypto', icon: '₿', mode: 'holdings', hasSector: false },
  { value: 'other', label: 'Other', icon: '\u{1F4BC}', mode: 'lumpsum', hasSector: false },
];

export const ASSET_CLASS_MAP: Record<InvestmentType, AssetClassMeta> =
  ASSET_CLASSES.reduce((acc, meta) => {
    acc[meta.value] = meta;
    return acc;
  }, {} as Record<InvestmentType, AssetClassMeta>);

export function assetLabel(type: InvestmentType): string {
  return ASSET_CLASS_MAP[type]?.label ?? type;
}

export function assetIcon(type: InvestmentType): string {
  return ASSET_CLASS_MAP[type]?.icon ?? '\u{1F4BC}';
}

// Gain/loss helpers shared across investment pages.
export function gain(invested: number, current: number) {
  const gainLoss = current - invested;
  const gainLossPct = invested > 0 ? (gainLoss / invested) * 100 : 0;
  return { gainLoss, gainLossPct };
}
