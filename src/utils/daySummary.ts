import type { Transaction } from '../store/transactionStore';

const round2 = (n: number) => Math.round(n * 100) / 100;
const own = (t: Transaction) => (t.personalShare != null ? t.personalShare : t.amount);

export type DayCat = { _id: string; name: string; icon: string };
type Cat = DayCat;

/** Everything the day view shows, worked out from the day's records. */
export function summariseDay(txs: Transaction[], categories: Cat[]) {
  const real = txs.filter((t) => !t.isAdjustment);
  const spends = real.filter((t) => t.type === 'expense');
  const yourSpend = round2(spends.reduce((sum, t) => sum + own(t), 0));

  // Where your share went: items by category (fees and discounts kept apart).
  const cats = new Map<string, { name: string; icon: string; total: number; note: string }>();
  let fees = 0;
  const lookup = (t: Transaction, id?: string) => (id === t.categoryId?._id ? t.categoryId : categories.find((c) => c._id === id));
  spends.forEach((t) => {
    const ratio = t.amount > 0 ? own(t) / t.amount : 1;
    const split = t.personalShare != null && t.personalShare !== t.amount;
    const note = split ? (Math.abs(ratio - 0.5) < 0.01 ? 'your half' : 'your share') : '';
    const charges = (t.charges ?? []).reduce((sum, c) => sum + c.amount, 0);
    fees += charges * ratio;
    const add = (id: string | undefined, amount: number, detail: string) => {
      const c = lookup(t, id);
      const key = id ?? c?.name ?? 'none';
      const row = cats.get(key) ?? { name: c?.name ?? 'Uncategorized', icon: c?.icon ?? '', total: 0, note: '' };
      row.total = round2(row.total + amount * ratio);
      row.note = row.note || note || detail;
      cats.set(key, row);
    };
    const items = t.items ?? [];
    if (items.length === 0) add(t.categoryId?._id, t.amount, t.note ?? '');
    else {
      const byCat = new Map<string | undefined, { sum: number; names: string[] }>();
      items.forEach((it) => {
        const id = it.categoryId ?? t.categoryId?._id;
        const g = byCat.get(id) ?? { sum: 0, names: [] };
        g.sum += it.amount;
        if (it.itemId || it.name !== lookup(t, id)?.name) g.names.push(it.name);
        byCat.set(id, g);
      });
      byCat.forEach((g, id) => add(id, g.sum, g.names.slice(0, 2).join(', ')));
    }
  });
  const catRows = [...cats.values()].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

  // Money that left your accounts (the whole bill when you paid), by account.
  const accounts = new Map<string, { name: string; type?: string; total: number }>();
  spends.forEach((t) => {
    if (!t.accountId) return;
    const row = accounts.get(t.accountId._id) ?? { name: t.accountId.name, total: 0 };
    row.total = round2(row.total + t.amount);
    accounts.set(t.accountId._id, row);
  });
  const leftAccounts = round2([...accounts.values()].reduce((sum, a) => sum + a.total, 0));

  // Who owes whom from the day's split bills (positive = they owe you).
  const net: Record<string, { name: string; amount: number }> = {};
  spends.forEach((t) => {
    const parts = (t.split?.splits ?? []).map((sp) => ({
      id: typeof sp.friendId === 'string' ? sp.friendId : sp.friendId._id,
      name: typeof sp.friendId === 'string' ? 'Friend' : sp.friendId.name,
      amount: sp.amount,
    }));
    const payer = t.paidByFriendId;
    if (payer) {
      const mine = round2(t.amount - parts.reduce((sum, p) => sum + p.amount, 0));
      net[payer._id] = { name: payer.name, amount: round2((net[payer._id]?.amount ?? 0) - mine) };
    } else {
      parts.forEach((p) => { net[p.id] = { name: p.name, amount: round2((net[p.id]?.amount ?? 0) + p.amount) }; });
    }
  });
  const owedToYou = Object.entries(net).filter(([, v]) => v.amount > 0.004).map(([id, v]) => ({ id, ...v }));
  const youOwe = Object.entries(net).filter(([, v]) => v.amount < -0.004).map(([id, v]) => ({ id, name: v.name, amount: -v.amount }));
  const comingBack = round2(owedToYou.reduce((sum, f) => sum + f.amount, 0));

  // Real items bought (not plain category lines).
  const bought = new Map<string, number>();
  spends.forEach((t) => (t.items ?? []).forEach((it) => {
    if (it.itemId) bought.set(it.name, (bought.get(it.name) ?? 0) + 1);
  }));

  return { yourSpend, leftAccounts, comingBack, catRows, fees: round2(fees), accounts: [...accounts.values()], owedToYou, youOwe, bought: [...bought.entries()] };
}

