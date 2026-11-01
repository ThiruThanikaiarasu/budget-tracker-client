// ── "Export this bill" as a PDF ───────────────────────────────────────
// Pure layout: a saved transaction → sections (Shared / Only X / Custom) → rows →
// A4 pages. Every row has a fixed height, so pages can be worked out without
// measuring the DOM; the CSS in index.css (.bill-*) uses the same numbers.

export type BillLine = {
  key: string; name: string; qty?: string; amount: number;
  /** Who shares this line, and each person's amount. */
  people: string[]; shares: Record<string, number>;
  /** A category-level amount with no items under it. */
  plain: boolean;
};
export type BillGroup = { id: string; name: string; icon: string; lines: BillLine[]; fees: { label: string; amount: number }[]; total: number };
export interface BillModel {
  title: string; subtitle: string; dateLabel: string; total: number;
  youKey: string; keys: string[]; names: Record<string, string>; payerKey: string; stored: Record<string, number>;
  groups: BillGroup[]; billFees: { label: string; amount: number }[]; note?: string;
  split: boolean;
  /** Per-line shares are known (they reproduce the stored totals). Without them the bill prints as one list. */
  detailed: boolean;
  lineCount: number; categoryCount: number;
}
export interface BillOptions { items: boolean; price: boolean; who: boolean; fees: boolean; pct: boolean; chart: boolean }
/** 'full' = everyone, otherwise one person's key. */
export type CopyOf = 'full' | string;

export type Section = {
  id: string; kind: 'shared' | 'only' | 'custom' | 'all'; title: string; person?: string;
  rows: { group: BillGroup; lines: BillLine[] }[]; lineCount: number; total: number;
};
export type Cols = { price: boolean; pct: boolean; each: boolean; people: string[] | null };
export type Slice = { name: string; icon: string; amount: number; pct: number; color: string; other?: boolean };
export type Atom =
  | { t: 'band'; section: Section; sub: string; neutral?: boolean }
  | { t: 'cols'; cols: Cols; qtyLabel: string }
  | { t: 'cat'; group: BillGroup; cont?: boolean }
  | { t: 'line'; line: BillLine; cols: Cols; each?: number; /** share of its category, 0–100 */ pct?: number; /** bar length 0–100: the category's biggest line is a full bar */ bar?: number }
  | { t: 'fee'; label: string; amount: number }
  | { t: 'pair'; left: Section; right: Section; price: boolean; pct: boolean; pctOf: Record<string, number>; barOf: Record<string, number>; rows: number }
  | { t: 'empty'; text: string }
  | { t: 'title'; text: string }
  | { t: 'total'; label: string; amount: number }
  | { t: 'text'; text: string; lines: number }
  | { t: 'chart'; title: string; slices: Slice[] }
  | { t: 'stack'; title: string; legend: { label: string; color: string }[]; rows: { name: string; icon: string; total: number; bar: number; parts: { color: string; frac: number }[] }[] }
  | { t: 'people'; title: string; cols: { who: string; total: number; slices: Slice[] }[] }
  | { t: 'top'; title: string; rows: { name: string; cat: string; icon: string; amount: number; pct: number; bar: number }[] }
  | { t: 'gap'; h: number };

export const PAGE_W = 794;
export const PAGE_H = 1123;
export const PAGE_PAD = 40;
const FOOT_H = 34;
const CONT_H = 30;
export const HEAD_FIRST = 118;
export const HEAD_RUN = 34;
export const STATS_H = 106;
export const CAPACITY = PAGE_H - 2 * PAGE_PAD - FOOT_H - CONT_H;

export const ROW_H = 28;
export const SLICE_COLORS = ['#FFC83D', '#6EC1F5', '#9FD3A5', '#F5B8D0', '#C9B8F5', '#F5A98A', '#B7E4C7', '#D9CDB8'];
export const heightOf = (a: Atom): number => {
  switch (a.t) {
    case 'band': return 52;
    case 'cols': return 30;
    case 'cat': return 34;
    case 'line': return ROW_H;
    case 'fee': return 26;
    case 'pair': return 52 + 30 + a.rows * ROW_H;
    case 'empty': return 68;
    case 'title': return 44;
    case 'total': return 40;
    case 'text': return a.lines * 20 + 12;
    case 'chart': return 290;
    case 'stack': return 44 + 32 + a.rows.length * 34 + 10;
    case 'people': return 366;
    case 'top': return 44 + a.rows.length * 30 + 10;
    case 'gap': return a.h;
  }
};
const keepWithNext = (a: Atom) => a.t === 'band' || a.t === 'cols' || a.t === 'cat' || a.t === 'title';

