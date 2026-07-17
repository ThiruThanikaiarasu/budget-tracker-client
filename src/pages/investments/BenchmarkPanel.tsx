import { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import type { Investment } from '../../store/investmentStore';
import useSnapshotStore, { type PortfolioSnapshot } from '../../store/snapshotStore';

type Selection = { mode: 'total' } | { mode: 'sector'; key: string } | { mode: 'stock'; key: string };

function label(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

// Value of the chosen selection within a single snapshot.
function selectionValue(snap: PortfolioSnapshot, sel: Selection): number {
  if (sel.mode === 'total') return snap.totalCurrent;
  if (sel.mode === 'sector') {
    return snap.holdings
      .filter((h) => h.sector === sel.key)
      .reduce((s, h) => s + h.current, 0);
  }
  return snap.holdings.filter((h) => h.symbol === sel.key).reduce((s, h) => s + h.current, 0);
}

export default function BenchmarkPanel({ active }: { active: Investment[] }) {
  const { snapshots, fetchSnapshots } = useSnapshotStore();
  const [selValue, setSelValue] = useState('total');

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Only snapshots that captured a Nifty level can be compared.
  const benchmarked = useMemo(
    () => snapshots.filter((s) => s.benchmarkLevel != null),
    [snapshots]
  );

  const sectors = Array.from(
    new Set(active.filter((h) => h.sector).map((h) => h.sector as string))
  ).sort();
  const stocks = active.filter((h) => h.symbol).map((h) => ({ symbol: h.symbol as string, name: h.name }));

  const sel: Selection =
    selValue === 'total'
      ? { mode: 'total' }
      : selValue.startsWith('sector:')
      ? { mode: 'sector', key: selValue.slice(7) }
      : { mode: 'stock', key: selValue.slice(6) };

  const selLabel =
    sel.mode === 'total' ? 'Total portfolio' : sel.mode === 'sector' ? sel.key : sel.key;

  // Build normalized series (both rebased to 100 at the first usable point).
  const data = useMemo(() => {
    const rows: { date: string; sel: number; nifty: number }[] = [];
    let selBase = 0;
    let niftyBase = 0;
    for (const s of benchmarked) {
      const sv = selectionValue(s, sel);
      const nv = s.benchmarkLevel as number;
      if (selBase === 0) {
        if (sv <= 0) continue; // wait until the selection has value
        selBase = sv;
        niftyBase = nv;
      }
      rows.push({
        date: label(s.date),
        sel: (sv / selBase) * 100,
        nifty: (nv / niftyBase) * 100,
      });
    }
    return rows;
  }, [benchmarked, sel]);

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Compare vs Nifty 50</h2>
          <p className="text-sm text-gray-500">Growth rebased to 100 — is your pick beating the index?</p>
        </div>
        <select
          value={selValue}
          onChange={(e) => setSelValue(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="total">Total portfolio</option>
          {sectors.length > 0 && (
            <optgroup label="Sector">
              {sectors.map((s) => (
                <option key={s} value={`sector:${s}`}>{s}</option>
              ))}
            </optgroup>
          )}
          {stocks.length > 0 && (
            <optgroup label="Stock">
              {stocks.map((s) => (
                <option key={s.symbol} value={`stock:${s.symbol}`}>{s.symbol}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {data.length < 2 ? (
        <p className="py-16 text-center text-sm text-gray-400">
          Sync from Zerodha at least twice (which captures the Nifty level) to compare against the index.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => Number(v).toFixed(0)} width={40} tick={{ fontSize: 12 }} domain={['auto', 'auto']} />
            <Tooltip formatter={(v) => `${Number(v).toFixed(1)}`} />
            <Legend />
            <Line type="monotone" dataKey="sel" name={selLabel} stroke="#3B82F6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="nifty" name="Nifty 50" stroke="#F59E0B" strokeWidth={2} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
