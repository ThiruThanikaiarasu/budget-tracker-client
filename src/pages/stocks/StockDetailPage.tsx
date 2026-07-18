import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import useStockAnalysisStore from '../../store/stockAnalysisStore';
import useWatchlistStore, { type WatchlistExchange } from '../../store/watchlistStore';
import { formatCurrency } from '../../utils/format';

type Range = '1Y' | '3Y' | '5Y';
const RANGE_YEARS: Record<Range, number> = { '1Y': 1, '3Y': 3, '5Y': 5 };

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

function crore(n: number) {
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)}L Cr`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(1)}k Cr`;
  return `₹${n.toLocaleString('en-IN')} Cr`;
}

export default function StockDetailPage() {
  const { symbol = '' } = useParams();
  const [params] = useSearchParams();
  const exchange = (params.get('exchange') as WatchlistExchange) || 'NSE';
  const fallbackName = params.get('name') || symbol;

  const { analysis, isLoading, notFound, fetchAnalysis } = useStockAnalysisStore();
  const { watchlists, fetchWatchlists, addItem } = useWatchlistStore();
  const [range, setRange] = useState<Range>('1Y');
  const [addTo, setAddTo] = useState('');

  useEffect(() => {
    fetchAnalysis(symbol.toUpperCase(), exchange);
    fetchWatchlists();
  }, [symbol, exchange, fetchAnalysis, fetchWatchlists]);

  const chartData = useMemo(() => {
    if (!analysis) return [];
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - RANGE_YEARS[range]);
    return analysis.priceSeries
      .filter((p) => new Date(p.date) >= cutoff)
      .map((p) => ({ date: p.date, close: p.close }));
  }, [analysis, range]);

  const name = analysis?.name || fallbackName;

  const handleAdd = async () => {
    if (!addTo) return;
    await addItem(addTo, {
      symbol: symbol.toUpperCase(),
      exchange,
      name,
    });
    setAddTo('');
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div>
        <Link to="/watchlist" className="text-sm text-blue-600 hover:underline">
          ← Watchlist
        </Link>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-bold text-gray-900">{symbol.toUpperCase()}</h1>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">{exchange}</span>
          <span className="text-sm text-gray-500">{name}</span>
        </div>
        {analysis?.currentPrice != null && (
          <p className="mt-2 text-xl font-bold text-gray-900">{formatCurrency(analysis.currentPrice)}</p>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : notFound || !analysis ? (
        <div className="rounded-lg bg-white p-8 text-center shadow">
          <p className="font-medium text-gray-900">Not analyzed yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
            No price history or fundamentals stored for {symbol.toUpperCase()} yet. Ask Claude to run the
            analysis and this page will fill in with charts and ratios.
          </p>
          <p className="mt-3 inline-block rounded-md bg-gray-100 px-3 py-1.5 font-mono text-sm text-gray-700">
            analyze {symbol.toUpperCase()}
          </p>
        </div>
      ) : (
        <>
          {/* Price chart */}
          <div className="rounded-lg bg-white p-5 shadow">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Price history</h2>
                <p className="text-sm text-gray-500">Closing price</p>
              </div>
              <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm">
                {(Object.keys(RANGE_YEARS) as Range[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`rounded-md px-3 py-1 ${
                      range === r ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {chartData.length === 0 ? (
              <p className="py-16 text-center text-sm text-gray-500">No price data in this range.</p>
            ) : (
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <defs>
                      <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={fmtDate}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      minTickGap={40}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      width={48}
                      tickFormatter={(v) => `₹${v}`}
                    />
                    <Tooltip
                      formatter={(v) => formatCurrency(Number(v))}
                      labelFormatter={(l) => fmtDate(String(l))}
                    />
                    <Area type="monotone" dataKey="close" stroke="#3b82f6" strokeWidth={2} fill="url(#priceFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Fundamentals */}
          <Fundamentals analysis={analysis} />

          {/* Add to watchlist */}
          {watchlists.length > 0 && (
            <div className="rounded-lg bg-white p-5 shadow">
              <h2 className="text-sm font-semibold text-gray-900">Add to a watchlist</h2>
              <div className="mt-3 flex gap-2">
                <select
                  value={addTo}
                  onChange={(e) => setAddTo(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Choose a list…</option>
                  {watchlists.map((w) => (
                    <option key={w._id} value={w._id}>{w.name}</option>
                  ))}
                </select>
                <button
                  onClick={handleAdd}
                  disabled={!addTo}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">
            {analysis.source ? `${analysis.source} · ` : ''}updated {fmtDate(analysis.fetchedAt)}
          </p>
        </>
      )}
    </div>
  );
}

function Fundamentals({ analysis }: { analysis: NonNullable<ReturnType<typeof useStockAnalysisStore.getState>['analysis']> }) {
  const f = analysis.fundamentals;
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, value: string | undefined) => value && rows.push({ label, value });

  add('Market cap', f.marketCap != null ? crore(f.marketCap) : undefined);
  add('P/E', f.pe != null ? f.pe.toFixed(1) : undefined);
  add('P/B', f.pb != null ? f.pb.toFixed(2) : undefined);
  add('Book value', f.bookValue != null ? formatCurrency(f.bookValue) : undefined);
  add('EPS', f.eps != null ? formatCurrency(f.eps) : undefined);
  add('ROE', f.roe != null ? `${f.roe.toFixed(1)}%` : undefined);
  add('ROCE', f.roce != null ? `${f.roce.toFixed(1)}%` : undefined);
  add('Dividend yield', f.dividendYield != null ? `${f.dividendYield.toFixed(2)}%` : undefined);
  add('Debt / equity', f.debtToEquity != null ? f.debtToEquity.toFixed(2) : undefined);
  add('Face value', f.faceValue != null ? formatCurrency(f.faceValue) : undefined);
  add('52-wk high', f.high52 != null ? formatCurrency(f.high52) : undefined);
  add('52-wk low', f.low52 != null ? formatCurrency(f.low52) : undefined);
  add('Industry', f.industry);

  if (rows.length === 0) {
    return (
      <div className="rounded-lg bg-white p-5 shadow">
        <h2 className="text-lg font-semibold text-gray-900">Fundamentals</h2>
        <p className="mt-2 text-sm text-gray-500">No fundamentals stored.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <h2 className="text-lg font-semibold text-gray-900">Fundamentals</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label}>
            <dt className="text-xs text-gray-500">{r.label}</dt>
            <dd className="text-sm font-semibold text-gray-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
