import { useEffect, useState, useCallback, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react';
import useTransactionStore, { type Transaction } from '../store/transactionStore';
import useCategoryStore from '../store/categoryStore';
import useAccountStore from '../store/accountStore';
import useFriendStore, { type Friend } from '../store/friendStore';
import useBudgetStore, { precheckBudget } from '../store/budgetStore';
import { formatCurrency } from '../utils/format';
import { renderCategoryIcon } from '../utils/categoryIcons';

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
  value, onChange, className,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
}) {
  const fmt = (n: number) => (n ? String(Math.round(n * 100) / 100) : '0');
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
    if (v === '') v = '0';
    setText(v);
    onChange(parseFloat(v) || 0);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onFocus={(e) => {
        setFocused(true);
        const end = e.target.value.length;
        requestAnimationFrame(() => e.target.setSelectionRange(end, end));
      }}
      onBlur={() => setFocused(false)}
      className={className}
    />
  );
}

// ── Category select with icons ──────────────────────────────────────────
function CategorySelect({
  categories, value, onChange,
}: {
  categories: { _id: string; name: string; icon: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const selected = categories.find(c => c._id === value);
  return (
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <ListboxButton
          className="t-select w-full"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              {renderCategoryIcon(selected.icon, selected.name, 22)}
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span style={{ color: 'var(--c-muted)' }}>Select</span>
          )}
          <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          className="z-50 mt-1 w-[var(--button-width)] rounded-lg p-1 max-h-60 overflow-auto"
          style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)' }}
        >
          {categories.map(c => (
            <ListboxOption key={c._id} value={c._id}>
              {({ focus, selected }) => (
                <div
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm cursor-pointer"
                  style={{ background: focus ? 'var(--c-surface)' : 'transparent', color: 'var(--c-text)', fontWeight: selected ? 600 : 400 }}
                >
                  {renderCategoryIcon(c.icon, c.name, 22)}
                  <span className="truncate">{c.name}</span>
                </div>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}

// ── Main page ─────────────────────────────────────────────────────────
function Transactions() {
  const {
    transactions, pagination, isLoading,
    fetchTransactions, createTransaction, updateTransaction, deleteTransaction,
  } = useTransactionStore();
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
  const [showFilter, setShowFilter] = useState(false);

  // Filters (accessible via filter panel)
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [accountFilter, setAccountFilter] = useState('');

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

  // Derive dateFrom / dateTo from viewYear + viewMonth
  const dateFrom = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
  const dateTo = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const load = useCallback(
    (page?: number) => {
      fetchTransactions({
        dateFrom,
        dateTo,
        type: typeFilter || undefined,
        categoryId: categoryFilter || undefined,
        accountId: accountFilter || undefined,
        page,
      });
    },
    [fetchTransactions, dateFrom, dateTo, typeFilter, categoryFilter, accountFilter]
  );

  useEffect(() => { load(1); }, [load]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  // ── Derived data ─────────────────────────────────────────────────
  const { totalExpense, totalIncome } = useMemo(() => {
    let e = 0, i = 0;
    for (const tx of transactions) {
      if (tx.type === 'expense') e += tx.amount;
      else if (tx.type === 'income') i += tx.amount;
    }
    return { totalExpense: e, totalIncome: i };
  }, [transactions]);
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
      setDetailTx(null);
    }
  };

  const handleCloseCreate = () => {
    setShowCreate(false);
    if (returnToDash) { setReturnToDash(false); navigate('/dashboard'); }
  };

  const activeAccounts = accounts.filter(a => a.isActive);

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-10 px-4 pt-4 pb-3"
        style={{ background: 'var(--c-header-bg)' }}
      >
        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-1.5" style={{ color: 'var(--c-muted)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <span className="text-base font-semibold" style={{ color: 'var(--c-text)' }}>
            {MONTHS[viewMonth]}, {viewYear}
          </span>
          <div className="flex items-center gap-2">
            <button onClick={nextMonth} className="p-1.5" style={{ color: 'var(--c-muted)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <button onClick={() => setShowFilter(v => !v)} className="p-1.5" style={{ color: showFilter ? 'var(--c-accent)' : 'var(--c-muted)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="12" y1="18" x2="12" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary row */}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-muted)' }}>Expense</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-expense)' }}>
              {formatCurrency(totalExpense)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-muted)' }}>Income</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-income)' }}>
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-muted)' }}>Total</p>
            <p
              className="text-sm font-bold mt-0.5"
              style={{ color: totalNet >= 0 ? 'var(--c-income)' : 'var(--c-expense)' }}
            >
              {totalNet >= 0 ? '+' : ''}{formatCurrency(totalNet)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Filter panel ──────────────────────────────────────────── */}
      {showFilter && (
        <div className="px-4 py-3 space-y-2" style={{ background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
          <div className="grid grid-cols-3 gap-2">
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="t-select text-xs">
              <option value="">All types</option>
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="t-select text-xs">
              <option value="">All categories</option>
              {categories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
            </select>
            <select value={accountFilter} onChange={e => setAccountFilter(e.target.value)} className="t-select text-xs">
              <option value="">All accounts</option>
              {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
            </select>
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
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>No transactions this month</p>
          </div>
        ) : (
          sortedDates.map(dateKey => (
            <div key={dateKey}>
              {/* Date header */}
              <div
                className="px-4 py-2 flex items-center gap-3"
                style={{ borderBottom: '1px solid var(--c-border)' }}
              >
                <span className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
                  {groupDate(dateKey)}
                </span>
                <div className="flex-1 h-px" style={{ background: 'var(--c-border)' }} />
              </div>
              {/* Rows */}
              {grouped[dateKey].map((tx, idx) => {
                const isSplit = tx.personalShare != null && tx.personalShare !== tx.amount;
                return (
                <button
                  key={tx._id}
                  onClick={() => setDetailTx(tx)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                  style={{
                    borderBottom: idx < grouped[dateKey].length - 1 ? '1px solid var(--c-border)' : undefined,
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
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>
                      {tx.type === 'transfer' ? 'Transfer' : tx.categoryId?.name || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      {tx.accountId ? (
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
                          Debt
                        </span>
                      )}
                      {isSplit && (
                        <span
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: 'rgba(80,128,192,0.18)', color: '#5080c0' }}
                        >
                          ✂ Split
                        </span>
                      )}
                      {tx.note && (
                        <span className="text-[10px] truncate" style={{ color: 'var(--c-muted)' }}>
                          · {tx.note}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Amount */}
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: tx.type === 'income' ? 'var(--c-income)'
                             : tx.type === 'expense' ? 'var(--c-expense)'
                             : 'var(--c-muted)',
                      }}
                    >
                      {tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}
                      {formatCurrency(isSplit ? tx.personalShare! : tx.amount)}
                    </span>
                    {isSplit && (
                      <span className="text-[10px]" style={{ color: 'var(--c-muted)' }}>
                        your share · of {formatCurrency(tx.amount)}
                      </span>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          ))
        )}

        {/* Pagination (load more) */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-3 py-4">
            <button
              onClick={() => load(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="t-btn-outline disabled:opacity-40"
            >
              ← Prev
            </button>
            <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
              {pagination.page} / {pagination.pages}
            </span>
            <button
              onClick={() => load(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="t-btn-outline disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </div>

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
            <DialogPanel className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl">
              {/* Colored header */}
              <div
                className="px-4 pt-4 pb-8 relative"
                style={{ backgroundColor: DETAIL_HEADER_COLOR[detailTx.type] || '#888' }}
              >
                <div className="flex items-center justify-between">
                  <button onClick={() => setDetailTx(null)} className="text-white/80 hover:text-white p-1">
                    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDelete(detailTx._id)}
                      className="text-white/80 hover:text-white p-1"
                    >
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6m4-6v6" /><path d="M9 6V4h6v2" />
                      </svg>
                    </button>
                    {detailTx.type !== 'transfer' && (
                      <button
                        onClick={() => { setEditingTx(detailTx); setDetailTx(null); }}
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
                    {detailTx.type}
                  </p>
                  <p className="text-4xl font-bold text-white mt-1">
                    {detailTx.type === 'expense' ? '-' : detailTx.type === 'income' ? '+' : ''}
                    {formatCurrency(
                      detailTx.personalShare != null && detailTx.personalShare !== detailTx.amount
                        ? detailTx.personalShare
                        : detailTx.amount
                    )}
                  </p>
                  {detailTx.personalShare != null && detailTx.personalShare !== detailTx.amount && (
                    <p className="text-xs text-white/80 mt-1">
                      ✂ your share · total {formatCurrency(detailTx.amount)}
                    </p>
                  )}
                  <p className="text-xs text-white/70 mt-2">{fmtDateTime(detailTx.date)}</p>
                </div>
              </div>
              {/* Details */}
              <div className="p-4 space-y-3" style={{ background: 'var(--c-surface)' }}>
                {detailTx.accountId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--c-muted)' }}>
                      {detailTx.type === 'transfer' ? 'From' : 'Account'}
                    </span>
                    <span
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                      style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
                    >
                      <span className="text-sm">💳</span>
                      <span className="text-sm font-medium">{detailTx.accountId.name}</span>
                    </span>
                  </div>
                )}
                {detailTx.type === 'transfer' && detailTx.toAccountId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--c-muted)' }}>To</span>
                    <span
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                      style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
                    >
                      <span className="text-sm">💳</span>
                      <span className="text-sm font-medium">{detailTx.toAccountId.name}</span>
                    </span>
                  </div>
                )}
                {detailTx.categoryId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm" style={{ color: 'var(--c-muted)' }}>Category</span>
                    <span
                      className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                      style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}
                    >
                      <span className="text-sm">{detailTx.categoryId.icon}</span>
                      <span className="text-sm font-medium">{detailTx.categoryId.name}</span>
                    </span>
                  </div>
                )}
                {detailTx.split && detailTx.split.splits.length > 0 && (
                  <div className="pt-1">
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--c-muted)' }}>Split details</p>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--c-text)' }}>
                          You{detailTx.split.paidBy === 'user' ? ' (paid)' : ''}
                        </span>
                        <span style={{ color: 'var(--c-text)' }}>
                          {formatCurrency(detailTx.amount - detailTx.split.splits.reduce((s, x) => s + x.amount, 0))}
                        </span>
                      </div>
                      {detailTx.split.splits.map((s, i) => {
                        const name = typeof s.friendId === 'string' ? s.friendId : s.friendId.name;
                        const fid = typeof s.friendId === 'string' ? s.friendId : s.friendId._id;
                        const paid = detailTx.split!.paidBy === fid;
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
                {detailTx.note && (
                  <p className="text-sm text-center py-2" style={{ color: 'var(--c-muted)' }}>
                    {detailTx.note}
                  </p>
                )}
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}

      {/* ── Create modal ──────────────────────────────────────────── */}
      <TransactionModal
        open={showCreate}
        onClose={handleCloseCreate}
        onSubmit={createTransaction}
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
          onSubmit={(data) => updateTransaction(editingTx._id, data)}
          categories={categories}
          accounts={activeAccounts}
          friends={friends}
          transaction={editingTx}
        />
      )}
    </div>
  );
}

// ── Transaction modal ─────────────────────────────────────────────────
function Numpad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
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
        className="flex items-center justify-between px-4 py-3 rounded-xl mb-2"
        style={{ background: 'var(--c-surface)' }}
      >
        <div className="flex items-baseline gap-1">
          {op && <span className="text-sm" style={{ color: 'var(--c-accent)' }}>{op}</span>}
          <span className="text-3xl font-bold" style={{ color: 'var(--c-text)' }}>{value}</span>
        </div>
        <button onClick={handleDel} style={{ color: 'var(--c-muted)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
            <line x1="18" y1="9" x2="12" y2="15" /><line x1="12" y1="9" x2="18" y2="15" />
          </svg>
        </button>
      </div>

      {/* Grid: operators left, digits right */}
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
    </div>
  );
}

function TransactionModal({
  open, onClose, onSubmit, categories, accounts, friends, transaction, initialType,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  categories: { _id: string; name: string; type: string; icon: string }[];
  accounts: { _id: string; name: string }[];
  friends: Friend[];
  transaction?: Transaction;
  initialType?: 'income' | 'expense';
}) {
  const isEdit = !!transaction;
  const [amountStr, setAmountStr] = useState('0');

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } =
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
            date: new Date().toISOString().slice(0, 10),
            note: '',
          },
    });

  const selectedType = watch('type');
  const selectedCategoryId = watch('categoryId');
  const totalAmount = watch('amount');
  const filteredCategories = categories.filter(c => c.type === selectedType);

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
    if (!isEdit && accounts.length > 0) {
      const icici = accounts.find(a => a.name.toUpperCase().includes('ICICI'));
      if (icici) setValue('accountId', icici._id);
    }
  }, [isEdit, accounts, setValue]);

  const [whoPaid, setWhoPaid] = useState<'user' | string>('user');
  const [isSplit, setIsSplit] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});

  // Prefill split state when editing a transaction that was split.
  useEffect(() => {
    if (!open) return;
    const split = transaction?.split;
    if (split && split.splits.length > 0) {
      const idOf = (f: { _id: string } | string) => typeof f === 'string' ? f : f._id;
      setIsSplit(true);
      setWhoPaid(split.paidBy ?? 'user');
      setSelectedFriends(split.splits.map(s => idOf(s.friendId)));
      setSplitAmounts(Object.fromEntries(split.splits.map(s => [idOf(s.friendId), s.amount])));
    } else {
      setIsSplit(false);
      setWhoPaid('user');
      setSelectedFriends([]);
      setSplitAmounts({});
    }
  }, [transaction, open]);

  const hasFriends = friends.length > 0;
  const showFriendFlow = hasFriends && selectedType === 'expense';
  const friendPaid = whoPaid !== 'user';
  const participantCount = selectedFriends.length + 1;
  const equalShare = participantCount > 0 ? (totalAmount || 0) / participantCount : 0;

  // Only the user's own share counts toward the budget when the expense is split.
  const myShare = (showFriendFlow && isSplit && selectedFriends.length > 0)
    ? totalAmount - selectedFriends.reduce((s, id) => s + (splitAmounts[id] ?? equalShare), 0)
    : totalAmount;

  // Editing "You" redistributes the remainder across the selected friends
  // (evenly if there are several), keeping the total in sync either way.
  const handleUserShareChange = (v: number) => {
    if (selectedFriends.length === 0) return;
    const remainder = (totalAmount || 0) - v;
    const each = remainder / selectedFriends.length;
    setSplitAmounts(Object.fromEntries(selectedFriends.map(id => [id, each])));
  };

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

  const toggleFriend = (id: string) =>
    setSelectedFriends(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const handleFormSubmit = async (data: TransactionFormData) => {
    try {
      const payload: any = { type: data.type, amount: data.amount, categoryId: data.categoryId, date: data.date, note: data.note };
      if (friendPaid) payload.paidByFriendId = whoPaid;
      else payload.accountId = data.accountId;
      if (showFriendFlow && isSplit && selectedFriends.length > 0)
        payload.splits = selectedFriends.map(id => ({ friendId: id, amount: Math.round((splitAmounts[id] ?? equalShare) * 100) / 100 }));
      await onSubmit(payload);
      reset(); setWhoPaid('user'); setIsSplit(false); setSelectedFriends([]); setSplitAmounts({}); setAmountStr('0');
      onClose();
    } catch { /* handled by store */ }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50" />
      <div className="fixed inset-0 flex flex-col md:items-center md:justify-center">
        <DialogPanel
          className="flex flex-col w-full h-dvh md:h-auto md:max-w-md md:rounded-2xl md:max-h-[92vh] overflow-hidden"
          style={{ background: 'var(--c-bg)' }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <button onClick={onClose} className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--c-expense)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              CANCEL
            </button>
            {/* Type tabs */}
            <div className="flex gap-1 text-xs font-bold tracking-wider">
              {(['income', 'expense'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setValue('type', t); setValue('categoryId', ''); }}
                  className="px-3 py-1 rounded-full transition-colors"
                  style={{
                    background: selectedType === t ? 'var(--c-accent)' : 'transparent',
                    color: selectedType === t ? 'var(--c-accent-fg)' : 'var(--c-muted)',
                  }}
                >
                  {t === 'income' ? 'INCOME' : 'EXPENSE'}
                </button>
              ))}
            </div>
            <button
              onClick={handleSubmit(handleFormSubmit)}
              disabled={isSubmitting}
              className="text-sm font-semibold flex items-center gap-1"
              style={{ color: 'var(--c-income)' }}
            >
              SAVE
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable form body */}
          <div className="flex-1 overflow-y-auto px-4 pt-3 space-y-3 pb-4 min-h-0">
            {/* Account + Category */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Account</label>
                {!friendPaid ? (
                  <select {...register('accountId')} className="t-select">
                    {accounts.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                  </select>
                ) : (
                  <div className="t-input opacity-50">Friend paid</div>
                )}
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Category</label>
                <CategorySelect
                  categories={filteredCategories}
                  value={selectedCategoryId}
                  onChange={(id) => setValue('categoryId', id, { shouldValidate: true })}
                />
                {errors.categoryId && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.categoryId.message}</p>}
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Date</label>
              <input type="date" {...register('date')} className="t-input" />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Notes</label>
              <textarea
                {...register('note')}
                rows={2}
                placeholder="Add a note..."
                className="t-input resize-none"
              />
            </div>

            {/* Budget warning */}
            {budgetWarning && (
              <div className="rounded-lg p-3" style={{ background: 'rgba(201,167,47,0.12)', border: '1px solid rgba(201,167,47,0.3)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--c-accent)' }}>⚠ Budget alert</p>
                {budgetWarning.map((w, i) => <p key={i} className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>{w}</p>)}
              </div>
            )}

            {/* Friend flow */}
            {showFriendFlow && (
              <>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Who paid?</label>
                  <select value={whoPaid} onChange={e => setWhoPaid(e.target.value)} className="t-select">
                    <option value="user">You</option>
                    {friends.map(f => <option key={f._id} value={f._id}>{f.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>Split?</label>
                  <div className="flex gap-2">
                    {[false, true].map(v => (
                      <button key={String(v)} type="button" onClick={() => { setIsSplit(v); if (v && friends.length === 1 && selectedFriends.length === 0) setSelectedFriends([friends[0]._id]); }}
                        className="flex-1 rounded-lg py-2 text-xs font-semibold"
                        style={{ background: isSplit === v ? 'var(--c-accent)' : 'var(--c-surface2)', color: isSplit === v ? 'var(--c-accent-fg)' : 'var(--c-muted)' }}>
                        {v ? 'Yes' : 'No'}
                      </button>
                    ))}
                  </div>
                </div>
                {isSplit && (
                  <div className="rounded-lg p-3 space-y-2" style={{ background: 'var(--c-surface)' }}>
                    {friends.map(f => (
                      <label key={f._id} className="flex items-center gap-2">
                        <input type="checkbox" checked={selectedFriends.includes(f._id)} onChange={() => toggleFriend(f._id)} className="rounded" />
                        <span className="text-sm flex-1" style={{ color: 'var(--c-text)' }}>{f.name}</span>
                      </label>
                    ))}
                    {selectedFriends.length > 0 && (totalAmount || 0) > 0 && (
                      <div className="mt-2 pt-2 space-y-1" style={{ borderTop: '1px solid var(--c-border)' }}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs" style={{ color: 'var(--c-muted)' }}>You</span>
                          <CalcAmountInput
                            value={totalAmount - selectedFriends.reduce((s, id) => s + (splitAmounts[id] ?? equalShare), 0)}
                            onChange={handleUserShareChange}
                            className="t-input w-24 text-right text-xs py-1"
                          />
                        </div>
                        {selectedFriends.map(id => {
                          const f = friends.find(x => x._id === id);
                          return (
                            <div key={id} className="flex items-center justify-between gap-2">
                              <span className="text-xs" style={{ color: 'var(--c-muted)' }}>{f?.name}</span>
                              <CalcAmountInput
                                value={splitAmounts[id] ?? Math.round(equalShare * 100) / 100}
                                onChange={(v) => setSplitAmounts(p => ({ ...p, [id]: v }))}
                                className="t-input w-24 text-right text-xs py-1"
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

          </div>

          {/* Numpad — pinned to bottom */}
          <div className="flex-shrink-0 px-4 pb-4 pt-2" style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-bg)' }}>
            {errors.amount && <p className="text-xs text-center mb-1" style={{ color: 'var(--c-expense)' }}>{errors.amount.message}</p>}
            <Numpad value={amountStr} onChange={setAmountStr} />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Transactions;
