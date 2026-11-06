/** 'YYYY-MM' of the financial month we're in, for a month that starts on `startDay` (1 = calendar month). */
export function getCurrentFinancialMonth(startDay: number) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (startDay > 1 && now.getDate() >= startDay) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}
