import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useInvestmentStore, { type InvestmentType } from '../../store/investmentStore';
import { ASSET_CLASSES, gain } from './assetClasses';
import { formatCurrency } from '../../utils/format';
import HoldingModal from './HoldingModal';

interface ClassAgg {
  type: InvestmentType;
  invested: number;
  current: number;
  count: number;
}

export default function AssetClassesPage() {
  const { investments, isLoading, fetchInvestments } = useInvestmentStore();
  const [addType, setAddType] = useState<InvestmentType | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const active = investments.filter((i) => i.isActive);
  const totalCurrent = active.reduce((s, i) => s + i.currentValue, 0);

  const byClass: ClassAgg[] = ASSET_CLASSES.map((m) => {
    const items = active.filter((i) => i.type === m.value);
    if (items.length === 0) return undefined;
    return {
      type: m.value,
      invested: items.reduce((s, i) => s + i.amountInvested, 0),
      current: items.reduce((s, i) => s + i.currentValue, 0),
      count: items.length,
    };
  }).filter((a): a is ClassAgg => a !== undefined);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <Link to="/investments" className="text-sm text-blue-600 hover:underline">
          ← Portfolio
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">Asset Classes</h1>
        <p className="mt-1 text-sm text-gray-500">Manage holdings across every asset class</p>
      </div>

      {isLoading && investments.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ASSET_CLASSES.map((meta) => {
            const agg = byClass.find((c) => c.type === meta.value);
            const g = agg ? gain(agg.invested, agg.current) : null;
            const pct = agg && totalCurrent > 0 ? (agg.current / totalCurrent) * 100 : 0;
            const clickable = !!meta.route;
            return (
              <div
                key={meta.value}
                onClick={clickable ? () => navigate(meta.route!) : undefined}
                className={`rounded-lg bg-white p-5 shadow ${
                  clickable ? 'cursor-pointer transition hover:shadow-md hover:ring-1 hover:ring-blue-200' : ''
                } ${!agg ? 'opacity-70' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{meta.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-900">{meta.label}</p>
                      <p className="text-xs text-gray-500">
                        {agg ? `${agg.count} holding${agg.count > 1 ? 's' : ''} · ${pct.toFixed(0)}%` : 'No holdings'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setAddType(meta.value); }}
                    className="rounded-md px-2 py-1 text-sm font-medium text-blue-600 hover:bg-blue-50"
                  >
                    + Add
                  </button>
                </div>
                {agg && g && (
                  <>
                    <p className="mt-3 text-lg font-bold text-gray-900">{formatCurrency(agg.current)}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`text-sm font-medium ${g.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {g.gainLoss >= 0 ? '+' : ''}{formatCurrency(g.gainLoss)} ({g.gainLossPct >= 0 ? '+' : ''}{g.gainLossPct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${g.gainLoss >= 0 ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addType && <HoldingModal open assetClass={addType} onClose={() => setAddType(null)} />}
    </div>
  );
}
