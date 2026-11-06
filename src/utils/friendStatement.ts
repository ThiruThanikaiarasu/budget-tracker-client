// ── A friend's statement: the Friends page list and its PDF ───────────
// Pure layout. Bills with a friend → scope (not settled / this month / picked / dates) →
// "paid by you" and "paid by them" sections → fixed-height rows → A4 pages. Row heights match
// the .bill-* / .stmt-* CSS in index.css, so pages are worked out without measuring the DOM.
import type { Friend } from '../store/friendStore';
import type { SharedExpense } from '../store/splitStore';
import type { ShareLine } from './shareLines';
import { balanceContribution, sharedExpenseLabel, signedShare } from './friendBalance';
import { CAPACITY, HEAD_RUN } from './billExport';

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));

export interface StmtBill {
  id: string;
  /** ISO date of the bill. */
  date: string;
  label: string;
  total: number;
  /** The friend's side of it: + they owe you, − you owe them. */
  signed: number;
  /** True when the friend paid the bill. */
  paidByFriend: boolean;
  settled: boolean;
  cat?: { name: string; icon: string };
  lines: { name: string; qty?: string; amount: number }[];
}

/** 'YYYY-MM-DD' in local time (never through Date.parse of a date-only string). */
export const localDay = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Every settled-or-open bill with this friend, newest first. Settlements are not bills. */
export function billsWith(expenses: SharedExpense[], friendId: string): StmtBill[] {
  const covered = new Set(expenses.flatMap((e) => (e.isSettlement ? e.coveredExpenseIds ?? [] : [])));
  return expenses
    .filter((e) => !e.isSettlement)
    .map((e): StmtBill | null => {
      const signed = round2(signedShare(e, friendId));
      if (signed === 0) return null;
      const tx = e.transactionId && typeof e.transactionId !== 'string' ? e.transactionId : undefined;
      const lines = [
        ...(tx?.items ?? []).map((it) => ({
          name: it.name,
          qty: it.quantity ? `${it.quantity}${it.unit ? ` ${it.unit}` : ''}` : undefined,
          amount: it.amount,
        })),
        ...(tx?.charges ?? []).map((c) => ({ name: c.label, amount: c.amount })),
      ];
      return {
        id: e._id, date: e.date, label: sharedExpenseLabel(e), total: e.totalAmount, signed,
        paidByFriend: e.paidBy !== 'user', settled: covered.has(e._id),
        cat: tx?.categoryId ? { name: tx.categoryId.name, icon: tx.categoryId.icon } : undefined,
        lines,
      };
    })
    .filter((b): b is StmtBill => !!b)
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

/** Bills grouped by calendar day, newest first, with each day's net (+ they owe you). */
export function dayGroups(bills: StmtBill[]) {
  const days = new Map<string, { key: string; date: Date; bills: StmtBill[]; net: number }>();
  bills.forEach((b) => {
    const key = localDay(b.date);
    let g = days.get(key);
    if (!g) { g = { key, date: new Date(b.date), bills: [], net: 0 }; days.set(key, g); }
    g.bills.push(b);
    g.net = round2(g.net + b.signed);
  });
  return [...days.values()];
}

/** The lines on a "remind" card: what they owe you, bill by bill, balanced to the exact amount owed. */
export function reminderLines(bills: StmtBill[], owed: number): ShareLine[] {
  const lines: ShareLine[] = bills
    .filter((b) => !b.settled)
    .map((b) => ({ name: b.label, how: b.signed > 0 ? 'your share' : 'you owe them', amount: b.signed }));
  const listed = sum(lines.map((l) => l.amount));
  if (Math.abs(owed - listed) >= 0.01) lines.push({ name: 'Part payments', how: 'already paid', amount: round2(owed - listed) });
  return lines;
}

// ── Statement ─────────────────────────────────────────────────────────

export type StmtScope = 'open' | 'month' | 'selected' | 'dates';
export interface StmtOptions { items: boolean; history: boolean }
export interface StmtHistoryRow { id: string; date: string; what: string; tag: string; amount: number }

export interface StmtModel {
  you: string; friend: string; subtitle: string;
  /** + they owe you, − you owe them. */
  net: number;
  /** Paid by you · their share. */
  lent: StmtBill[];
  /** Paid by them · your share. */
  borrowed: StmtBill[];
  /** Part payments already made that left the bills open (signed like `net`). */
  adjust: number;
  history: StmtHistoryRow[];
  showItems: boolean;
  dateLabel: string;
}

const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}${d.getFullYear() === new Date().getFullYear() ? '' : ` ${String(d.getFullYear()).slice(2)}`}`;
};
const fmtLong = (iso: string | Date) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtStmtDay = fmtDay;

export function buildStatement(a: {
  friend: Friend; expenses: SharedExpense[]; netLive: number; you: string;
  scope: StmtScope; selectedIds: Set<string>; from: string; to: string; opts: StmtOptions; now?: Date;
}): StmtModel {
  const now = a.now ?? new Date();
  const all = billsWith(a.expenses, a.friend._id);
  const monthKey = localDay(now).slice(0, 7);
  const inRange = (iso: string) => {
    const d = localDay(iso);
    return a.scope === 'month' ? d.startsWith(monthKey) : (!a.from || d >= a.from) && (!a.to || d <= a.to);
  };
  const inScope = (b: StmtBill) =>
    a.scope === 'open' ? !b.settled : a.scope === 'selected' ? a.selectedIds.has(b.id) : inRange(b.date);

  const scoped = all.filter(inScope);
  const open = scoped.filter((b) => !b.settled);
  const lent = open.filter((b) => !b.paidByFriend);
  const borrowed = open.filter((b) => b.paidByFriend);
  const billsNet = sum(open.map((b) => b.signed));
  // A part payment that kept the bills open lowers the balance without clearing any bill.
  const adjust = a.scope === 'open' ? round2(a.netLive - billsNet) : 0;
  const net = round2(billsNet + (Math.abs(adjust) >= 0.01 ? adjust : 0));

  const history: StmtHistoryRow[] = [];
  if (a.opts.history && a.scope !== 'selected') {
    const within = (iso: string) => a.scope === 'open' || inRange(iso);
    all.filter((b) => b.settled && within(b.date)).forEach((b) =>
      history.push({ id: b.id, date: b.date, what: b.label, tag: 'Bill settled', amount: b.signed }));
    a.expenses.filter((e) => e.isSettlement && within(e.date)).forEach((e) => {
      const m = e.settlementMethod;
      history.push({
        id: e._id, date: e.date, tag: 'Payment', amount: e.totalAmount,
        what: m === 'received' ? `Received from ${a.friend.name}` : m === 'paid' ? `Paid to ${a.friend.name}` : m === 'waived' ? 'Waived' : 'Settlement',
      });
    });
    history.sort((x, y) => +new Date(y.date) - +new Date(x.date));
  }

  const latest = open[0]?.date ?? now.toISOString();
  const subtitle =
    a.scope === 'open' ? `Bills not settled · up to ${fmtLong(latest)}`
    : a.scope === 'month' ? `Bills in ${now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`
    : a.scope === 'selected' ? `${open.length} selected ${open.length === 1 ? 'bill' : 'bills'}`
    : `Bills ${a.from ? `from ${fmtLong(a.from + 'T00:00:00')}` : ''}${a.to ? ` to ${fmtLong(a.to + 'T00:00:00')}` : ''}`.trim();

  return {
    you: a.you, friend: a.friend.name, subtitle, net, lent, borrowed, adjust: Math.abs(adjust) >= 0.01 ? adjust : 0,
    history, showItems: a.opts.items, dateLabel: fmtLong(now),
  };
}

// ── Pages ─────────────────────────────────────────────────────────────

export type SAtom =
  | { t: 'band'; tone: 'lent' | 'borrowed' | 'history'; title: string; sub: string; cont?: boolean }
  | { t: 'cols'; kind: 'bill' | 'hist'; owes: string }
  | { t: 'row'; bill: StmtBill }
  | { t: 'sub'; name: string; qty?: string; amount: number }
  | { t: 'hrow'; row: StmtHistoryRow }
  | { t: 'adjust'; amount: number }
  | { t: 'total'; text: string; amount: number }
  | { t: 'empty'; text: string }
  | { t: 'gap'; h: number };

export const S_HEAD_FIRST = 140;
export const SROW_H = 28;
export const SSUB_H = 22;
export const sHeight = (a: SAtom): number => {
  switch (a.t) {
    case 'band': return 52;
    case 'cols': return 30;
    case 'row': case 'hrow': case 'adjust': return SROW_H;
    case 'sub': return SSUB_H;
    case 'total': return 56;
    case 'empty': return 48;
    case 'gap': return a.h;
  }
};
const keepWithNext = (a: SAtom) => a.t === 'band' || a.t === 'cols';

export function statementAtoms(m: StmtModel): SAtom[] {
  const out: SAtom[] = [];
  const you = m.you, fr = m.friend;
  const section = (tone: 'lent' | 'borrowed', bills: StmtBill[]) => {
    if (bills.length === 0) return;
    if (out.length) out.push({ t: 'gap', h: 14 });
    out.push({
      t: 'band', tone, title: tone === 'lent' ? `Paid by ${you} · ${fr}'s share` : `Paid by ${fr} · ${you}'s share`,
      sub: `${bills.length} ${bills.length === 1 ? 'bill' : 'bills'}`,
    });
    out.push({ t: 'cols', kind: 'bill', owes: tone === 'lent' ? `${fr.toUpperCase()} OWES` : `${you.toUpperCase()} OWES` });
    bills.forEach((b) => {
      out.push({ t: 'row', bill: b });
      if (m.showItems) b.lines.forEach((l) => out.push({ t: 'sub', ...l }));
    });
  };
  section('lent', m.lent);
  section('borrowed', m.borrowed);
  if (m.lent.length === 0 && m.borrowed.length === 0) out.push({ t: 'empty', text: 'No unsettled bills in this selection.' });

  if (m.adjust !== 0) {
    out.push({ t: 'gap', h: 10 });
    out.push({ t: 'adjust', amount: m.adjust });
  }
  out.push({ t: 'gap', h: 12 });
  out.push({
    t: 'total', amount: Math.abs(m.net),
    text: m.net === 0 ? 'All square' : m.net > 0 ? `${fr} pays ${you}` : `${you} pays ${fr}`,
  });

  if (m.history.length > 0) {
    out.push({ t: 'gap', h: 18 });
    out.push({ t: 'band', tone: 'history', title: 'Already settled', sub: 'not counted above' });
    out.push({ t: 'cols', kind: 'hist', owes: 'AMOUNT' });
    m.history.forEach((row) => out.push({ t: 'hrow', row }));
  }
  return out;
}

export interface StmtPage { atoms: SAtom[] }

export function paginateStatement(atoms: SAtom[]): StmtPage[] {
  const pages: SAtom[][] = [[]];
  let used = S_HEAD_FIRST;
  let band: Extract<SAtom, { t: 'band' }> | null = null;
  let cols: SAtom | null = null;

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    let need = sHeight(a);
    if (keepWithNext(a)) {
      for (let j = i + 1; j < atoms.length; j++) {
        need += sHeight(atoms[j]);
        if (!keepWithNext(atoms[j])) break;
      }
    }
    const cur = pages[pages.length - 1];
    if (used + need > CAPACITY && cur.length > 0) {
      pages.push([]);
      used = HEAD_RUN;
      // A table carried onto a new page keeps its heading and column titles.
      if ((a.t === 'row' || a.t === 'sub' || a.t === 'hrow') && band && cols) {
        const fresh = pages[pages.length - 1];
        const b = { ...band, cont: true };
        fresh.push(b, cols);
        used += sHeight(b) + sHeight(cols);
      }
    }
    if (a.t === 'gap' && pages[pages.length - 1].length === 0) continue;
    pages[pages.length - 1].push(a);
    used += sHeight(a);
    if (a.t === 'band') { band = a; cols = null; }
    if (a.t === 'cols') cols = a;
    if (a.t === 'total' || a.t === 'adjust' || a.t === 'gap') { band = null; cols = null; }
  }
  return pages.map((atomsOnPage) => ({ atoms: atomsOnPage }));
}

/** Net balance of bills only (what the Friends page shows when a friend has no part payments). */
export const netOf = (expenses: SharedExpense[], friendId: string) =>
  round2(expenses.reduce((s, e) => s + balanceContribution(e, friendId), 0));
