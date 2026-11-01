/** ₹ with Indian grouping and no decimals — for headline numbers. */
export const inr = (n: number) => `${n < 0 ? '−' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`;
/** ₹ with paise only when there are some — for prices and small amounts. */
export const inrExact = (n: number) => {
  const whole = Math.abs(n % 1) < 0.005;
  return `${n < 0 ? '−' : ''}₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
};

/** 0.25 kg → "250 g", 1.5 l → "1.5 l", 3 pcs → "3 pcs". */
export function formatQty(qty: number | null, unit: string | null): string {
  if (qty == null) return '';
  if (unit === 'kg' && qty < 1) return `${Math.round(qty * 1000)} g`;
  if (unit === 'l' && qty < 1) return `${Math.round(qty * 1000)} ml`;
  return `${Number(qty.toFixed(2))} ${unit ?? ''}`.trim();
}

export function monthLabel(month: string, style: 'long' | 'short' = 'long') {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('en-IN', style === 'long' ? { month: 'long', year: 'numeric' } : { month: 'short' });
}

export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** "+12%" / "−8%" against last month; null when there's nothing to compare. */
export function deltaPct(now: number, before: number | undefined | null): number | null {
  if (before == null || before <= 0) return null;
  return ((now - before) / before) * 100;
}
