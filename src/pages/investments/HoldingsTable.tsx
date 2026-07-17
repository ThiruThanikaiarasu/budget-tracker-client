import { useEffect, useState } from 'react';
import type { Investment } from '../../store/investmentStore';
import { type AssetClassMeta, gain } from './assetClasses';
import { formatCurrency } from '../../utils/format';

export default function HoldingsTable({
  holdings,
  meta,
  onEdit,
  onToggle,
}: {
  holdings: Investment[];
  meta: AssetClassMeta;
  onEdit: (investment: Investment) => void;
  onToggle: (id: string) => void;
}) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  if (holdings.length === 0) {
    return (
      <div className="mt-6 rounded-lg bg-white p-8 text-center text-gray-500 shadow">
        No {meta.label.toLowerCase()} yet. Add your first holding to start tracking.
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg bg-white shadow">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Instrument</th>
            {meta.hasSector && <th className="px-4 py-3 text-left">Sector</th>}
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Avg</th>
            <th className="px-4 py-3 text-right">LTP</th>
            <th className="px-4 py-3 text-right">Invested</th>
            <th className="px-4 py-3 text-right">Cur. value</th>
            <th className="px-4 py-3 text-right">P&amp;L</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {holdings.map((h) => {
            const { gainLoss, gainLossPct } = gain(h.amountInvested, h.currentValue);
            const pnlColor = gainLoss >= 0 ? 'text-green-600' : 'text-red-600';
            return (
              <tr key={h._id} className={h.isActive ? '' : 'opacity-50'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{h.symbol || h.name}</span>
                    {!h.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">Exited</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    {h.symbol ? h.name : null}
                    {h.exchange ? `${h.symbol ? ' · ' : ''}${h.exchange}` : ''}
                  </div>
                </td>
                {meta.hasSector && (
                  <td className="px-4 py-3 text-gray-600">{h.sector || '—'}</td>
                )}
                <td className="px-4 py-3 text-right text-gray-700">{h.quantity ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {h.avgBuyPrice != null ? formatCurrency(h.avgBuyPrice) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {h.currentPrice != null ? formatCurrency(h.currentPrice) : '—'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(h.amountInvested)}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCurrency(h.currentValue)}</td>
                <td className={`px-4 py-3 text-right font-medium ${pnlColor}`}>
                  <div>{gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}</div>
                  <div className="text-xs">
                    {gainLossPct >= 0 ? '+' : ''}{gainLossPct.toFixed(1)}%
                  </div>
                </td>
                <td className="relative px-2 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === h._id ? null : h._id);
                    }}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {openMenuId === h._id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-2 z-10 mt-1 w-36 rounded-md bg-white py-1 text-left shadow-lg ring-1 ring-black ring-opacity-5"
                    >
                      <button
                        onClick={() => { onEdit(h); setOpenMenuId(null); }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { onToggle(h._id); setOpenMenuId(null); }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {h.isActive ? 'Mark Exited' : 'Mark Active'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
