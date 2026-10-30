import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Controller, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import useTransactionStore, { type Transaction } from '../store/transactionStore';
import api from '../api/axios';
import useCategoryStore from '../store/categoryStore';
import useAccountStore, { type Account } from '../store/accountStore';
import useFriendStore, { type Friend } from '../store/friendStore';
import useBudgetStore, { precheckBudget } from '../store/budgetStore';
import useThemeStore from '../store/themeStore';
import { formatCurrency, formatQty } from '../utils/format';
import useCategoryItemStore, {
  isShownInPicker, fetchItemHistory, daysBetween, shortDate,
  type CategoryItem, type ItemPurchase,
} from '../store/categoryItemStore';
import useUnitGroupStore, { unitsFor, presetsFor, defaultLabel, type Unit, type UnitGroup } from '../store/unitGroupStore';
import ItemFields from '../components/ItemFields';
import CategorySelect from '../components/CategorySelect';
import ThemedSelect from '../components/ThemedSelect';
import DatePicker from '../components/DatePicker';
import { normalizeName } from '../utils/normalizeName';
import Amount from '../components/Amount';
import { sortByFrecency } from '../utils/frecency';
import { renderCategoryIcon } from '../utils/categoryIcons';
import { renderAccountIcon } from '../utils/accountIcons';
import CartoonRecords from './CartoonRecords';
import CartoonIcon from '../components/CartoonIcon';
import { itemKind, categoryKind } from '../utils/cartoonKinds';
import { categoryGroups } from '../utils/txCategories';
import { todayLocal } from '../utils/localDate';
import { FaceAvatar } from '../components/cartoon';

