import type { Transaction } from '../store/transactionStore';

export interface CategoryGroup {
  id?: string;
  name: string;
  icon: string;
  total: number;
}

/**
 * The categories a transaction touches, biggest first: items count toward
 * their own category (or the transaction's), fees/discounts toward the
 * transaction's. One group for an ordinary single-category transaction.
 */
export function categoryGroups(
  tx: Transaction,
  categories: { _id: string; name: string; icon: string }[],
): CategoryGroup[] {
  const main = tx.categoryId;
  const info = (id?: string) => (id === main?._id ? main : categories.find((c) => c._id === id));
  const groups = new Map<string | undefined, CategoryGroup>();
  const add = (id: string | undefined, amount: number) => {
    const c = info(id);
    const g = groups.get(id) ?? { id, name: c?.name ?? 'Uncategorized', icon: c?.icon ?? '', total: 0 };
    g.total = Math.round((g.total + amount) * 100) / 100;
    groups.set(id, g);
  };
  const items = tx.items ?? [];
  if (items.length === 0) {
    add(main?._id, tx.amount);
  } else {
    items.forEach((it) => add(it.categoryId ?? main?._id, it.amount));
    (tx.charges ?? []).filter((c) => !c.bill).forEach((c) => add(c.categoryId ?? main?._id, c.amount));
  }
  // Whole-bill fees/discounts are shared out in proportion to each category.
  const bill = (tx.charges ?? []).filter((c) => c.bill).reduce((sum, c) => sum + c.amount, 0);
  const base = [...groups.values()].reduce((sum, g) => sum + g.total, 0);
  if (bill && base > 0) groups.forEach((g) => { g.total = Math.round(g.total * (1 + bill / base) * 100) / 100; });
  return [...groups.values()].filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
}