const isCustom = (l: BillLine) => {
  const v = l.people.map((k) => l.shares[k] ?? 0);
  return v.length > 1 && Math.max(...v) - Math.min(...v) > 0.011;
};
const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

/** Shared / Only <person> / Custom amounts — never merged, as in the design. */
export function sectionsFor(m: BillModel, copy: CopyOf): Section[] {
  if (!m.split || !m.detailed) {
    const lines = m.groups.reduce((n, g) => n + g.lines.length, 0);
    return [{
      id: 'all', kind: 'all', title: m.split ? 'Split between ' + m.keys.map((k) => m.names[k]).join(' and ') : 'Items',
      rows: m.groups.map((g) => ({ group: g, lines: g.lines })), lineCount: lines, total: sum(m.groups.map((g) => sum(g.lines.map((l) => l.amount)))),
    }];
  }
  const buckets = new Map<string, Section>();
  const bucketFor = (id: string, kind: Section['kind'], title: string, person?: string) => {
    let s = buckets.get(id);
    if (!s) { s = { id, kind, title, person, rows: [], lineCount: 0, total: 0 }; buckets.set(id, s); }
    return s;
  };
  const everyone = m.keys.map((k) => m.names[k]);
  m.groups.forEach((g) => g.lines.forEach((l) => {
    if (copy !== 'full' && !l.people.includes(copy)) return;
    const s = isCustom(l) || (l.people.length > 1 && l.people.length < m.keys.length)
      ? bucketFor('custom', 'custom', 'Custom amounts')
      : l.people.length === 1
        ? bucketFor(`only:${l.people[0]}`, 'only', `Only ${m.names[l.people[0]]}`, l.people[0])
        : bucketFor('shared', 'shared', `Shared by ${everyone.length > 1 ? `${everyone.slice(0, -1).join(', ')} and ${everyone[everyone.length - 1]}` : everyone[0]}`);
    let row = s.rows.find((r) => r.group.id === g.id);
    if (!row) { row = { group: g, lines: [] }; s.rows.push(row); }
    row.lines.push(l);
    s.lineCount += 1;
    s.total = sum([s.total, l.amount]);
  }));
  const order = ['shared', ...m.keys.map((k) => `only:${k}`), 'custom'];
  return order.map((id) => buckets.get(id)).filter((s): s is Section => !!s);
}

/** A section's lines as rows; with "Items" off, one row per category. */
function rowsOf(m: BillModel, s: Section, opts: BillOptions): { cat?: BillGroup; lines: BillLine[] }[] {
  if (!opts.items) {
    return [{
      lines: s.rows.map(({ group, lines }) => ({
        key: group.id, name: group.name, qty: `${lines.length} ${lines.length === 1 ? 'item' : 'items'}`,
        amount: sum(lines.map((l) => l.amount)),
        people: m.keys, shares: Object.fromEntries(m.keys.map((k) => [k, sum(lines.map((l) => l.shares[k] ?? 0))])), plain: false,
      })),
    }];
  }
  return s.rows.map(({ group, lines }) => ({
    cat: lines.length === 1 && lines[0].plain ? undefined : group,
    lines: lines.map((l) => (l.plain ? { ...l, name: group.name } : l)),
  }));
}

