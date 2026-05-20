import { useEffect, useState } from 'react';
import useBudgetStore, { type DaySummary, type MonthlySummary } from '../store/budgetStore';
import useCategoryStore from '../store/categoryStore';
import useAuthStore from '../store/authStore';
import { formatCurrency } from '../utils/format';

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
  const {
    budget,
    monthlySummary,
    isLoading,
    fetchBudget,
    upsertBudget,
    fetchMonthlySummary,
  } = useBudgetStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { user } = useAuthStore();

  const startDay = user?.financialMonthStartDay ?? 1;
  const [selectedMonth, setSelectedMonth] = useState(getCurrentFinancialMonth(startDay));
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const [overallLimit, setOverallLimit] = useState<string>('');
  const [categoryBudgets, setCategoryBudgets] = useState<{ categoryId: string; limit: string; frequency: 'daily' | 'monthly' }[]>(
    []
  );

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchBudget(selectedMonth);
    fetchMonthlySummary(selectedMonth);
  }, [selectedMonth, fetchBudget, fetchMonthlySummary]);

  useEffect(() => {
    if (budget) {
      setOverallLimit(budget.overallLimit?.toString() || '');
      setCategoryBudgets(
        budget.categoryBudgets.map((cb) => ({
          categoryId: typeof cb.categoryId === 'string' ? cb.categoryId : cb.categoryId._id,
          limit: cb.limit.toString(),
          frequency: cb.frequency,
        }))
      );
    } else {
      setOverallLimit('');
      setCategoryBudgets([]);
    }
  }, [budget]);

  const addCategoryBudget = () => {
    setCategoryBudgets((prev) => [...prev, { categoryId: '', limit: '', frequency: 'daily' as const }]);
  };

  const removeCategoryBudget = (index: number) => {
    setCategoryBudgets((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCategoryBudget = (index: number, field: 'categoryId' | 'limit' | 'frequency', value: string) => {
    setCategoryBudgets((prev) =>
      prev.map((cb, i) => (i === index ? { ...cb, [field]: value } : cb))
    );
  };

  const handleSave = async () => {
    const payload: any = { month: selectedMonth };
    if (overallLimit) payload.overallLimit = parseFloat(overallLimit);
    const validCategoryBudgets = categoryBudgets.filter((cb) => cb.categoryId && cb.limit);
    if (validCategoryBudgets.length > 0) {
      payload.categoryBudgets = validCategoryBudgets.map((cb) => ({
        categoryId: cb.categoryId,
        limit: parseFloat(cb.limit),
        frequency: cb.frequency,
      }));
    }
    try {
      await upsertBudget(payload);
      await fetchMonthlySummary(selectedMonth);
      setShowForm(false);
    } catch {
      // handled by store
    }
  };

  const navigateMonth = (delta: number) => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const periodLabel =
    monthlySummary && startDay > 1
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
    return (
      <DetailedView
        summary={monthlySummary}
        month={selectedMonth}
        onBack={() => setShowDetails(false)}
      />
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="mt-1 text-sm text-gray-500">Set monthly budgets and track daily spending</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancel' : budget ? 'Edit Budget' : '+ Set Budget'}
        </button>
      </div>

      {/* Month Navigation */}
      <div className="mt-6 flex flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            &larr; Prev
          </button>
          <h2 className="text-lg font-semibold text-gray-900">{formatMonthLabel(selectedMonth)}</h2>
          <button
            onClick={() => navigateMonth(1)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Next &rarr;
          </button>
        </div>
        {periodLabel && (
          <p className="text-xs text-gray-400">{periodLabel}</p>
        )}
      </div>

      {/* Budget Form */}
      {showForm && (
        <div className="mt-6 rounded-lg bg-white p-6 shadow">
          <h3 className="text-base font-semibold text-gray-900">
            Budget for {formatMonthLabel(selectedMonth)}
          </h3>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Overall Monthly Budget
              </label>
              <input
                type="number"
                value={overallLimit}
                onChange={(e) => setOverallLimit(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. 15000"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Category Budgets</label>
                <button
                  type="button"
                  onClick={addCategoryBudget}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  + Add Category
                </button>
              </div>
              <div className="mt-2 space-y-2">
                {categoryBudgets.map((cb, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      value={cb.categoryId}
                      onChange={(e) => updateCategoryBudget(i, 'categoryId', e.target.value)}
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select category</option>
                      {expenseCategories.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={cb.limit}
                      onChange={(e) => updateCategoryBudget(i, 'limit', e.target.value)}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Limit"
                    />
                    <select
                      value={cb.frequency}
                      onChange={(e) => updateCategoryBudget(i, 'frequency', e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-2 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="daily">Daily</option>
                      <option value="monthly">Monthly</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeCategoryBudget(i)}
                      className="rounded-md p-2 text-red-500 hover:bg-red-50"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleSave}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Save Budget
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Overview — two-column layout */}
      {!showForm && monthlySummary && (
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          {/* Left — progress bars */}
          <div className="flex-1 space-y-6">
            {/* Overall Progress */}
            {monthlySummary.overallLimit && (
              <div className="rounded-lg bg-white p-6 shadow">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-700">Overall Budget</h3>
                  <span className="text-sm text-gray-500">
                    {formatCurrency(monthlySummary.totalSpent)} / {formatCurrency(monthlySummary.overallLimit)}
                  </span>
                </div>
                <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      monthlySummary.totalSpent > monthlySummary.overallLimit
                        ? 'bg-red-500'
                        : monthlySummary.totalSpent > monthlySummary.overallLimit * 0.8
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min((monthlySummary.totalSpent / monthlySummary.overallLimit) * 100, 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Daily allowance: {formatCurrency(monthlySummary.dailyLimit!)}
                </p>
              </div>
            )}

            {/* Category Progress */}
            {monthlySummary.categorySummary.length > 0 && (
              <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="text-sm font-medium text-gray-700">Category Budgets</h3>
                <div className="mt-3 space-y-3">
                  {monthlySummary.categorySummary.map((cat) => {
                    const pct = cat.limit > 0 ? (cat.totalSpent / cat.limit) * 100 : 0;
                    const isDaily = cat.frequency === 'daily';
                    return (
                      <div key={cat.categoryId._id}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">
                            {cat.categoryId.icon} {cat.categoryId.name}
                            <span className="ml-1.5 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                              {isDaily ? 'Daily' : 'Monthly'}
                            </span>
                          </span>
                          <span className="text-gray-500">
                            {formatCurrency(cat.totalSpent)} / {formatCurrency(cat.limit)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-gray-400">
                          {isDaily && cat.dailyLimit !== null
                            ? `Daily: ${formatCurrency(cat.dailyLimit)}`
                            : `Monthly: ${formatCurrency(cat.limit)}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar — calendar + details button */}
          <div className="w-full space-y-4 lg:w-auto lg:shrink-0">
            <CalendarGrid days={monthlySummary.days} periodStart={monthlySummary.periodStart} />
            <button
              onClick={() => setShowDetails(true)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              View Detailed Breakdown
            </button>
          </div>
        </div>
      )}

      {!showForm && !monthlySummary && !isLoading && (
        <div className="mt-12 text-center text-gray-500">
          <p>No budget set for {formatMonthLabel(selectedMonth)}.</p>
          <p className="mt-1 text-sm">Click "Set Budget" to get started.</p>
        </div>
      )}

      {isLoading && (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}
    </div>
  );
}

function CalendarGrid({ days, periodStart }: { days: DaySummary[]; periodStart: string }) {
  const startDate = parseDateStr(periodStart);
  const firstDayOfWeek = startDate.getDay();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <h3 className="text-sm font-medium text-gray-700">Daily Spending</h3>
      <div className="mt-3 flex justify-center">
        <div className="inline-grid grid-cols-7 gap-1">
          {weekDays.map((d, i) => (
            <div key={i} className="flex h-4 w-4 items-center justify-center text-[9px] font-medium text-gray-400 sm:h-5 sm:w-5 sm:text-[10px]">
              {d}
            </div>
          ))}
          {blanks.map((b) => (
            <div key={`blank-${b}`} className="h-4 w-4 sm:h-5 sm:w-5" />
          ))}
          {days.map((day) => {
            const isToday = day.date === todayStr;
            const isPast = day.date <= todayStr;
            const isFuture = day.date > todayStr;
            const hasSpending = day.spent > 0;
            const hasBudget = day.dailyLimit !== null;

            let bg = 'bg-gray-100';
            if (isFuture) {
              bg = 'bg-gray-100';
            } else if (isPast && hasBudget) {
              if (hasSpending && day.isOver) bg = 'bg-red-500';
              else if (hasSpending) bg = 'bg-green-500';
            }

            const showCross = isPast && !isFuture && hasBudget && !hasSpending;

            const dayDate = parseDateStr(day.date);
            const dayNum = dayDate.getDate();
            const title = isFuture
              ? `${dayNum}`
              : `${dayNum}: ${hasSpending ? formatCurrency(day.spent) : 'No spending'}${day.dailyLimit ? ` / ${formatCurrency(day.dailyLimit)}` : ''}`;

            return (
              <div
                key={day.date}
                title={title}
                className={`relative h-4 w-4 rounded-sm sm:h-5 sm:w-5 ${bg} ${
                  isToday ? 'ring-1.5 ring-blue-500 ring-offset-1' : ''
                }`}
              >
                {showCross && (
                  <svg
                    className="absolute inset-0 h-full w-full text-gray-400"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <line x1="4" y1="4" x2="12" y2="12" />
                    <line x1="12" y1="4" x2="4" y2="12" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-500" />
          Under
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-500" />
          Over
        </span>
        <span className="flex items-center gap-1">
          <span className="relative inline-block h-3 w-3 rounded-sm bg-gray-100">
            <svg className="absolute inset-0 h-full w-full text-gray-400" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="3" x2="9" y2="9" />
              <line x1="9" y1="3" x2="3" y2="9" />
            </svg>
          </span>
          No spend
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-gray-100" />
          Future
        </span>
      </div>
    </div>
  );
}

function DetailedView({
  summary,
  month,
  onBack,
}: {
  summary: MonthlySummary;
  month: string;
  onBack: () => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          &larr; Back
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Breakdown</h1>
          <p className="mt-1 text-sm text-gray-500">{formatMonthLabel(month)}</p>
        </div>
      </div>

      {/* Summary row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-xs font-medium text-gray-500">Monthly Budget</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {summary.overallLimit ? formatCurrency(summary.overallLimit) : '--'}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-xs font-medium text-gray-500">Total Spent</p>
          <p className="mt-1 text-lg font-bold text-red-600">{formatCurrency(summary.totalSpent)}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-xs font-medium text-gray-500">Daily Limit</p>
          <p className="mt-1 text-lg font-bold text-gray-900">
            {summary.dailyLimit ? formatCurrency(summary.dailyLimit) : '--'}
          </p>
        </div>
      </div>

      {/* Day-by-day table */}
      <div className="mt-6 overflow-x-auto rounded-lg bg-white shadow">
        <table className="min-w-[600px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Day</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Spent</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Daily Limit</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Difference</th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summary.days.map((day) => {
              const date = parseDateStr(day.date);
              const dayName = date.toLocaleDateString('en-IN', { weekday: 'short' });
              const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
              const isPast = day.date <= todayStr;
              const isFuture = day.date > todayStr;
              const diff = day.dailyLimit !== null ? day.dailyLimit - day.spent : null;
              const isToday = day.date === todayStr;

              return (
                <tr
                  key={day.date}
                  className={`${isToday ? 'bg-blue-50' : isFuture ? 'bg-gray-50/50' : 'hover:bg-gray-50'}`}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-700">
                    {dateStr}
                    {isToday && (
                      <span className="ml-1.5 rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                        Today
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-sm text-gray-500">{dayName}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium text-gray-900">
                    {isPast && day.spent > 0 ? formatCurrency(day.spent) : isPast ? '--' : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-sm text-gray-500">
                    {day.dailyLimit !== null ? formatCurrency(day.dailyLimit) : '--'}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2.5 text-right text-sm font-medium ${
                    diff !== null && isPast
                      ? diff >= 0 ? 'text-green-600' : 'text-red-600'
                      : 'text-gray-400'
                  }`}>
                    {diff !== null && isPast
                      ? `${diff >= 0 ? '+' : ''}${formatCurrency(diff)}`
                      : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-center">
                    {isPast && day.dailyLimit !== null ? (
                      day.spent === 0 ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          No spend
                        </span>
                      ) : day.isOver ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Over
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Under
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-300">--</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Budget;
