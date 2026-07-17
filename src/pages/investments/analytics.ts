import type { Investment, InvestmentType } from '../../store/investmentStore';
import { ASSET_CLASS_MAP, assetLabel, gain } from './assetClasses';

// Thresholds for concentration / rebalance heuristics.
const CLASS_OVERWEIGHT = 40; // % of portfolio in one asset class
const HOLDING_CONCENTRATED = 25; // % of portfolio in one holding
const LAGGARD_UNDERPERFORM = 8; // % points below the portfolio's own return

export interface Signal {
  kind: 'buy' | 'sell' | 'hold';
  text: string;
}

export interface Laggard {
  holding: Investment;
  pct: number; // return %
  weight: number; // % of portfolio
}

export interface PortfolioAnalysis {
  score: number; // 0..100 diversification score
  scoreLabel: 'Poor' | 'Fair' | 'Good' | 'Excellent';
  effectiveHoldings: number; // 1 / HHI — "how many holdings it really behaves like"
  concentration: string[];
  laggards: Laggard[];
  signals: Signal[];
}

function scoreLabel(score: number): PortfolioAnalysis['scoreLabel'] {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

/**
 * Derive diversification, concentration, laggards and rebalance signals from the
 * live holdings. Pure — no hooks, no side effects. Heuristic guidance only, not
 * financial advice.
 */
export function analyzePortfolio(active: Investment[]): PortfolioAnalysis {
  const total = active.reduce((s, h) => s + h.currentValue, 0);

  if (active.length === 0 || total <= 0) {
    return {
      score: 0,
      scoreLabel: 'Poor',
      effectiveHoldings: 0,
      concentration: [],
      laggards: [],
      signals: [{ kind: 'buy', text: 'Add your first holding to start building a portfolio.' }],
    };
  }

  // Weights (0..1).
  const holdingWeights = active.map((h) => h.currentValue / total);

  const classTotals = new Map<InvestmentType, number>();
  for (const h of active) {
    classTotals.set(h.type, (classTotals.get(h.type) ?? 0) + h.currentValue);
  }
  const classWeights = Array.from(classTotals.values()).map((v) => v / total);

  // Herfindahl-Hirschman Index (sum of squared weights). 1 = fully concentrated.
  const hhiHolding = holdingWeights.reduce((s, w) => s + w * w, 0);
  const hhiClass = classWeights.reduce((s, w) => s + w * w, 0);
  const blendedHhi = 0.5 * hhiHolding + 0.5 * hhiClass;
  const score = Math.max(0, Math.min(100, Math.round((1 - blendedHhi) * 100)));
  const effectiveHoldings = hhiHolding > 0 ? 1 / hhiHolding : 0;

  // Concentration warnings.
  const concentration: string[] = [];
  for (const [type, val] of classTotals) {
    const pct = (val / total) * 100;
    if (pct >= CLASS_OVERWEIGHT) {
      concentration.push(`${assetLabel(type)} is ${pct.toFixed(0)}% of your portfolio.`);
    }
  }
  for (const h of active) {
    const pct = (h.currentValue / total) * 100;
    if (pct >= HOLDING_CONCENTRATED) {
      concentration.push(`${h.symbol || h.name} alone is ${pct.toFixed(0)}% of your portfolio.`);
    }
  }

  // Portfolio-wide return, for relative laggard detection.
  const invested = active.reduce((s, h) => s + h.amountInvested, 0);
  const portfolioReturn = gain(invested, total).gainLossPct;

  const laggards: Laggard[] = active
    .filter((h) => h.amountInvested > 0)
    .map((h) => ({
      holding: h,
      pct: gain(h.amountInvested, h.currentValue).gainLossPct,
      weight: (h.currentValue / total) * 100,
    }))
    .filter((l) => l.pct < 0 || l.pct < portfolioReturn - LAGGARD_UNDERPERFORM)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5);

  // Rebalance signals.
  const signals: Signal[] = [];

  for (const [type, val] of classTotals) {
    const pct = (val / total) * 100;
    if (pct >= CLASS_OVERWEIGHT) {
      signals.push({
        kind: 'sell',
        text: `Overweight in ${assetLabel(type)} (${pct.toFixed(0)}%) — consider trimming or pausing fresh buys.`,
      });
    }
  }

  const classCount = classTotals.size;
  if (classCount <= 2) {
    signals.push({
      kind: 'buy',
      text: `Only ${classCount} asset class${classCount > 1 ? 'es' : ''} — add others (e.g. bonds, gold, international) to diversify.`,
    });
  }

  const hasDebt = active.some((h) => h.type === 'bond' || h.type === 'fd' || h.type === 'ppf');
  if (!hasDebt) {
    signals.push({
      kind: 'buy',
      text: 'No debt allocation (bonds / FD / PPF) — a slice adds stability against equity swings.',
    });
  }

  // Highlight the single worst laggard as a review candidate.
  const worst = laggards[0];
  if (worst && worst.pct <= -15) {
    signals.push({
      kind: 'sell',
      text: `${worst.holding.symbol || worst.holding.name} is down ${Math.abs(worst.pct).toFixed(0)}% — review the thesis or cut the position.`,
    });
  }

  // A steady leader worth adding to.
  const leader = active
    .filter((h) => h.amountInvested > 0)
    .map((h) => ({ h, g: gain(h.amountInvested, h.currentValue).gainLossPct, w: (h.currentValue / total) * 100 }))
    .sort((a, b) => b.g - a.g)[0];
  if (leader && leader.g >= 10 && leader.w < HOLDING_CONCENTRATED) {
    signals.push({
      kind: 'buy',
      text: `${leader.h.symbol || leader.h.name} is up ${leader.g.toFixed(0)}% and still a small position — a candidate to add on dips.`,
    });
  }

  return {
    score,
    scoreLabel: scoreLabel(score),
    effectiveHoldings,
    concentration,
    laggards,
    signals: signals.slice(0, 5),
  };
}

export function assetIconFor(type: InvestmentType) {
  return ASSET_CLASS_MAP[type]?.icon ?? '\u{1F4BC}';
}