export function buildAtoms(m: BillModel, copy: CopyOf, opts: BillOptions): Atom[] {
  const out: Atom[] = [];
  // How big each line is within its whole category on the bill (not just within one section),
  // so the biggest spends stand out. With "Items" off the rows are categories: share of all items.
  const catSum = new Map(m.groups.map((g) => [g.id, sum(g.lines.map((l) => l.amount))]));
  const billSum = sum([...catSum.values()]);
  const pctOf: Record<string, number> = {};
  m.groups.forEach((g) => g.lines.forEach((l) => { const t = catSum.get(g.id) ?? 0; pctOf[l.key] = t > 0 ? (l.amount / t) * 100 : 0; }));
  const barOf: Record<string, number> = {};
  m.groups.forEach((g) => { const top = Math.max(0, ...g.lines.map((l) => pctOf[l.key])); g.lines.forEach((l) => { barOf[l.key] = top > 0 ? (pctOf[l.key] / top) * 100 : 0; }); });
  m.groups.forEach((g) => { pctOf[g.id] = billSum > 0 ? ((catSum.get(g.id) ?? 0) / billSum) * 100 : 0; });
  const groupTop = Math.max(0, ...m.groups.map((g) => pctOf[g.id] ?? 0));
  m.groups.forEach((g) => { barOf[g.id] = groupTop > 0 ? ((pctOf[g.id] ?? 0) / groupTop) * 100 : 0; });
  const pctFor = (l: BillLine) => pctOf[l.key] ?? 0;
  const secs = sectionsFor(m, copy);
  const onlys = secs.filter((s) => s.kind === 'only');
  const pairable = onlys.length === 2 && onlys.every((s) => s.lineCount <= 10);
  let pairDone = false;

  const sub = (s: Section) => s.kind === 'shared' ? `${s.lineCount} ${s.lineCount === 1 ? 'line' : 'lines'} · split equally` : `${s.lineCount} ${s.lineCount === 1 ? 'line' : 'lines'}`;

  secs.forEach((s, i) => {
    if (s.kind === 'only' && pairable) {
      if (pairDone) return;
      pairDone = true;
      out.push({ t: 'gap', h: 12 });
      out.push({ t: 'pair', left: onlys[0], right: onlys[1], price: opts.price, pct: opts.pct, pctOf, barOf, rows: Math.max(onlys[0].lineCount, onlys[1].lineCount) });
      return;
    }
    if (i > 0) out.push({ t: 'gap', h: 14 });
    out.push({ t: 'band', section: s, sub: s.kind === 'only' ? '' : sub(s), neutral: s.kind === 'all' });
    const cols: Cols = {
      price: opts.price,
      pct: opts.pct,
      each: opts.who && s.kind === 'shared',
      people: s.kind === 'custom' ? m.keys : null,
    };
    out.push({ t: 'cols', cols, qtyLabel: 'QTY' });
    rowsOf(m, s, opts).forEach(({ cat, lines }) => {
      if (cat) out.push({ t: 'cat', group: cat });
      lines.forEach((l) => out.push({
        t: 'line', line: l, cols, pct: pctFor(l), bar: barOf[l.key] ?? 0,
        each: cols.each ? l.shares[copy === 'full' ? l.people[0] : copy] ?? l.shares[l.people[0]] : undefined,
      }));
    });
  });

  if (m.split && m.detailed && copy === 'full' && !secs.some((s) => s.kind === 'custom')) {
    out.push({ t: 'gap', h: 14 });
    out.push({ t: 'empty', text: "Lines with typed shares go here, with each person's amount. None on this bill." });
  }

  if (opts.fees) {
    const fees = [...m.groups.flatMap((g) => g.fees.map((f) => ({ ...f, label: `${f.label} · ${g.name}` }))), ...m.billFees];
    if (fees.length > 0 || m.note) out.push({ t: 'gap', h: 14 });
    if (fees.length > 0) {
      out.push({ t: 'title', text: 'Fees, discounts and round off' });
      fees.forEach((f) => out.push({ t: 'fee', label: f.label, amount: f.amount }));
      out.push({ t: 'total', label: 'Bill total', amount: m.total });
    }
    if (m.note) out.push({ t: 'text', text: `Note: ${m.note}`, lines: Math.max(1, Math.ceil(m.note.length / 88)) });
  }

  // Closing analysis. The tables list lines and never category totals, so each chart adds something:
  // where it all went (pie), common vs personal per category, each person's own mix, the biggest spends.
  if (opts.chart && m.groups.length >= 1) {
    const mine = copy !== 'full' && m.split && m.detailed;
    const val = (l: BillLine) => (mine ? l.shares[copy] ?? 0 : l.amount);
    const groups = m.groups
      .map((g) => ({ g, lines: g.lines.filter((l) => !mine || l.people.includes(copy)) }))
      .map((x) => ({ ...x, total: sum(x.lines.map(val)) }))
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
    const all = sum(groups.map((x) => x.total));
    const slicesOf = (rows: { name: string; icon: string; amount: number }[], keep: number): Slice[] => {
      const tot = sum(rows.map((r) => r.amount));
      const top = rows.slice(0, keep);
      const rest = rows.slice(keep);
      const shown = rest.length ? [...top, { name: `Other (${rest.length})`, icon: '', amount: sum(rest.map((r) => r.amount)), other: true }] : top;
      return shown.map((r, i) => ({ ...r, pct: tot > 0 ? (r.amount / tot) * 100 : 0, color: SLICE_COLORS[i % SLICE_COLORS.length] }));
    };

    // 1 · where the money went
    if (groups.length >= 2 && all > 0) {
      out.push({ t: 'gap', h: 14 });
      out.push({ t: 'chart', title: mine ? 'Where your share went' : 'Where the money went', slices: slicesOf(groups.map((x) => ({ name: x.g.name, icon: x.g.icon, amount: x.total })), 7) });
    }

    // 2 · the biggest spends (kept second so it packs into the space after the pie)
    const lines = groups.flatMap((x) => x.lines.map((l) => ({ name: l.plain ? x.g.name : l.name, cat: x.g.name, icon: x.g.icon, amount: val(l) }))).filter((l) => l.amount > 0);
    if (lines.length >= 6 && all > 0) {
      const topLines = [...lines].sort((a, b) => b.amount - a.amount).slice(0, 8);
      out.push({ t: 'gap', h: 14 });
      out.push({ t: 'top', title: 'The biggest spends', rows: topLines.map((l) => ({ ...l, pct: (l.amount / all) * 100, bar: (l.amount / topLines[0].amount) * 100 })) });
    }

    // 3 · common vs personal, by category
    if (m.split && m.detailed) {
      const classOf = (l: BillLine) => (isCustom(l) || (l.people.length > 1 && l.people.length < m.keys.length) ? 'custom' : l.people.length === 1 ? `only:${l.people[0]}` : 'shared');
      const ONLY = ['#FFC83D', '#6EC1F5', '#F5B8D0', '#C9B8F5'];
      const colorOf = (cls: string) => (cls === 'shared' ? '#9FD3A5' : cls === 'custom' ? '#F5A98A' : ONLY[Math.max(0, m.keys.indexOf(cls.slice(5))) % ONLY.length]);
      const labelOf = (cls: string) => (cls === 'shared' ? 'Common, split equally' : cls === 'custom' ? 'Custom amounts' : `Only ${m.names[cls.slice(5)]}`);
      const used = new Set<string>();
      const rows = groups.slice(0, 8).map((x) => {
        const by = new Map<string, number>();
        x.lines.forEach((l) => { const c = classOf(l); used.add(c); by.set(c, sum([by.get(c) ?? 0, val(l)])); });
        const order = ['shared', ...m.keys.map((k) => `only:${k}`), 'custom'].filter((c) => by.has(c));
        return { name: x.g.name, icon: x.g.icon, total: x.total, parts: order.map((c) => ({ color: colorOf(c), frac: (by.get(c) ?? 0) / x.total })) };
      });
      const top = Math.max(...rows.map((r) => r.total));
      if (used.size >= 2 && rows.length >= 1) {
        const order = ['shared', ...m.keys.map((k) => `only:${k}`), 'custom'].filter((c) => used.has(c));
        out.push({ t: 'gap', h: 14 });
        out.push({
          t: 'stack', title: 'Common and personal, by category',
          legend: order.map((c) => ({ label: labelOf(c), color: colorOf(c) })),
          rows: rows.map((r) => ({ ...r, bar: (r.total / top) * 100 })),
        });
      }
    }

    // 4 · each person's own mix (full bill only)
    if (copy === 'full' && m.split && m.detailed && m.keys.length >= 2 && m.keys.length <= 3) {
      const cols = m.keys.map((k) => {
        const rows = m.groups
          .map((g) => ({ name: g.name, icon: g.icon, amount: sum(g.lines.filter((l) => l.people.includes(k)).map((l) => l.shares[k] ?? 0)) }))
          .filter((r) => r.amount > 0).sort((a, b) => b.amount - a.amount);
        // The header total is the bill's own figure for this person, the same as the boxes at the top.
        return { who: k === m.youKey ? 'Your share' : `${m.names[k]}'s share`, total: m.stored[k] ?? sum(rows.map((r) => r.amount)), slices: slicesOf(rows, 5) };
      }).filter((c) => c.slices.length > 0);
      if (cols.length >= 2) { out.push({ t: 'gap', h: 14 }); out.push({ t: 'people', title: 'Who spent on what', cols }); }
    }

  }
  return out;
}

