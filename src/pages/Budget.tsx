import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import toast from 'react-hot-toast';
import useBudgetStore, { type DaySummary, type MonthlySummary } from '../store/budgetStore';
import useCategoryStore from '../store/categoryStore';
import useAuthStore from '../store/authStore';
import { formatCurrency } from '../utils/format';
import Amount from '../components/Amount';
import { renderCategoryIcon } from '../utils/categoryIcons';
import api from '../api/axios';

function getCurrentFinancialMonth(startDay: number) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;
  if (startDay > 1 && now.getDate() >= startDay) {
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

function formatMonthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function parseDateStr(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function Budget() {
  const { budget, monthlySummary, isLoading, fetchBudget, upsertBudget, fetchMonthlySummary } = useBudgetStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { user } = useAuthStore();

  const startDay = user?.financialMonthStartDay ?? 1;
  const [selectedMonth, setSelectedMonth] = useState(getCurrentFinancialMonth(startDay));
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [focusedCategoryId, setFocusedCategoryId] = useState<string | null>(null);

  const [overallLimit, setOverallLimit] = useState<string>('');
  const [categoryBudgets, setCategoryBudgets] = useState<{ categoryId: string; limit: string; frequency: 'daily' | 'monthly'; carryForward: boolean }[]>([]);

  const expenseCategories = categories.filter(c => c.type === 'expense');

  useEffect(() => { fetchCategories(); }, [fetchCategories]);
  useEffect(() => { fetchBudget(selectedMonth); fetchMonthlySummary(selectedMonth); }, [selectedMonth, fetchBudget, fetchMonthlySummary]);

  useEffect(() => {
    if (budget) {
      setOverallLimit(budget.overallLimit?.toString() || '');
      setCategoryBudgets(budget.categoryBudgets.map(cb => ({
        categoryId: typeof cb.categoryId === 'string' ? cb.categoryId : cb.categoryId._id,
        limit: cb.limit.toString(),
        frequency: cb.frequency,
        carryForward: cb.carryForward ?? false,
      })));
    } else {
      setOverallLimit('');
      setCategoryBudgets([]);
    }
  }, [budget]);

  const navigateMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const addCategoryBudget = () => setCategoryBudgets(p => [...p, { categoryId: '', limit: '', frequency: 'monthly' as const, carryForward: false }]);
  const removeCategoryBudget = (i: number) => setCategoryBudgets(p => p.filter((_, idx) => idx !== i));
  const updateCategoryBudget = (i: number, field: 'categoryId' | 'limit' | 'frequency', v: string) =>
    setCategoryBudgets(p => p.map((cb, idx) => idx === i ? { ...cb, [field]: v } : cb));
  const toggleCategoryCarryForward = (i: number) =>
    setCategoryBudgets(p => p.map((cb, idx) => idx === i ? { ...cb, carryForward: !cb.carryForward } : cb));

  const handleSave = async () => {
    const payload: any = { month: selectedMonth };
    if (overallLimit) payload.overallLimit = parseFloat(overallLimit);
    const valid = categoryBudgets.filter(cb => cb.categoryId && cb.limit);
    if (valid.length > 0)
      payload.categoryBudgets = valid.map(cb => ({ categoryId: cb.categoryId, limit: parseFloat(cb.limit), frequency: cb.frequency, carryForward: cb.carryForward }));
    try { await upsertBudget(payload); await fetchMonthlySummary(selectedMonth); setShowForm(false); } catch {}
  };

  const handleSetBudgetForCategory = (categoryId: string) => {
    setFocusedCategoryId(categoryId);
  };

  const handleSaveSingleCategory = async (categoryId: string, limit: string, frequency: 'daily' | 'monthly', carryForward: boolean) => {
    const updatedRows = categoryBudgets.some(cb => cb.categoryId === categoryId)
      ? categoryBudgets.map(cb => cb.categoryId === categoryId ? { ...cb, limit, frequency, carryForward } : cb)
      : [...categoryBudgets, { categoryId, limit, frequency, carryForward }];
    const payload: any = { month: selectedMonth };
    if (overallLimit) payload.overallLimit = parseFloat(overallLimit);
    const valid = updatedRows.filter(cb => cb.categoryId && cb.limit);
    if (valid.length > 0)
      payload.categoryBudgets = valid.map(cb => ({ categoryId: cb.categoryId, limit: parseFloat(cb.limit), frequency: cb.frequency, carryForward: cb.carryForward }));
    await upsertBudget(payload);
    await fetchMonthlySummary(selectedMonth);
    setCategoryBudgets(updatedRows);
    setFocusedCategoryId(null);
  };

  const handleSetFromPreviousMonth = async () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    try {
      const { data } = await api.get(`/budgets/${prevMonth}`);
      if (!data.budget) {
        toast.error('No budget found for previous month');
        return;
      }
      setOverallLimit(data.budget.overallLimit?.toString() || '');
      setCategoryBudgets(data.budget.categoryBudgets.map((cb: any) => ({
        categoryId: typeof cb.categoryId === 'string' ? cb.categoryId : cb.categoryId._id,
        limit: cb.limit.toString(),
        frequency: cb.frequency,
        carryForward: cb.carryForward ?? false,
      })));
      setShowForm(true);
    } catch {
      toast.error('No budget found for previous month');
    }
  };

  const periodLabel = monthlySummary && startDay > 1
    ? (() => {
        const first = monthlySummary.days[0];
        const last = monthlySummary.days[monthlySummary.days.length - 1];
        if (!first || !last) return '';
        const s = parseDateStr(first.date);
        const e = parseDateStr(last.date);
        return `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      })()
    : null;

  if (showDetails && monthlySummary) {
    return <DetailedView summary={monthlySummary} month={selectedMonth} onBack={() => setShowDetails(false)} />;
  }

  // Compute budgeted/unbudgeted categories
  const budgetedIds = new Set((monthlySummary?.categorySummary || []).map(c => c.categoryId._id));
  const unbudgetedCategories = expenseCategories.filter(c => !budgetedIds.has(c._id));
  const budgetedCategories = monthlySummary?.categorySummary || [];

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ background: 'var(--c-header-bg)' }}>
        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <button onClick={() => navigateMonth(-1)} className="p-1.5" style={{ color: 'var(--c-muted)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div className="text-center">
            <p className="cred-serif text-lg font-semibold" style={{ color: 'var(--c-text)' }}>{formatMonthLabel(selectedMonth)}</p>
            {periodLabel && <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-muted)' }}>{periodLabel}</p>}
          </div>
          <button onClick={() => navigateMonth(1)} className="p-1.5" style={{ color: 'var(--c-muted)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Budget summary hero */}
        <div className="mt-4 text-center">
          <p className="cred-label">Spent this month</p>
          <p className="cred-serif mt-1 text-4xl font-semibold" style={{ color: 'var(--c-text)' }}>
            {monthlySummary ? <Amount value={monthlySummary.totalSpent} /> : '—'}
          </p>
          <p className="mt-2 text-xs" style={{ color: 'var(--c-muted)' }}>
            of{' '}
            {monthlySummary?.totalBudget ? (
              <Amount value={monthlySummary.totalBudget} className="font-semibold" style={{ color: 'var(--c-text)' }} />
            ) : (
              '—'
            )}{' '}
            budgeted
          </p>
        </div>
      </div>

      {/* ── Action row ────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex gap-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <button onClick={() => setShowForm(true)} className="t-btn-outline flex-1 text-center">
          {budget ? 'Edit Budget' : '+ Set Budget'}
        </button>
        {monthlySummary && (
          <button onClick={() => setShowDetails(true)} className="t-btn-outline flex-1 text-center">
            View Details
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--c-border)', borderTopColor: 'var(--c-accent)' }} />
        </div>
      ) : (
        <>
          {/* ── Overall progress bar ──────────────────────────── */}
          {monthlySummary?.overallLimit && (
            <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
              <div className="flex items-center justify-between mb-1">
                <span className="cred-label">Overall</span>
                <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
                  <Amount value={monthlySummary.totalSpent} /> of <Amount value={monthlySummary.overallLimit} />
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-surface2)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((monthlySummary.totalSpent / monthlySummary.overallLimit) * 100, 100)}%`,
                    background: monthlySummary.totalSpent > monthlySummary.overallLimit ? 'var(--c-expense)' :
                                monthlySummary.totalSpent > monthlySummary.overallLimit * 0.8 ? 'var(--c-warning)' : 'var(--c-income)',
                  }}
                />
              </div>
              {monthlySummary.dailyLimit != null && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--c-muted)' }}>
                  Daily allowance: <Amount value={monthlySummary.dailyLimit} />
                </p>
              )}
            </div>
          )}

          {/* ── Budgeted categories ───────────────────────────── */}
          {budgetedCategories.length > 0 && (
            <div>
              <div className="px-4 pt-4 pb-2">
                <p className="cred-label">Budgeted categories · {formatMonthLabel(selectedMonth)}</p>
              </div>
              {budgetedCategories.map(cat => {
                const isCarryForward = cat.carryForward;
                const pot = cat.pot;

                // For carry-forward: show pot vs limit; for others: spent vs limit
                const displayDenom = isCarryForward ? Math.max(cat.limit, Math.abs(pot ?? 0)) : cat.limit;
                const displayNumer = isCarryForward ? cat.totalSpent : cat.totalSpent;
                const pct = displayDenom > 0 ? Math.min((displayNumer / displayDenom) * 100, 100) : 0;
                const over = isCarryForward ? (pot !== null && pot < 0) : cat.totalSpent > cat.limit;

                return (
                  <div key={cat.categoryId._id} className="cred-divider px-4 py-3">
                    <div className="flex items-center gap-3">
                      {renderCategoryIcon(cat.categoryId.icon, cat.categoryId.name, 40)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{cat.categoryId.name}</p>
                            {isCarryForward && (
                              <span className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: 'rgba(197,142,0,0.12)', color: 'var(--c-warning)' }}>
                                Saving
                              </span>
                            )}
                          </div>
                          <p className="text-xs" style={{ color: over ? 'var(--c-expense)' : 'var(--c-muted)' }}>
                            <Amount value={cat.totalSpent} /> of <Amount value={cat.limit} />
                          </p>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface2)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: over ? 'var(--c-expense)' : pct > 80 ? 'var(--c-warning)' : 'var(--c-income)',
                            }}
                          />
                        </div>
                        {isCarryForward && pot !== null ? (
                          <p className="text-[10px] mt-0.5 font-semibold" style={{ color: over ? 'var(--c-expense)' : 'var(--c-income)' }}>
                            {over ? 'Pot overdrawn by ' : 'Saved up: '}
                            <Amount value={Math.abs(pot)} />
                            {!over && ' available'}
                          </p>
                        ) : cat.frequency === 'daily' && cat.adaptiveDaily !== null ? (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
                            Today's pace: <Amount value={cat.adaptiveDaily} /> / day
                          </p>
                        ) : (
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
                            Monthly budget
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Calendar ──────────────────────────────────────── */}
          {monthlySummary && (
            <div className="px-4 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
              <CalendarGrid days={monthlySummary.days} periodStart={monthlySummary.periodStart} />
            </div>
          )}

          {/* ── Not budgeted this month ───────────────────────── */}
          {unbudgetedCategories.length > 0 && (
            <div>
              <div className="px-4 pt-4 pb-2">
                <p className="cred-label">Not budgeted this month</p>
              </div>
              {unbudgetedCategories.map(cat => (
                <div
                  key={cat._id}
                  className="cred-divider flex items-center gap-3 px-4 py-3"
                >
                  {renderCategoryIcon(cat.icon, cat.name, 40)}
                  <p className="flex-1 text-sm font-medium" style={{ color: 'var(--c-text)' }}>{cat.name}</p>
                  <button
                    onClick={() => handleSetBudgetForCategory(cat._id)}
                    className="t-btn-outline"
                  >
                    SET BUDGET
                  </button>
                </div>
              ))}

              {/* Set from past months */}
              <div className="px-4 py-4">
                <button
                  onClick={handleSetFromPreviousMonth}
                  className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                  style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
                >
                  <span className="text-base leading-none">⊕</span>
                  Set from previous month
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!monthlySummary && (
            <div className="flex flex-col items-center py-16 gap-2 px-4 text-center">
              <span className="text-4xl opacity-30">🎯</span>
              <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>No budget set for this month</p>
              <p className="text-xs" style={{ color: 'var(--c-muted)' }}>
                Set budget limits to track your spending.
              </p>
              <button onClick={() => setShowForm(true)} className="t-btn-primary mt-2">Set Budget</button>
            </div>
          )}
        </>
      )}

      {/* ── Full budget modal ─────────────────────────────────────── */}
      <BudgetModal
        open={showForm}
        onClose={() => setShowForm(false)}
        month={selectedMonth}
        overallLimit={overallLimit}
        setOverallLimit={setOverallLimit}
        categoryBudgets={categoryBudgets}
        expenseCategories={expenseCategories}
        onAdd={addCategoryBudget}
        onRemove={removeCategoryBudget}
        onUpdate={updateCategoryBudget}
        onToggleCarryForward={toggleCategoryCarryForward}
        onSave={handleSave}
      />

      {/* ── Single-category modal ─────────────────────────────────── */}
      {focusedCategoryId && (() => {
        const cat = expenseCategories.find(c => c._id === focusedCategoryId);
        const existing = categoryBudgets.find(cb => cb.categoryId === focusedCategoryId);
        if (!cat) return null;
        return (
          <SingleCategoryModal
            open
            category={cat}
            initialLimit={existing?.limit ?? ''}
            initialFrequency={existing?.frequency ?? 'monthly'}
            initialCarryForward={existing?.carryForward ?? false}
            onClose={() => setFocusedCategoryId(null)}
            onSave={(limit, freq, cf) => handleSaveSingleCategory(focusedCategoryId, limit, freq, cf)}
          />
        );
      })()}
    </div>
  );
}