// ── Constants ────────────────────────────────────────────────────────
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function groupDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${MONTHS[m - 1]} ${d}, ${DAYS[date.getDay()]}`;
}

function fmtDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function fmtPaymentTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).toLowerCase();
}

function paymentMonthLabel(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number);
  return `${day} ${MONTHS[month - 1].slice(0, 3).toUpperCase()}`;
}

const DETAIL_HEADER_COLOR: Record<string, string> = {
  expense: '#e07060',
  income: '#50a870',
  transfer: '#5080c0',
};

// ── Schema ───────────────────────────────────────────────────────────
const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be positive'),
  categoryId: z.string().min(1, 'Category is required'),
  accountId: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  note: z.string().optional(),
});
type TransactionFormData = z.infer<typeof transactionSchema>;

// ── Category Icon ────────────────────────────────────────────────────
function CatIcon({ icon, name, size = 40 }: { icon?: string; name: string; size?: number }) {
  return renderCategoryIcon(icon, name, size);
}

// ── Calculator-style amount input ───────────────────────────────────────
// Right-aligned, no native number-input quirks (no stray leading zeros),
// and places the cursor at the end on focus so typing always appends.
function CalcAmountInput({
  value, onChange, className, onFocusChange, autoFocus,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  onFocusChange?: (focused: boolean) => void;
  autoFocus?: boolean;
}) {
  // Zero shows as empty (with a faint 0 placeholder) so typing never fights a leading 0.
  const fmt = (n: number) => (n ? String(Math.round(n * 100) / 100) : '');
  const [text, setText] = useState(() => fmt(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText(fmt(value));
  }, [value, focused]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/[^0-9.]/g, '');
    const dot = v.indexOf('.');
    if (dot !== -1) v = v.slice(0, dot + 1) + v.slice(dot + 1).replace(/\./g, '');
    if (v.length > 1 && v[0] === '0' && v[1] !== '.') v = v.replace(/^0+/, '');
    setText(v);
    onChange(parseFloat(v) || 0);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder="0"
      onChange={handleChange}
      onFocus={(e) => {
        setFocused(true);
        onFocusChange?.(true);
        const el = e.target;
        const end = el.value.length;
        // An empty "0" is replaced by what's typed; a real number keeps the caret at its end.
        requestAnimationFrame(() => (el.value === '0' ? el.select() : el.setSelectionRange(end, end)));
      }}
      onBlur={() => { setFocused(false); onFocusChange?.(false); }}
      className={className}
      autoFocus={autoFocus}
    />
  );
}

const FEE_LABELS = ['Delivery Fee', 'Handling Fee', 'Platform Fee', 'Marketplace Fee', 'Taxes & Charges', 'Packaging Fee'];
const DISCOUNT_LABELS = ['Coupon Offer', 'Offer Discount', 'Cashback'];
const CHARGE_LABELS_KEY = 'budget-tracker:charge-labels:v1';
const readCustomLabels = (): Record<'fee' | 'discount', string[]> => {
  try { return { fee: [], discount: [], ...JSON.parse(localStorage.getItem(CHARGE_LABELS_KEY) ?? '{}') }; } catch { return { fee: [], discount: [] }; }
};

/** Name of a fee or discount: pick a preset (or one you used before) or type your own. */
function ChargeLabelSelect({ value, kind, onChange }: { value: string; kind: 'fee' | 'discount'; onChange: (label: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const presets = kind === 'fee' ? FEE_LABELS : DISCOUNT_LABELS;
  const options = open ? [...presets, ...readCustomLabels()[kind].filter((l) => !presets.includes(l))] : presets;
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.toLowerCase().includes(q)) : options;
  const canUseTyped = !!q && !options.some((o) => o.toLowerCase() === q);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const pick = (label: string) => {
    onChange(label);
    if (!presets.includes(label)) {
      const all = readCustomLabels();
      all[kind] = [label, ...all[kind].filter((l) => l !== label)].slice(0, 12);
      try { localStorage.setItem(CHARGE_LABELS_KEY, JSON.stringify(all)); } catch { /* storage unavailable */ }
    }
    setOpen(false); setQuery('');
  };

  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" onClick={() => setOpen((o) => !o)} className="item-cell w-full flex items-center justify-between gap-2 text-left">
        <span className="truncate" style={{ color: value ? undefined : 'var(--c-muted)' }}>{value || (kind === 'fee' ? 'Pick a fee' : 'Pick a discount')}</span>
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {open && (
        <div className="cartoon-select-panel absolute z-50 mt-1 rounded-xl shadow-lg" style={{ top: '100%', left: 0, minWidth: '15rem', background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}>
          <div className="cartoon-select-search p-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (canUseTyped) pick(query.trim()); else if (shown[0]) pick(shown[0]); } else if (e.key === 'Escape') { setOpen(false); setQuery(''); } }}
              placeholder="Search or type your own…" className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }} />
          </div>
          <div className="p-1.5 space-y-0.5 overflow-y-auto" style={{ maxHeight: '13rem' }}>
            {shown.map((o) => (
              <button key={o} type="button" onClick={() => pick(o)} className={`cartoon-select-opt ${o === value ? 'is-on' : ''} flex w-full items-center px-3 py-2 rounded-lg text-sm text-left`}>{o}</button>
            ))}
            {canUseTyped && (
              <button type="button" onClick={() => pick(query.trim())} className="cartoon-select-opt flex w-full items-center px-3 py-2 rounded-lg text-sm text-left">Use “{query.trim()}”</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Split helpers (Google-Pay-style avatars + amount splitting) ──────────
const USER_KEY = 'user';
const TX_DRAFT_KEY = 'budget-tracker:tx-draft:v1';
const TX_DRAFT_BACKUP_KEY = 'budget-tracker:tx-draft-cleared:v1';
const AVATAR_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Deterministic avatar colour from a name/id. */
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/** First letter of each friend's name; two chars when first letters collide. */
function computeInitials(friends: { _id: string; name: string }[]): Record<string, string> {
  const firstCounts: Record<string, number> = {};
  friends.forEach((f) => {
    const c = (f.name.trim()[0] ?? '?').toUpperCase();
    firstCounts[c] = (firstCounts[c] ?? 0) + 1;
  });
  const map: Record<string, string> = {};
  friends.forEach((f) => {
    const name = f.name.trim();
    const c = (name[0] ?? '?').toUpperCase();
    map[f._id] = firstCounts[c] > 1 ? name.slice(0, 2).toUpperCase() : c;
  });
  return map;
}

/**
 * Split `total` across `keys`. Keys present in `locked` keep their (manual)
 * amount; the rest share the remainder equally, with the last unlocked person
 * absorbing the rounding paisa so the amounts always sum to `total`.
 * Invalid only when everything is locked (or over-locked) and it doesn't add up.
 */
function computeSplit(total: number, keys: string[], locked: Record<string, number>) {
  const lockedKeys = keys.filter((k) => locked[k] !== undefined);
  const unlockedKeys = keys.filter((k) => locked[k] === undefined);
  const lockedSum = lockedKeys.reduce((s, k) => s + (locked[k] || 0), 0);
  const remaining = round2(total - lockedSum);

  const shares: Record<string, number> = {};
  lockedKeys.forEach((k) => { shares[k] = round2(locked[k] || 0); });

  if (unlockedKeys.length > 0 && remaining >= 0) {
    const each = Math.floor((remaining / unlockedKeys.length) * 100) / 100;
    let acc = 0;
    unlockedKeys.forEach((k, i) => {
      if (i === unlockedKeys.length - 1) shares[k] = round2(remaining - acc);
      else { shares[k] = each; acc = round2(acc + each); }
    });
    return { shares, valid: true, unassigned: 0 };
  }

  unlockedKeys.forEach((k) => { shares[k] = 0; });
  const unassigned = round2(total - keys.reduce((s, k) => s + (shares[k] || 0), 0));
  return { shares, valid: Math.abs(unassigned) < 0.01, unassigned };
}

// ── Itemised bills (sub-category items) ─────────────────────────────────
interface ItemRow {
  key: string;
  itemId?: string;
  name: string;
  quantity?: number;
  /** Unit name as recorded; unitId points into the item's unit group. */
  unit?: string;
  unitId?: string;
  /** quantity × unit factor, in the group's base unit (for price-per-kg). */
  baseQuantity?: number;
  amount: number;
  /** Own category when it differs from the transaction's; undefined = the transaction's. */
  categoryId?: string;
  /** Participant keys sharing this item; undefined = everyone in the split. */
  sharedWith?: string[];
}
interface ChargeRow {
  key: string;
  label: string;
  kind: 'fee' | 'discount';
  /** Always positive; `kind` gives the sign. */
  value: number;
}
const signedCharge = (c: ChargeRow) => (c.kind === 'discount' ? -c.value : c.value);
const rowKey = () => Math.random().toString(36).slice(2);

/**
 * Split an itemised bill: each item is shared equally by the people ticked on
 * it, then fees/discounts are spread in proportion to each person's item
 * subtotal. Works in paise so the shares always add up to the exact total.
 */
function computeItemSplit(items: ItemRow[], charges: ChargeRow[], keys: string[]) {
  const sub: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  const unassignedItems: string[] = [];
  items.forEach((item) => {
    const people = (item.sharedWith ?? keys).filter((k) => keys.includes(k));
    if (people.length === 0) { unassignedItems.push(item.name); return; }
    const cents = Math.round(item.amount * 100);
    const base = Math.floor(cents / people.length);
    people.forEach((k, i) => { sub[k] += base + (i < cents - base * people.length ? 1 : 0); });
  });

  const itemCents = keys.reduce((s, k) => s + sub[k], 0);
  const chargeCents = Math.round(charges.reduce((s, c) => s + signedCharge(c), 0) * 100);
  const cents: Record<string, number> = {};
  let allotted = 0;
  keys.forEach((k) => {
    const part = itemCents > 0 ? Math.round((chargeCents * sub[k]) / itemCents) : Math.round(chargeCents / keys.length);
    cents[k] = sub[k] + part;
    allotted += part;
  });
  // Rounding leftovers (a paisa or two) go to the user.
  cents[keys[0]] += chargeCents - allotted;

  const shares = Object.fromEntries(keys.map((k) => [k, cents[k] / 100]));
  const valid = unassignedItems.length === 0 && keys.every((k) => cents[k] >= 0);
  return { shares, valid, unassignedItems };
}

/**
 * Cartoon split: every line (an item, or a category with just an amount) is
 * shared by its own people, each can have a hand-set amount, and the people's
 * totals are the sum over lines (fees/discounts spread in proportion).
 */
type SplitLine = { key: string; name: string; qty?: string; amount: number; group?: string };
/** A signed fee/discount, spread over the people sharing the lines of its `group` (no group = the whole bill). */
type SplitCharge = { group?: string; amount: number };
/** Round exact (fractional) paise to whole paise so they still add up: largest remainders get the extras. */
function apportionCents(exact: number[]): number[] {
  const total = Math.round(exact.reduce((sum, v) => sum + v, 0));
  const floors = exact.map((v) => Math.floor(v + 1e-9));
  let left = total - floors.reduce((sum, v) => sum + v, 0);
  const order = exact.map((v, i) => ({ i, frac: v - Math.floor(v + 1e-9) })).sort((x, y) => y.frac - x.frac || y.i - x.i);
  for (let n = 0; left > 0 && n < order.length * 2; n++, left--) floors[order[n % order.length].i] += 1;
  for (let n = 0; left < 0 && n < order.length * 2; n++, left++) floors[order[order.length - 1 - (n % order.length)].i] -= 1;
  return floors;
}

function computeLineSplit(
  lines: SplitLine[], charges: SplitCharge[], keys: string[],
  shared: Record<string, string[] | undefined>, locks: Record<string, Record<string, number>>,
) {
  // Everything is worked out in exact paise and rounded once at the end, so an
  // equal split comes out equal (a spare paisa goes to one person, not piled on one).
  const exact: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  const byGroup: Record<string, Record<string, number>> = {};
  const lineShares: Record<string, Record<string, number>> = {};
  const unassignedItems: string[] = [];
  let valid = true;
  lines.forEach((l) => {
    const people = (shared[l.key] ?? keys).filter((k) => keys.includes(k));
    lineShares[l.key] = {};
    if (people.length === 0) { if (l.amount > 0) { unassignedItems.push(l.name); valid = false; } return; }
    const held = Object.fromEntries(people.filter((k) => locks[l.key]?.[k] !== undefined).map((k) => [k, locks[l.key][k]]));
    const r = computeSplit(l.amount, people, held);
    if (!r.valid) valid = false;
    const heldCents = Object.values(held).reduce((sum, v) => sum + v * 100, 0);
    const free = people.filter((k) => held[k] === undefined);
    const g = (byGroup[l.group ?? ''] ??= Object.fromEntries(keys.map((k) => [k, 0])));
    people.forEach((k) => {
      const cents = held[k] !== undefined ? held[k] * 100 : free.length ? Math.max(0, l.amount * 100 - heldCents) / free.length : 0;
      lineShares[l.key][k] = r.shares[k] ?? 0;
      exact[k] += cents;
      g[k] += cents;
    });
  });
  // Each fee/discount is shared in proportion to what each person owes in its
  // own category (or on the whole bill when it has none).
  const lineExact = { ...exact };
  const chargeShares: Record<number, Record<string, number>> = {};
  charges.forEach((c, n) => {
    const sub = c.group === undefined ? lineExact : byGroup[c.group] ?? Object.fromEntries(keys.map((k) => [k, 0]));
    const subTotal = keys.reduce((sum, k) => sum + sub[k], 0);
    const total = c.amount * 100;
    const part = keys.map((k) => (subTotal > 0 ? (total * sub[k]) / subTotal : total / keys.length));
    part.forEach((v, i) => { exact[keys[i]] += v; });
    const rounded = apportionCents(part);
    chargeShares[n] = Object.fromEntries(keys.map((k, i) => [k, rounded[i] / 100]));
  });
  const cents = apportionCents(keys.map((k) => exact[k]));
  const shares = Object.fromEntries(keys.map((k, i) => [k, cents[i] / 100]));
  return { shares, lineShares, chargeShares, valid: valid && cents.every((v) => v >= 0), unassignedItems };
}

function AvatarCircle({ label, color, isUser, size = 44, name }: { label?: string; color?: string; isUser?: boolean; size?: number; name?: string }) {
  const isCartoon = useThemeStore((st) => st.theme === 'cartoon');
  if (isCartoon) return <FaceAvatar name={isUser ? 'You' : (name || label || '?')} size={size} />;
  return (
    <span
      className="split-avatar flex items-center justify-center rounded-full font-semibold flex-shrink-0"
      style={{
        width: size, height: size, fontSize: size * 0.36,
        background: isUser ? 'var(--c-accent)' : color,
        color: isUser ? 'var(--c-accent-fg)' : '#fff',
      }}
    >
      {isUser ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: size * 0.5, height: size * 0.5 }}>
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
        </svg>
      ) : label}
    </span>
  );
}

/**
 * Click-and-drag horizontal scrolling for a strip (mouse). Two-finger
 * trackpad swipe already works natively via overflow-x. `dragged()` reports
 * whether the last pointer gesture moved, so clicks can be ignored after a drag.
 */
function useDragScroll() {
  const moved = useRef(false);
  const cleanup = useRef<(() => void) | null>(null);
  // Callback ref: attach native listeners when the strip mounts (it renders
  // conditionally), detach on unmount. Mouse-only, so touch keeps native scroll.
  const ref = useCallback((el: HTMLDivElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (!el) return;
    let down = false, startX = 0, startLeft = 0;
    const onDown = (e: globalThis.MouseEvent) => {
      down = true; moved.current = false; startX = e.clientX; startLeft = el.scrollLeft;
    };
    const onMove = (e: globalThis.MouseEvent) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved.current = true;
      el.scrollLeft = startLeft - dx;
    };
    const onUp = () => { down = false; };
    // Capture-phase: if the pointer moved (a drag), swallow the click so it
    // doesn't select an avatar. Reset happens on the next mousedown.
    const onClickCapture = (e: globalThis.MouseEvent) => {
      if (moved.current) { e.stopPropagation(); e.preventDefault(); }
    };
    el.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    el.addEventListener('click', onClickCapture, true);
    cleanup.current = () => {
      el.removeEventListener('mousedown', onDown);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      el.removeEventListener('click', onClickCapture, true);
    };
  }, []);
  return { ref };
}

// ── Shared dropdown options panel ───────────────────────────────────────
// White-themed, anchored below the trigger with a small margin, rounded
// corners + shadow, and a capped height so long lists scroll within the
// panel instead of stretching to the bottom of the viewport. The cap is
// applied via --anchor-max-height, which Headless UI's floating-ui sizing
// reads (it otherwise forces maxHeight to the full available viewport space).
function SelectOptions({ children }: { children: ReactNode }) {
  return (
    <ListboxOptions
      anchor="bottom start"
      className="cartoon-select-panel z-50 mt-2 w-max min-w-[var(--button-width)] max-w-[16rem] rounded-xl p-1.5 space-y-0.5 shadow-lg"
      style={{
        background: 'var(--c-surface2)',
        border: '1px solid var(--c-border)',
        '--anchor-max-height': '16rem',
      } as React.CSSProperties}
    >
      {children}
    </ListboxOptions>
  );
}

// ── Account select (with type icon, same dropdown panel as category) ───
function AccountSelect({
  accounts, value, onChange,
}: {
  accounts: { _id: string; name: string; type: Account['type']; color?: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = accounts.find(a => a._id === value);
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <ListboxButton
          className="t-select w-full"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="transaction-select-icon">{renderAccountIcon(selected.type, selected.color, 22)}</span>
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span style={{ color: 'var(--c-muted)' }}>Select</span>
          )}
          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </ListboxButton>
        <SelectOptions>
          {accounts.map(a => (
            <ListboxOption key={a._id} value={a._id}>
              {({ focus, selected }) => (
                <div
                  className={`cartoon-select-opt ${focus ? 'is-active' : ''} ${selected ? 'is-on' : ''} flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer`}
                  style={{ background: focus ? 'var(--c-surface)' : 'transparent', color: 'var(--c-text)', fontWeight: selected ? 600 : 400 }}
                >
                  <span className="transaction-select-icon">{renderAccountIcon(a.type, a.color, 22)}</span>
                  <span className="truncate">{a.name}</span>
                </div>
              )}
            </ListboxOption>
          ))}
        </SelectOptions>
      </div>
    </Listbox>
  );
}

// ── Records filters (styled listboxes with the same visual language) ──
const TYPE_FILTER_ITEMS: { _id: string; name: string }[] = [
  { _id: 'income', name: 'Income' },
  { _id: 'expense', name: 'Expense' },
];

function RecordsFilterSelect<T extends { _id: string; name: string }>({
  items, value, onChange, placeholder, allLabel, renderIcon,
}: {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  allLabel: string;
  renderIcon?: (item: T) => ReactNode;
}) {
  const selected = items.find(item => item._id === value);

  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative w-full">
        <ListboxButton className="t-select records-filter-button flex w-full items-center justify-between gap-2 text-left">
          <span className="flex min-w-0 items-center gap-2">
            {selected && renderIcon && <span className="transaction-select-icon">{renderIcon(selected)}</span>}
            <span className="truncate">{selected?.name ?? placeholder}</span>
          </span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </ListboxButton>
        <SelectOptions>
          <ListboxOption value="">
            {({ focus, selected: isSelected }) => (
              <div
                className="cursor-pointer rounded-lg px-3 py-2 text-sm"
                style={{
                  background: focus ? 'var(--c-surface)' : 'transparent',
                  color: 'var(--c-muted)',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {allLabel}
              </div>
            )}
          </ListboxOption>
          {items.map(item => (
            <ListboxOption key={item._id} value={item._id}>
              {({ focus, selected: isSelected }) => (
                <div
                  className={`cartoon-select-opt ${focus ? 'is-active' : ''} ${isSelected ? 'is-on' : ''} flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm`}
                  style={{
                    background: focus ? 'var(--c-surface)' : 'transparent',
                    color: 'var(--c-text)',
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {renderIcon && <span className="transaction-select-icon">{renderIcon(item)}</span>}
                  <span className="truncate">{item.name}</span>
                </div>
              )}
            </ListboxOption>
          ))}
        </SelectOptions>
      </div>
    </Listbox>
  );
}

/** "Potato, Tomato +2" — what an itemised bill was for. */
function itemsSummary(tx: Transaction): string {
  const names = (tx.items ?? []).map(i => i.name);
  return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
}

function accountLabel(tx: Transaction): string {
  if (tx.accountId) return tx.accountId.name + (tx.type === 'transfer' && tx.toAccountId ? ` → ${tx.toAccountId.name}` : '');
  return tx.paidByFriendId ? `Paid by ${tx.paidByFriendId.name}` : 'Debt';
}

// ── Main page ─────────────────────────────────────────────────────────
function Transactions() {
  const theme = useThemeStore((s) => s.theme);
  const isCredWhite = theme === 'cred-white';
  const isCartoon = theme === 'cartoon';
  const {
    transactions, pagination, isLoading, isLoadingMore, summary,
    fetchTransactions, fetchTransactionsSummary, createTransaction, updateTransaction, deleteTransaction,
  } = useTransactionStore();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { categories, fetchCategories } = useCategoryStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const { friends, fetchFriends } = useFriendStore();
  const { fetchTodaySummary } = useBudgetStore();

  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as { openCreate?: boolean; initialType?: 'income' | 'expense' } | null;

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth()); // 0-indexed

  const [showCreate, setShowCreate] = useState(!!navState?.openCreate);
  const [createInitialType] = useState<'income' | 'expense' | undefined>(navState?.initialType);
  const [returnToDash, setReturnToDash] = useState(!!navState?.openCreate);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [detailTx, setDetailTx] = useState<Transaction | null>(null);
  // Cartoon: the day opened from its header in the list (a 'YYYY-MM-DD' key).
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [showFilter, setShowFilter] = useState(false);

  // Filters (accessible via filter panel)
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

  // Search (notes / category name / amount) — debounced so we don't refetch
  // on every keystroke. Always scoped to the viewed month via dateFrom/dateTo.
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (navState?.openCreate) {
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
    fetchFriends();
    fetchTodaySummary();
  }, [fetchCategories, fetchAccounts, fetchFriends, fetchTodaySummary]);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // Derive dateFrom / dateTo from viewYear + viewMonth
  const dateFrom = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const dateTo = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // Shared with the summary fetch so the header total is always scoped to
  // exactly the same window/filters as the list — never derived from
  // whatever pages happen to be loaded client-side.
  const summaryFilters = useMemo(
    () => ({
      dateFrom,
      dateTo,
      type: typeFilter || undefined,
      categoryId: categoryFilter || undefined,
      accountId: accountFilter || undefined,
      search: debouncedSearch || undefined,
    }),
    [dateFrom, dateTo, typeFilter, categoryFilter, accountFilter, debouncedSearch]
  );

  const load = useCallback(
    () => {
      fetchTransactions({ ...summaryFilters, page: 1 });
      fetchTransactionsSummary(summaryFilters);
    },
    [fetchTransactions, fetchTransactionsSummary, summaryFilters]
  );

  // Infinite scroll — load the next page when the sentinel enters the viewport.
  // The observer is only active when NOT already loading and there are more pages.
  useEffect(() => {
    if (isLoadingMore || pagination.page >= pagination.pages) return;
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          // Only extends the list — the header total is never re-derived from
          // this, so scrolling further can't change it.
          fetchTransactions({ ...summaryFilters, page: pagination.page + 1, append: true });
        }
      },
      { threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoadingMore, pagination.page, pagination.pages, fetchTransactions, summaryFilters]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // ── Derived data ─────────────────────────────────────────────────
  // Header totals come from the server (fetchTransactionsSummary), scoped to
  // the full filtered date range — NOT summed from `transactions`, which only
  // holds whatever page(s) infinite scroll has loaded so far. Summing the
  // local list would make the total grow as you scroll, which is wrong.
  const totalExpense = summary?.totalExpense ?? 0;
  const totalIncome = summary?.totalIncome ?? 0;
  const totalNet = totalIncome - totalExpense;

  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const tx of transactions) {
      const key = tx.date.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(tx);
    }
    return map;
  }, [transactions]);
  const sortedDates = useMemo(() => Object.keys(grouped).sort().reverse(), [grouped]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this transaction?')) {
      await deleteTransaction(id);
      fetchTransactionsSummary(summaryFilters);
      setDetailTx(null);
    }
  };

  const handleCloseCreate = () => {
    setShowCreate(false);
    if (returnToDash) { setReturnToDash(false); navigate('/dashboard'); }
  };

  const activeAccounts = accounts.filter(a => a.isActive);

  // Desktop: the list stays on the left and the form / details live in a
  // side panel on the right — no popups, no FAB.
  const isDesktop = useIsDesktop();
  // Bumped to give the "new transaction" panel a fresh, empty form.
  const [createKey, setCreateKey] = useState(0);
  const selectedId = isDesktop ? (editingTx?._id ?? detailTx?._id) : undefined;
  const openTx = (tx: Transaction) => { setEditingTx(null); setDayKey(null); setDetailTx(tx); };
  const openDay = (key: string) => { setEditingTx(null); setDetailTx(null); setDayKey(key); };
  const startNew = useCallback(() => {
    setEditingTx(null);
    setDetailTx(null);
    setDayKey(null);
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.transactions-panel input[aria-label="Amount"]')?.focus());
  }, []);

  // Desktop shortcuts: N = new transaction, Esc = close details / editing.
  useEffect(() => {
    if (!isDesktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
      if (e.key === 'Escape' && (detailTx || editingTx || dayKey)) { e.preventDefault(); startNew(); }
      else if (!typing && (e.key === 'n' || e.key === 'N')) { e.preventDefault(); startNew(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isDesktop, detailTx, editingTx, dayKey, startNew]);

  return (
    <div className="transactions-page lg:flex lg:items-start" style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      <div className="lg:flex-1 lg:min-w-0">
      {isCartoon ? (
        <CartoonRecords
          viewYear={viewYear} viewMonth={viewMonth} onPrev={prevMonth} onNext={nextMonth}
          searchQuery={searchQuery} onSearch={setSearchQuery} debouncedSearch={debouncedSearch}
          categories={categories} accounts={accounts}
          categoryFilter={categoryFilter} onCategoryFilter={setCategoryFilter}
          accountFilter={accountFilter} onAccountFilter={setAccountFilter}
          totalExpense={totalExpense} totalIncome={totalIncome} recordCount={pagination.total}
          transactions={transactions} sortedDates={sortedDates} grouped={grouped}
          isLoading={isLoading} isLoadingMore={isLoadingMore} sentinelRef={sentinelRef}
          selectedId={selectedId} onOpen={openTx} onOpenDay={openDay}
        />
      ) : (<>
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div
        className="transactions-header sticky top-0 z-10 px-4 pt-4 pb-3"
        style={{ background: 'var(--c-header-bg)' }}
      >
        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-1.5" style={{ color: 'var(--c-muted)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="transactions-heading">
            <span className="transactions-title cred-serif text-xl font-semibold" style={{ color: 'var(--c-text)' }}>
              {isCredWhite ? 'payment history' : `${MONTHS[viewMonth]} ${viewYear}`}
            </span>
            {isCredWhite && (
              <span className="transactions-heading-month">{MONTHS[viewMonth]} {viewYear}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={nextMonth} className="transactions-next p-1.5" style={{ color: 'var(--c-muted)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button onClick={() => setShowFilter(v => !v)} className="transactions-filter-toggle p-1.5" style={{ color: showFilter ? 'var(--c-accent)' : 'var(--c-muted)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="12" y1="18" x2="12" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary hero */}
        <div className="transactions-summary mt-4 text-center">
          <p className="cred-label">Net this month</p>
          <p className="cred-serif mt-1 text-4xl font-semibold" style={{ color: 'var(--c-text)' }}>
            <Amount value={Math.abs(totalNet)} prefix={totalNet < 0 ? '−' : totalNet > 0 ? '+' : ''} />
          </p>
          <div className="mt-2 flex items-center justify-center gap-3 text-xs" style={{ color: 'var(--c-muted)' }}>
            <span>
              Expense{' '}
              <Amount value={totalExpense} className="font-semibold" style={{ color: 'var(--c-expense)' }} />
            </span>
            <span style={{ opacity: 0.35 }}>·</span>
            <span>
              Income{' '}
              <Amount value={totalIncome} className="font-semibold" style={{ color: 'var(--c-income)' }} />
            </span>
          </div>
        </div>

        {/* Search — notes, category or amount, within the viewed month */}
        <div className="transactions-search mt-4">
          <div className="transactions-search-field flex items-center gap-2 rounded-lg px-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
            <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--c-muted)' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              inputMode="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search notes, category or amount"
              aria-label="Search transactions this month"
              className="w-full bg-transparent py-2 text-sm outline-none"
              style={{ color: 'var(--c-text)' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="shrink-0 p-1"
                style={{ color: 'var(--c-muted)' }}
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Filter panel ──────────────────────────────────────────── */}
      {(showFilter || isCredWhite) && (
        <div className="transactions-filters px-4 py-3 space-y-2" style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
          <div className="transactions-filter-grid">
            {isCredWhite ? (
              <>
                <div className="records-filter-type">
                  <RecordsFilterSelect
                    items={TYPE_FILTER_ITEMS}
                    value={typeFilter}
                    onChange={setTypeFilter}
                    placeholder="Filter"
                    allLabel="All"
                  />
                </div>
                <div className="records-filter-category">
                  <RecordsFilterSelect
                    items={categories}
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    placeholder="Category"
                    allLabel="All"
                    renderIcon={(category) => renderCategoryIcon(category.icon, category.name, 22)}
                  />
                </div>
                <div className="records-filter-account">
                  <RecordsFilterSelect
                    items={accounts}
                    value={accountFilter}
                    onChange={setAccountFilter}
                    placeholder="Payment methods"
                    allLabel="All"
                    renderIcon={(account) => renderAccountIcon(account.type, account.color, 22)}
                  />
                </div>
              </>
            ) : (
              <>
                <select aria-label="Filter by transaction type" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="t-select text-xs">
                  <option value="">All types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
                <select aria-label="Filter by category" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="t-select text-xs">
                  <option value="">All categories</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
                </select>
                <select aria-label="Filter by payment method" value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="t-select text-xs">
                  <option value="">All accounts</option>
                  {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                </select>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Desktop month stats ───────────────────────────────────── */}
      {isDesktop && (
        <div className="grid grid-cols-4 gap-3 px-8 pt-2 pb-4">
          {[
            { label: 'Spent', value: totalExpense, color: 'var(--c-expense)' },
            { label: 'Earned', value: totalIncome, color: 'var(--c-income)' },
            { label: 'Net', value: Math.abs(totalNet), color: 'var(--c-text)', prefix: totalNet < 0 ? '−' : totalNet > 0 ? '+' : '' },
          ].map(card => (
            <div key={card.label} className="rounded-xl px-4 py-3" style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>{card.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: card.color }}>
                <Amount value={card.value} prefix={card.prefix} />
              </p>
            </div>
          ))}
          <div className="rounded-xl px-4 py-3" style={{ border: '1px solid var(--c-border)', background: 'var(--c-surface)' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Records</p>
            <p className="mt-1 text-xl font-semibold tabular-nums" style={{ color: 'var(--c-text)' }}>{pagination.total}</p>
          </div>
        </div>
      )}

      {/* ── Transaction list ──────────────────────────────────────── */}
      <div className="pb-4">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--c-border)', borderTopColor: 'var(--c-accent)' }} />
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="text-4xl opacity-30">📋</span>
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
              {debouncedSearch ? 'No matching transactions this month' : 'No transactions this month'}
            </p>
          </div>
        ) : (
          sortedDates.map(dateKey => (
            <div key={dateKey}>
              {/* Date header */}
              <div className="transactions-date px-4 pt-4 pb-1.5">
                <span className="cred-label">{isCredWhite ? paymentMonthLabel(dateKey) : groupDate(dateKey)}</span>
              </div>
              {/* Rows */}
              {grouped[dateKey].map((tx, idx) => {
                const isSplit = tx.personalShare != null && tx.personalShare !== tx.amount;
                return (
                <button
                  key={tx._id}
                  onClick={() => openTx(tx)}
                  className="transaction-row w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{
                    borderBottom: idx < grouped[dateKey].length - 1 ? '1px dashed var(--c-border)' : undefined,
                    background: tx._id === selectedId ? 'var(--c-surface2)' : undefined,
                  }}
                >
                  {/* Icon */}
                  {tx.type === 'transfer' ? (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#5080c0' }}>
                      <span className="text-base">↔</span>
                    </div>
                  ) : tx.categoryId ? (
                    <CatIcon icon={tx.categoryId.icon} name={tx.categoryId.name} size={40} />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--c-surface2)' }}>
                      <span className="text-base">💰</span>
                    </div>
                  )}
                  {/* Name + account */}
                  <div className="flex-1 min-w-0">
                    <p className="transaction-name text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>
                      {tx.isAdjustment ? 'Clean up' : tx.type === 'transfer' ? 'Transfer' : tx.categoryId?.name || 'Unknown'}
                      {(() => {
                        const others = [...new Set((tx.items ?? []).map(i => i.categoryId).filter((id): id is string => !!id && id !== tx.categoryId?._id))]
                          .map(id => categories.find(c => c._id === id)?.name).filter(Boolean);
                        return others.length ? <span style={{ color: 'var(--c-muted)' }}> + {others.join(', ')}</span> : null;
                      })()}
                    </p>
                    <div className="transaction-meta flex items-center gap-1 mt-0.5 min-w-0">
                      {isCredWhite && (
                        <>
                          <span className="transaction-success" aria-label="Completed">✓</span>
                          <span className="transaction-time">{fmtPaymentTime(tx.date)}</span>
                        </>
                      )}
                      {tx.isAdjustment && (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ background: 'var(--c-surface2)', color: 'var(--c-muted)' }}
                        >
                          new journey
                        </span>
                      )}
                      {!isCredWhite && (tx.accountId ? (
                        <span
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px]"
                          style={{ background: 'var(--c-surface2)', color: 'var(--c-muted)' }}
                        >
                          {tx.accountId.name}
                          {tx.type === 'transfer' && tx.toAccountId ? ` → ${tx.toAccountId.name}` : ''}
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px]"
                          style={{ background: 'var(--c-surface2)', color: 'var(--c-muted)' }}
                        >
                          {tx.paidByFriendId
                            ? `Debt · ${tx.paidByFriendId.name}`
                            : 'Debt'}
                        </span>
                      ))}
                      {isSplit && (
                        <span className="text-[11px] leading-none" style={{ color: '#5080c0' }} title="Split">
                          ✂
                        </span>
                      )}
                      {tx.type === 'income' && tx.receivedFromFriendId && (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px]"
                          style={{ background: 'var(--c-surface2)', color: 'var(--c-muted)' }}
                        >
                          From {tx.receivedFromFriendId.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Desktop: note / items and the account, in their own column */}
                  {isDesktop && (
                    <div className="w-[40%] min-w-0 text-xs">
                      <p className="truncate" style={{ color: tx.note || tx.items?.length ? 'var(--c-text)' : 'var(--c-muted)' }}>
                        {tx.note || itemsSummary(tx) || '—'}
                      </p>
                      <p className="truncate mt-0.5" style={{ color: 'var(--c-muted)' }}>
                        {[accountLabel(tx), tx.note ? itemsSummary(tx) : ''].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  )}
                  {/* Amount */}
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span
                      className="transaction-amount text-sm font-bold"
                      style={{
                        color: isCredWhite ? 'var(--c-text)'
                             : tx.type === 'income' ? 'var(--c-income)'
                             : tx.type === 'expense' ? 'var(--c-expense)'
                             : 'var(--c-muted)',
                      }}
                    >
                      <Amount
                        value={isSplit ? tx.personalShare! : tx.amount}
                        prefix={tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''}
                      />
                    </span>
                    {isSplit && (
                      <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>
                        of <Amount value={tx.amount} />
                      </span>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          ))
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-1" />
        {isLoadingMore && (
          <div className="flex justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" style={{ color: 'var(--c-muted)' }} />
          </div>
        )}

      </div>
      </>)}
      </div>

      {/* ── Desktop side panel: new / details / edit ─────────────── */}
      {isDesktop && (
        <aside
          className="transactions-panel @container sticky top-0 h-screen flex-shrink-0 w-[40%] min-w-[30rem] max-w-[46rem]"
          style={{ borderLeft: '1px solid var(--c-border)', background: 'var(--c-bg)' }}
        >
          {editingTx ? (
            <TransactionModal
              key={`edit-${editingTx._id}`}
              panel
              open
              onClose={() => setEditingTx(null)}
              onSubmit={async (data) => {
                await updateTransaction(editingTx._id, data);
                fetchTransactionsSummary(summaryFilters);
              }}
              categories={categories}
              accounts={activeAccounts}
              friends={friends}
              transaction={editingTx}
            />
          ) : detailTx ? (
            <div className="transaction-detail h-full overflow-y-auto" style={{ background: 'var(--c-surface)' }}>
              <TransactionDetail
                tx={detailTx}
                isCredWhite={isCredWhite}
                categories={categories}
                onClose={() => setDetailTx(null)}
                onDelete={() => handleDelete(detailTx._id)}
                onEdit={() => { setEditingTx(detailTx); setDetailTx(null); }}
              />
            </div>
          ) : dayKey && grouped[dayKey] ? (
            <div className="transaction-detail h-full overflow-y-auto" style={{ background: 'var(--c-surface)' }}>
              <CartoonDayReceipt dateKey={dayKey} txs={grouped[dayKey]} categories={categories} onClose={() => setDayKey(null)} onOpenTx={openTx} />
            </div>
          ) : (
            <TransactionModal
              key={`new-${createKey}`}
              panel
              open
              onClose={() => { setCreateKey(k => k + 1); handleCloseCreate(); }}
              onSubmit={async (data) => {
                await createTransaction(data);
                fetchTransactionsSummary(summaryFilters);
              }}
              categories={categories}
              accounts={activeAccounts}
              friends={friends}
              initialType={createInitialType}
            />
          )}
        </aside>
      )}

      {!isDesktop && (<>
      {/* ── FAB ───────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-10 text-2xl font-light"
        style={{ background: 'var(--c-surface2)', color: 'var(--c-accent)' }}
      >
        +
      </button>

      {/* ── Transaction detail popup ──────────────────────────────── */}
      {detailTx && (
        <Dialog open onClose={() => setDetailTx(null)} className="relative z-50">
          <div className="fixed inset-0 bg-black/60" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="transaction-detail w-full max-w-sm max-h-[92vh] overflow-y-auto overscroll-contain rounded-2xl shadow-2xl">
              <TransactionDetail
                tx={detailTx}
                isCredWhite={isCredWhite}
                categories={categories}
                onClose={() => setDetailTx(null)}
                onDelete={() => handleDelete(detailTx._id)}
                onEdit={() => { setEditingTx(detailTx); setDetailTx(null); }}
              />
            </DialogPanel>
          </div>
        </Dialog>
      )}

      {dayKey && grouped[dayKey] && (
        <Dialog open onClose={() => setDayKey(null)} className="relative z-50">
          <div className="fixed inset-0 bg-black/60" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <DialogPanel className="transaction-detail w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl">
              <CartoonDayReceipt dateKey={dayKey} txs={grouped[dayKey]} categories={categories} onClose={() => setDayKey(null)} onOpenTx={openTx} />
            </DialogPanel>
          </div>
        </Dialog>
      )}

      {/* ── Create modal ──────────────────────────────────────────── */}
      <TransactionModal
        open={showCreate}
        onClose={handleCloseCreate}
        onSubmit={async (data) => {
          await createTransaction(data);
          fetchTransactionsSummary(summaryFilters);
        }}
        categories={categories}
        accounts={activeAccounts}
        friends={friends}
        initialType={createInitialType}
      />

      {/* ── Edit modal ────────────────────────────────────────────── */}
      {editingTx && (
        <TransactionModal
          open
          onClose={() => setEditingTx(null)}
          onSubmit={async (data) => {
            await updateTransaction(editingTx._id, data);
            fetchTransactionsSummary(summaryFilters);
          }}
          categories={categories}
          accounts={activeAccounts}
          friends={friends}
          transaction={editingTx}
        />
      )}
      </>)}
    </div>
  );
}

// ── Transaction detail (popup on mobile, side panel on desktop) ────────
function TransactionDetail({ tx, isCredWhite, categories, onClose, onDelete, onEdit }: {
  tx: Transaction;
  isCredWhite: boolean;
  categories: { _id: string; name: string; icon: string }[];
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const isCartoon = useThemeStore((st) => st.theme === 'cartoon');
  if (isCartoon) return <CartoonReceipt tx={tx} categories={categories} onClose={onClose} onDelete={onDelete} onEdit={onEdit} />;
  return (
    <>
    {/* Colored header */}
    <div
      className="transaction-detail-header px-4 pt-4 pb-8 relative"
      style={{ backgroundColor: isCredWhite ? 'var(--c-text)' : (DETAIL_HEADER_COLOR[tx.type] || '#888') }}
    >
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="text-white/80 hover:text-white p-1">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <button
            onClick={onDelete}
            className="text-white/80 hover:text-white p-1"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6m4-6v6" /><path d="M9 6V4h6v2" />
            </svg>
          </button>
          {tx.type !== 'transfer' && (
            <button
              onClick={onEdit}
              className="text-white/80 hover:text-white p-1"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="text-center mt-4">
        <p className="text-xs uppercase font-semibold tracking-widest text-white/80">
          {tx.type}
        </p>
        <p className="text-4xl font-bold text-white mt-1">
          {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
          {formatCurrency(
            tx.personalShare != null && tx.personalShare !== tx.amount
              ? tx.personalShare
              : tx.amount
          )}
        </p>
        {tx.personalShare != null && tx.personalShare !== tx.amount && (
          <p className="text-xs text-white/80 mt-1">
            ✂ your share · total {formatCurrency(tx.amount)}
          </p>
        )}
        <p className="text-xs text-white/70 mt-2">{fmtDateTime(tx.date)}</p>
      </div>
    </div>
    {/* Details */}
    <div className="transaction-detail-body p-4 space-y-3" style={{ background: 'var(--c-surface)' }}>
      {tx.accountId ? (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--c-muted)' }}>
            {tx.type === 'transfer' ? 'From' : 'Account'}
          </span>
          <span
            className="transaction-detail-chip flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
          >
            <span className="text-sm">💳</span>
            <span className="text-sm font-medium">{tx.accountId.name}</span>
          </span>
        </div>
      ) : tx.paidByFriendId ? (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--c-muted)' }}>Paid by</span>
          <span
            className="transaction-detail-chip flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
          >
            <span className="text-sm">👤</span>
            <span className="text-sm font-medium">{tx.paidByFriendId.name}</span>
          </span>
        </div>
      ) : null}
      {tx.type === 'income' && tx.receivedFromFriendId && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--c-muted)' }}>Received from</span>
          <span
            className="transaction-detail-chip flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
          >
            <span className="text-sm">👤</span>
            <span className="text-sm font-medium">{tx.receivedFromFriendId.name}</span>
          </span>
        </div>
      )}
      {tx.type === 'transfer' && tx.toAccountId && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--c-muted)' }}>To</span>
          <span
            className="transaction-detail-chip flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
          >
            <span className="text-sm">💳</span>
            <span className="text-sm font-medium">{tx.toAccountId.name}</span>
          </span>
        </div>
      )}
      {tx.categoryId && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: 'var(--c-muted)' }}>Category</span>
          <span
            className="transaction-detail-chip flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
          >
            {renderCategoryIcon(tx.categoryId.icon, tx.categoryId.name, 20)}
            <span className="text-sm font-medium">{tx.categoryId.name}</span>
          </span>
        </div>
      )}
      {tx.items && tx.items.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>Items</p>
          <div className="space-y-1">
            {tx.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm gap-2">
                <span className="truncate" style={{ color: 'var(--c-text)' }}>
                  {item.name}
                  {formatQty(item.quantity, item.unit) && (
                    <span style={{ color: 'var(--c-muted)' }}> · {formatQty(item.quantity, item.unit)}</span>
                  )}
                </span>
                <span style={{ color: 'var(--c-text)' }}>{formatCurrency(item.amount)}</span>
              </div>
            ))}
            {tx.charges?.map((c, i) => (
              <div key={`c${i}`} className="flex items-center justify-between text-sm">
                <span style={{ color: 'var(--c-muted)' }}>{c.label}</span>
                <span style={{ color: 'var(--c-muted)' }}>{c.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(c.amount))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {tx.split && tx.split.splits.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>Split details</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: 'var(--c-text)' }}>
                You{tx.split.paidBy === 'user' ? ' (paid)' : ''}
              </span>
              <span style={{ color: 'var(--c-text)' }}>
                {formatCurrency(tx.amount - tx.split.splits.reduce((s, x) => s + x.amount, 0))}
              </span>
            </div>
            {tx.split.splits.map((s, i) => {
              const name = typeof s.friendId === 'string' ? s.friendId : s.friendId.name;
              const fid = typeof s.friendId === 'string' ? s.friendId : s.friendId._id;
              const paid = tx.split!.paidBy === fid;
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: 'var(--c-muted)' }}>{name}{paid ? ' (paid)' : ''}</span>
                  <span style={{ color: 'var(--c-muted)' }}>{formatCurrency(s.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {tx.note && (
        <p className="text-sm text-center py-2" style={{ color: 'var(--c-muted)' }}>
          {tx.note}
        </p>
      )}
    </div>
    </>
  );
}

const SPLIT_COLORS = ['#FFC83D', '#9FD3A5', '#7DBEF0', '#F2A7C3', '#F6B48A', '#C5B3F0', '#8FD6D0'];

interface SplitBlock {
  key: string;
  name: string;
  icon: string;
  total: number;
  /** Item lines; empty = the category is one plain amount. */
  lines: SplitLine[];
}

/** Cartoon theme "Split it" panel — who's in, who shares each line, who pays what. */
function CartoonSplitPanel({
  blocks, fees, calc, keys, candidates, friends, initials, selectedFriends, onToggleFriend, payerKey,
  shared, onShared, locks, onLock, onReset, customized, total, onOff, onFocusChange,
}: {
  blocks: SplitBlock[];
  /** Fees and discounts, in the order the split calculation received them. */
  fees: { label: string; amount: number; where?: string }[];
  calc: ReturnType<typeof computeLineSplit>;
  keys: string[];
  candidates: Friend[];
  friends: Friend[];
  initials: Record<string, string>;
  selectedFriends: string[];
  onToggleFriend: (id: string) => void;
  payerKey: string;
  shared: Record<string, string[] | undefined>;
  onShared: (lineKey: string, people: string[] | undefined) => void;
  locks: Record<string, Record<string, number>>;
  onLock: (lineKey: string, person: string, value: number) => void;
  onReset: () => void;
  customized: boolean;
  total: number;
  onOff: () => void;
  onFocusChange: (focused: boolean) => void;
}) {
  const nameOf = (k: string) => (k === USER_KEY ? 'You' : friends.find((f) => f._id === k)?.name ?? '');
  const face = (k: string, size: number) => (
    <AvatarCircle name={nameOf(k)} isUser={k === USER_KEY} label={k === USER_KEY ? undefined : initials[k]} color={avatarColor(nameOf(k))} size={size} />
  );
  const peopleOf = (lineKey: string) => (shared[lineKey] ?? keys).filter((k) => keys.includes(k));
  const toggleOne = (lineKey: string, k: string) => {
    const now = peopleOf(lineKey);
    const next = now.includes(k) ? now.filter((x) => x !== k) : [...now, k];
    onShared(lineKey, keys.every((x) => next.includes(x)) ? undefined : keys.filter((x) => next.includes(x)));
  };
  const toggleWhole = (lineKeys: string[], k: string) => {
    const all = lineKeys.every((lk) => peopleOf(lk).includes(k));
    lineKeys.forEach((lk) => {
      const now = peopleOf(lk);
      const next = all ? now.filter((x) => x !== k) : now.includes(k) ? now : [...now, k];
      onShared(lk, keys.every((x) => next.includes(x)) ? undefined : keys.filter((x) => next.includes(x)));
    });
  };
  const chips = (lineKey: string) => (
    <div className="sp-chips">
      {keys.map((k) => {
        const on = peopleOf(lineKey).includes(k);
        const locked = locks[lineKey]?.[k] !== undefined;
        return (
          <div key={k} className="sp-slot">
            {on ? (
              <div className={`sp-chip ${locked ? 'is-locked' : ''}`}>
                <button type="button" className="sp-face" onClick={() => toggleOne(lineKey, k)} aria-label={`${nameOf(k)} shares this`}>
                  {face(k, 30)}<span className="sp-check">✓</span>
                </button>
                <span className="sp-rs">₹</span>
                <CalcAmountInput value={calc.lineShares[lineKey]?.[k] ?? 0} onChange={(v) => onLock(lineKey, k, v)} className="sp-amt" onFocusChange={onFocusChange} />
              </div>
            ) : (
              <button type="button" className="sp-chip is-out" onClick={() => toggleOne(lineKey, k)} aria-label={`Add ${nameOf(k)}`}>
                <span className="sp-face">{face(k, 30)}</span><span className="sp-out">not in</span>
              </button>
            )}
            <span className="sp-slot-name">{nameOf(k)}</span>
          </div>
        );
      })}
    </div>
  );

  const signed = (n: number) => `${n < 0 ? '−' : n > 0 ? '+' : ''}₹${Math.abs(round2(n))}`;
  const payerName = nameOf(payerKey);
  const others = keys.filter((k) => k !== payerKey);
  const sub = (k: string) => {
    if (k === payerKey) return 'paid the bill';
    const amt = formatCurrency(calc.shares[k] ?? 0);
    return payerKey === USER_KEY ? `owes you ${amt}` : k === USER_KEY ? `you owe ${payerName} ${amt}` : `owes ${payerName} ${amt}`;
  };

  return (
    <div className="sp-panel">
      <div className="sp-head">
        <span className="sp-title"><CartoonIcon kind="pizza" size={30} />Split it</span>
        <button type="button" role="switch" aria-checked="true" aria-label="Split on" className="sp-switch" onClick={onOff}><span /></button>
      </div>

      <p className="sp-label">Who's sharing?</p>
      <div className="sp-people no-scrollbar">
        {[USER_KEY, ...(payerKey !== USER_KEY ? [payerKey] : []), ...candidates.map((f) => f._id)].map((k) => {
          const on = k === USER_KEY || k === payerKey || selectedFriends.includes(k);
          const fixed = k === USER_KEY || k === payerKey;
          return (
            <button key={k} type="button" disabled={fixed} className={`sp-person ${on ? 'is-on' : ''}`} onClick={() => onToggleFriend(k)}>
              <span className="sp-person-face">{face(k, 52)}{on && <span className="sp-check">✓</span>}</span>
              <span className="sp-person-name">{nameOf(k)}</span>
            </button>
          );
        })}
      </div>

      <div className="sp-legend">
        <span><b className="sp-check is-inline">✓</b> shares it</span>
        <span><b className="sp-dash" /> left out</span>
        <span>🔒 own amount</span>
        {customized && <button type="button" className="sp-reset" onClick={onReset}>Reset all to equal</button>}
      </div>

      {keys.length < 2 ? (
        <p className="sp-hint">Tap a friend above to share this with.</p>
      ) : total <= 0 ? (
        <p className="sp-hint">Add an amount above, then choose who shares each part.</p>
      ) : (
        <>
          {blocks.map((b) => (
            <div key={b.key} className="sp-card">
              <div className="sp-card-head">
                {renderCategoryIcon(b.icon, b.name, 44)}
                <div className="min-w-0 flex-1">
                  <p className="sp-card-name">{b.name}</p>
                  <p className="sp-card-sub">{b.lines.length > 0 ? `${b.lines.length} item${b.lines.length === 1 ? '' : 's'}` : 'Just an amount'}</p>
                </div>
                <span className="sp-card-amt">₹{b.total}</span>
              </div>
              {b.lines.length === 0 ? chips(b.key) : (
                <>
                  <div className="sp-whole">
                    <span>Whole {b.name}</span>
                    <div className="flex gap-1.5">
                      {keys.map((k) => {
                        const lk = b.lines.map((l) => l.key);
                        const n = lk.filter((x) => peopleOf(x).includes(k)).length;
                        return (
                          <button key={k} type="button" className={`sp-mini ${n === 0 ? 'is-out' : ''}`} onClick={() => toggleWhole(lk, k)} aria-label={`${nameOf(k)} shares all of ${b.name}`}>
                            {face(k, 30)}{n > 0 && <span className="sp-check">{n === lk.length ? '✓' : '–'}</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {b.lines.map((l) => (
                    <div key={l.key} className="sp-item">
                      <div className="sp-item-head"><span>{l.name}{l.qty && <em> · {l.qty}</em>}</span><b>₹{l.amount}</b></div>
                      {chips(l.key)}
                    </div>
                  ))}
                </>
              )}
            </div>
          ))}
          {fees.length > 0 && (
            <div className="sp-card">
              <div className="sp-card-head">
                <CartoonIcon kind="receipt" size={44} />
                <div className="min-w-0 flex-1">
                  <p className="sp-card-name">Fees &amp; discounts</p>
                  <p className="sp-card-sub">Shared in proportion to what each person owes</p>
                </div>
                <span className="sp-card-amt">{signed(round2(fees.reduce((sum, f) => sum + f.amount, 0)))}</span>
              </div>
              {fees.map((f, n) => (
                <div key={n} className="sp-item">
                  <div className="sp-item-head"><span>{f.label}{f.where && <em> · {f.where}</em>}</span><b>{signed(f.amount)}</b></div>
                  <div className="sp-chips">
                    {keys.map((k) => (
                      <div key={k} className="sp-slot">
                        <div className="sp-chip is-static"><span className="sp-face">{face(k, 30)}</span><span className="sp-static-amt">{signed(calc.chargeShares[n]?.[k] ?? 0)}</span></div>
                        <span className="sp-slot-name">{nameOf(k)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="sp-hint">Tap a face to leave someone out. Tap an amount to set it.</p>

          <div className="sp-pays">
            <div className="sp-pays-head"><span>Who pays what</span><b>₹{total}</b></div>
            <div className="sp-bar">
              {keys.map((k, i) => (calc.shares[k] ?? 0) > 0 && <span key={k} style={{ flex: calc.shares[k], background: SPLIT_COLORS[i % SPLIT_COLORS.length] }} />)}
            </div>
            {keys.map((k) => (
              <div key={k} className="sp-pays-row">
                {face(k, 36)}
                <div className="min-w-0 flex-1"><p className="sp-pays-name">{nameOf(k)}</p><p className="sp-pays-sub">{sub(k)}</p></div>
                <b>₹{round2(calc.shares[k] ?? 0)}</b>
              </div>
            ))}
            <p className={`sp-sum ${calc.valid ? '' : 'is-bad'}`}>
              {calc.valid
                ? `${others.map((k) => (payerKey === USER_KEY ? `${nameOf(k)} owes you ${formatCurrency(calc.shares[k] ?? 0)}` : k === USER_KEY ? `You owe ${payerName} ${formatCurrency(calc.shares[k] ?? 0)}` : `${nameOf(k)} owes ${payerName} ${formatCurrency(calc.shares[k] ?? 0)}`)).join(', ')}. Adds up to ${formatCurrency(total)}.`
                : calc.unassignedItems.length > 0 ? `Nobody shares ${calc.unassignedItems.join(', ')} yet.` : "The amounts don't add up to the total yet."}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Cartoon theme: one day as a paper receipt — where the money went, every
 * record of the day, the day's total, and who ends up owing whom.
 */
function CartoonDayReceipt({ dateKey, txs, categories, onClose, onOpenTx }: {
  dateKey: string;
  txs: Transaction[];
  categories: { _id: string; name: string; icon: string }[];
  onClose: () => void;
  onOpenTx: (tx: Transaction) => void;
}) {
  const navigate = useNavigate();
  const [y, m, d] = dateKey.split('-').map(Number);
  const dayDate = new Date(y, m - 1, d);
  const heading = `${WEEKDAYS[dayDate.getDay()]}`.toUpperCase();
  const dateLabel = dayDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const own = (tx: Transaction) => (tx.personalShare != null ? tx.personalShare : tx.amount);
  const real = txs.filter((t) => !t.isAdjustment);
  const spends = real.filter((t) => t.type === 'expense');
  const incomes = real.filter((t) => t.type === 'income');
  const out = round2(spends.reduce((sum, t) => sum + own(t), 0));
  const inn = round2(incomes.reduce((sum, t) => sum + t.amount, 0));

  // Where the money went: your share of every category the day's bills touched.
  const spread = (list: Transaction[], mine: boolean) => {
    const acc = new Map<string, { name: string; icon: string; total: number }>();
    list.forEach((t) => {
      const ratio = mine && t.amount > 0 ? own(t) / t.amount : 1;
      categoryGroups(t, categories).forEach((g) => {
        const key = g.id ?? g.name;
        const row = acc.get(key) ?? { name: g.name, icon: g.icon, total: 0 };
        row.total = round2(row.total + g.total * ratio);
        acc.set(key, row);
      });
    });
    return [...acc.values()].filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
  };
  const outGroups = spread(spends, true);
  const inGroups = spread(incomes, false);

  const titleOf = (t: Transaction) => {
    if (t.type === 'transfer') return 'Transfer';
    const gs = categoryGroups(t, categories);
    const base = gs.length > 1 ? (gs.length === 2 ? `${gs[0].name} + ${gs[1].name}` : `${gs[0].name} + ${gs.length - 1} more`) : (t.categoryId?.name ?? 'Record');
    return t.merchant ? `${base} · ${t.merchant}` : base;
  };
  const timeOf = (t: Transaction) => new Date(t.date).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

  // Who ends up owing whom across the day's split bills (positive = they owe you).
  const net: Record<string, { name: string; amount: number }> = {};
  spends.forEach((t) => {
    const parts = (t.split?.splits ?? []).map((sp) => ({
      id: typeof sp.friendId === 'string' ? sp.friendId : sp.friendId._id,
      name: typeof sp.friendId === 'string' ? 'Friend' : sp.friendId.name,
      amount: sp.amount,
    }));
    const payer = t.paidByFriendId;
    if (payer) {
      // A friend paid: you owe them your own share (all of it when nothing was split).
      const mine = round2(t.amount - parts.reduce((sum, p) => sum + p.amount, 0));
      net[payer._id] = { name: payer.name, amount: round2((net[payer._id]?.amount ?? 0) - mine) };
    } else {
      parts.forEach((p) => { net[p.id] = { name: p.name, amount: round2((net[p.id]?.amount ?? 0) + p.amount) }; });
    }
  });
  const nets = Object.entries(net).filter(([, v]) => Math.abs(v.amount) >= 0.005);

  const roundBtn = (label: string, onClick: () => void, icon: ReactNode) => (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rcpt-btn">{icon}</button>
  );

  return (
    <div className="rcpt-wrap">
      <div className="rcpt-bar">
        {roundBtn('Close', onClose, <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>)}
      </div>

      <div className="rcpt">
        <p className="rcpt-title">{heading}</p>
        <div className="rcpt-chips">
          <span className="rcpt-chip"><CartoonIcon kind="calendar" size={18} />{dateLabel}</span>
          <span className="rcpt-chip">{txs.length} record{txs.length === 1 ? '' : 's'}</span>
        </div>
        <div className="rcpt-rule" />

        {outGroups.length > 0 && (
          <>
            <p className="rcpt-count">Where it went</p>
            {outGroups.map((g) => (
              <div key={g.name} className="rcpt-group">
                <div className="rcpt-line is-head">
                  {renderCategoryIcon(g.icon, g.name, 30)}
                  <span className="rcpt-name">{g.name}</span>
                  <span className="rcpt-dots" />
                  <span className="rcpt-amt">{formatCurrency(g.total)}</span>
                </div>
              </div>
            ))}
          </>
        )}
        {inGroups.length > 0 && (
          <>
            <p className="rcpt-count" style={{ marginTop: 10 }}>Money in</p>
            {inGroups.map((g) => (
              <div key={g.name} className="rcpt-group">
                <div className="rcpt-line is-head">
                  {renderCategoryIcon(g.icon, g.name, 30)}
                  <span className="rcpt-name">{g.name}</span>
                  <span className="rcpt-dots" />
                  <span className="rcpt-amt">+{formatCurrency(g.total)}</span>
                </div>
              </div>
            ))}
          </>
        )}

        <div className="rcpt-rule is-dashed" />
        <p className="rcpt-count">Records</p>
        {txs.map((t) => (
          <button key={t._id} type="button" className="rcpt-rec" onClick={() => onOpenTx(t)}>
            <span className="rcpt-rec-time">{timeOf(t)}</span>
            <span className="rcpt-name">{titleOf(t)}</span>
            <span className="rcpt-dots" />
            <span className="rcpt-amt">
              {t.isAdjustment ? '' : t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}{formatCurrency(t.isAdjustment ? t.amount : own(t))}
            </span>
          </button>
        ))}

        <div className="rcpt-rule is-dashed" />
        {inn > 0 && (
          <div className="rcpt-line is-item" style={{ paddingLeft: 0 }}>
            <span className="rcpt-name">Money in</span><span className="rcpt-dots" /><span className="rcpt-amt">+{formatCurrency(inn)}</span>
          </div>
        )}
        <div className="rcpt-line is-total">
          <span className="rcpt-name">OUT</span>
          <span className="rcpt-count">your share of the day</span>
          <span className="rcpt-dots" />
          <span className="rcpt-amt">{formatCurrency(out)}</span>
        </div>
      </div>
      <svg className="rcpt-tear" width="100%" height="14" aria-hidden>
        <defs>
          <pattern id="rcpt-zz-day" width="20" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 0H20L10 12Z" fill="#fff" />
            <path d="M0 0L10 12L20 0" fill="none" stroke="var(--c-ink)" strokeWidth="3" strokeLinejoin="round" />
          </pattern>
        </defs>
        <rect width="100%" height="14" fill="url(#rcpt-zz-day)" />
      </svg>

      {nets.length > 0 && (
        <div className="rcpt-split">
          <div className="rcpt-split-top">
            <CartoonIcon kind="pizza" size={44} />
            <div className="min-w-0">
              <p className="rcpt-split-title">Who owes whom</p>
              <p className="rcpt-split-sub">Across the split bills of this day.</p>
            </div>
          </div>
          {nets.map(([id, v]) => (
            <div key={id} className="rcpt-owe">
              <div className="flex items-center gap-2 min-w-0">
                {v.amount > 0
                  ? (<><FaceAvatar name={v.name} size={28} /><span className="rcpt-arrow">→</span><FaceAvatar name="You" size={28} /><span className="rcpt-owe-text">{v.name} owes you <b>{formatCurrency(v.amount)}</b></span></>)
                  : (<><FaceAvatar name="You" size={28} /><span className="rcpt-arrow">→</span><FaceAvatar name={v.name} size={28} /><span className="rcpt-owe-text">You owe {v.name} <b style={{ color: 'var(--c-tomato)' }}>{formatCurrency(Math.abs(v.amount))}</b></span></>)}
              </div>
              <button type="button" className="rcpt-pill is-go" onClick={() => navigate('/friends')}>Settle up</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Cartoon theme: a saved transaction as a paper receipt — one payment,
 * grouped by category, each category with its items or a plain amount.
 */
function CartoonReceipt({ tx, categories, onClose, onDelete, onEdit }: {
  tx: Transaction;
  categories: { _id: string; name: string; icon: string }[];
  onClose: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const mainId = tx.categoryId?._id;
  const lookup = (id?: string) => (id === mainId ? tx.categoryId : categories.find((c) => c._id === id));
  const items = tx.items ?? [];
  const charges = tx.charges ?? [];

  // ── People in the split (keys: 'user' or a friend id) ──
  const split = tx.split && tx.split.splits.length > 0 ? tx.split : null;
  const names: Record<string, string> = { [USER_KEY]: 'You' };
  const stored: Record<string, number> = {};
  split?.splits.forEach((sp) => {
    const id = typeof sp.friendId === 'string' ? sp.friendId : sp.friendId._id;
    if (typeof sp.friendId !== 'string') names[id] = sp.friendId.name;
    stored[id] = round2((stored[id] ?? 0) + sp.amount);
  });
  if (tx.paidByFriendId) names[tx.paidByFriendId._id] = tx.paidByFriendId.name;
  const payerKey = split ? (split.paidBy === 'user' ? USER_KEY : split.paidBy) : USER_KEY;
  const keys = split ? [...new Set([USER_KEY, ...Object.keys(stored), payerKey])] : [USER_KEY];
  stored[USER_KEY] = round2(tx.amount - Object.entries(stored).filter(([k]) => k !== USER_KEY).reduce((sum, [, v]) => sum + v, 0));
  const nameOf = (k: string) => names[k] ?? 'Friend';

  // ── Lines grouped by category ──
  type Line = { key: string; name: string; qty?: string; amount: number; shared?: string[]; plain: boolean; group: string };
  const groups: { id?: string; cat?: { name: string; icon: string }; lines: Line[]; fees: { label: string; amount: number }[]; total: number }[] = [];
  const groupFor = (id?: string) => {
    let g = groups.find((x) => x.id === id);
    if (!g) { g = { id, cat: lookup(id), lines: [], fees: [], total: 0 }; groups.push(g); }
    return g;
  };
  if (tx.type === 'transfer') {
    // no category groups
  } else if (items.length === 0) {
    const g = groupFor(mainId);
    g.total = tx.amount;
    g.lines.push({ key: 'cat', name: g.cat?.name ?? '', amount: tx.amount, plain: true, group: String(g.id) });
  } else {
    groupFor(mainId);
    items.forEach((it, n) => {
      const g = groupFor(it.categoryId ?? mainId);
      g.total = round2(g.total + it.amount);
      const plain = !it.itemId && it.name === g.cat?.name;
      g.lines.push({ key: `i${n}`, name: it.name, qty: formatQty(it.quantity, it.unit) || undefined, amount: it.amount, shared: it.sharedWith, plain, group: String(g.id) });
    });
    charges.filter((c) => !c.bill).forEach((c) => {
      const g = groupFor(c.categoryId ?? mainId);
      g.total = round2(g.total + c.amount);
      g.fees.push(c);
    });
  }
  const shown = groups.filter((g) => g.total !== 0 || g.lines.length > 0);
  const billFees = charges.filter((c) => c.bill);
  const allLines = shown.flatMap((g) => g.lines);

  // Per-line shares are worked out the way the form does (equal among those
  // ticked). Hand-set amounts aren't stored per line, so only show them when
  // they reproduce the stored totals.
  const derived = split ? computeLineSplit(
    allLines.map((l) => ({ key: l.key, name: l.name, amount: l.amount, group: l.group })),
    charges.map((c) => ({ group: c.bill ? undefined : String(c.categoryId ?? mainId), amount: c.amount })),
    keys, Object.fromEntries(allLines.map((l) => [l.key, l.shared])), {},
  ) : null;
  const exact = !!derived && keys.every((k) => Math.abs((derived.shares[k] ?? 0) - (stored[k] ?? 0)) < 0.031);

  const chipsFor = (l: Line) => {
    if (!split || !exact || !derived) return null;
    const people = (l.shared ?? keys).filter((k) => keys.includes(k));
    return (
      <div className="rcpt-shares">
        {keys.map((k) => people.includes(k) ? (
          <span key={k} className={`rcpt-share-chip ${k === USER_KEY ? 'is-you' : 'is-friend'}`}>
            <FaceAvatar name={nameOf(k)} size={20} />{nameOf(k)} {formatCurrency(derived.lineShares[l.key]?.[k] ?? 0)}
          </span>
        ) : (
          <span key={k} className="rcpt-share-chip is-out"><FaceAvatar name={nameOf(k)} size={20} />{nameOf(k)}, not in</span>
        ))}
      </div>
    );
  };

  const isShare = tx.personalShare != null && tx.personalShare !== tx.amount;
  const heading = tx.type === 'income' ? 'MONEY IN' : tx.type === 'transfer' ? 'TRANSFER' : 'ONE PAYMENT';
  const who = tx.paidByFriendId ? `Paid by ${tx.paidByFriendId.name}` : tx.receivedFromFriendId ? `From ${tx.receivedFromFriendId.name}` : null;
  const youPaid = !!split && payerKey === USER_KEY;

  // Who pays what
  const donut = keys.filter((k) => (stored[k] ?? 0) > 0);
  const circ = 2 * Math.PI * 28;
  let offset = 0;
  const owes = keys.filter((k) => k !== payerKey && (stored[k] ?? 0) > 0);
  const remind = async (k: string) => {
    const text = `Hi ${nameOf(k)}, you owe me ${formatCurrency(stored[k])} for ${shown.map((g) => g.cat?.name).filter(Boolean).join(' + ')} on ${fmtDateTime(tx.date)}.`;
    try { await navigator.clipboard.writeText(text); toast.success('Reminder copied — paste it in a message'); } catch { toast.error('Could not copy the reminder'); }
  };
  const breakdown = (k: string) => {
    if (!exact || !derived) return null;
    const parts = allLines
      .filter((l) => (derived.lineShares[l.key]?.[k] ?? 0) > 0)
      .map((l) => `${l.name} ${formatCurrency(derived.lineShares[l.key][k]).replace(/\.00$/, '')}`);
    const feeShare = round2(charges.reduce((sum, _c, n) => sum + (derived.chargeShares[n]?.[k] ?? 0), 0));
    if (feeShare) parts.push(`Fees & discounts ${feeShare < 0 ? '−' : '+'}${formatCurrency(Math.abs(feeShare)).replace(/\.00$/, '')}`);
    return parts.length ? parts.join(' · ') : null;
  };

  const roundBtn = (label: string, onClick: () => void, icon: ReactNode) => (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="rcpt-btn">{icon}</button>
  );
  const svg = (children: ReactNode) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
  );

  return (
    <div className="rcpt-wrap">
      <div className="rcpt-bar">
        {roundBtn('Close', onClose, svg(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>))}
        <div className="flex items-center gap-2">
          {roundBtn('Delete', onDelete, svg(<><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6m4-6v6" /><path d="M9 6V4h6v2" /></>))}
          {tx.type !== 'transfer' && roundBtn('Edit', onEdit, svg(<><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></>))}
        </div>
      </div>

      <div className="rcpt">
        <p className="rcpt-title">{heading}</p>
        <div className="rcpt-chips">
          {tx.accountId && (
            <span className="rcpt-chip"><CartoonIcon kind="card" size={18} />{tx.accountId.name}{tx.type === 'transfer' && tx.toAccountId ? ` → ${tx.toAccountId.name}` : ''}</span>
          )}
          <span className="rcpt-chip"><CartoonIcon kind="calendar" size={18} />{fmtDateTime(tx.date)}</span>
          {tx.merchant && <span className="rcpt-chip"><CartoonIcon kind="shopping" size={18} />{tx.merchant}</span>}
          {youPaid && <span className="rcpt-chip is-you"><FaceAvatar name="You" size={20} />You paid</span>}
          {who && <span className="rcpt-chip"><CartoonIcon kind="face2" size={18} />{who}</span>}
        </div>
        <div className="rcpt-rule" />

        {shown.map((g) => {
          const plainLine = g.lines.length === 1 && g.lines[0].plain ? g.lines[0] : null;
          const listed = g.lines.filter((l) => !l.plain);
          return (
            <div key={g.id ?? 'none'} className="rcpt-group">
              <div className="rcpt-line is-head">
                {g.cat ? renderCategoryIcon(g.cat.icon, g.cat.name, 30) : <CartoonIcon kind="coins" size={30} />}
                <span className="rcpt-name">{g.cat?.name ?? 'Uncategorized'}</span>
                <span className="rcpt-dots" />
                <span className="rcpt-amt">{formatCurrency(g.total)}</span>
              </div>
              {plainLine && chipsFor(plainLine)}
              {listed.map((l) => (
                <div key={l.key}>
                  <div className="rcpt-line is-item">
                    <span className="rcpt-name">{l.name}{l.qty && <span className="rcpt-qty"> × {l.qty}</span>}</span>
                    <span className="rcpt-dots" />
                    <span className="rcpt-amt">{formatCurrency(l.amount)}</span>
                  </div>
                  {chipsFor(l)}
                </div>
              ))}
              {g.fees.map((c, i) => (
                <div key={`f${i}`} className="rcpt-line is-item">
                  <span className="rcpt-name">{c.label}</span>
                  <span className="rcpt-dots" />
                  <span className="rcpt-amt">{c.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(c.amount))}</span>
                </div>
              ))}
            </div>
          );
        })}

        {billFees.length > 0 && (
          <div className="rcpt-group">
            <div className="rcpt-line is-head">
              <CartoonIcon kind="receipt" size={30} />
              <span className="rcpt-name">Whole bill</span>
            </div>
            {billFees.map((c, i) => (
              <div key={`b${i}`} className="rcpt-line is-item">
                <span className="rcpt-name">{c.label}</span>
                <span className="rcpt-dots" />
                <span className="rcpt-amt">{c.amount < 0 ? '−' : '+'}{formatCurrency(Math.abs(c.amount))}</span>
              </div>
            ))}
          </div>
        )}
        <div className="rcpt-rule is-dashed" />
        <div className="rcpt-line is-total">
          <span className="rcpt-name">TOTAL</span>
          <span className="rcpt-count">{tx.type === 'transfer' ? 'between accounts' : `${shown.length} categor${shown.length === 1 ? 'y' : 'ies'} · ${allLines.length} ${allLines.length === 1 ? 'line' : 'lines'}`}</span>
          <span className="rcpt-dots" />
          <span className="rcpt-amt">{formatCurrency(tx.amount)}</span>
        </div>
        {isShare && <p className="rcpt-share">✂ your share {formatCurrency(tx.personalShare!)}</p>}
      </div>
      <svg className="rcpt-tear" width="100%" height="14" aria-hidden>
        <defs>
          <pattern id="rcpt-zz" width="20" height="14" patternUnits="userSpaceOnUse">
            <path d="M0 0H20L10 12Z" fill="#fff" />
            <path d="M0 0L10 12L20 0" fill="none" stroke="var(--c-ink)" strokeWidth="3" strokeLinejoin="round" />
          </pattern>
        </defs>
        <rect width="100%" height="14" fill="url(#rcpt-zz)" />
      </svg>

      {split && (
        <div className="rcpt-split">
          <div className="rcpt-split-top">
            <svg viewBox="0 0 72 72" width="72" height="72" className="shrink-0">
              <circle cx="36" cy="36" r="28" fill="none" stroke="#fff" strokeWidth="14" />
              {donut.map((k) => {
                const len = ((stored[k] ?? 0) / tx.amount) * circ;
                const el = (
                  <circle key={k} cx="36" cy="36" r="28" fill="none" stroke={SPLIT_COLORS[keys.indexOf(k) % SPLIT_COLORS.length]} strokeWidth="14"
                    strokeDasharray={`${len} ${circ - len}`} strokeDashoffset={-offset} transform="rotate(-90 36 36)" />
                );
                offset += len;
                return el;
              })}
              <circle cx="36" cy="36" r="29" fill="none" stroke="var(--c-ink)" strokeWidth="3" />
              <circle cx="36" cy="36" r="15" fill="#fff" stroke="var(--c-ink)" strokeWidth="3" />
            </svg>
            <div className="min-w-0">
              <p className="rcpt-split-title">Who pays what</p>
              <p className="rcpt-split-sub">
                {youPaid ? `You paid ${formatCurrency(tx.amount)} for ${keys.length === 2 ? 'both of you' : 'everyone'}.` : `${nameOf(payerKey)} paid ${formatCurrency(tx.amount)}.`}
              </p>
            </div>
          </div>
          {keys.map((k) => (
            <div key={k} className="rcpt-who">
              <FaceAvatar name={nameOf(k)} size={34} />
              <div className="min-w-0 flex-1">
                <p className="rcpt-who-name">{nameOf(k)}</p>
                {breakdown(k) && <p className="rcpt-who-sub">{breakdown(k)}</p>}
              </div>
              <b className="rcpt-who-amt">{formatCurrency(stored[k] ?? 0)}</b>
            </div>
          ))}
          {youPaid ? owes.map((k) => (
            <div key={k} className="rcpt-owe">
              <div className="flex items-center gap-2 min-w-0">
                <FaceAvatar name={nameOf(k)} size={28} /><span className="rcpt-arrow">→</span><FaceAvatar name="You" size={28} />
                <span className="rcpt-owe-text">{nameOf(k)} owes you <b>{formatCurrency(stored[k])}</b></span>
              </div>
              <div className="flex gap-2">
                <button type="button" className="rcpt-pill" onClick={() => remind(k)}>Remind</button>
                <button type="button" className="rcpt-pill is-go" onClick={() => navigate('/friends')}>Settle up</button>
              </div>
            </div>
          )) : (
            <div className="rcpt-owe">
              <div className="flex items-center gap-2 min-w-0">
                <FaceAvatar name="You" size={28} /><span className="rcpt-arrow">→</span><FaceAvatar name={nameOf(payerKey)} size={28} />
                <span className="rcpt-owe-text">You owe {nameOf(payerKey)} <b>{formatCurrency(stored[USER_KEY] ?? 0)}</b></span>
              </div>
              <button type="button" className="rcpt-pill is-go" onClick={() => navigate('/friends')}>Settle up</button>
            </div>
          )}
        </div>
      )}
      {tx.note && <p className="rcpt-note">{tx.note}</p>}
    </div>
  );
}

// ── Desktop amount field (typed, with maths) ──────────────────────────
/** Evaluates "40+33*2", "(120-20)/4" etc. Returns null while incomplete. */
function evalExpression(src: string): number | null {
  const s = src.replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[,\s]/g, '');
  if (!s || !/^[0-9.+\-*/()]+$/.test(s)) return null;
  let i = 0;
  const expr = (): number => {
    let v = term();
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
    return v;
  };
  const term = (): number => {
    let v = factor();
    while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const r = factor(); v = op === '*' ? v * r : v / r; }
    return v;
  };
  const factor = (): number => {
    if (s[i] === '-') { i++; return -factor(); }
    if (s[i] === '(') { i++; const v = expr(); if (s[i++] !== ')') throw new Error('paren'); return v; }
    const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
    if (!m) throw new Error('number');
    i += m[0].length;
    return parseFloat(m[0]);
  };
  try {
    const v = expr();
    return i === s.length && Number.isFinite(v) ? round2(v) : null;
  } catch {
    return null;
  }
}

/**
 * The amount on desktop: a plain input instead of the numpad. Accepts maths
 * ("40+33") and shows the result; Enter or leaving the field settles it.
 */
function AmountField({ value, onChange, locked }: {
  value: string;
  onChange: (v: string) => void;
  /** Itemised bill — the total comes from the items. */
  locked?: boolean;
}) {
  const shown = (v: string) => (v === '0' ? '' : v);
  const [text, setText] = useState(() => shown(value));
  const [lastValue, setLastValue] = useState(value);
  // Follow outside changes (reset after save, edit prefill) without
  // clobbering an expression that already evaluates to the same number.
  if (value !== lastValue) {
    setLastValue(value);
    if (evalExpression(text) !== (parseFloat(value) || 0)) setText(shown(value));
  }
  const result = evalExpression(text);
  const isExpression = /[+\-*/×x÷(]/.test(text.replace(/^-/, ''));
  const settle = () => setText(result != null ? shown(String(result)) : shown(value));

  return (
    <div className="flex items-center gap-3 rounded-xl px-4 h-16" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <span className="text-2xl" style={{ color: 'var(--c-muted)' }}>₹</span>
      {locked ? (
        <span className="flex-1 text-3xl font-bold tabular-nums" style={{ color: 'var(--c-text)' }}>{value}</span>
      ) : (
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.+\-*/×x÷() ,]/g, '');
            setText(v);
            const r = evalExpression(v);
            if (r != null) onChange(String(r));
            else if (v.trim() === '') onChange('0');
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); settle(); } }}
          onBlur={settle}
          inputMode="decimal"
          placeholder="0"
          aria-label="Amount"
          className="flex-1 min-w-0 bg-transparent text-3xl font-bold tabular-nums outline-none"
          style={{ color: 'var(--c-text)' }}
        />
      )}
      {locked ? (
        <span className="text-[11px]" style={{ color: 'var(--c-muted)' }}>Total of items</span>
      ) : isExpression && (
        <span className="text-sm tabular-nums" style={{ color: result != null ? 'var(--c-muted)' : 'var(--c-expense)' }}>
          {result != null ? `= ${result}` : '…'}
        </span>
      )}
    </div>
  );
}

/** True on desktop-width screens (side-panel layout). */
function useIsDesktop() {
  const query = '(min-width: 1200px)';
  const [matches, setMatches] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return matches;
}

// ── Transaction modal ─────────────────────────────────────────────────
function Numpad({ value, onChange, collapsed, locked }: {
  value: string; onChange: (v: string) => void; collapsed?: boolean;
  /** Total is derived elsewhere (itemised bill) — show it, but don't edit it. */
  locked?: boolean;
}) {
  const [op, setOp] = useState<string | null>(null);
  const [prev, setPrev] = useState(0);
  const [waitingNext, setWaitingNext] = useState(false);

  function handleDigit(d: string) {
    if (waitingNext) { setWaitingNext(false); onChange(d === '.' ? '0.' : d); return; }
    if (d === '.' && value.includes('.')) return;
    if (value === '0' && d !== '.') { onChange(d); return; }
    onChange(value + d);
  }

  function handleOp(newOp: string) {
    const cur = parseFloat(value) || 0;
    if (op && !waitingNext) {
      const result = compute(prev, cur, op);
      const str = String(Math.round(result * 100) / 100);
      onChange(str);
      setPrev(result);
    } else {
      setPrev(cur);
    }
    setOp(newOp);
    setWaitingNext(true);
  }

  function handleEqual() {
    if (!op) return;
    const cur = parseFloat(value) || 0;
    const result = compute(prev, cur, op);
    const str = String(Math.round(result * 100) / 100);
    onChange(str);
    setOp(null);
    setPrev(0);
    setWaitingNext(false);
  }

  function handleDel() {
    onChange(value.length > 1 ? value.slice(0, -1) : '0');
  }

  function compute(a: number, b: number, operator: string) {
    if (operator === '+') return a + b;
    if (operator === '-') return a - b;
    if (operator === '×') return a * b;
    if (operator === '÷') return b !== 0 ? a / b : a;
    return b;
  }

  // Physical keyboard support (desktop). Handlers close over fresh state, so keep
  // the latest ones in a ref and register the window listener once.
  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyHandlerRef.current = (e) => {
      if (locked || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      // Let real text fields (notes, date, search, split amounts) keep their keystrokes.
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return;

      const k = e.key;
      if (/^[0-9.]$/.test(k)) handleDigit(k);
      else if (k === '+' || k === '-') handleOp(k);
      else if (k === '*' || k === 'x' || k === 'X') handleOp('×');
      else if (k === '/') handleOp('÷');
      else if (k === '=' || (k === 'Enter' && t?.tagName !== 'BUTTON')) handleEqual();
      else if (k === 'Backspace') handleDel();
      else return;
      e.preventDefault();
    };
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const opBtn = (label: string) => (
    <button
      key={label}
      onClick={() => handleOp(label)}
      className="rounded-lg flex items-center justify-center text-base font-semibold h-12"
      style={{
        background: op === label ? 'var(--c-accent)' : 'var(--c-surface)',
        color: op === label ? 'var(--c-accent-fg)' : 'var(--c-muted)',
        border: '1px solid var(--c-border)',
      }}
    >
      {label}
    </button>
  );

  const digitBtn = (label: string, action?: () => void) => (
    <button
      key={label}
      onClick={action || (() => handleDigit(label))}
      className="rounded-lg flex items-center justify-center text-base font-medium h-12"
      style={{ background: 'var(--c-surface2)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Display */}
      <div
        tabIndex={0}
        onClick={(e) => e.currentTarget.focus()}
        className="flex items-center justify-between px-4 py-3 rounded-xl mb-2 cursor-text outline-none focus:ring-2 focus:ring-[var(--c-accent)]"
        style={{ background: 'var(--c-surface)' }}
      >
        <div className="flex items-baseline gap-1">
          {op && <span className="text-sm" style={{ color: 'var(--c-accent)' }}>{op}</span>}
          <span className="text-3xl font-bold" style={{ color: 'var(--c-text)' }}>{value}</span>
        </div>
        {locked ? (
          <span className="text-[11px]" style={{ color: 'var(--c-muted)' }}>Total of items</span>
        ) : (
        <button onClick={handleDel} style={{ color: 'var(--c-muted)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
            <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
          </svg>
        </button>
        )}
      </div>

      {/* Grid: operators left, digits right — hidden while the system keyboard is open */}
      {!collapsed && !locked && (
        <div className="grid grid-cols-4 gap-1.5">
          {opBtn('+')}  {digitBtn('7')} {digitBtn('8')} {digitBtn('9')}
          {opBtn('-')}  {digitBtn('4')} {digitBtn('5')} {digitBtn('6')}
          {opBtn('×')}  {digitBtn('1')} {digitBtn('2')} {digitBtn('3')}
          {opBtn('÷')}  {digitBtn('0')} {digitBtn('.')}
          <button
            onClick={handleEqual}
            className="rounded-lg flex items-center justify-center text-base font-bold h-12"
            style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}
          >
            =
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * "Items" block of the transaction form: pick several sub-category items,
 * price each one, add fees/discounts, and (when the bill is split) tick who
 * shares each item. The bill total is derived from these rows.
 */
// Item | Qty | Price | × — shared by item rows and fee/discount rows.
const NESTED_ITEM_GRID = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 5rem 1.25rem', gap: '0.25rem', alignItems: 'center' } as const;
const ITEM_GRID = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 6.5rem 5.5rem 1.25rem', gap: '0.25rem', alignItems: 'center' } as const;

/**
 * Quantity combobox: type a number, or open the dropdown to pick a quick
 * value of any of the item's units (100 g … 1 kg). ↑/↓ move, Enter/Tab pick.
 */
function QtyCell({ units, presetsOf, unitId, quantity, legacyUnit, onChange, label }: {
  units: Unit[];
  presetsOf: (unit: Unit) => number[];
  unitId?: string;
  quantity?: number;
  /** Free-text unit recorded before unit groups existed. */
  legacyUnit?: string;
  onChange: (value: { unit?: Unit; quantity?: number }) => void;
  label: string;
}) {
  const unit = units.find((u) => u._id === unitId) ?? units[0];
  const [open, setOpen] = useState(false);
  // -1 = nothing highlighted, so Tab keeps a typed value and just moves on.
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Local text so "0." / "" can be typed; the parent only sees numbers.
  const [text, setText] = useState(quantity ? String(quantity) : '');
  const [lastQuantity, setLastQuantity] = useState(quantity);
  if (quantity !== lastQuantity) {
    setLastQuantity(quantity);
    if ((parseFloat(text) || undefined) !== quantity) setText(quantity ? String(quantity) : '');
  }

  const options = units.flatMap((u) => presetsOf(u).map((value) => ({ unit: u, value })));
  const isCurrent = (o: { unit: Unit; value: number }) => o.unit._id === unit?._id && o.value === quantity;
  const unitName = unit?.name ?? legacyUnit;

  useEffect(() => { if (open) panelRef.current?.scrollIntoView({ block: 'nearest' }); }, [open]);

  const pick = (o: { unit: Unit; value: number }) => {
    onChange({ unit: o.unit, quantity: o.value });
    setOpen(false);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && options.length) {
      e.preventDefault();
      setOpen(true);
      const n = options.length;
      setActive((i) => (i < 0 ? (e.key === 'ArrowDown' ? 0 : n - 1) : (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n));
    } else if ((e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) && open && active >= 0) {
      e.preventDefault();
      pick(options[active]);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault(); e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <div className="item-cell flex items-center cursor-text" style={{ padding: 0, background: open ? 'var(--c-surface2)' : undefined }}
        onClick={() => inputRef.current?.focus()}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9.]/g, '');
            setText(v);
            setActive(-1);
            onChange({ unit, quantity: parseFloat(v) || undefined });
          }}
          onFocus={() => { setActive(-1); setOpen(true); }}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          inputMode="decimal"
          placeholder="Qty"
          aria-label={`${label} quantity`}
          className="min-w-0 bg-transparent pl-2 text-sm tabular-nums outline-none"
          // Sized to the number so the unit sits right after it ("500 g").
          style={{ color: 'var(--c-text)', width: `${Math.max(text.length, 3) + 1}ch` }}
        />
        {unitName && <span className="flex-shrink-0 text-sm" style={{ color: 'var(--c-muted)' }}>{unitName}</span>}
        <span className="flex-1" />
        {options.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`${label} quick quantities`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { if (open) setOpen(false); else inputRef.current?.focus(); }}
            className="flex-shrink-0 h-full px-1.5"
            style={{ color: 'var(--c-muted)' }}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5"
              style={{ transform: open ? 'rotate(180deg)' : undefined }}>
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        )}
      </div>

      {open && (options.length > 0 || units.length > 1) && (
        <div ref={panelRef} className="absolute right-0 z-40 mt-1 w-40 rounded-xl p-1 shadow-lg"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          onMouseDown={(e) => e.preventDefault()}>
          <div className="max-h-48 overflow-y-auto">
            {options.map((o, i) => (
              <button
                key={`${o.unit._id}-${o.value}`}
                type="button"
                tabIndex={-1}
                onMouseMove={() => setActive(i)}
                onClick={() => pick(o)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm"
                style={{ background: i === active ? 'var(--c-surface2)' : 'transparent', color: 'var(--c-text)', fontWeight: isCurrent(o) ? 600 : 400 }}
              >
                <span className="tabular-nums">{o.value} {o.unit.name}</span>
                {isCurrent(o) && <span style={{ color: 'var(--c-accent)' }}>✓</span>}
              </button>
            ))}
          </div>
          {units.length > 1 && (
            <div className="flex items-center gap-1 px-2 pt-1.5 pb-1 mt-1" style={{ borderTop: '1px solid var(--c-border)' }}>
              <span className="text-[10px] uppercase tracking-wider mr-auto" style={{ color: 'var(--c-muted)' }}>Unit</span>
              {units.map((u) => (
                <button
                  key={u._id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onChange({ unit: u, quantity })}
                  className="text-xs font-semibold rounded-full px-2.5 py-0.5"
                  style={u._id === unit?._id
                    ? { background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }
                    : { background: 'var(--c-surface2)', color: 'var(--c-text)' }}
                >
                  {u.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The "add item" row: type to search this category's items. ↑/↓ move,
 * Tab/Enter take the highlighted one (or offer to create a new item).
 */
function ItemSearchInput({ items, unitGroups, onPick, onCreate }: {
  /** This category's items not already on the bill. */
  items: CategoryItem[];
  unitGroups: UnitGroup[];
  onPick: (item: CategoryItem) => void;
  onCreate: (name: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const term = normalizeName(query);
  // Without a search, only items ticked "show in picker"; searching finds all.
  const matches = term ? items.filter((i) => normalizeName(i.name).includes(term)) : items.filter(isShownInPicker);
  const canCreate = !!query.trim() && !items.some((i) => normalizeName(i.name) === term);
  const count = matches.length + (canCreate ? 1 : 0);
  const current = Math.min(active, count - 1);

  useEffect(() => { if (open && count) panelRef.current?.scrollIntoView({ block: 'nearest' }); }, [open, count]);

  const choose = (index: number) => {
    if (index < matches.length) onPick(matches[index]);
    else onCreate(query.trim());
    setQuery(''); setActive(0); setOpen(false);
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (count) setActive((Math.max(current, 0) + (e.key === 'ArrowDown' ? 1 : count - 1)) % count);
    } else if ((e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey && query.trim())) && open && count > 0) {
      e.preventDefault();
      choose(current);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault(); e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div className="relative" style={{ gridColumn: '1 / -1' }}>
      <input
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="+ Add item"
        aria-label="Add item"
        className="item-cell"
      />
      {open && count > 0 && (
        <div ref={panelRef} className="tx-item-suggest absolute left-0 right-0 z-40 mt-1 max-h-56 overflow-y-auto rounded-xl p-1 shadow-lg"
          style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          {matches.map((item, i) => (
            <button
              key={item._id}
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => setActive(i)}
              onClick={() => choose(i)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm"
              style={{ background: i === current ? 'var(--c-surface2)' : 'transparent', color: 'var(--c-text)' }}
            >
              <span className="truncate">{item.name}</span>
              {defaultLabel(item, unitGroups) && (
                <span className="flex-shrink-0 text-xs" style={{ color: 'var(--c-muted)' }}>{defaultLabel(item, unitGroups)}</span>
              )}
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => e.preventDefault()}
              onMouseMove={() => setActive(matches.length)}
              onClick={() => choose(matches.length)}
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold"
              style={{ background: current === matches.length ? 'var(--c-surface2)' : 'transparent', color: 'var(--c-accent)' }}
            >
              + Create "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ItemsSection({
  categoryId, noCharges, wide, hideLabel, rows, onRowsChange, charges, onChargesChange, splitKeys, friends, initials, onFocusChange,
  date, currentTransactionId,
}: {
  categoryId: string;
  /** Hide fee/discount buttons (bills spanning categories have none). */
  noCharges?: boolean;
  /** Full-width container: keep the one-line item rows even with `noCharges`. */
  wide?: boolean;
  /** Skip the "Items" caption (the caller already labels the list). */
  hideLabel?: boolean;
  /** The transaction's date — "previous purchase" means before this. */
  date: string;
  /** When editing, so the transaction doesn't count as its own previous purchase. */
  currentTransactionId?: string;
  rows: ItemRow[];
  onRowsChange: (rows: ItemRow[]) => void;
  charges: ChargeRow[];
  onChargesChange: (charges: ChargeRow[]) => void;
  /** Participant keys when the bill is being split, else null. */
  splitKeys: string[] | null;
  friends: Friend[];
  initials: Record<string, string>;
  onFocusChange: (focused: boolean) => void;
}) {
  const { items: allItems, loaded, fetchItems, createItem } = useCategoryItemStore();
  // Name typed into "+ Create …" — opens the new-item form.
  const [creatingName, setCreatingName] = useState<string | null>(null);
  // Row whose price box should take focus once it mounts (just added).
  const [focusPriceKey, setFocusPriceKey] = useState<string | null>(null);
  const { groups: unitGroups, loaded: unitsLoaded, fetchGroups } = useUnitGroupStore();
  useEffect(() => { if (!loaded) fetchItems(); }, [loaded, fetchItems]);
  useEffect(() => { if (!unitsLoaded) fetchGroups(); }, [unitsLoaded, fetchGroups]);

  // Purchase history of the items on this bill, fetched once per item while
  // the form is open — powers the "previous one lasted N days" hint.
  const [histories, setHistories] = useState<Record<string, ItemPurchase[]>>({});
  const rowItemIds = rows.map((r) => r.itemId).filter((id): id is string => !!id).join(',');
  useEffect(() => {
    rowItemIds.split(',').filter((id) => id && !(id in histories)).forEach((id) => {
      setHistories((h) => ({ ...h, [id]: [] })); // mark as requested
      fetchItemHistory(id).then((list) => setHistories((h) => ({ ...h, [id]: list }))).catch(() => {});
    });
  }, [rowItemIds, histories]);

  /** Latest purchase of the row's item before this transaction's date. */
  const previousPurchase = (row: ItemRow) => {
    if (!row.itemId) return undefined;
    return histories[row.itemId]?.find((p) =>
      p.transactionId !== currentTransactionId && daysBetween(p.date, date) >= 0);
  };

  const catalogItem = (row: ItemRow) => allItems.find((i) => i._id === row.itemId);
  /** Quantity fields for a row: unit name + base-unit quantity follow the unit. */
  const measure = (unit: Unit | undefined, quantity: number | undefined) => ({
    unitId: unit?._id,
    unit: unit?.name,
    quantity,
    baseQuantity: unit && quantity ? round2(quantity * unit.factor) : undefined,
  });

  const categoryItems = allItems.filter((i) => i.categoryId === categoryId);

  const addItem = (item: CategoryItem) => {
    // The same item can go on a bill more than once (one for you, one for a friend) — each is its own line.
    const units = unitsFor(item, unitGroups);
    const unit = units.find((u) => u._id === item.defaultUnitId) ?? units[0];
    const key = rowKey();
    onRowsChange([...rows, {
      key, itemId: item._id, name: item.name, amount: 0,
      ...(unit ? measure(unit, item.defaultQuantity) : { quantity: item.defaultQuantity, unit: item.unit }),
    }]);
    setFocusPriceKey(key);
  };
  const updateRow = (key: string, patch: Partial<ItemRow>) =>
    onRowsChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateCharge = (key: string, patch: Partial<ChargeRow>) =>
    onChargesChange(charges.map((c) => (c.key === key ? { ...c, ...patch } : c)));

  const toggleSharer = (row: ItemRow, key: string) => {
    if (!splitKeys) return;
    const current = (row.sharedWith ?? splitKeys).filter((k) => splitKeys.includes(k));
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    // Back to "everyone" when all are ticked, so people added to the split
    // later are included automatically.
    const everyone = splitKeys.every((k) => next.includes(k));
    updateRow(row.key, { sharedWith: everyone ? undefined : splitKeys.filter((k) => next.includes(k)) });
  };

  const itemsTotal = round2(rows.reduce((s, r) => s + r.amount, 0));
  const total = round2(itemsTotal + charges.reduce((s, c) => s + signedCharge(c), 0));
  const missingPrice = rows.some((r) => !(r.amount > 0));
  const label = 'block text-[10px] uppercase tracking-wider';
  const isCartoon = useThemeStore((st) => st.theme === 'cartoon');
  const priceClass = 'item-cell text-right tabular-nums';
  // Inside a multi-category bill the list is narrow: the name gets its own line.
  const narrow = !!noCharges && !wide;
  const grid = narrow ? NESTED_ITEM_GRID : ITEM_GRID;
  const removeBtn = 'text-base leading-none justify-self-center w-5 h-5 rounded-full hover:bg-[var(--c-surface2)]';

  return (
    <div onFocus={() => onFocusChange(true)} onBlur={() => onFocusChange(false)}>
      <div className={`flex items-center justify-between ${(hideLabel || narrow) && rows.length === 0 ? 'hidden' : 'mb-1'}`}>
        {hideLabel || narrow ? <span /> : <span className={label} style={{ color: 'var(--c-muted)' }}>Items</span>}
        {rows.length > 0 && (
          <span className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
            {rows.length} item{rows.length > 1 ? 's' : ''} · total ₹{total}
          </span>
        )}
      </div>

      {/* One card, one line per item — a bill, not a stack of boxes. */}
      <div className="tx-items rounded-xl divide-y divide-[var(--c-border)]" style={{ border: '1px solid var(--c-border)' }}>
        {rows.length > 0 && !narrow && (
          <div style={{ ...grid, background: 'var(--c-surface2)' }} className="tx-items-head rounded-t-xl px-1.5 py-1.5 text-[10px] uppercase tracking-wider" aria-hidden>
            <span className="pl-2" style={{ color: 'var(--c-muted)' }}>Item</span>
            <span className="pl-2" style={{ color: 'var(--c-muted)' }}>Qty</span>
            <span className="text-right pr-2" style={{ color: 'var(--c-muted)' }}>Price ₹</span>
            <span />
          </div>
        )}

        {rows.map((row) => {
          const item = catalogItem(row);
          const units = item ? unitsFor(item, unitGroups) : [];
          const sharers = splitKeys ? (row.sharedWith ?? splitKeys).filter((k) => splitKeys.includes(k)) : [];
          const prev = previousPurchase(row);
          const days = prev ? daysBetween(prev.date, date) : 0;
          return (
            <div key={row.key} style={grid} className="tx-item-row px-1.5 py-1">
              <div className="flex items-center gap-2 h-9 px-2 min-w-0" title={row.name} style={narrow ? { gridColumn: '1 / -1' } : undefined}>
                {isCartoon && <CartoonIcon kind={itemKind(row.name) ?? 'items'} size={28} />}
                <span className="truncate text-sm font-medium" style={{ color: 'var(--c-text)' }}>{row.name}</span>
              </div>
              <QtyCell
                units={units}
                presetsOf={(u) => (item ? presetsFor(item, u) : u.presets)}
                unitId={row.unitId}
                quantity={row.quantity}
                legacyUnit={row.unit}
                onChange={({ unit, quantity }) => updateRow(row.key, unit ? measure(unit, quantity) : { quantity })}
                label={row.name}
              />
              <CalcAmountInput
                value={row.amount}
                onChange={(v) => updateRow(row.key, { amount: v })}
                className={priceClass}
                autoFocus={row.key === focusPriceKey}
              />
              <button type="button" aria-label={`Remove ${row.name}`} onClick={() => onRowsChange(rows.filter((r) => r.key !== row.key))}
                className={removeBtn} style={{ color: 'var(--c-muted)' }}>×</button>

              {prev && (
                <div className="flex items-center gap-2 flex-wrap -mt-1.5 pb-1 px-2" style={{ gridColumn: '1 / -1' }}>
                  {!(row.amount > 0) && prev.amount > 0 && (
                    <button type="button" className="use-last-price" onClick={() => updateRow(row.key, { amount: prev.amount })}
                      title={`Same as ${shortDate(prev.date)}`}>
                      Use last price ₹{prev.amount}
                    </button>
                  )}
                  <span className="text-[10px] truncate" style={{ color: 'var(--c-muted)' }}
                    title={`Previous purchase: ${shortDate(prev.date)}, ₹${prev.amount}`}>
                    Last bought {shortDate(prev.date)} · ₹{prev.amount}
                    {days > 0 ? ` · lasted ${days} day${days > 1 ? 's' : ''}` : ' · same day'}
                  </span>
                </div>
              )}
              {splitKeys && (
                <div className="flex items-center justify-end gap-1 flex-wrap px-2 pb-1" style={{ gridColumn: '1 / -1' }}>
                  {sharers.length === 0 && (
                    <span className="text-[11px] mr-auto" style={{ color: 'var(--c-expense)' }}>Tick who shares {row.name}</span>
                  )}
                  <span className="text-[10px] mr-1" style={{ color: 'var(--c-muted)' }}>Shared by</span>
                  {splitKeys.map((k) => {
                    const on = sharers.includes(k);
                    const isUser = k === USER_KEY;
                    const name = isUser ? 'You' : (friends.find((f) => f._id === k)?.name ?? '');
                    return (
                      <button key={k} type="button" onClick={() => toggleSharer(row, k)}
                        title={`${name} ${on ? 'shares' : "doesn't share"} ${row.name}`}
                        className="rounded-full transition-all"
                        style={{ opacity: on ? 1 : 0.3, boxShadow: on ? '0 0 0 2px var(--c-accent)' : 'none' }}>
                        <AvatarCircle isUser={isUser} name={name} label={isUser ? undefined : initials[k]} color={isUser ? undefined : avatarColor(name)} size={22} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {charges.map((c) => (
          <div key={c.key} style={grid} className="px-1.5 py-1">
            <ChargeLabelSelect value={c.label} kind={c.kind} onChange={(label) => updateCharge(c.key, { label })} />
            <button type="button" onClick={() => updateCharge(c.key, { kind: c.kind === 'fee' ? 'discount' : 'fee' })}
              title="Switch between fee and discount"
              className="justify-self-start ml-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase"
              style={{ background: 'var(--c-surface2)', color: c.kind === 'fee' ? 'var(--c-expense)' : 'var(--c-income)' }}>
              {c.kind === 'fee' ? '+ Fee' : '− Discount'}
            </button>
            <CalcAmountInput value={c.value} onChange={(v) => updateCharge(c.key, { value: v })} className={priceClass} />
            <button type="button" aria-label="Remove" onClick={() => onChargesChange(charges.filter((x) => x.key !== c.key))}
              className={removeBtn} style={{ color: 'var(--c-muted)' }}>×</button>
          </div>
        ))}

        {creatingName === null && (
          <div style={grid} className="px-1.5 py-1">
            <ItemSearchInput
              items={categoryItems}
              unitGroups={unitGroups}
              onPick={addItem}
              onCreate={setCreatingName}
            />
          </div>
        )}
      </div>

      {creatingName !== null && (
        <div className="rounded-lg p-2 mt-1.5" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <ItemFields
            categoryItems={categoryItems}
            initial={{ name: creatingName }}
            submitLabel="Add item"
            onSubmit={async (data) => {
              addItem(await createItem(categoryId, data));
              setCreatingName(null);
            }}
            onCancel={() => setCreatingName(null)}
            onDuplicate={(existing) => { addItem(existing); setCreatingName(null); }}
          />
        </div>
      )}

      {rows.length > 0 && (
        <div className="flex items-center gap-3 mt-1.5">
          {!noCharges && (
            <>
              <button type="button" onClick={() => onChargesChange([...charges, { key: rowKey(), label: '', kind: 'fee', value: 0 }])}
                className="tx-sticker text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>{isCartoon && <CartoonIcon kind="receipt" size={18} />}+ Fee / tax</button>
              <button type="button" onClick={() => onChargesChange([...charges, { key: rowKey(), label: '', kind: 'discount', value: 0 }])}
                className="tx-sticker text-xs font-semibold" style={{ color: 'var(--c-muted)' }}>{isCartoon && <CartoonIcon kind="tag" size={18} />}+ Discount</button>
            </>
          )}
          {missingPrice && (
            <span className="ml-auto text-[11px]" style={{ color: 'var(--c-expense)' }}>Enter a price for every item</span>
          )}
        </div>
      )}
      {splitKeys && charges.length > 0 && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--c-muted)' }}>Fees and discounts are shared in proportion to each person's items.</p>
      )}
    </div>
  );
}

function TransactionModal({
  open, onClose, onSubmit, categories, accounts, friends, transaction, initialType, panel,
}: {
  open: boolean;
  /** Render inline as the desktop side panel instead of a popup. */
  panel?: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  categories: { _id: string; name: string; type: string; icon: string }[];
  accounts: { _id: string; name: string; type: Account['type']; color?: string }[];
  friends: Friend[];
  transaction?: Transaction;
  initialType?: 'income' | 'expense';
}) {
  const isEdit = !!transaction;
  const [amountStr, setAmountStr] = useState('0');

  // Any field that opens the system keyboard (Notes, category search, a
  // split-amount input) collapses the Numpad grid so the field being typed
  // into isn't squeezed off-screen between the keyboard and the grid.
  const [notesFocused, setNotesFocused] = useState(false);
  const [categorySearchFocused, setCategorySearchFocused] = useState(false);
  const [splitFieldFocused, setSplitFieldFocused] = useState(false);
  const [itemFieldFocused, setItemFieldFocused] = useState(false);
  // Only touch devices pop up an on-screen keyboard; on desktop the Numpad
  // stays visible while typing elsewhere.
  const [isTouch] = useState(() => window.matchMedia?.('(pointer: coarse), (max-width: 767px)').matches ?? false);
  const keyboardOpen = isTouch && (notesFocused || categorySearchFocused || splitFieldFocused || itemFieldFocused);

  // Itemised bill (sub-category items + fees/discounts). When there are item
  // rows, the total comes from them instead of the numpad.
  const [itemRows, setItemRows] = useState<ItemRow[]>([]);
  const [chargeRows, setChargeRows] = useState<ChargeRow[]>([]);
  // A bill spanning categories: the form's own category plus these extra ones,
  // each with its own amount, or its own item list. Empty = the
  // usual single category. The first category's amount lives in primaryAmt.
  const [extraLines, setExtraLines] = useState<{ key: string; categoryId: string; amount: number; rows: ItemRow[]; charges: ChargeRow[] }[]>([]);
  // Category lines whose item list is open (the first category is 'primary').
  const [openItems, setOpenItems] = useState<string[]>([]);
  const [primaryAmt, setPrimaryAmt] = useState(0);
  // Whole-bill fees/discounts (delivery, tax, coupon) — spread across categories.
  const [billCharges, setBillCharges] = useState<ChargeRow[]>([]);
  // What was actually paid when the shop rounds the bill (987.73 → 988); 0 = no rounding.
  const [paidTotal, setPaidTotal] = useState(0);
  // Where it was bought (Swiggy, Amazon, a hotel…), with suggestions from earlier bills.
  const [merchant, setMerchant] = useState('');
  const [merchantFocus, setMerchantFocus] = useState(false);
  // Suggestions come from the database, ranked by what's being entered (see below).
  const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([]);
  const merchantMatches = merchantSuggestions.filter((m) => m.toLowerCase() !== merchant.trim().toLowerCase()).slice(0, 6);
  const multi = extraLines.length > 0 || billCharges.length > 0 || paidTotal > 0;

  const { register, handleSubmit, reset, watch, setValue, getValues, control, formState: { errors, isSubmitting } } =
    useForm<TransactionFormData>({
      resolver: zodResolver(transactionSchema),
      defaultValues: transaction
        ? {
            type: transaction.type as 'income' | 'expense',
            amount: transaction.amount,
            categoryId: transaction.categoryId?._id || '',
            accountId: transaction.accountId?._id || '',
            date: transaction.date.slice(0, 10),
            note: transaction.note || '',
          }
        : {
            type: initialType ?? 'expense',
            amount: undefined as unknown as number,
            categoryId: '',
            accountId: '',
            date: todayLocal(),
            note: '',
          },
    });

  const selectedType = watch('type');
  const selectedCategoryId = watch('categoryId');
  const selectedAccountId = watch('accountId');
  const totalAmount = watch('amount');
  const filteredCategories = categories.filter(c => c.type === selectedType);
  const itemized = itemRows.length > 0;
  const itemsTotal = round2(
    itemRows.reduce((s, r) => s + r.amount, 0) + chargeRows.reduce((s, c) => s + signedCharge(c), 0)
  );
  const itemsValid = !itemized || (itemRows.every((r) => r.amount > 0) && itemsTotal > 0);
  // Per-category amount: a category with items is the sum of its items.
  const chargesSum = (cs: ChargeRow[] = []) => cs.reduce((sum, c) => sum + signedCharge(c), 0);
  const primaryTotal = itemized ? round2(itemRows.reduce((s, r) => s + r.amount, 0) + chargesSum(chargeRows)) : primaryAmt;
  const lineTotal = (l: { amount: number; rows: ItemRow[]; charges: ChargeRow[] }) => (l.rows.length ? round2(l.rows.reduce((s, r) => s + r.amount, 0) + chargesSum(l.charges)) : l.amount);
  const preRoundTotal = round2(primaryTotal + extraLines.reduce((s, l) => s + lineTotal(l), 0) + chargesSum(billCharges));
  const roundOff = paidTotal > 0 ? round2(paidTotal - preRoundTotal) : 0;
  const multiTotal = round2(preRoundTotal + roundOff);
  const linesValid = !multi || (primaryTotal > 0 && (!itemized || itemRows.every((r) => r.amount > 0))
    && extraLines.every((l) => l.categoryId && lineTotal(l) > 0 && l.rows.every((r) => r.amount > 0)));
  // Split-by-item only makes sense for a single-category itemised bill.
  const itemSplitMode = itemized && !multi;

  // Prefill / clear item rows when the modal opens.
  useEffect(() => {
    if (!open) return;
    // A bill spanning categories reopens as one block per category: a plain
    // amount line, or that category's items.
    const items = transaction?.items ?? [];
    const mainId = transaction?.categoryId?._id;
    const nameOf = (id?: string) => categories.find((c) => c._id === id)?.name;
    const multiBill = !!mainId && (items.some((i) => i.categoryId && i.categoryId !== mainId) || (transaction?.charges ?? []).some((c) => c.bill));
    const toCharge = (c: { label: string; amount: number }): ChargeRow => ({ key: rowKey(), label: c.label, kind: c.amount < 0 ? 'discount' : 'fee', value: Math.abs(c.amount) });
    const chargesOf = (id?: string) => (transaction?.charges ?? []).filter((c) => !c.bill && (c.categoryId ?? mainId) === id).map(toCharge);
    setMerchant(transaction?.merchant ?? '');
    const roundLine = (transaction?.charges ?? []).find((c) => c.bill && c.label === 'Round off');
    setBillCharges(multiBill ? (transaction?.charges ?? []).filter((c) => c.bill && c !== roundLine).map(toCharge) : []);
    setPaidTotal(multiBill && roundLine && transaction ? transaction.amount : 0);
    const sm: Record<string, string[] | undefined> = {};
    const mkRow = (i: (typeof items)[number], cat?: string): ItemRow => { const key = rowKey(); if (i.sharedWith) sm[key] = i.sharedWith; return { ...i, categoryId: cat, key }; };
    const toRows = (list: typeof items): ItemRow[] => list.map((i) => mkRow(i, undefined));
    const isPlain = (list: typeof items, id?: string) => list.length === 1 && !list[0].itemId && list[0].name === nameOf(id);
    if (multiBill) {
      const groups = new Map<string, typeof items>();
      items.forEach((i) => { const id = i.categoryId ?? mainId!; groups.set(id, [...(groups.get(id) ?? []), i]); });
      const mine = groups.get(mainId!) ?? [];
      if (isPlain(mine, mainId) && mine[0].sharedWith) sm.primary = mine[0].sharedWith;
      setPrimaryAmt(isPlain(mine, mainId) ? mine[0].amount : 0);
      setItemRows(isPlain(mine, mainId) ? [] : toRows(mine));
      const extras = [...groups.entries()].filter(([id]) => id !== mainId).map(([id, list]) => ({
        key: rowKey(), categoryId: id,
        amount: isPlain(list, id) ? list[0].amount : 0,
        rows: isPlain(list, id) ? [] : toRows(list),
        charges: isPlain(list, id) ? [] : chargesOf(id),
      }));
      extras.forEach((e, n) => { const list = [...groups.entries()].filter(([id]) => id !== mainId)[n][1]; if (isPlain(list, e.categoryId) && list[0].sharedWith) sm[e.key] = list[0].sharedWith; });
      setExtraLines(extras);
      setOpenItems([mainId!, ...extras.map((l) => l.key)].filter((k) => k === mainId ? !isPlain(mine, mainId) : !!extras.find((l) => l.key === k)?.rows.length).map((k) => k === mainId ? 'primary' : k));
    } else {
      setPrimaryAmt(0);
      setExtraLines([]);
      setOpenItems([]);
      setItemRows(items.map((i) => mkRow(i, i.categoryId)));
    }
    setSharedMap(sm);
    setLineLocks({});
    setChargeRows(multiBill ? chargesOf(mainId) : (transaction?.charges ?? []).map(toCharge));
  }, [transaction, open]);

  // Items drive the total.
  useEffect(() => {
    if (itemSplitMode) setAmountStr(String(itemsTotal));
  }, [itemSplitMode, itemsTotal]);

  // Category lines drive the total.
  useEffect(() => {
    if (multi) setAmountStr(String(multiTotal));
  }, [multi, multiTotal]);

  // Init amountStr from transaction when editing
  useEffect(() => {
    if (transaction) setAmountStr(String(transaction.amount));
    else setAmountStr('0');
  }, [transaction, open]);

  // Sync numpad → form amount
  useEffect(() => {
    const val = parseFloat(amountStr);
    if (!isNaN(val)) setValue('amount', val, { shouldValidate: false });
  }, [amountStr, setValue]);

  useEffect(() => {
    if (!isEdit && accounts.length > 0 && !getValues('accountId')) {
      const icici = accounts.find(a => a.name.toUpperCase().includes('ICICI'));
      if (icici) setValue('accountId', icici._id);
    }
  }, [isEdit, accounts, setValue, getValues]);

  const [whoPaid, setWhoPaid] = useState<'user' | string>('user');
  // Whether the "Others" friend list is expanded under Who paid — transient,
  // collapses once a pick is made so only one friend-list is open at a time.
  const [whoPaidExpanded, setWhoPaidExpanded] = useState(false);
  const [receivedFrom, setReceivedFrom] = useState<'' | string>('');
  const [isSplit, setIsSplit] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});
  // Cartoon split: who shares each line (undefined = everyone) and hand-set amounts per line.
  const [sharedMap, setSharedMap] = useState<Record<string, string[] | undefined>>({});
  const [lineLocks, setLineLocks] = useState<Record<string, Record<string, number>>>({});

  // Prefill split state when editing a transaction that was split.
  useEffect(() => {
    if (!open) return;
    // paidByFriendId on the transaction is the primary source of truth.
    // split.paidBy is a fallback for records created before paidByFriendId was added.
    const friendPayer = transaction?.paidByFriendId?._id ?? transaction?.split?.paidBy;
    setWhoPaid((friendPayer && friendPayer !== 'user') ? friendPayer : 'user');
    setWhoPaidExpanded(false);
    setReceivedFrom(transaction?.receivedFromFriendId?._id ?? '');

    const split = transaction?.split;
    if (split && split.splits.length > 0) {
      const idOf = (f: { _id: string } | string) => typeof f === 'string' ? f : f._id;
      setIsSplit(true);
      // The payer's own share (when friend paid) is represented as a
      // participant row automatically, not via the "other friends" picker.
      const payerId = (friendPayer && friendPayer !== 'user') ? friendPayer : null;
      setSelectedFriends(split.splits.map(s => idOf(s.friendId)).filter(id => id !== payerId));
      setSplitAmounts(Object.fromEntries(split.splits.map(s => [idOf(s.friendId), s.amount])));
    } else {
      setIsSplit(false);
      setSelectedFriends([]);
      setSplitAmounts({});
    }
  }, [transaction, open]);

  const hasFriends = friends.length > 0;
  const showFriendFlow = hasFriends && selectedType === 'expense';
  const showReceivedFromFlow = hasFriends && selectedType === 'income';
  const friendPaid = whoPaid !== 'user';
  const pickerDrag = useDragScroll();
  const whoPaidDrag = useDragScroll();
  const recordInteraction = useFriendStore((s) => s.recordInteraction);
  // The payer can't also be a split recipient — splits are what OTHER
  // friends owe (the user's own share is always the implicit remainder).
  const splitCandidateFriends = useMemo(
    () => (friendPaid ? friends.filter(f => f._id !== whoPaid) : friends),
    [friends, friendPaid, whoPaid]
  );
  const sortedFriends = useMemo(() => sortByFrecency(splitCandidateFriends), [splitCandidateFriends]);
  const sortedAllFriends = useMemo(() => sortByFrecency(friends), [friends]);
  const initials = useMemo(() => computeInitials(friends), [friends]);
  const isCartoonTheme = useThemeStore((st) => st.theme === 'cartoon');

  // If the payer changes to someone already picked as a split recipient,
  // drop them from the split — they can't owe themselves.
  useEffect(() => {
    if (!friendPaid) return;
    if (!selectedFriends.includes(whoPaid)) return;
    setSelectedFriends(p => p.filter(id => id !== whoPaid));
    setSplitAmounts(p => { const { [whoPaid]: _drop, ...rest } = p; return rest; });
  }, [whoPaid, friendPaid]);
  // When a friend paid, they're always a participant too — their own share
  // is what's NOT owed back, same as the user's share is when the user pays.
  const participantKeys = useMemo(
    () => friendPaid ? [USER_KEY, whoPaid, ...selectedFriends] : [USER_KEY, ...selectedFriends],
    [friendPaid, whoPaid, selectedFriends]
  );
  // Splitting with just the payer (a straight 2-way split) is meaningful on
  // its own — it doesn't require picking any other friend first.
  const splitActive = showFriendFlow && isSplit && (friendPaid || selectedFriends.length > 0);
  // With items, shares come from who shares each item; otherwise from the
  // per-person amounts below.
  const itemSplit = useMemo(
    () => computeItemSplit(itemRows, chargeRows, participantKeys),
    [itemRows, chargeRows, participantKeys]
  );
  const splitBlocks: SplitBlock[] = (() => {
    const mk = (key: string, categoryId: string, rows: ItemRow[], amount: number, charges: ChargeRow[] = []): SplitBlock => {
      const cat = categories.find((c) => c._id === categoryId);
      return {
        key, name: cat?.name ?? 'Category', icon: cat?.icon ?? '',
        total: rows.length ? round2(rows.reduce((sum, r) => sum + r.amount, 0) + charges.reduce((sum, c) => sum + signedCharge(c), 0)) : amount,
        lines: rows.map((r) => ({ key: r.key, name: r.name, qty: formatQty(r.quantity, r.unit) || undefined, amount: r.amount, group: key })),
      };
    };
    if (!selectedCategoryId) return [];
    return [
      mk('primary', selectedCategoryId, itemRows, multi ? primaryAmt : (totalAmount || 0), chargeRows),
      ...extraLines.filter((l) => l.categoryId).map((l) => mk(l.key, l.categoryId, l.rows, l.amount, l.charges)),
    ];
  })();
  const splitLineList: SplitLine[] = splitBlocks.flatMap((b) => (b.lines.length ? b.lines : [{ key: b.key, name: b.name, amount: b.total, group: b.key }]));
  const feeName = (c: ChargeRow) => c.label.trim() || (c.kind === 'fee' ? 'Fee' : 'Discount');
  const catLabel = (id?: string) => categories.find((c) => c._id === id)?.name;
  const splitFees: { label: string; amount: number; where?: string; group?: string }[] = [
    ...chargeRows.map((c) => ({ label: feeName(c), amount: signedCharge(c), where: catLabel(selectedCategoryId), group: 'primary' })),
    ...extraLines.flatMap((l) => l.charges.map((c) => ({ label: feeName(c), amount: signedCharge(c), where: catLabel(l.categoryId), group: l.key }))),
    ...billCharges.map((c) => ({ label: feeName(c), amount: signedCharge(c), group: undefined })),
    ...(roundOff ? [{ label: 'Round off', amount: roundOff, group: undefined }] : []),
  ].filter((f) => f.amount !== 0);
  const splitCharges: SplitCharge[] = splitFees.map((f) => ({ group: f.group, amount: f.amount }));
  const cartoonSplit = computeLineSplit(splitLineList, splitCharges, participantKeys, sharedMap, lineLocks);
  const splitCalc = isCartoonTheme ? cartoonSplit : itemSplitMode ? itemSplit : computeSplit(totalAmount || 0, participantKeys, splitAmounts);
  const splitValid = !splitActive || splitCalc.valid;

  // Only the user's own share counts toward the budget when the expense is split.
  const myShare = splitActive ? (splitCalc.shares[USER_KEY] ?? 0) : totalAmount;


  const [budgetWarning, setBudgetWarning] = useState<string[] | null>(null);

  // Server-side budget precheck — debounced, runs when amount / category / date changes.
  const selectedDate = watch('date');
  useEffect(() => {
    if (isEdit || selectedType !== 'expense' || !myShare || myShare <= 0) {
      setBudgetWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      const warnings = await precheckBudget(selectedCategoryId || undefined, myShare, selectedDate);
      setBudgetWarning(warnings.length > 0 ? warnings : null);
    }, 400);
    return () => clearTimeout(timer);
  }, [isEdit, selectedType, myShare, selectedCategoryId, selectedDate]);

  const toggleFriend = (id: string) => {
    if (selectedFriends.includes(id)) {
      setSelectedFriends(p => p.filter(x => x !== id));
      setSplitAmounts(prev => { const { [id]: _, ...rest } = prev; return rest; });
    } else {
      setSelectedFriends(p => [...p, id]);
    }
  };

  const handleFormSubmit = async (data: TransactionFormData) => {
    try {
      const payload: any = { type: data.type, amount: data.amount, categoryId: data.categoryId, date: data.date, note: data.note, merchant: merchant.trim() || undefined };
      if (friendPaid) payload.paidByFriendId = whoPaid;
      else payload.accountId = data.accountId;
      if (showReceivedFromFlow && receivedFrom) payload.receivedFromFriendId = receivedFrom;
      if (multi) {
        if (!linesValid) return;
        const catName = (id: string) => categories.find(c => c._id === id)?.name ?? 'Other';
        const blocks = [
          { key: 'primary', categoryId: data.categoryId as string, amount: primaryAmt, rows: itemRows, charges: chargeRows },
          ...extraLines,
        ];
        const byCategory: Record<string, number> = {};
        blocks.forEach(b => { byCategory[b.categoryId] = (byCategory[b.categoryId] ?? 0) + (b.rows.length ? b.rows.reduce((s, r) => s + r.amount, 0) + chargesSum(b.charges) : b.amount); });
        const mainCategory = Object.keys(byCategory).reduce((a, b) => (byCategory[b] > byCategory[a] ? b : a));
        payload.categoryId = mainCategory;
        const who = (k: string) => (splitActive ? (sharedMap[k] ?? participantKeys).filter(x => participantKeys.includes(x)) : undefined);
        payload.items = blocks.flatMap((b) => {
          const own = b.categoryId !== mainCategory ? b.categoryId : undefined;
          return b.rows.length
            ? b.rows.map(({ key, itemId, name, quantity, unit, unitId, baseQuantity, amount }) => ({ itemId, name, quantity, unit, unitId, baseQuantity, amount, categoryId: own, sharedWith: who(key) }))
            : [{ name: catName(b.categoryId), amount: b.amount, categoryId: own, sharedWith: who(b.key) }];
        });
        const feeLines = blocks.flatMap(b => (b.rows.length ? b.charges : []).filter(c => c.value > 0).map(c => ({
          label: c.label.trim() || (c.kind === 'fee' ? 'Fee' : 'Discount'), amount: signedCharge(c),
          categoryId: b.categoryId !== mainCategory ? b.categoryId : undefined,
        })));
        const billLines = [
          ...billCharges.filter(c => c.value > 0).map(c => ({ label: c.label.trim() || (c.kind === 'fee' ? 'Fee' : 'Discount'), amount: signedCharge(c), bill: true })),
          ...(roundOff ? [{ label: 'Round off', amount: roundOff, bill: true }] : []),
        ];
        if (feeLines.length + billLines.length > 0) payload.charges = [...feeLines, ...billLines];
      } else if (itemized) {
        if (!itemsValid) return;
        // The bill's own category is the one with the most spend (charges stay
        // with the picked category); lines in any other category carry theirs.
        const byCategory: Record<string, number> = { [data.categoryId]: chargeRows.reduce((s, c) => s + signedCharge(c), 0) };
        itemRows.forEach(r => { const c = r.categoryId ?? data.categoryId; byCategory[c] = (byCategory[c] ?? 0) + r.amount; });
        const mainCategory = Object.keys(byCategory).reduce((a, b) => (byCategory[b] > byCategory[a] ? b : a), data.categoryId);
        payload.categoryId = mainCategory;
        payload.items = itemRows.map(({ key, itemId, name, quantity, unit, unitId, baseQuantity, amount, sharedWith, categoryId: lineCategory }) => ({
          itemId, name, quantity, unit, unitId, baseQuantity, amount,
          categoryId: (lineCategory ?? data.categoryId) !== mainCategory ? (lineCategory ?? data.categoryId) : undefined,
          // Store the resolved list so the record says exactly who had what.
          sharedWith: splitActive ? ((isCartoonTheme ? sharedMap[key] : sharedWith) ?? participantKeys).filter(k => participantKeys.includes(k)) : undefined,
        }));
        payload.charges = chargeRows
          .filter(c => c.value > 0)
          .map(c => ({ label: c.label.trim() || (c.kind === 'fee' ? 'Fee' : 'Discount'), amount: signedCharge(c) }));
      }
      if (splitActive) {
        if (!splitCalc.valid) return; // amounts must sum to the total
        // Every non-user participant's share, including the payer's own (when
        // a friend paid) — that's what lets the server compute the user's
        // actual owed amount as less than the full bill.
        payload.splits = participantKeys
          .filter(id => id !== USER_KEY)
          .map(id => ({ friendId: id, amount: splitCalc.shares[id] ?? 0 }));
      }
      await onSubmit(payload);
      // Learn which friends get used together (frequent-first ordering).
      const interacted = new Set<string>();
      if (friendPaid) interacted.add(whoPaid);
      if (showReceivedFromFlow && receivedFrom) interacted.add(receivedFrom);
      if (splitActive) selectedFriends.forEach(id => interacted.add(id));
      interacted.forEach(id => recordInteraction(id));
      draftRef.current = null;
      try { localStorage.removeItem(TX_DRAFT_KEY); localStorage.removeItem(TX_DRAFT_BACKUP_KEY); } catch { /* ignore */ }
      setBackupDraft(null);
      reset(); setWhoPaid('user'); setWhoPaidExpanded(false); setReceivedFrom(''); setIsSplit(false); setSelectedFriends([]); setSplitAmounts({}); setSharedMap({}); setLineLocks({}); setBillCharges([]); setPaidTotal(0); setMerchant(''); setAmountStr('0'); setItemRows([]); setChargeRows([]); setExtraLines([]); setPrimaryAmt(0); setOpenItems([]);
      onClose();
    } catch { /* handled by store */ }
  };

  const save = handleSubmit(handleFormSubmit);
  const dateField = (
    <div>
      <label className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Date</label>
      <Controller control={control} name="date" render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />} />
    </div>
  );
  // ── Cartoon: one card per category (amount, or its own items) ─────────
  const usedCategoryIds = [selectedCategoryId, ...extraLines.map((l) => l.categoryId)].filter(Boolean);
  const unusedCategories = filteredCategories.filter((c) => !usedCategoryIds.includes(c._id));
  const [menuKey, setMenuKey] = useState<string | null>(null);
  const [pickMore, setPickMore] = useState(false);
  const addCategoryLine = (id: string) => {
    if (!multi) setPrimaryAmt(itemized ? 0 : parseFloat(amountStr) || 0);
    setExtraLines((ls) => [...ls, { key: rowKey(), categoryId: id, amount: 0, rows: [], charges: [] }]);
    setPickMore(false);
  };
  const cartoonCard = (o: {
    key: string; categoryId: string; options: typeof filteredCategories; onCategory: (id: string) => void;
    rows: ItemRow[]; onRows: (r: ItemRow[]) => void; charges: ChargeRow[]; onCharges: (c: ChargeRow[]) => void;
    amount: number; onAmount: (n: number) => void; onRemove?: () => void;
  }) => {
    const cat = categories.find((c) => c._id === o.categoryId);
    const hasItems = o.rows.length > 0 || openItems.includes(o.key);
    const itemsSum = round2(o.rows.reduce((sum, r) => sum + r.amount, 0) + chargesSum(o.charges));
    const closeItems = () => {
      o.onRows([]); o.onCharges([]);
      setOpenItems((ids) => ids.filter((k) => k !== o.key));
      if (itemsSum > 0) o.onAmount(itemsSum);
    };
    return (
      <div key={o.key} className="catcard">
        <div className="catcard-head">
          {cat ? renderCategoryIcon(cat.icon, cat.name, 52) : null}
          <div className="min-w-0 flex-1">
            <p className="catcard-name">{cat?.name}</p>
            <p className="catcard-sub">{o.rows.length > 0 ? `${o.rows.length} item${o.rows.length === 1 ? '' : 's'}, adds up for you` : hasItems ? 'Add the items below' : 'Just an amount'}</p>
          </div>
          {o.rows.length > 0 ? (
            <div className="text-right">
              <p className="catcard-sum">₹{itemsSum}</p>
              <span className="catcard-auto">AUTO SUM</span>
            </div>
          ) : (
            <label className="catcard-amount"><span>₹</span>
              <CalcAmountInput value={o.amount} onChange={o.onAmount} className="catcard-input" onFocusChange={setSplitFieldFocused} />
            </label>
          )}
          <button type="button" className="catcard-menu" aria-label="More" onClick={() => setMenuKey(menuKey === o.key ? null : o.key)}>•••</button>
        </div>
        {menuKey === o.key && (
          <div className="catcard-menu-panel">
            <CategorySelect categories={o.options} value={o.categoryId} onChange={(id) => { o.onCategory(id); setMenuKey(null); }} inline />
            {o.onRemove && <button type="button" className="catcard-remove" onClick={() => { setMenuKey(null); o.onRemove!(); }}>Remove this category</button>}
          </div>
        )}
        {hasItems ? (
          <div className="catcard-items">
            <ItemsSection categoryId={o.categoryId} rows={o.rows} onRowsChange={o.onRows} wide hideLabel
              charges={o.charges} onChargesChange={o.onCharges}
              splitKeys={null} friends={friends} initials={initials}
              onFocusChange={setItemFieldFocused} date={selectedDate} currentTransactionId={transaction?._id} />
            <button type="button" className="catcard-link" onClick={closeItems}>Use one amount instead</button>
          </div>
        ) : (
          <button type="button" className="catcard-break" onClick={() => setOpenItems((ids) => [...ids, o.key])}>
            <CartoonIcon kind="items" size={20} />Break into items
          </button>
        )}
      </div>
    );
  };

  const addBillCharge = (kind: 'fee' | 'discount') => {
    if (!multi) { setPrimaryAmt(itemized ? 0 : parseFloat(amountStr) || 0); }
    setBillCharges((cs) => [...cs, { key: rowKey(), label: '', kind, value: 0 }]);
  };
  const updateBillCharge = (key: string, patch: Partial<ChargeRow>) => setBillCharges((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const removeBillCharge = (key: string) => {
    if (billCharges.length === 1 && extraLines.length === 0 && paidTotal === 0) setAmountStr(String(primaryTotal));
    setBillCharges((cs) => cs.filter((c) => c.key !== key));
  };
  const billTotal = round2(chargesSum(billCharges));
  const billSection = (
    <div className="catcard">
      <div className="catcard-head">
        <CartoonIcon kind="receipt" size={44} />
        <div className="min-w-0 flex-1">
          <p className="catcard-name">Whole bill</p>
          <p className="catcard-sub">{billCharges.length > 0 ? 'Shared across the categories above' : 'Delivery fee, taxes, coupons…'}</p>
        </div>
        {billCharges.length > 0 && <p className="catcard-sum">{billTotal < 0 ? '−' : '+'}₹{Math.abs(billTotal)}</p>}
      </div>
      {billCharges.map((c) => (
        <div key={c.key} style={ITEM_GRID} className="px-1 py-1 mt-2">
          <ChargeLabelSelect value={c.label} kind={c.kind} onChange={(label) => updateBillCharge(c.key, { label })} />
          <button type="button" onClick={() => updateBillCharge(c.key, { kind: c.kind === 'fee' ? 'discount' : 'fee' })}
            title="Switch between fee and discount"
            className="justify-self-start ml-1 rounded-full px-2 py-1 text-[10px] font-bold uppercase"
            style={{ background: 'var(--c-surface2)', color: c.kind === 'fee' ? 'var(--c-expense)' : 'var(--c-income)' }}>
            {c.kind === 'fee' ? '+ Fee' : '− Discount'}
          </button>
          <CalcAmountInput value={c.value} onChange={(v) => updateBillCharge(c.key, { value: v })} className="item-cell text-right tabular-nums" onFocusChange={setSplitFieldFocused} />
          <button type="button" aria-label="Remove" onClick={() => removeBillCharge(c.key)} className="text-base leading-none justify-self-center w-5 h-5 rounded-full" style={{ color: 'var(--c-muted)' }}>×</button>
        </div>
      ))}
      {paidTotal > 0 ? (
        <div className="catcard-round">
          <span className="catcard-round-label">Rounded off · you paid</span>
          <label className="catcard-amount"><span>₹</span>
            <CalcAmountInput value={paidTotal} onChange={setPaidTotal} className="catcard-input" onFocusChange={setSplitFieldFocused} />
          </label>
          <span className="catcard-round-diff">{roundOff === 0 ? 'no change' : `${roundOff > 0 ? '+' : '−'}₹${Math.abs(roundOff)} round off`}</span>
          <button type="button" aria-label="Remove round off" className="text-base leading-none w-5 h-5" style={{ color: 'var(--c-muted)' }}
            onClick={() => { if (billCharges.length === 0 && extraLines.length === 0) setAmountStr(String(primaryTotal)); setPaidTotal(0); }}>×</button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="catcard-break" onClick={() => addBillCharge('fee')}><CartoonIcon kind="receipt" size={18} />+ Fee / tax</button>
        <button type="button" className="catcard-break" onClick={() => addBillCharge('discount')}><CartoonIcon kind="tag" size={18} />+ Discount</button>
        {paidTotal === 0 && (
          <button type="button" className="catcard-break" onClick={() => { if (!multi) setPrimaryAmt(itemized ? 0 : parseFloat(amountStr) || 0); setPaidTotal(Math.round(preRoundTotal) || 0); }}>
            <CartoonIcon kind="coins" size={18} />Round off
          </button>
        )}
      </div>
    </div>
  );
  const cartoonCategories = (
    <div>
      <p className="tx-label block text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--c-muted)' }}>What was it for?</p>
      {!selectedCategoryId ? (
        <CategorySelect categories={filteredCategories} value="" onChange={(id) => setValue('categoryId', id, { shouldValidate: true })} onSearchFocusChange={setCategorySearchFocused} />
      ) : (
        <div className="space-y-3">
          {cartoonCard({
            key: 'primary', categoryId: selectedCategoryId,
            options: filteredCategories.filter((c) => !extraLines.some((l) => l.categoryId === c._id)),
            onCategory: (id) => setValue('categoryId', id, { shouldValidate: true }),
            rows: itemRows, onRows: setItemRows, charges: chargeRows, onCharges: setChargeRows,
            amount: multi ? primaryAmt : (parseFloat(amountStr) || 0),
            onAmount: multi ? setPrimaryAmt : (v) => setAmountStr(String(v)),
          })}
          {extraLines.map((line) => cartoonCard({
            key: line.key, categoryId: line.categoryId,
            options: filteredCategories.filter((c) => c._id !== selectedCategoryId && !extraLines.some((l) => l.key !== line.key && l.categoryId === c._id)),
            onCategory: (id) => setExtraLines((ls) => ls.map((l) => l.key === line.key ? { ...l, categoryId: id } : l)),
            rows: line.rows, onRows: (rows) => setExtraLines((ls) => ls.map((l) => l.key === line.key ? { ...l, rows } : l)),
            charges: line.charges, onCharges: (charges) => setExtraLines((ls) => ls.map((l) => l.key === line.key ? { ...l, charges } : l)),
            amount: line.amount, onAmount: (v) => setExtraLines((ls) => ls.map((l) => l.key === line.key ? { ...l, amount: v } : l)),
            onRemove: () => {
              if (extraLines.length === 1 && billCharges.length === 0 && paidTotal === 0) setAmountStr(String(primaryTotal));
              setExtraLines((ls) => ls.filter((l) => l.key !== line.key));
            },
          }))}
          {billSection}
          {unusedCategories.length > 0 && (
            <div>
              <p className="tx-label block text-[10px] uppercase tracking-wider mb-2" style={{ color: 'var(--c-muted)' }}>Add another category</p>
              <div className="flex flex-wrap gap-2">
                {unusedCategories.slice(0, 3).map((c) => (
                  <button key={c._id} type="button" className="cartoon-chip" onClick={() => addCategoryLine(c._id)}>
                    <CartoonIcon kind={categoryKind(c.icon, c.name)} size={22} />{c.name}
                  </button>
                ))}
                {unusedCategories.length > 3 && (
                  <button type="button" className="cartoon-chip cartoon-chip-dashed" onClick={() => setPickMore((v) => !v)}>All categories</button>
                )}
              </div>
              {pickMore && (
                <div className="mt-2">
                  <CategorySelect categories={unusedCategories} value="" onChange={addCategoryLine} inline defaultOpen onClose={() => setPickMore(false)} placeholder="Pick a category" />
                </div>
              )}
            </div>
          )}
          {multi && <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>Total ₹{multiTotal} — one payment, split across these categories.</p>}
          {errors.categoryId && <p className="text-xs" style={{ color: 'var(--c-expense)' }}>{errors.categoryId.message}</p>}
        </div>
      )}
    </div>
  );

  // ── Draft: an unsaved new transaction survives leaving the page ────────
  // Kept in localStorage while typing. A save clears it; the back arrow clears it
  // too, but first parks a copy so "Restore cleared draft" can bring it back.
  const noteValue = watch('note');
  const clearDraft = () => { try { localStorage.removeItem(TX_DRAFT_KEY); } catch { /* storage unavailable */ } };
  const draftRef = useRef<Record<string, unknown> | null>(null);
  const discardDraft = () => {
    try {
      const raw = localStorage.getItem(TX_DRAFT_KEY) ?? (draftRef.current ? JSON.stringify(draftRef.current) : null);
      if (raw) { localStorage.setItem(TX_DRAFT_BACKUP_KEY, raw); toast('Draft cleared — you can restore it from the empty form', { icon: '🗑️' }); }
    } catch { /* storage unavailable */ }
    draftRef.current = null;
    clearDraft();
    onClose();
  };
  const applyDraft = (d: any) => {
    setValue('type', d.type ?? 'expense');
    setValue('categoryId', d.categoryId ?? '');
    if (d.accountId) setValue('accountId', d.accountId);
    if (d.date) setValue('date', d.date);
    setValue('note', d.note ?? '');
    setAmountStr(d.amountStr ?? '0');
    setItemRows(d.itemRows ?? []);
    setChargeRows(d.chargeRows ?? []);
    // Drafts saved by older versions lack some fields — fill them in.
    setExtraLines((d.extraLines ?? []).map((l: { rows?: ItemRow[]; charges?: ChargeRow[] }) => ({ ...l, rows: l.rows ?? [], charges: l.charges ?? [] })));
    setBillCharges(d.billCharges ?? []);
    setMerchant(d.merchant ?? '');
    setPaidTotal(d.paidTotal ?? 0);
    setPrimaryAmt(d.primaryAmt ?? 0);
    setOpenItems(d.openItems ?? []);
    setWhoPaid(d.whoPaid ?? 'user');
    setReceivedFrom(d.receivedFrom ?? '');
    setIsSplit(!!d.isSplit);
    setSelectedFriends(d.selectedFriends ?? []);
    setSplitAmounts(d.splitAmounts ?? {});
    setSharedMap(d.sharedMap ?? {});
    setLineLocks(d.lineLocks ?? {});
  };
  const DRAFT_LIFETIME = 7 * 24 * 3600 * 1000;
  // An empty form may only erase the stored draft once the draft has had its chance to load.
  const mayErase = useRef(false);
  useEffect(() => {
    if (!open || isEdit) return;
    const arm = setTimeout(() => { mayErase.current = true; }, 800);
    try {
      const raw = localStorage.getItem(TX_DRAFT_KEY);
      if (!raw) return () => clearTimeout(arm);
      const d = JSON.parse(raw);
      if (!d || Date.now() - (d.savedAt ?? 0) > DRAFT_LIFETIME) { clearDraft(); return () => clearTimeout(arm); }
      applyDraft(d);
    } catch { /* corrupt draft — ignore */ }
    return () => clearTimeout(arm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEdit]);
  const draftDirty = !!selectedCategoryId || (parseFloat(amountStr) || 0) > 0 || !!noteValue?.trim() || !!merchant.trim()
    || itemRows.length > 0 || extraLines.length > 0 || billCharges.length > 0 || paidTotal > 0;
  const writeDraft = (draft: Record<string, unknown> | null) => {
    try {
      if (draft) localStorage.setItem(TX_DRAFT_KEY, JSON.stringify(draft));
      else if (mayErase.current) localStorage.removeItem(TX_DRAFT_KEY);
    } catch { /* storage full or unavailable */ }
  };
  useEffect(() => {
    if (!open || isEdit) return;
    draftRef.current = draftDirty ? {
      savedAt: Date.now(), type: selectedType, categoryId: selectedCategoryId, accountId: selectedAccountId, date: selectedDate,
      note: noteValue ?? '', merchant, amountStr, itemRows, chargeRows, extraLines, billCharges, paidTotal, primaryAmt, openItems,
      whoPaid, receivedFrom, isSplit, selectedFriends, splitAmounts, sharedMap, lineLocks,
    } : null;
    const timer = setTimeout(() => writeDraft(draftRef.current), 300);
    return () => clearTimeout(timer);
  }, [open, isEdit, draftDirty, selectedType, selectedCategoryId, selectedAccountId, selectedDate, noteValue, merchant, amountStr, itemRows, chargeRows,
    extraLines, billCharges, paidTotal, primaryAmt, openItems, whoPaid, receivedFrom, isSplit, selectedFriends, splitAmounts, sharedMap, lineLocks]);
  // Leaving the form (another page, a day, a record) must not lose the last few keystrokes.
  useEffect(() => () => { if (draftRef.current) writeDraft(draftRef.current); }, []);

  // A cleared draft can be brought back while the form is still empty.
  const [backupDraft, setBackupDraft] = useState<any>(() => {
    try { const d = JSON.parse(localStorage.getItem(TX_DRAFT_BACKUP_KEY) ?? 'null'); return d && Date.now() - (d.savedAt ?? 0) < DRAFT_LIFETIME ? d : null; } catch { return null; }
  });
  const restoreBackup = () => {
    applyDraft(backupDraft);
    try { localStorage.removeItem(TX_DRAFT_BACKUP_KEY); } catch { /* ignore */ }
    setBackupDraft(null);
  };

  // "Where from?" suggestions: the user's own merchants from the database, best
  // match first — same kind (income/expense), same category, same account type.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/transactions/merchants', {
          params: {
            type: selectedType,
            categoryId: selectedCategoryId || undefined,
            accountId: friendPaid ? undefined : selectedAccountId || undefined,
            q: merchant.trim() || undefined,
          },
        });
        if (!cancelled) setMerchantSuggestions((data.merchants ?? []).map((m: { name: string }) => m.name));
      } catch {
        if (!cancelled) setMerchantSuggestions([]);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, selectedType, selectedCategoryId, selectedAccountId, friendPaid, merchant]);

  const canSave = !isSubmitting && splitValid && itemsValid && linesValid;

  const content = (
        <>
          {/* Top bar */}
          <div className="tx-topbar flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <button type="button" onClick={discardDraft} aria-label={panel ? 'Clear form' : 'Go back'} title={panel ? (isEdit ? 'Cancel editing (Esc)' : 'Clear form (Esc)') : 'Go back'} className="transaction-form-icon-action flex items-center justify-center rounded-full">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="20" y1="12" x2="4" y2="12" />
                <polyline points="10 18 4 12 10 6" />
              </svg>
            </button>
            {/* Type tabs */}
            <div className="tx-type-tabs flex gap-1 text-xs font-bold tracking-wider">
              {(['income', 'expense'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setValue('type', t); setValue('categoryId', ''); setItemRows([]); setChargeRows([]); setExtraLines([]); }}
                  className={`tx-type-tab is-${t} ${selectedType === t ? 'is-on' : ''} px-3 py-1 rounded-full transition-colors`}
                  style={{
                    background: selectedType === t ? 'var(--c-accent)' : 'transparent',
                    color: selectedType === t ? 'var(--c-accent-fg)' : 'var(--c-muted)',
                  }}
                >
                  {t === 'income' ? 'INCOME' : 'EXPENSE'}
                </button>
              ))}
            </div>
            {panel ? (
              <span className="tx-mode-sticker text-xs font-semibold w-9 text-right" style={{ color: 'var(--c-muted)' }}>{isEdit ? 'Edit' : 'New'}</span>
            ) : (
            <button
              onClick={save}
              disabled={!canSave}
              aria-label="Save transaction"
              title="Save transaction"
              className="transaction-form-icon-action flex items-center justify-center rounded-full disabled:opacity-40"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
            )}
          </div>

          {/* Scrollable form body */}
          {/* scrollbar-gutter keeps the scrollbar's space reserved, so opening a
              dropdown that makes the body scrollable doesn't shift the layout. */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 space-y-3 pb-4 min-h-0" style={{ scrollbarGutter: 'stable' }}>
            {!isEdit && !draftDirty && backupDraft && (
              <button type="button" onClick={restoreBackup} className="draft-restore">↩ Restore the draft you cleared</button>
            )}

            {/* Account + Date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Account</label>
                {!friendPaid ? (
                  <AccountSelect
                    accounts={accounts}
                    value={selectedAccountId || ''}
                    onChange={(id) => setValue('accountId', id, { shouldValidate: true })}
                  />
                ) : (
                  <div className="t-input opacity-50">Friend paid</div>
                )}
              </div>
              {dateField}
            </div>

            {/* Where it was bought */}
            <div>
              <label className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Where from?</label>
              <input
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                onFocus={() => setMerchantFocus(true)}
                onBlur={() => setTimeout(() => setMerchantFocus(false), 150)}
                placeholder="Swiggy, Amazon, hotel name…"
                maxLength={80}
                className="t-input"
              />
              {merchantFocus && merchantMatches.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {merchantMatches.map((m) => (
                    <button key={m} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { setMerchant(m); setMerchantFocus(false); }}
                      className={isCartoonTheme ? 'cartoon-chip' : 'rounded-full px-3 py-1 text-xs'} style={isCartoonTheme ? { minHeight: 36, padding: '4px 14px' } : { background: 'var(--c-surface2)', color: 'var(--c-text)' }}>
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Categories — one, or several when a bill spans categories. Each
                category has either a plain amount or its own items. */}
            {isCartoonTheme ? cartoonCategories : (() => {
              const itemsProps = {
                friends, initials, date: selectedDate, currentTransactionId: transaction?._id,
                onFocusChange: setItemFieldFocused, splitKeys: null as string[] | null, noCharges: true,
              };
              const toggleItems = (key: string, on: boolean) => setOpenItems(o => on ? [...o.filter(k => k !== key), key] : o.filter(k => k !== key));
              const amountBox = (hasItems: boolean, total: number, onChange: (n: number) => void) => (
                <div className="w-28 shrink-0">
                  {hasItems
                    ? <div className="t-input w-full text-right tabular-nums opacity-70" title="Total of the items below">{total}</div>
                    : <CalcAmountInput value={total} onChange={onChange} className="t-input w-full text-right tabular-nums" onFocusChange={setSplitFieldFocused} />}
                </div>
              );
              // One category of a multi-category bill. With items it shrinks to
              // its icon and the item list takes the rest of the row; without,
              // it's a full-width select with an amount.
              const block = (o: {
                key: string; categoryId: string; options: typeof filteredCategories;
                onCategory: (id: string) => void; rows: ItemRow[]; onRows: (r: ItemRow[]) => void;
                amount: number; onAmount: (n: number) => void; onRemove?: () => void;
              }) => {
                const withItems = o.rows.length > 0 || openItems.includes(o.key);
                const select = (compact: boolean) => (
                  <CategorySelect categories={o.options} value={o.categoryId} onChange={o.onCategory}
                    onSearchFocusChange={setCategorySearchFocused} compact={compact} />
                );
                const remove = o.onRemove && (
                  <button type="button" aria-label="Remove category" className="h-8 w-full text-lg leading-none" style={{ color: 'var(--c-muted)' }} onClick={o.onRemove}>×</button>
                );
                if (withItems && o.categoryId) {
                  return (
                    <div key={o.key} className="flex items-start gap-2">
                      <div className="w-[4.5rem] shrink-0">{select(true)}{remove}</div>
                      <div className="flex-1 min-w-0">
                        <ItemsSection {...itemsProps} categoryId={o.categoryId} rows={o.rows} onRowsChange={o.onRows} charges={[]} onChargesChange={() => {}} />
                        {o.rows.length === 0 && (
                          <button type="button" className="block text-xs font-semibold px-1 py-0.5" style={{ color: 'var(--c-muted)' }} onClick={() => toggleItems(o.key, false)}>− Hide items</button>
                        )}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={o.key} className="space-y-1">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-[8rem]">{select(false)}</div>
                      {amountBox(false, o.amount, o.onAmount)}
                      {o.onRemove && <button type="button" aria-label="Remove category" className="h-11 w-6 text-lg leading-none" style={{ color: 'var(--c-muted)' }} onClick={o.onRemove}>×</button>}
                    </div>
                    {o.categoryId && (
                      <button type="button" className="block text-xs font-semibold px-1 py-0.5" style={{ color: 'var(--c-muted)' }} onClick={() => toggleItems(o.key, true)}>+ Add items</button>
                    )}
                  </div>
                );
              };
              return (
                <div>
                  <label className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>{multi ? 'Categories' : 'Category'}</label>
                  <div className="space-y-2">
                    {multi ? block({
                      key: 'primary', categoryId: selectedCategoryId,
                      options: filteredCategories.filter(c => !extraLines.some(l => l.categoryId === c._id)),
                      onCategory: (id) => setValue('categoryId', id, { shouldValidate: true }),
                      rows: itemRows, onRows: setItemRows, amount: primaryAmt, onAmount: setPrimaryAmt,
                    }) : (
                      <CategorySelect
                        categories={filteredCategories}
                        value={selectedCategoryId}
                        onChange={(id) => {
                          // Items belong to a category — switching category starts a fresh list.
                          setValue('categoryId', id, { shouldValidate: true });
                        }}
                        onSearchFocusChange={setCategorySearchFocused}
                      />
                    )}
                    {extraLines.map((line) => block({
                      key: line.key, categoryId: line.categoryId,
                      options: filteredCategories.filter(c => c._id !== selectedCategoryId && !extraLines.some(l => l.key !== line.key && l.categoryId === c._id)),
                      onCategory: (id) => setExtraLines(ls => ls.map(l => l.key === line.key ? { ...l, categoryId: id } : l)),
                      rows: line.rows, onRows: (rows) => setExtraLines(ls => ls.map(l => l.key === line.key ? { ...l, rows } : l)),
                      amount: line.amount, onAmount: (v) => setExtraLines(ls => ls.map(l => l.key === line.key ? { ...l, amount: v } : l)),
                      onRemove: () => {
                        if (extraLines.length === 1 && billCharges.length === 0 && paidTotal === 0) setAmountStr(String(primaryTotal));
                        setExtraLines(ls => ls.filter(l => l.key !== line.key));
                        toggleItems(line.key, false);
                      },
                    }))}
                    {errors.categoryId && <p className="text-xs" style={{ color: 'var(--c-expense)' }}>{errors.categoryId.message}</p>}
                    {selectedCategoryId && filteredCategories.length > extraLines.length + 1 && (
                      <button type="button" className="tx-add-category text-sm font-semibold px-1 py-1" style={{ color: 'var(--c-accent)' }}
                        onClick={() => {
                          if (!multi) { setPrimaryAmt(itemized ? 0 : parseFloat(amountStr) || 0); setChargeRows([]); }
                          setExtraLines(ls => [...ls, { key: rowKey(), categoryId: '', amount: 0, rows: [], charges: [] }]);
                        }}>
                        + Add another category
                      </button>
                    )}
                    {multi && (
                      <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
                        Total ₹{multiTotal} — one payment, split across these categories.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Items of a single-category bill */}
            {selectedCategoryId && !multi && !isCartoonTheme && (
              <ItemsSection
                categoryId={selectedCategoryId}
                rows={itemRows}
                onRowsChange={setItemRows}
                charges={chargeRows}
                onChargesChange={setChargeRows}
                splitKeys={splitActive ? participantKeys : null}
                friends={friends}
                initials={initials}
                onFocusChange={setItemFieldFocused}
                date={selectedDate}
                currentTransactionId={transaction?._id}
              />
            )}

            {/* Notes */}
            <div>
              <label className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Notes</label>
              <textarea
                {...register('note', { onBlur: () => setNotesFocused(false) })}
                rows={2}
                placeholder="Add a note..."
                className="t-input resize-none"
                onFocus={() => setNotesFocused(true)}
              />
            </div>

            {/* Budget warning */}
            {budgetWarning && (
              <div className="tx-budget rounded-lg p-3" style={{ background: 'rgba(201,167,47,0.12)', border: '1px solid rgba(201,167,47,0.3)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--c-accent)' }}>⚠ Budget alert</p>
                {budgetWarning.map((w, i) => <p key={i} className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>{w}</p>)}
              </div>
            )}

            {/* Received from friend (income only) */}
            {showReceivedFromFlow && (
              <div>
                <label className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Received from</label>
                <ThemedSelect
                  value={receivedFrom}
                  onChange={setReceivedFrom}
                  options={[{ value: '', label: 'Nobody / regular income' }, ...friends.map(f => ({ value: f._id, label: f.name }))]}
                />
              </div>
            )}

            {/* Friend flow */}
            {showFriendFlow && (
              <>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <label className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Who paid?</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setWhoPaid('user'); setWhoPaidExpanded(false); }}
                        className="flex flex-col items-center gap-1 flex-shrink-0 w-12">
                        <span className="relative rounded-full transition-all"
                          style={{ boxShadow: whoPaid === 'user' ? '0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-accent)' : 'none', opacity: whoPaid === 'user' ? 1 : 0.5 }}>
                          <AvatarCircle isUser size={36} />
                        </span>
                        <span className="text-[10px] truncate w-full text-center" style={{ color: whoPaid === 'user' ? 'var(--c-text)' : 'var(--c-muted)' }}>You</span>
                      </button>

                      {/* "Others" — shows the picked friend once chosen; tap toggles the picker below. */}
                      <button type="button" onClick={() => setWhoPaidExpanded(v => !v)}
                        className="flex flex-col items-center gap-1 flex-shrink-0 w-12">
                        <span className="relative rounded-full transition-all"
                          style={{ boxShadow: (friendPaid || whoPaidExpanded) ? '0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-accent)' : 'none', opacity: (friendPaid || whoPaidExpanded) ? 1 : 0.5 }}>
                          {friendPaid ? (
                            <AvatarCircle name={friends.find(f => f._id === whoPaid)?.name} label={initials[whoPaid]} color={avatarColor(friends.find(f => f._id === whoPaid)?.name ?? '')} size={36} />
                          ) : (
                            <span className="split-avatar flex items-center justify-center rounded-full flex-shrink-0"
                              style={{ width: 36, height: 36, background: 'var(--c-surface2)', color: 'var(--c-muted)' }}>
                              {isCartoonTheme ? <CartoonIcon kind="friends" size={26} /> : (
                              <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M17 21v-2a4 4 0 00-3-3.87" /><path d="M13 3.13a4 4 0 010 7.75" />
                                <path d="M2 21v-2a4 4 0 014-4h4a4 4 0 014 4v2" /><circle cx="8" cy="7" r="4" />
                              </svg>)}
                            </span>
                          )}
                        </span>
                        <span className="text-[10px] truncate w-full text-center" style={{ color: (friendPaid || whoPaidExpanded) ? 'var(--c-text)' : 'var(--c-muted)' }}>
                          {friendPaid ? friends.find(f => f._id === whoPaid)?.name : 'Others'}
                        </span>
                      </button>
                    </div>

                    {whoPaidExpanded && (
                      <div
                        ref={whoPaidDrag.ref}
                        className="flex gap-2 overflow-x-auto py-2 mt-2 -mx-1 px-1 no-scrollbar select-none cursor-grab active:cursor-grabbing"
                        style={{ borderTop: '1px solid var(--c-border)' }}
                      >
                        {sortedAllFriends.map(f => {
                          const sel = whoPaid === f._id;
                          return (
                            <button key={f._id} type="button" onClick={() => { setWhoPaid(f._id); setWhoPaidExpanded(false); }}
                              className="flex flex-col items-center gap-1 flex-shrink-0 w-12">
                              <span className="relative rounded-full transition-all"
                                style={{ boxShadow: sel ? '0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-accent)' : 'none', opacity: sel ? 1 : 0.5 }}>
                                <AvatarCircle name={f.name} label={initials[f._id]} color={avatarColor(f.name)} size={36} />
                              </span>
                              <span className="text-[10px] truncate w-full text-center" style={{ color: sel ? 'var(--c-text)' : 'var(--c-muted)' }}>{f.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-center">
                    <label className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Split?</label>
                    <button
                      type="button"
                      aria-label={isSplit ? 'Split on' : 'Split off'}
                      title="Split"
                      onClick={() => {
                        const next = !isSplit;
                        setIsSplit(next);
                        setWhoPaidExpanded(false);
                        if (!next) setSplitAmounts({});
                        if (next && splitCandidateFriends.length === 1 && selectedFriends.length === 0) setSelectedFriends([splitCandidateFriends[0]._id]);
                      }}
                      className={`tx-split-toggle ${isSplit ? 'is-on' : ''} rounded-full flex items-center justify-center flex-shrink-0`}
                      style={{ width: 36, height: 36, background: isSplit ? 'var(--c-accent)' : 'var(--c-surface2)', color: isSplit ? 'var(--c-accent-fg)' : 'var(--c-muted)' }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>✂</span>
                    </button>
                  </div>
                </div>
                {isSplit && isCartoonTheme && (
                  <CartoonSplitPanel
                    blocks={splitBlocks} fees={splitFees} calc={cartoonSplit} keys={participantKeys} candidates={sortedFriends} friends={friends} initials={initials}
                    selectedFriends={selectedFriends} onToggleFriend={toggleFriend} payerKey={friendPaid ? whoPaid : USER_KEY}
                    shared={sharedMap} onShared={(k, people) => setSharedMap(m => ({ ...m, [k]: people }))}
                    locks={lineLocks} onLock={(k, person, v) => setLineLocks(m => ({ ...m, [k]: { ...m[k], [person]: v } }))}
                    onReset={() => { setSharedMap({}); setLineLocks({}); }}
                    customized={Object.keys(lineLocks).some(k => Object.keys(lineLocks[k] ?? {}).length > 0) || Object.values(sharedMap).some(Boolean)}
                    total={totalAmount || 0}
                    onOff={() => { setIsSplit(false); setSplitAmounts({}); setSharedMap({}); setLineLocks({}); }}
                    onFocusChange={setSplitFieldFocused}
                  />
                )}
                {isSplit && !isCartoonTheme && (
                  <div className="tx-split-box rounded-lg p-3 space-y-3" style={{ background: 'var(--c-surface)' }}>
                    {/* Add more people to the split (anyone besides who already paid) —
                        only shown when there's someone else who could be added. */}
                    {sortedFriends.length > 0 && (
                      <div>
                        <span className="tx-label block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>
                          Split with — tap to add
                        </span>
                        <div
                          ref={pickerDrag.ref}
                          className="flex gap-2 overflow-x-auto py-2 -mx-1 px-1 no-scrollbar select-none cursor-grab active:cursor-grabbing"
                        >
                          {sortedFriends.map(f => {
                            const sel = selectedFriends.includes(f._id);
                            return (
                              <button key={f._id} type="button" onClick={() => toggleFriend(f._id)}
                                className="flex flex-col items-center gap-1 flex-shrink-0 w-14">
                                <span className="relative rounded-full transition-all"
                                  style={{ boxShadow: sel ? '0 0 0 2px var(--c-surface), 0 0 0 4px var(--c-accent)' : 'none', opacity: sel ? 1 : 0.5 }}>
                                  <AvatarCircle name={f.name} label={initials[f._id]} color={avatarColor(f.name)} size={44} />
                                  {sel && (
                                    <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center rounded-full"
                                      style={{ width: 16, height: 16, background: 'var(--c-accent)', border: '2px solid var(--c-surface)' }}>
                                      <svg viewBox="0 0 24 24" className="w-2.5 h-2.5" fill="none" stroke="var(--c-accent-fg)" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] truncate w-full text-center" style={{ color: sel ? 'var(--c-text)' : 'var(--c-muted)' }}>{f.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Editable per-person amounts (You + selected friends) */}
                    {splitActive && (totalAmount || 0) > 0 && (
                      <div className="pt-2 space-y-2" style={{ borderTop: '1px solid var(--c-border)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Each person's share</span>
                          {itemSplitMode ? (
                            <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>From items — tick avatars on each item</span>
                          ) : (
                            <button type="button" onClick={() => setSplitAmounts({})} className="text-[11px] font-semibold" style={{ color: 'var(--c-accent)' }}>Split equally</button>
                          )}
                        </div>
                        {participantKeys.map(key => {
                          const isUser = key === USER_KEY;
                          const f = isUser ? null : friends.find(x => x._id === key);
                          const name = isUser ? 'You' : (f?.name ?? '');
                          const isLocked = !itemSplitMode && splitAmounts[key] !== undefined;
                          return (
                            <div key={key} className="flex items-center gap-2">
                              <AvatarCircle name={name} label={isUser ? undefined : initials[key]} color={isUser ? undefined : avatarColor(name)} isUser={isUser} size={30} />
                              <span className="text-sm flex-1 truncate" style={{ color: 'var(--c-text)' }}>{name}</span>
                              {isLocked && (
                                <button type="button" onClick={() => setSplitAmounts(p => { const { [key]: _drop, ...rest } = p; return rest; })}
                                  className="text-[10px] font-medium" style={{ color: 'var(--c-muted)' }} title="Reset to auto split">auto ↺</button>
                              )}
                              <span className="text-xs" style={{ color: 'var(--c-muted)' }}>₹</span>
                              {itemSplitMode ? (
                                <span className="w-24 text-right text-sm font-medium" style={{ color: 'var(--c-text)' }}>{round2(splitCalc.shares[key] ?? 0)}</span>
                              ) : (
                              <CalcAmountInput
                                value={splitCalc.shares[key] ?? 0}
                                onChange={(v) => setSplitAmounts(p => ({ ...p, [key]: v }))}
                                className="t-input w-24 text-right text-sm py-1"
                                onFocusChange={setSplitFieldFocused}
                              />
                              )}
                            </div>
                          );
                        })}
                        {!splitCalc.valid && !itemSplitMode && 'unassigned' in splitCalc && (
                          <p className="text-xs font-semibold text-center pt-1" style={{ color: 'var(--c-expense)' }}>
                            {splitCalc.unassigned > 0 ? `Unassigned ₹${round2(splitCalc.unassigned)}` : `Over by ₹${round2(-splitCalc.unassigned)}`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>

          {/* Amount — numpad on mobile, a typed field + Save on desktop */}
          <div className="tx-footer flex-shrink-0 px-4 pb-4 pt-2" style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-bg)' }}>
            {errors.amount && <p className="text-xs text-center mb-1" style={{ color: 'var(--c-expense)' }}>{errors.amount.message}</p>}
            {panel ? (
              <div className="space-y-2">
                <AmountField value={amountStr} onChange={setAmountStr} locked={itemSplitMode || multi} />
                <button type="button" onClick={save} disabled={!canSave} className="tx-save t-btn-primary w-full disabled:opacity-40">
                  {isSubmitting ? 'Saving…' : isEdit ? 'Save changes' : `Add ${selectedType}`}
                  <span className="ml-2 text-[11px] opacity-60">⌘↵</span>
                </button>
              </div>
            ) : (
              <Numpad value={amountStr} onChange={setAmountStr} collapsed={keyboardOpen || itemSplitMode || multi} locked={itemSplitMode || multi} />
            )}
          </div>
        </>
  );

  if (panel) {
    return (
      <div
        className="tx-form flex flex-col h-full min-h-0"
        style={{ background: 'var(--c-bg)' }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (canSave) save(); }
        }}
      >
        {content}
      </div>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" />
      <div className="fixed inset-0 flex flex-col md:items-center md:justify-center">
        <DialogPanel
          className="tx-form flex flex-col w-full h-dvh md:h-auto md:max-w-md md:rounded-2xl md:max-h-[92vh] overflow-hidden"
          style={{ background: 'var(--c-bg)' }}
        >
          {content}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Transactions;
