import { useEffect, useState } from 'react';
import type { Investment, InvestmentType } from '../../store/investmentStore';
import useTargetStore, { type TargetEntry } from '../../store/targetStore';
import { ASSET_CLASSES, ASSET_CLASS_MAP } from './assetClasses';
import { formatCurrency } from '../../utils/format';

interface Row {
  type: InvestmentType;
  targetPct: number;
  actualPct: number;
  actualValue: number;
  diff: number; // actualValue - targetValue: >0 overweight (sell), <0 underweight (buy)
}

export default function TargetAllocationPanel({ active }: { active: Investment[] }) {
  const { targets, fetchTargets } = useTargetStore();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    fetchTargets();
  }, [fetchTargets]);

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

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Target Allocation</h2>
          <p className="text-sm text-gray-500">How far each class is from your target — and what to rebalance</p>
        </div>
        <button
          onClick={() => setEditing(true)}
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

      {editing && (
        <TargetEditor
          current={targets}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function TargetEditor({ current, onClose }: { current: TargetEntry[]; onClose: () => void }) {
  const { saveTargets } = useTargetStore();
  const [values, setValues] = useState<Record<string, number>>(() => {
    const v: Record<string, number> = {};
    current.forEach((t) => { v[t.type] = t.pct; });
    return v;
  });
  const [saving, setSaving] = useState(false);

  const sum = Object.values(values).reduce((s, n) => s + (Number(n) || 0), 0);
  const valid = Math.round(sum) === 100;

  const save = async () => {
    const targets: TargetEntry[] = ASSET_CLASSES
      .filter((m) => (values[m.value] ?? 0) > 0)
      .map((m) => ({ type: m.value, pct: Number(values[m.value]) }));
    setSaving(true);
    try {
      await saveTargets(targets);
      onClose();
    } catch {
      /* handled by store */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">Edit Target Allocation</h3>
        <p className="mt-1 text-sm text-gray-500">Set a target % per asset class. Must total 100%.</p>

        <div className="mt-4 space-y-2">
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
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [m.value]: e.target.value === '' ? 0 : Number(e.target.value) }))
                  }
                  onWheel={(e) => e.currentTarget.blur()}
                  className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="0"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>
          ))}
        </div>

        <div className={`mt-4 flex items-center justify-between rounded-md px-3 py-2 text-sm ${valid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
          <span>Total</span>
          <span className="font-semibold">{sum.toFixed(0)}%{valid ? '' : ' (must be 100%)'}</span>
        </div>

        <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!valid || saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