// ── Budget modal ──────────────────────────────────────────────────────
interface CatBudgetRow { categoryId: string; limit: string; frequency: 'daily' | 'monthly'; carryForward: boolean }

function BudgetModal({
  open, onClose, month,
  overallLimit, setOverallLimit,
  categoryBudgets, expenseCategories,
  onAdd, onRemove, onUpdate, onToggleCarryForward, onSave,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  overallLimit: string;
  setOverallLimit: (v: string) => void;
  categoryBudgets: CatBudgetRow[];
  expenseCategories: { _id: string; name: string; icon: string }[];
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: 'categoryId' | 'limit' | 'frequency', v: string) => void;
  onToggleCarryForward: (i: number) => void;
  onSave: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <DialogPanel
          className="flex flex-col w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'var(--c-surface)', maxHeight: '85dvh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <DialogTitle className="text-base font-bold" style={{ color: 'var(--c-text)' }}>
              Budget · {formatMonthLabel(month)}
            </DialogTitle>
            <button
              onClick={onClose}
              className="p-1 rounded-lg"
              style={{ color: 'var(--c-muted)' }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 min-h-0">
            {/* Overall limit */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-muted)' }}>
                Overall Monthly Budget
              </label>
              <input
                type="number"
                value={overallLimit}
                onChange={e => setOverallLimit(e.target.value)}
                onWheel={e => e.currentTarget.blur()}
                className="t-input"
                placeholder="e.g. 15000"
              />
            </div>

            {/* Category budgets */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                  Category Budgets
                </label>
                <button
                  onClick={onAdd}
                  className="text-xs font-bold px-3 py-1 rounded-lg"
                  style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}
                >
                  + Add
                </button>
              </div>

              {categoryBudgets.length === 0 && (
                <p className="text-xs text-center py-3" style={{ color: 'var(--c-muted)' }}>
                  No category budgets added yet
                </p>
              )}

              <div className="space-y-3">
                {categoryBudgets.map((cb, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-4 space-y-3"
                    style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}
                  >
                    {/* Category row */}
                    <div className="flex items-center gap-2">
                      <select
                        value={cb.categoryId}
                        onChange={e => onUpdate(i, 'categoryId', e.target.value)}
                        className="t-select flex-1 font-medium"
                      >
                        <option value="">Select category</option>
                        {expenseCategories.map(c => (
                          <option key={c._id} value={c._id}>{c.icon} {c.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => onRemove(i)}
                        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg font-bold text-base"
                        style={{ background: 'rgba(224,88,80,0.12)', color: 'var(--c-expense)' }}
                      >
                        ×
                      </button>
                    </div>

                    {/* Limit */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>
                        Budget Limit
                      </label>
                      <input
                        type="number"
                        value={cb.limit}
                        onChange={e => onUpdate(i, 'limit', e.target.value)}
                        onWheel={e => e.currentTarget.blur()}
                        className="t-input"
                        placeholder="e.g. 5000"
                      />
                    </div>

                    {/* Frequency pills */}
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--c-muted)' }}>
                        Frequency
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(['monthly', 'daily'] as const).map(f => (
                          <button
                            key={f}
                            onClick={() => onUpdate(i, 'frequency', f)}
                            className="py-2 rounded-lg text-sm font-semibold capitalize transition-all"
                            style={{
                              background: cb.frequency === f ? 'var(--c-accent)' : 'var(--c-surface)',
                              color: cb.frequency === f ? 'var(--c-accent-fg)' : 'var(--c-muted)',
                              border: cb.frequency === f ? 'none' : '1px solid var(--c-border)',
                            }}
                          >
                            {f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Carry-forward toggle (monthly only) */}
                    {cb.frequency === 'monthly' && (
                      <button
                        onClick={() => onToggleCarryForward(i)}
                        className="flex items-center justify-between w-full py-2 px-3 rounded-lg transition-all"
                        style={{
                          background: cb.carryForward ? 'rgba(201,167,47,0.12)' : 'var(--c-bg)',
                          border: `1px solid ${cb.carryForward ? 'rgba(201,167,47,0.4)' : 'var(--c-border)'}`,
                        }}
                      >
                        <div className="text-left">
                          <p className="text-xs font-semibold" style={{ color: cb.carryForward ? 'var(--c-accent)' : 'var(--c-muted)' }}>
                            Save &amp; carry forward
                          </p>
                          <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
                            Unspent budget rolls over each month
                          </p>
                        </div>
                        <div
                          className="w-9 h-5 rounded-full flex-shrink-0 transition-all relative"
                          style={{ background: cb.carryForward ? 'var(--c-accent)' : 'var(--c-surface2)' }}
                        >
                          <div
                            className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                            style={{
                              background: 'white',
                              left: cb.carryForward ? '18px' : '2px',
                            }}
                          />
                        </div>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-5 py-4" style={{ borderTop: '1px solid var(--c-border)' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              className="t-btn-primary w-full"
            >
              {saving ? 'Saving…' : 'Save Budget'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// ── Single-category budget modal ──────────────────────────────────────
function SingleCategoryModal({
  open, category, initialLimit, initialFrequency, initialCarryForward, onClose, onSave,
}: {
  open: boolean;
  category: { _id: string; name: string; icon: string };
  initialLimit: string;
  initialFrequency: 'daily' | 'monthly';
  initialCarryForward: boolean;
  onClose: () => void;
  onSave: (limit: string, frequency: 'daily' | 'monthly', carryForward: boolean) => Promise<void>;
}) {
  const [limit, setLimit] = useState(initialLimit);
  const [frequency, setFrequency] = useState<'daily' | 'monthly'>(initialFrequency);
  const [carryForward, setCarryForward] = useState(initialCarryForward);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setLimit(initialLimit); setFrequency(initialFrequency); setCarryForward(initialCarryForward); }
  }, [open, initialLimit, initialFrequency, initialCarryForward]);

  const handleSave = async () => {
    if (!limit) return;
    setSaving(true);
    try { await onSave(limit, frequency, carryForward); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <DialogPanel
          className="flex flex-col w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'var(--c-surface)', maxHeight: '90dvh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                {renderCategoryIcon(category.icon, category.name, 28)}
                <DialogTitle className="text-base font-bold" style={{ color: 'var(--c-text)' }}>
                  {category.name}
                </DialogTitle>
              </div>
            </div>
            <button onClick={onClose} className="p-1" style={{ color: 'var(--c-muted)' }}>
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-muted)' }}>
                Budget Limit
              </label>
              <input
                type="number"
                value={limit}
                onChange={e => setLimit(e.target.value)}
                onWheel={e => e.currentTarget.blur()}
                className="t-input"
                placeholder="e.g. 5000"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-muted)' }}>
                Frequency
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['monthly', 'daily'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFrequency(f)}
                    className="py-2.5 rounded-xl text-sm font-semibold capitalize transition-all"
                    style={{
                      background: frequency === f ? 'var(--c-accent)' : 'var(--c-bg)',
                      color: frequency === f ? 'var(--c-accent-fg)' : 'var(--c-muted)',
                      border: frequency === f ? 'none' : '1px solid var(--c-border)',
                    }}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Carry-forward toggle (monthly only) */}
            {frequency === 'monthly' && (
              <button
                onClick={() => setCarryForward(v => !v)}
                className="flex items-center justify-between w-full py-3 px-3 rounded-xl transition-all"
                style={{
                  background: carryForward ? 'rgba(201,167,47,0.12)' : 'var(--c-bg)',
                  border: `1px solid ${carryForward ? 'rgba(201,167,47,0.4)' : 'var(--c-border)'}`,
                }}
              >
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: carryForward ? 'var(--c-accent)' : 'var(--c-text)' }}>
                    Save &amp; carry forward
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                    Unspent budget rolls over — builds up for big purchases
                  </p>
                </div>
                <div
                  className="w-10 h-5 rounded-full flex-shrink-0 ml-3 relative transition-all"
                  style={{ background: carryForward ? 'var(--c-accent)' : 'var(--c-surface2)' }}
                >
                  <div
                    className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                    style={{ background: 'white', left: carryForward ? '22px' : '2px' }}
                  />
                </div>
              </button>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 pb-6 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || !limit}
              className="t-btn-primary w-full"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// ── Calendar grid ─────────────────────────────────────────────────────
function CalendarGrid({ days, periodStart }: { days: DaySummary[]; periodStart: string }) {
  const startDate = parseDateStr(periodStart);
  const firstDayOfWeek = startDate.getDay();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)' }}>
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--c-muted)' }}>Daily Spending</p>
      <div className="flex justify-center">
        <div className="inline-grid grid-cols-7 gap-1">
          {weekDays.map((d, i) => (
            <div key={i} className="flex h-5 w-5 items-center justify-center text-[9px] font-medium" style={{ color: 'var(--c-muted)' }}>{d}</div>
          ))}
          {blanks.map(b => <div key={`b-${b}`} className="h-5 w-5" />)}
          {days.map(day => {
            const isToday = day.date === todayStr;
            const isPast = day.date <= todayStr;
            const isFuture = day.date > todayStr;
            const hasSpending = day.spent > 0;
            const hasBudget = day.dailyLimit !== null;
            let bg = 'var(--c-surface2)';
            if (!isFuture && hasBudget) {
              if (hasSpending && day.isOver) bg = 'var(--c-expense)';
              else if (hasSpending) bg = 'var(--c-income)';
            }
            const showCross = isPast && !isFuture && hasBudget && !hasSpending;
            const dayDate = parseDateStr(day.date);
            return (
              <div
                key={day.date}
                title={`${dayDate.getDate()}: ${hasSpending ? formatCurrency(day.spent) : 'No spending'}`}
                className="relative h-5 w-5 rounded-sm"
                style={{ background: bg, outline: isToday ? '1.5px solid var(--c-accent)' : undefined, outlineOffset: '1px' }}
              >
                {showCross && (
                  <svg className="absolute inset-0 h-full w-full" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round">
                    <line x1="4" y1="4" x2="12" y2="12" /><line x1="12" y1="4" x2="4" y2="12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px]" style={{ color: 'var(--c-muted)' }}>
        {[['var(--c-income)', 'Under'], ['var(--c-expense)', 'Over'], ['var(--c-surface2)', 'Future']].map(([color, label]) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Detailed view ─────────────────────────────────────────────────────
function DetailedView({ summary, month, onBack }: { summary: MonthlySummary; month: string; onBack: () => void }) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3" style={{ background: 'var(--c-header-bg)' }}>
        <button onClick={onBack} className="p-1.5" style={{ color: 'var(--c-muted)' }}>
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <p className="cred-serif text-lg font-semibold" style={{ color: 'var(--c-text)' }}>Daily Breakdown</p>
          <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{formatMonthLabel(month)}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        {[
          ['Budget', summary.totalBudget, 'var(--c-text)'],
          ['Spent', summary.totalSpent, 'var(--c-expense)'],
          ['Daily', summary.dailyLimit, 'var(--c-text)'],
        ].map(([label, value, color]) => (
          <div key={label as string} className="text-center rounded-xl p-3" style={{ background: 'var(--c-surface)' }}>
            <p className="cred-label">{label}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: color as string }}>
              {value ? <Amount value={value as number} /> : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Day-by-day */}
      <div>
        {summary.days.map(day => {
          const date = parseDateStr(day.date);
          const isPast = day.date <= todayStr;
          const isFuture = day.date > todayStr;
          const isToday = day.date === todayStr;
          const diff = day.dailyLimit !== null ? day.dailyLimit - day.spent : null;
          return (
            <div
              key={day.date}
              className="cred-divider flex items-center px-4 py-3 gap-3"
              style={{
                opacity: isFuture ? 0.4 : 1,
                background: isToday ? 'var(--c-surface2)' : undefined,
              }}
            >
              <div className="w-10 text-center">
                <p className="text-base font-bold" style={{ color: 'var(--c-text)' }}>{date.getDate()}</p>
                <p className="text-[10px]" style={{ color: 'var(--c-muted)' }}>
                  {date.toLocaleDateString('en-IN', { weekday: 'short' })}
                </p>
              </div>
              <div className="flex-1">
                {isPast && day.spent > 0 ? (
                  <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}><Amount value={day.spent} /></p>
                ) : isPast ? (
                  <p className="text-sm" style={{ color: 'var(--c-muted)' }}>No spending</p>
                ) : null}
                {day.dailyLimit != null && (
                  <p className="text-[10px]" style={{ color: 'var(--c-muted)' }}>Limit: <Amount value={day.dailyLimit} /></p>
                )}
              </div>
              {diff !== null && isPast && (
                <span
                  className="text-xs font-semibold rounded-full px-2 py-0.5"
                  style={{
                    background: diff >= 0 ? 'rgba(88,182,120,0.15)' : 'rgba(224,88,80,0.15)',
                    color: diff >= 0 ? 'var(--c-income)' : 'var(--c-expense)',
                  }}
                >
                  <Amount value={Math.abs(diff)} prefix={diff >= 0 ? '+' : '−'} />
                </span>
              )}
              {isToday && (
                <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}>
                  Today
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Budget;
