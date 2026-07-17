import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from 'recharts';
import useInvestmentStore, {
  type Investment,
  type InvestmentType,
} from '../../store/investmentStore';
import { ASSET_CLASSES, ASSET_CLASS_MAP, assetLabel, gain } from './assetClasses';
import { formatCurrency } from '../../utils/format';
import HoldingModal from './HoldingModal';
import AnalysisPanel from './AnalysisPanel';
import TargetAllocationPanel from './TargetAllocationPanel';
import ValueOverTimePanel from './ValueOverTimePanel';
import BenchmarkPanel from './BenchmarkPanel';
import { portfolioXirr } from './xirr';

const PIE_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
];

// Compact INR for chart centres / axes (₹12.3L, ₹1.4Cr).
function compactINR(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${n.toFixed(0)}`;
}

interface ClassAgg {
  type: InvestmentType;
  invested: number;
  current: number;
  count: number;
}

export default function PortfolioOverview() {
  const { investments, isLoading, fetchInvestments } = useInvestmentStore();
  const [addType, setAddType] = useState<InvestmentType | null>(null);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  const active = investments.filter((i) => i.isActive);

  const totalInvested = active.reduce((s, i) => s + i.amountInvested, 0);
  const totalCurrent = active.reduce((s, i) => s + i.currentValue, 0);
  const total = gain(totalInvested, totalCurrent);
  const annualized = portfolioXirr(active);

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

  const allocationData = byClass.map((c) => ({
    name: assetLabel(c.type),
    value: c.current,
    pct: totalCurrent > 0 ? (c.current / totalCurrent) * 100 : 0,
  }));

  // Sector allocation across all sector-bearing holdings (stocks, US stocks).
  const sectorMap = new Map<string, number>();
  for (const h of active) {
    if (h.sector && h.currentValue > 0) {
      sectorMap.set(h.sector, (sectorMap.get(h.sector) ?? 0) + h.currentValue);
    }
  }
  const sectorData = Array.from(sectorMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // Per-holding gain %, for gainers/losers.
  const ranked = active
    .filter((h) => h.amountInvested > 0)
    .map((h) => ({ h, ...gain(h.amountInvested, h.currentValue) }))
    .sort((a, b) => b.gainLossPct - a.gainLossPct);
  const gainers = ranked.filter((r) => r.gainLoss > 0).slice(0, 5);
  const losers = ranked.filter((r) => r.gainLoss < 0).slice(-5).reverse();

  // P&L contribution by asset class (absolute).
  const pnlByClass = byClass
    .map((c) => ({ name: assetLabel(c.type), pnl: c.current - c.invested }))
    .sort((a, b) => b.pnl - a.pnl);

  const empty = !isLoading && active.length === 0;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Portfolio</h1>
          <p className="mt-1 text-sm text-gray-500">Your investments across every asset class</p>
        </div>
        <Link
          to="/investments/assets"
          className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
          Asset Classes
        </Link>
      </div>

      {/* Hero band */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroCard label="Current Value" value={formatCurrency(totalCurrent)} accent="blue" />
        <HeroCard label="Invested" value={formatCurrency(totalInvested)} accent="slate" />
        <HeroCard
          label="Total Returns"
          value={`${total.gainLoss >= 0 ? '+' : ''}${formatCurrency(total.gainLoss)}`}
          accent={total.gainLoss >= 0 ? 'green' : 'red'}
        />
        <HeroCard
          label="Overall Return %"
          value={`${total.gainLossPct >= 0 ? '+' : ''}${total.gainLossPct.toFixed(2)}%`}
          accent={total.gainLoss >= 0 ? 'green' : 'red'}
          sub={annualized != null ? `${annualized >= 0 ? '+' : ''}${annualized.toFixed(1)}% annualized (XIRR)` : undefined}
        />
      </div>

      {isLoading && investments.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : empty ? (
        <div className="rounded-lg bg-white p-10 text-center shadow">
          <p className="text-gray-500">No investments yet. Add your first holding to build your portfolio.</p>
          <button
            onClick={() => setAddType('stocks')}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Holding
          </button>
        </div>
      ) : (
        <>
          {/* Portfolio value over time */}
          <ValueOverTimePanel />

          {/* Benchmark vs Nifty */}
          <BenchmarkPanel active={active} />

          {/* Portfolio analysis */}
          <AnalysisPanel active={active} />

          {/* Target allocation & rebalancing */}
          <TargetAllocationPanel active={active} />

          {/* Charts row: allocation donut + sector donut */}
          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Asset Allocation" subtitle="Current value by asset class">
              <div className="relative">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={allocationData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={75}
                      outerRadius={110}
                      paddingAngle={2}
                    >
                      {allocationData.map((_e, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs text-gray-400">Total</span>
                  <span className="text-xl font-bold text-gray-900">{compactINR(totalCurrent)}</span>
                </div>
              </div>
              <Legend
                items={allocationData.map((d, i) => ({
                  color: PIE_COLORS[i % PIE_COLORS.length],
                  label: d.name,
                  value: `${d.pct.toFixed(0)}%`,
                }))}
              />
            </ChartCard>

            <ChartCard title="Sector Exposure" subtitle="Across stocks & equity holdings">
              {sectorData.length === 0 ? (
                <EmptyChart text="Add sectors to your stock holdings to see exposure" />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={sectorData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={75}
                        outerRadius={110}
                        paddingAngle={2}
                      >
                        {sectorData.map((_e, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Legend
                    items={sectorData.map((d, i) => ({
                      color: PIE_COLORS[i % PIE_COLORS.length],
                      label: d.name,
                      value: formatCurrency(d.value),
                    }))}
                  />
                </>
              )}
            </ChartCard>
          </div>

          {/* Gainers / losers */}
          <div className="grid gap-6 lg:grid-cols-2">
            <MoversCard title="Top Gainers" rows={gainers} positive />
            <MoversCard title="Top Losers" rows={losers} positive={false} />
          </div>

          {/* P&L by asset class */}
          <ChartCard title="Profit & Loss by Asset Class" subtitle="Absolute gain / loss">
            <ResponsiveContainer width="100%" height={Math.max(160, pnlByClass.length * 46)}>
              <BarChart data={pnlByClass} layout="vertical" margin={{ left: 20, right: 20 }}>
                <XAxis type="number" tickFormatter={(v) => compactINR(Number(v))} />
                <YAxis type="category" dataKey="name" width={110} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                  {pnlByClass.map((d, i) => (
                    <Cell key={i} fill={d.pnl >= 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </>
      )}

      {addType && <HoldingModal open assetClass={addType} onClose={() => setAddType(null)} />}
    </div>
  );
}

// --- Presentational pieces ---

const ACCENTS: Record<string, string> = {
  blue: 'text-blue-600',
  slate: 'text-gray-900',
  green: 'text-green-600',
  red: 'text-red-600',
};

function HeroCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${ACCENTS[accent] ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="mb-4 text-sm text-gray-500">{subtitle}</p>}
      {children}
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return <p className="py-16 text-center text-sm text-gray-400">{text}</p>;
}

function Legend({ items }: { items: { color: string; label: string; value: string }[] }) {
  return (
    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
      {items.map((it) => (
        <div key={it.label} className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2 truncate text-gray-600">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
            <span className="truncate">{it.label}</span>
          </span>
          <span className="shrink-0 font-medium text-gray-700">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

function MoversCard({
  title,
  rows,
  positive,
}: {
  title: string;
  rows: { h: Investment; gainLoss: number; gainLossPct: number }[];
  positive: boolean;
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          No {positive ? 'gainers' : 'losers'} yet
        </p>
      ) : (
        <div className="mt-3 divide-y divide-gray-100">
          {rows.map(({ h, gainLoss, gainLossPct }) => (
            <div key={h._id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-lg">{ASSET_CLASS_MAP[h.type].icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{h.symbol || h.name}</p>
                  <p className="text-xs text-gray-500">{assetLabel(h.type)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`text-sm font-semibold ${positive ? 'text-green-600' : 'text-red-600'}`}>
                  {gainLossPct >= 0 ? '+' : ''}{gainLossPct.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-400">
                  {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
