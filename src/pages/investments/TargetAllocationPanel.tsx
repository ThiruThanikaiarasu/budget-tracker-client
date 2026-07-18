import { useEffect, useMemo, useState } from 'react';
import type { Investment, InvestmentType } from '../../store/investmentStore';
import useTargetStore, { type TargetEntry } from '../../store/targetStore';
import useInvestmentBudgetStore, { type InvestedEntry } from '../../store/investmentBudgetStore';
import { ASSET_CLASSES, ASSET_CLASS_MAP } from './assetClasses';
import { formatCurrency } from '../../utils/format';

interface Row {
  type: InvestmentType;
  targetPct: number;
  actualPct: number;
  actualValue: number;
  diff: number; // actualValue - targetValue: >0 overweight (sell), <0 underweight (buy)
}

/** Current calendar month as YYYY-MM. */
function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function monthLabel(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

/**
 * Drift-aware, buy-only allocation of the remaining monthly budget.
 * Fills the most under-weight classes first (toward target at the post-investment
 * total), then spreads any leftover by target %. Suggestions sum to `remaining`.
 */
function computeMonthlyPlan(
  rows: Row[],
  totalCurrent: number,
  budget: number,
  investedByType: Map<InvestmentType, number>
) {
  const totalInvested = [...investedByType.values()].reduce((s, n) => s + n, 0);
  const remaining = Math.max(0, budget - totalInvested);

  const planClasses = rows.filter((r) => r.targetPct > 0);
  const suggestions = new Map<InvestmentType, number>();
  planClasses.forEach((r) => suggestions.set(r.type, 0));

  if (remaining <= 0 || planClasses.length === 0) {
    return { totalInvested, remaining, suggestions };
  }

  const projectedTotal = totalCurrent + remaining;
  const gaps = planClasses.map((r) => ({
    type: r.type,
    gap: Math.max(0, (r.targetPct / 100) * projectedTotal - r.actualValue),
    targetPct: r.targetPct,
  }));
  const sumGap = gaps.reduce((s, g) => s + g.gap, 0);
  const sumTargetPct = planClasses.reduce((s, r) => s + r.targetPct, 0);

  if (sumGap <= 0) {
    // Everything already at/over target — spread by target %.
    gaps.forEach((g) => suggestions.set(g.type, (g.targetPct / sumTargetPct) * remaining));
  } else if (sumGap <= remaining) {
    // Fill every gap, then spread the leftover by target %.
    const leftover = remaining - sumGap;
    gaps.forEach((g) =>
      suggestions.set(g.type, g.gap + (g.targetPct / sumTargetPct) * leftover)
    );
  } else {
    // Not enough to fill all gaps — split proportionally to each shortfall.
    gaps.forEach((g) => suggestions.set(g.type, (g.gap / sumGap) * remaining));
  }

  return { totalInvested, remaining, suggestions };
}

export default function TargetAllocationPanel({ active }: { active: Investment[] }) {
  const { targets, fetchTargets } = useTargetStore();
  const { current: budgetDoc, fetchBudget } = useInvestmentBudgetStore();
  const [editing, setEditing] = useState<'targets' | 'budget' | null>(null);
  const month = currentMonth();

  useEffect(() => {
    fetchTargets();
    fetchBudget(month);
  }, [fetchTargets, fetchBudget, month]);

  const totalCurrent = active.reduce((s, h) => s + h.currentValue, 0);

  const actualByClass = new Map<InvestmentType, number>();
  for (const h of active) {
    actualByClass.set(h.type, (actualByClass.get(h.type) ?? 0) + h.currentValue);
  }

  // Union of classes that have a target or a holding.
  const types = new Set<InvestmentType>();
  targets.forEach((t) => types.add(t.type));
  actualByClass.forEach((_v, k) => types.add(k));

  const rows: Row[] = ASSET_CLASSES.filter((m) => types.has(m.value)).map((m) => {
    const targetPct = targets.find((t) => t.type === m.value)?.pct ?? 0;
    const actualValue = actualByClass.get(m.value) ?? 0;
    const actualPct = totalCurrent > 0 ? (actualValue / totalCurrent) * 100 : 0;
    const targetValue = (targetPct / 100) * totalCurrent;
    return { type: m.value, targetPct, actualPct, actualValue, diff: actualValue - targetValue };
  });

  const investedByType = useMemo(() => {
    const map = new Map<InvestmentType, number>();
    (budgetDoc?.invested ?? []).forEach((e) => map.set(e.type, e.amount));
    return map;
  }, [budgetDoc]);

  const budget = budgetDoc?.budget ?? 0;
  const plan = useMemo(
    () => computeMonthlyPlan(rows, totalCurrent, budget, investedByType),
    [rows, totalCurrent, budget, investedByType]
  );

  const planClasses = rows.filter((r) => r.targetPct > 0);

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Target Allocation</h2>
          <p className="text-sm text-gray-500">How far each class is from your target — and what to rebalance</p>
        </div>
        <button
          onClick={() => setEditing('targets')}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {targets.length === 0 ? 'Set targets' : 'Edit targets'}
        </button>
      </div>

      {targets.length === 0 ? (
        <p className="mt-6 text-center text-sm text-gray-400">
          No targets set yet. Set a target allocation to see drift and rebalance amounts.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-2 text-left">Asset Class</th>
                <th className="py-2 text-right">Target</th>
                <th className="py-2 text-right">Actual</th>
                <th className="py-2 text-right">Drift</th>
                <th className="py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => {
                const meta = ASSET_CLASS_MAP[r.type];
                const driftPct = r.actualPct - r.targetPct;
                const overweight = r.diff > 0;
                // "In balance" when within ₹1 or negligible drift.
                const balanced = Math.abs(r.diff) < 1 || Math.abs(driftPct) < 0.5;
                return (
                  <tr key={r.type}>
                    <td className="py-2.5">
                      <span className="flex items-center gap-2 text-gray-800">
                        <span>{meta.icon}</span>{meta.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right text-gray-600">{r.targetPct}%</td>
                    <td className="py-2.5 text-right text-gray-600">{r.actualPct.toFixed(0)}%</td>
                    <td className={`py-2.5 text-right font-medium ${balanced ? 'text-gray-400' : overweight ? 'text-amber-600' : 'text-blue-600'}`}>
                      {driftPct >= 0 ? '+' : ''}{driftPct.toFixed(0)}%
                    </td>
                    <td className="py-2.5 text-right">
                      {balanced ? (
                        <span className="text-xs text-gray-400">In balance</span>
                      ) : (
                        <span className={`text-xs font-semibold ${overweight ? 'text-red-600' : 'text-green-600'}`}>
                          {overweight ? 'Sell' : 'Buy'} {formatCurrency(Math.abs(r.diff))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── This month's investment plan ─────────────────────────────── */}
      {targets.length > 0 && (
        <div className="mt-5 rounded-lg border border-gray-100 bg-gray-50/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">This month · {monthLabel(month)}</h3>
              <p className="text-xs text-gray-500">Where to invest this month to move toward target</p>
            </div>
            <button
              onClick={() => setEditing('budget')}
              className="rounded-md px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
            >
              {budget > 0 ? 'Edit budget' : 'Set budget'}
            </button>
          </div>

          {budget <= 0 ? (
            <p className="mt-3 text-sm text-gray-400">
              Set a monthly budget to get a drift-aware, per-class plan.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-white p-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Budget</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(budget)}</p>
                </div>
                <div className="rounded-md bg-white p-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Invested</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(plan.totalInvested)}</p>
                </div>
                <div className="rounded-md bg-white p-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-400">Remaining</p>
                  <p className="text-sm font-bold text-blue-600">{formatCurrency(plan.remaining)}</p>
                </div>
              </div>

              {plan.remaining <= 0 ? (
                <p className="mt-3 text-center text-sm font-medium text-green-600">
                  🎉 Budget fully invested this month.
                </p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {planClasses.map((r) => {
                    const amt = plan.suggestions.get(r.type) ?? 0;
                    const meta = ASSET_CLASS_MAP[r.type];
                    return (
                      <li key={r.type} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-gray-700">
                          <span>{meta.icon}</span>{meta.label}
                        </span>
                        {amt < 1 ? (
                          <span className="text-xs text-gray-400">On target — skip</span>
                        ) : (
                          <span className="font-semibold text-green-600">Invest {formatCurrency(amt)}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {editing && (
        <AllocationEditor
          initialTab={editing}
          targets={targets}
          month={month}
          budget={budget}
          invested={budgetDoc?.invested ?? []}
          planClasses={planClasses.map((r) => r.type)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

const numberInputClass =
  'w-24 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function AllocationEditor({
  initialTab,
  targets,
  month,
  budget,
  invested,
  planClasses,
  onClose,
}: {
  initialTab: 'targets' | 'budget';
  targets: TargetEntry[];
  month: string;
  budget: number;
  invested: InvestedEntry[];
  planClasses: InvestmentType[];
  onClose: () => void;
}) {
  const { saveTargets } = useTargetStore();
  const { saveBudget } = useInvestmentBudgetStore();
  const [tab, setTab] = useState<'targets' | 'budget'>(initialTab);
  const [saving, setSaving] = useState(false);

  // ── Targets tab state ──
  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    targets.forEach((t) => { v[t.type] = t.pct; });
    return v;
  });
  const sum = Object.values(values).reduce((s, n) => s + (Number(n) || 0), 0);
  const targetsValid = Math.round(sum) === 100;

  // ── Budget tab state ──
  const [budgetAmount, setBudgetAmount] = useState<number>(budget);
  const [investedValues, setInvestedValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    invested.forEach((e) => { v[e.type] = e.amount; });
    return v;
  });
  // Classes to plan for: those with a target set (fallback to all if none yet).
  const budgetClasses = planClasses.length > 0 ? planClasses : ASSET_CLASSES.map((m) => m.value);

  const saveTargetsTab = async () => {
    const next: TargetEntry[] = ASSET_CLASSES
      .filter((m) => (values[m.value] ?? 0) > 0)
      .map((m) => ({ type: m.value, pct: Number(values[m.value]) }));
    setSaving(true);
    try {
      await saveTargets(next);
      onClose();
    } catch { /* handled by store */ } finally { setSaving(false); }
  };

  const saveBudgetTab = async () => {
    const investedEntries: InvestedEntry[] = budgetClasses
      .filter((t) => (investedValues[t] ?? 0) > 0)
      .map((t) => ({ type: t, amount: Number(investedValues[t]) }));
    setSaving(true);
    try {
      await saveBudget(month, { budget: Number(budgetAmount) || 0, invested: investedEntries });
      onClose();
    } catch { /* handled by store */ } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        {/* Tab header */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
          <button
            onClick={() => setTab('targets')}
            className={`flex-1 rounded-md py-1.5 font-medium ${tab === 'targets' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Targets
          </button>
          <button
            onClick={() => setTab('budget')}
            className={`flex-1 rounded-md py-1.5 font-medium ${tab === 'budget' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
          >
            Monthly Budget
          </button>
        </div>

        {tab === 'targets' ? (
          <>
            <p className="mt-4 text-sm text-gray-500">Set a target % per asset class. Must total 100%.</p>
            <div className="mt-3 space-y-2">
              {ASSET_CLASSES.map((m) => (
                <div key={m.value} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 text-sm text-gray-700">
                    <span>{m.icon}</span>{m.label}
                  </span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="any"
                      value={values[m.value] ?? ''}
                      onChange={(e) => setValues((v) => ({ ...v, [m.value]: e.target.value === '' ? 0 : Number(e.target.value) }))}
                      onWheel={(e) => e.currentTarget.blur()}
                      className={numberInputClass}
                      placeholder="0"
                    />
                    <span className="text-sm text-gray-400">%</span>
                  </div>
                </div>
              ))}
            </div>
            <div className={`mt-4 flex items-center justify-between rounded-md px-3 py-2 text-sm ${targetsValid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              <span>Total</span>
              <span className="font-semibold">{sum.toFixed(0)}%{targetsValid ? '' : ' (must be 100%)'}</span>
            </div>
          </>
        ) : (
          <>
            <p className="mt-4 text-sm text-gray-500">
              Budget for <span className="font-medium text-gray-700">{monthLabel(month)}</span>, and what you've already invested this month per class.
            </p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-gray-800">Monthly budget</span>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-400">₹</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={budgetAmount || ''}
                  onChange={(e) => setBudgetAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={numberInputClass}
                  placeholder="0"
                />
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Already invested this month</p>
            <div className="mt-2 space-y-2">
              {budgetClasses.map((t) => {
                const meta = ASSET_CLASS_MAP[t];
                return (
                  <div key={t} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-sm text-gray-700">
                      <span>{meta.icon}</span>{meta.label}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-400">₹</span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={investedValues[t] ?? ''}
                        onChange={(e) => setInvestedValues((v) => ({ ...v, [t]: e.target.value === '' ? 0 : Number(e.target.value) }))}
                        onWheel={(e) => e.currentTarget.blur()}
                        className={numberInputClass}
                        placeholder="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          {tab === 'targets' ? (
            <button
              onClick={saveTargetsTab}
              disabled={!targetsValid || saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          ) : (
            <button
              onClick={saveBudgetTab}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
