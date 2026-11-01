import type { Transaction } from '../store/transactionStore';

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ShareLine {
  name: string;
  /** How it was split, from the friend's side: "all yours", "half of ₹30"… */
  how: string;
  amount: number;
}

/** Where the user keeps their UPI ID (used for the "Pay on UPI" link on reminders). */
const UPI_KEY = 'budget-tracker:upi-id:v1';
export const getUpiId = () => { try { return localStorage.getItem(UPI_KEY) ?? ''; } catch { return ''; } };
export const setUpiId = (id: string) => { try { localStorage.setItem(UPI_KEY, id.trim()); } catch { /* storage unavailable */ } };

/**
 * The lines that make up what a friend owes you across some records: each item
 * (or whole category amount) they share, split equally among its sharers. Fees,
 * discounts and hand-set shares show up as one balancing "fees and rounding" line
 * so the lines always add up to the amount owed.
 */
export function friendLines(txs: Transaction[], friendId: string, owed: number): ShareLine[] {
  const lines: ShareLine[] = [];
  txs.forEach((t) => {
    if (t.type !== 'expense' || t.paidByFriendId || !t.split) return;
    const friends = t.split.splits.map((sp) => (typeof sp.friendId === 'string' ? sp.friendId : sp.friendId._id));
    if (!friends.includes(friendId)) return;
    const everyone = ['user', ...friends];
    const parts = (t.items ?? []).length > 0
      ? t.items!.map((it) => ({ name: it.name, amount: it.amount, sharers: (it.sharedWith ?? everyone).filter((k) => everyone.includes(k)) }))
      : [{ name: t.categoryId?.name ?? 'Shared bill', amount: t.amount, sharers: everyone }];
    parts.forEach((p) => {
      if (!p.sharers.includes(friendId) || p.amount <= 0) return;
      const n = p.sharers.length;
      lines.push({
        name: p.name,
        how: n === 1 ? 'all yours' : n === 2 ? `half of ₹${round2(p.amount)}` : `1/${n} of ₹${round2(p.amount)}`,
        amount: round2(p.amount / n),
      });
    });
  });
  const listed = round2(lines.reduce((sum, l) => sum + l.amount, 0));
  if (Math.abs(owed - listed) >= 0.01) lines.push({ name: 'Fees and rounding', how: 'shared', amount: round2(owed - listed) });
  return lines;
}
