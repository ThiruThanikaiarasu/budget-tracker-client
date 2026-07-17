import type { Investment } from '../../store/investmentStore';

export interface Cashflow {
  amount: number; // negative = money in (invested), positive = money out / current value
  date: Date;
}

const DAYS_PER_YEAR = 365;

function npv(rate: number, flows: Cashflow[], t0: number): number {
  return flows.reduce((sum, cf) => {
    const years = (cf.date.getTime() - t0) / (1000 * 60 * 60 * 24 * DAYS_PER_YEAR);
    return sum + cf.amount / Math.pow(1 + rate, years);
  }, 0);
}

/**
 * XIRR — the annualized money-weighted return that accounts for *when* each
 * amount was invested. Solved with Newton's method, bisection fallback.
 * Returns a fraction (0.18 = 18%), or null when it can't be computed.
 */
export function xirr(flows: Cashflow[]): number | null {
  if (flows.length < 2) return null;
  const hasNeg = flows.some((f) => f.amount < 0);
  const hasPos = flows.some((f) => f.amount > 0);
  if (!hasNeg || !hasPos) return null;

  const t0 = Math.min(...flows.map((f) => f.date.getTime()));

  // Newton's method.
  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(rate, flows, t0);
    // Numerical derivative.
    const df = (npv(rate + 1e-6, flows, t0) - f) / 1e-6;
    if (Math.abs(df) < 1e-12) break;
    const next = rate - f / df;
    if (!isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-8) return next > -0.9999 ? next : null;
    rate = next;
  }

  // Bisection fallback over a sane range.
  let lo = -0.9999;
  let hi = 100;
  let flo = npv(lo, flows, t0);
  let fhi = npv(hi, flows, t0);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fmid = npv(mid, flows, t0);
    if (Math.abs(fmid) < 1e-7) return mid;
    if (flo * fmid < 0) {
      hi = mid;
      fhi = fmid;
    } else {
      lo = mid;
      flo = fmid;
    }
  }
  return (lo + hi) / 2;
}

/**
 * Portfolio XIRR: each active holding is a cash outflow at its invest date, and
 * the whole portfolio's current value is a single inflow today. Returns a
 * percentage (18.4), or null.
 */
export function portfolioXirr(active: Investment[]): number | null {
  const flows: Cashflow[] = active
    .filter((h) => h.amountInvested > 0)
    .map((h) => ({ amount: -h.amountInvested, date: new Date(h.dateInvested) }));

  const totalCurrent = active.reduce((s, h) => s + h.currentValue, 0);
  if (flows.length === 0 || totalCurrent <= 0) return null;

  flows.push({ amount: totalCurrent, date: new Date() });

  const rate = xirr(flows);
  return rate == null ? null : rate * 100;
}
