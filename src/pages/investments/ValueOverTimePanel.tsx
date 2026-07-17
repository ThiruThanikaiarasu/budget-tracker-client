import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import useSnapshotStore, { type PortfolioSnapshot } from '../../store/snapshotStore';
import { formatCurrency } from '../../utils/format';

type Cadence = 'weekly' | 'monthly' | 'all';

function compactINR(n: number) {
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `₹${(n / 1e3).toFixed(0)}k`;
  return `₹${n.toFixed(0)}`;
}

function label(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
}

export default function ValueOverTimePanel() {
  const { snapshots, fetchSnapshots, takeSnapshot } = useSnapshotStore();
  const [cadence, setCadence] = useState<Cadence>('all');
  const [taking, setTaking] = useState(false);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const filtered: PortfolioSnapshot[] =
    cadence === 'all' ? snapshots : snapshots.filter((s) => s.cadence === cadence);

  const data = filtered.map((s) => ({
    date: label(s.date),
    current: s.totalCurrent,
    invested: s.totalInvested,
  }));

  const onTake = async () => {
    setTaking(true);
    try {
      await takeSnapshot();
    } catch {
      /* handled by store */
    } finally {
      setTaking(false);
    }
  };

  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Portfolio Value Over Time</h2>
          <p className="text-sm text-gray-500">Current value vs invested, across snapshots</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5 text-sm">
            {(['weekly', 'monthly', 'all'] as Cadence[]).map((c) => (
              <button
                key={c}
                onClick={() => setCadence(c)}
                className={`rounded-md px-3 py-1 capitalize ${
                  cadence === c ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            onClick={onTake}
            disabled={taking}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {taking ? 'Saving...' : 'Take snapshot'}
          </button>
        </div>
      </div>

      {data.length < 2 ? (
        <p className="py-16 text-center text-sm text-gray-400">
          {data.length === 0
            ? 'No snapshots yet. Take one now — weekly & monthly snapshots also run automatically.'
            : 'One snapshot so far. The trend line appears once there are at least two.'}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={compactINR} width={60} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatCurrency(Number(v))} />
            <Area type="monotone" dataKey="current" name="Current value" stroke="#3B82F6" strokeWidth={2} fill="url(#valueFill)" />
            <Line type="monotone" dataKey="invested" name="Invested" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