export interface BillPage { atoms: Atom[]; continues: string }

export function paginate(atoms: Atom[], headFirst: number): BillPage[] {
  const pages: Atom[][] = [[]];
  let used = headFirst;
  let band: Atom | null = null;
  let cols: Atom | null = null;
  let cat: Atom | null = null;
  const cap = CAPACITY;

  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    // Never leave a heading at the foot of a page without its first row.
    let need = heightOf(a);
    if (keepWithNext(a)) {
      for (let j = i + 1; j < atoms.length; j++) {
        need += heightOf(atoms[j]);
        if (!keepWithNext(atoms[j])) break;
      }
    }
    const cur = pages[pages.length - 1];
    if (used + need > cap && cur.length > 0) {
      pages.push([]);
      used = HEAD_RUN;
      // Carry the table context onto the new page.
      const fresh = pages[pages.length - 1];
      if (a.t === 'line' || a.t === 'fee') {
        if (a.t === 'line' && cols) { fresh.push(cols); used += heightOf(cols); }
        if (a.t === 'line' && cat && (cat as { t: 'cat' }).t === 'cat') {
          const c = { ...(cat as Extract<Atom, { t: 'cat' }>), cont: true };
          fresh.push(c); used += heightOf(c);
        }
      }
    }
    if (a.t === 'gap' && pages[pages.length - 1].length === 0) continue;
    pages[pages.length - 1].push(a);
    used += heightOf(a);
    if (a.t === 'band') { band = a; cols = null; cat = null; }
    if (a.t === 'cols') cols = a;
    if (a.t === 'cat') cat = a;
    if (a.t === 'gap' || a.t === 'pair' || a.t === 'empty') { cat = null; }
  }
  void band;

  return pages.map((atomsOnPage, p) => {
    const later = pages.slice(p + 1).flat();
    const names = [...new Set(later.flatMap((x) => x.t === 'cat' ? [x.group.name] : x.t === 'band' ? [x.section.title] : x.t === 'pair' ? [x.left.title, x.right.title] : []))];
    const shown = names.slice(0, 4).join(', ');
    return { atoms: atomsOnPage, continues: later.length === 0 ? '' : `Continues on page ${p + 2}${shown ? `: ${p === 0 ? 'rest of ' : ''}${shown}${names.length > 4 ? ` and ${names.length - 4} more` : ''}` : ''}` };
  });
}

