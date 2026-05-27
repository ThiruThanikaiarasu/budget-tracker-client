import { useEffect, useState } from 'react';
import useBudgetStore, { type DaySummary, type MonthlySummary } from '../store/budgetStore';
import useCategoryStore from '../store/categoryStore';
import useAuthStore from '../store/authStore';
import { formatCurrency } from '../utils/format';

const CAT_COLORS = [
  '#e05850','#e07830','#c9a030','#50a860','#4090c8',
  '#8060c0','#d04080','#30a0a0','#805040','#4060a0',
];
function catColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return CAT_COLORS[Math.abs(h) % CAT_COLORS.length];
}

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

  const [overallLimit, setOverallLimit] = useState<string>('');
  const [categoryBudgets, setCategoryBudgets] = useState<{ categoryId: string; limit: string; frequency: 'daily' | 'monthly' }[]>([]);

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

  const addCategoryBudget = () => setCategoryBudgets(p => [...p, { categoryId: '', limit: '', frequency: 'monthly' as const }]);
  const removeCategoryBudget = (i: number) => setCategoryBudgets(p => p.filter((_, idx) => idx !== i));
  const updateCategoryBudget = (i: number, field: 'categoryId' | 'limit' | 'frequency', v: string) =>
    setCategoryBudgets(p => p.map((cb, idx) => idx === i ? { ...cb, [field]: v } : cb));

  const handleSave = async () => {
    const payload: any = { month: selectedMonth };
    if (overallLimit) payload.overallLimit = parseFloat(overallLimit);
    const valid = categoryBudgets.filter(cb => cb.categoryId && cb.limit);
    if (valid.length > 0)
      payload.categoryBudgets = valid.map(cb => ({ categoryId: cb.categoryId, limit: parseFloat(cb.limit), frequency: cb.frequency }));
    try { await upsertBudget(payload); await fetchMonthlySummary(selectedMonth); setShowForm(false); } catch {}
  };

  const handleSetBudgetForCategory = (categoryId: string) => {
    if (!categoryBudgets.find(cb => cb.categoryId === categoryId))
      setCategoryBudgets(p => [...p, { categoryId, limit: '', frequency: 'monthly' }]);
    setShowForm(true);
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
            <p className="text-base font-semibold" style={{ color: 'var(--c-text)' }}>{formatMonthLabel(selectedMonth)}</p>
            {periodLabel && <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-muted)' }}>{periodLabel}</p>}
          </div>
          <button onClick={() => navigateMonth(1)} className="p-1.5" style={{ color: 'var(--c-muted)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>

        {/* Budget summary */}
        <div className="mt-3 grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-muted)' }}>Total Budget</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-text)' }}>
              {monthlySummary?.overallLimit ? formatCurrency(monthlySummary.overallLimit) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--c-muted)' }}>Total Spent</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-expense)' }}>
              {monthlySummary ? formatCurrency(monthlySummary.totalSpent) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Action row ────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex gap-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <button
          onClick={() => setShowForm(!showForm)}
          className="t-btn-outline flex-1 text-center"
        >
          {showForm ? '× Cancel' : budget ? 'Edit Budget' : '+ Set Budget'}
        </button>
        {monthlySummary && (
          <button onClick={() => setShowDetails(true)} className="t-btn-outline flex-1 text-center">
            View Details
          </button>
        )}
      </div>

      {/* ── Edit Form ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="px-4 py-4 space-y-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
            Budget for {formatMonthLabel(selectedMonth)}
          </p>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Overall Monthly Budget</label>
            <input
              type="number"
              value={overallLimit}
              onChange={e => setOverallLimit(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              className="t-input"
              placeholder="e.g. 15000"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--c-muted)' }}>Category Budgets</label>
              <button onClick={addCategoryBudget} className="text-xs font-semibold" style={{ color: 'var(--c-accent)' }}>+ Add</button>
            </div>
            <div className="space-y-2">
              {categoryBudgets.map((cb, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <select value={cb.categoryId} onChange={e => updateCategoryBudget(i, 'categoryId', e.target.value)} className="t-select flex-1 min-w-0">
                    <option value="">Select category</option>
                    {expenseCategories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
                  </select>
                  <input
                    type="number"
                    value={cb.limit}
                    onChange={e => updateCategoryBudget(i, 'limit', e.target.value)}
                    onWheel={e => e.currentTarget.blur()}
                    className="t-input w-24"
                    placeholder="Limit"
                  />
                  <select value={cb.frequency} onChange={e => updateCategoryBudget(i, 'frequency', e.target.value)} className="t-select w-24">
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                  </select>
                  <button onClick={() => removeCategoryBudget(i)} className="text-lg font-bold" style={{ color: 'var(--c-expense)' }}>×</button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSave} className="t-btn-primary w-full">Save Budget</button>
        </div>
      )}

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
                <span className="text-xs" style={{ color: 'var(--c-muted)' }}>Overall</span>
                <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
                  {formatCurrency(monthlySummary.totalSpent)} / {formatCurrency(monthlySummary.overallLimit)}
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--c-surface2)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min((monthlySummary.totalSpent / monthlySummary.overallLimit) * 100, 100)}%`,
                    background: monthlySummary.totalSpent > monthlySummary.overallLimit ? 'var(--c-expense)' :
                                monthlySummary.totalSpent > monthlySummary.overallLimit * 0.8 ? 'var(--c-accent)' : 'var(--c-income)',
                  }}
                />
              </div>
              {monthlySummary.dailyLimit != null && (
                <p className="text-[10px] mt-1" style={{ color: 'var(--c-muted)' }}>
                  Daily allowance: {formatCurrency(monthlySummary.dailyLimit)}
                </p>
              )}
            </div>
          )}

          {/* ── Budgeted categories ───────────────────────────── */}
          {budgetedCategories.length > 0 && (
            <div>
              <div className="px-4 pt-4 pb-2">
                <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>
                  Budgeted categories: {formatMonthLabel(selectedMonth)}
                </p>
                <div className="mt-1 h-px" style={{ background: 'var(--c-border)' }} />
              </div>
              {budgetedCategories.map(cat => {
                const pct = cat.limit > 0 ? Math.min((cat.totalSpent / cat.limit) * 100, 100) : 0;
                const over = cat.totalSpent > cat.limit;
                return (
                  <div key={cat.categoryId._id} className="px-4 py-3" style={{ borderBottom: '1px solid var(--c-border)' }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-base flex-shrink-0"
                        style={{ backgroundColor: catColor(cat.categoryId.name) }}
                      >
                        {cat.categoryId.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{cat.categoryId.name}</p>
                          <p className="text-xs" style={{ color: over ? 'var(--c-expense)' : 'var(--c-muted)' }}>
                            {formatCurrency(cat.totalSpent)} / {formatCurrency(cat.limit)}
                          </p>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--c-surface2)' }}>
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: over ? 'var(--c-expense)' : pct > 80 ? 'var(--c-accent)' : 'var(--c-income)',
                            }}
                          />
                        </div>
                        <p className="text-[10px] mt-0.5" style={{ color: 'var(--c-muted)' }}>
                          {cat.frequency === 'daily' ? 'Daily' : 'Monthly'} budget
                        </p>
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
                <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>Not budgeted this month</p>
                <div className="mt-1 h-px" style={{ background: 'var(--c-border)' }} />
              </div>
              {unbudgetedCategories.map(cat => (
                <div
                  key={cat._id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: '1px solid var(--c-border)' }}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-base flex-shrink-0"
                    style={{ backgroundColor: catColor(cat.name) }}
                  >
                    {cat.icon || '💰'}
                  </div>
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
                  onClick={() => setShowForm(true)}
                  className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
                  style={{ border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}
                >
                  <span className="text-base leading-none">⊕</span>
                  Set from past months
                </button>
              </div>
            </div>
          )}

          {/* Empty state */}
          {!monthlySummary && !showForm && (
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
    </div>
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
          <p className="text-base font-bold" style={{ color: 'var(--c-text)' }}>Daily Breakdown</p>
          <p className="text-xs" style={{ color: 'var(--c-muted)' }}>{formatMonthLabel(month)}</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 px-4 py-4" style={{ borderBottom: '1px solid var(--c-border)' }}>
        {[
          ['Budget', summary.overallLimit ? formatCurrency(summary.overallLimit) : '—', 'var(--c-text)'],
          ['Spent', formatCurrency(summary.totalSpent), 'var(--c-expense)'],
          ['Daily', summary.dailyLimit ? formatCurrency(summary.dailyLimit) : '—', 'var(--c-text)'],
        ].map(([label, value, color]) => (
          <div key={label} className="text-center rounded-xl p-3" style={{ background: 'var(--c-surface)' }}>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>{label}</p>
            <p className="text-sm font-bold mt-0.5" style={{ color }}>{value}</p>
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
              className="flex items-center px-4 py-3 gap-3"
              style={{
                borderBottom: '1px solid var(--c-border)',
                opacity: isFuture ? 0.4 : 1,
                background: isToday ? 'rgba(201,167,47,0.06)' : undefined,
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
                  <p className="text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{formatCurrency(day.spent)}</p>
                ) : isPast ? (
                  <p className="text-sm" style={{ color: 'var(--c-muted)' }}>No spending</p>
                ) : null}
                {day.dailyLimit != null && (
                  <p className="text-[10px]" style={{ color: 'var(--c-muted)' }}>Limit: {formatCurrency(day.dailyLimit)}</p>
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
                  {diff >= 0 ? '+' : ''}{formatCurrency(diff)}
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
