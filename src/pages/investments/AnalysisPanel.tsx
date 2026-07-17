import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import type { Investment } from '../../store/investmentStore';
import { analyzePortfolio, assetIconFor, type Signal } from './analytics';
import { formatCurrency } from '../../utils/format';

const SCORE_COLOR: Record<string, string> = {
  Poor: '#EF4444',
  Fair: '#F59E0B',
  Good: '#3B82F6',
  Excellent: '#10B981',
};

const SIGNAL_STYLE: Record<Signal['kind'], { badge: string; label: string; ring: string }> = {
  buy: { badge: 'bg-green-100 text-green-700', label: 'BUY', ring: 'border-green-200' },
  sell: { badge: 'bg-red-100 text-red-700', label: 'TRIM', ring: 'border-red-200' },
  hold: { badge: 'bg-gray-100 text-gray-600', label: 'HOLD', ring: 'border-gray-200' },
};

export default function AnalysisPanel({ active }: { active: Investment[] }) {
  const a = analyzePortfolio(active);
  const color = SCORE_COLOR[a.scoreLabel];

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-lg font-semibold text-gray-900">Portfolio Analysis</h2>
      <p className="mb-4 text-sm text-gray-500">Diversification, concentration &amp; rebalance signals</p>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Diversification gauge */}
        <div className="flex flex-col items-center justify-center">
          <div className="relative h-44 w-44">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                innerRadius="72%"
                outerRadius="100%"
                data={[{ value: a.score, fill: color }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                <RadialBar dataKey="value" background cornerRadius={12} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{a.score}</span>
              <span className="text-xs font-medium" style={{ color }}>{a.scoreLabel}</span>
            </div>
          </div>
          <p className="mt-2 text-center text-xs text-gray-500">
            Diversification score
            {a.effectiveHoldings > 0 && (
              <> · behaves like <strong>{a.effectiveHoldings.toFixed(1)}</strong> equal holdings</>
            )}
          </p>
        </div>

        {/* Signals */}
        <div className="lg:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Signals</h3>
          {a.signals.length === 0 ? (
            <p className="mt-2 text-sm text-gray-400">Nothing to flag — looks balanced.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {a.signals.map((s, i) => {
                const st = SIGNAL_STYLE[s.kind];
                return (
                  <li key={i} className={`flex items-start gap-3 rounded-md border ${st.ring} bg-white p-2.5`}>
                    <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${st.badge}`}>
                      {st.label}
                    </span>
                    <span className="text-sm text-gray-700">{s.text}</span>
                  </li>
                );
              })}
            </ul>
          )}

          {a.concentration.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Concentration</h3>
              <ul className="mt-2 space-y-1">
                {a.concentration.map((c, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-amber-700">
                    <span>⚠️</span>{c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Laggards */}
      {a.laggards.length > 0 && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Laggards — trailing the portfolio
          </h3>
          <div className="mt-2 divide-y divide-gray-100">
            {a.laggards.map(({ holding, pct, weight }) => (
              <div key={holding._id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{assetIconFor(holding.type)}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{holding.symbol || holding.name}</p>
                    <p className="text-xs text-gray-500">{weight.toFixed(0)}% of portfolio</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${pct >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
                    {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatCurrency(holding.currentValue - holding.amountInvested)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