export type StatBox = { label: string; amount: number; person?: string; text?: string; settle?: boolean };
/** The boxes under the title: what each person pays, and who settles with whom. */
export function statBoxes(m: BillModel, copy: CopyOf): StatBox[] {
  if (!m.split) return [];
  const nm = (k: string) => m.names[k];
  const you = (k: string) => k === m.youKey;
  if (copy === 'full') {
    const boxes: StatBox[] = m.keys.slice(0, 3).map((k) => ({ label: `${nm(k)}${k === m.payerKey ? ' (paid)' : ''}`, amount: m.stored[k] ?? 0, person: k }));
    if (m.keys.length === 2) {
      const other = m.keys.find((k) => k !== m.payerKey)!;
      boxes.push({ label: 'To settle', amount: m.stored[other] ?? 0, settle: true, text: you(other) ? `You pay ${nm(m.payerKey)}` : you(m.payerKey) ? `${nm(other)} pays you` : `${nm(other)} pays ${nm(m.payerKey)}` });
    }
    return boxes;
  }
  const boxes: StatBox[] = [{ label: 'Your share', amount: m.stored[copy] ?? 0, person: copy }];
  if (copy !== m.payerKey) boxes.push({ label: 'To settle', amount: m.stored[copy] ?? 0, settle: true, text: `Pay ${nm(m.payerKey)}` });
  return boxes;
}
