import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import useInvestmentStore, {
  type Investment,
  type InvestmentType,
} from '../../store/investmentStore';
import { ASSET_CLASS_MAP, gain } from './assetClasses';
import { formatCurrency } from '../../utils/format';
import HoldingsTable from './HoldingsTable';
import HoldingModal from './HoldingModal';

const PIE_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

export default function AssetClassPage({ assetClass }: { assetClass: InvestmentType }) {
  const meta = ASSET_CLASS_MAP[assetClass];
  const { investments, isLoading, fetchInvestments, toggleInvestment } = useInvestmentStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const holdings = investments.filter((i) => i.type === assetClass);
  const active = holdings.filter((h) => h.isActive);
  const invested = active.reduce((s, h) => s + h.amountInvested, 0);
  const current = active.reduce((s, h) => s + h.currentValue, 0);
  const { gainLoss, gainLossPct } = gain(invested, current);

  const mix = active
    .filter((h) => h.currentValue > 0)
    .map((h) => ({ name: h.symbol || h.name, value: h.currentValue }))
    .sort((a, b) => b.value - a.value);

  const sectorMap = new Map<string, number>();
  for (const h of active) {
    if (h.sector && h.currentValue > 0) {
      sectorMap.set(h.sector, (sectorMap.get(h.sector) ?? 0) + h.currentValue);
    }
  }
  const sectorData = Array.from(sectorMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to="/investments" className="text-sm text-blue-600 hover:underline">
            ← Portfolio
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold text-gray-900">
            <span>{meta.icon}</span> {meta.label}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {meta.mode === 'holdings'
              ? 'Track each holding by quantity and price'
              : 'Track invested and current value'}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add {meta.label}
        </button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Invested" value={formatCurrency(invested)} />
        <SummaryCard label="Current Value" value={formatCurrency(current)} />
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Gain/Loss</p>
          <p className={`mt-1 text-2xl font-bold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}{' '}
            <span className="text-sm font-medium">
              ({gainLossPct >= 0 ? '+' : ''}{gainLossPct.toFixed(1)}%)
            </span>
          </p>
        </div>
      </div>

      {/* Charts */}
      {active.length > 0 && (
        <div className={`grid gap-6 ${meta.hasSector && sectorData.length > 0 ? 'lg:grid-cols-2' : ''}`}>
          <DonutCard title="Holdings Mix" subtitle="Share of current value" data={mix} />
          {meta.hasSector && sectorData.length > 0 && (
            <DonutCard title="Sector Exposure" subtitle="Current value by sector" data={sectorData} />
          )}
        </div>
      )}

      {/* Holdings */}
      {isLoading && holdings.length === 0 ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <HoldingsTable
          holdings={holdings}
          meta={meta}
          onEdit={(inv) => setEditing(inv)}
          onToggle={toggleInvestment}
        />
      )}

      {showCreate && (
        <HoldingModal open assetClass={assetClass} onClose={() => setShowCreate(false)} />
      )}
      {editing && (
        <HoldingModal open assetClass={assetClass} investment={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

function DonutCard({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mb-4 text-sm text-gray-500">{subtitle}</p>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={2}>
            {data.map((_e, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatCurrency(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
        {data.slice(0, 8).map((d, i) => (
          <div key={d.name} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 truncate text-gray-600">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className="truncate">{d.name}</span>
            </span>
            <span className="shrink-0 font-medium text-gray-700">
              {total > 0 ? ((d.value / total) * 100).toFixed(0) : 0}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
