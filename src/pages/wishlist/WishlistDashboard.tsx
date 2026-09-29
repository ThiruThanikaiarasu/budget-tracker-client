import { useEffect, useState } from 'react';
import useWatchlistStore from '../../store/watchlistStore';
import useStrategyStore, { type AnalysisItem, type StrategyResult } from '../../store/strategyStore';
import { formatCurrency } from '../../utils/format';
import StrategyManager from './StrategyManager';
import ItemDomainsModal from './ItemDomainsModal';

/** Colour + label for a single strategy verdict chip. */
function chipStyle(status: StrategyResult['status']) {
  if (status === 'green') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'red') return 'bg-red-100 text-red-700 border-red-200';
  return 'bg-gray-100 text-gray-400 border-gray-200';
}

/** The green/red/grey split bar for an item's aggregate. */
function SplitBar({ summary }: { summary: AnalysisItem['summary'] }) {
  const total = summary.green + summary.red + summary.noData;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div style={{ width: pct(summary.green) }} className="bg-green-500" />
      <div style={{ width: pct(summary.red) }} className="bg-red-500" />
      <div style={{ width: pct(summary.noData) }} className="bg-gray-300" />
    </div>
  );
}

export default function WishlistDashboard() {
  const { watchlists, fetchWatchlists } = useWatchlistStore();
  const { analysis, isLoading, fetchAnalysis, fetchStrategies, fetchDomains, strategies, domains } =
    useStrategyStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [managerOpen, setManagerOpen] = useState(false);
  const [domainItem, setDomainItem] = useState<{ listId: string; itemId: string; domainIds: string[] } | null>(null);

  useEffect(() => {
    fetchWatchlists();
    fetchStrategies();
    fetchDomains();
  }, [fetchWatchlists, fetchStrategies, fetchDomains]);

  const selected = watchlists.find((w) => w._id === selectedId) ?? watchlists[0] ?? null;

  // Re-run the analysis whenever the active list (or strategy/domain set) changes.
  useEffect(() => {
    if (selected) fetchAnalysis(selected._id);
  }, [selected?._id, fetchAnalysis, strategies.length, domains.length]);

  const refresh = () => selected && fetchAnalysis(selected._id);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Wishlist buy-zone</h1>
          <p className="mt-1 text-sm text-gray-500">
            How many of your strategies say the current price is in a considerable zone. Descriptive only — not a buy call.
          </p>
        </div>
        <button
          onClick={() => setManagerOpen(true)}
          className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Manage strategies & domains
        </button>
      </div>

      {/* List switcher */}
      <div className="flex flex-wrap gap-2">
        {watchlists.map((w) => {
          const active = w._id === selected?._id;
          return (
            <button
              key={w._id}
              onClick={() => setSelectedId(w._id)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                active ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.color || '#94a3b8' }} />
              {w.name}
              <span className="text-xs text-gray-400">{w.items.length}</span>
            </button>
          );
        })}
      </div>

      {strategies.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You have no strategies yet. Click <strong>Manage strategies &amp; domains</strong> to define one (e.g. your “x/2” formula) and hook it to a domain.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : analysis.length === 0 ? (
        <p className="rounded-lg bg-white p-10 text-center text-sm text-gray-500 shadow">
          No items in this list. Add stocks in the Watchlist page, then assign each a domain here.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {analysis.map((item) => (
            <div key={item._id} className="rounded-lg bg-white p-4 shadow">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900">{item.symbol}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                      {item.exchange}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-500">{item.name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-gray-900">
                    {item.lastPrice != null ? formatCurrency(item.lastPrice) : '—'}
                  </p>
                  {item.summary.green + item.summary.red > 0 && (
                    <p className="text-xs font-semibold text-green-600">{item.summary.greenPct}% green</p>
                  )}
                </div>
              </div>

              <div className="mt-3">
                <SplitBar summary={item.summary} />
                <div className="mt-1 flex justify-between text-[11px] text-gray-400">
                  <span>{item.summary.green} green · {item.summary.red} red</span>
                  {item.summary.noData > 0 && <span>{item.summary.noData} no data</span>}
                </div>
              </div>

              {/* Strategy chips — always show ALL n */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.results.length === 0 ? (
                  <span className="text-xs text-gray-400">No strategies for this item’s domain.</span>
                ) : (
                  item.results.map((r) => (
                    <span
                      key={r.strategyId}
                      title={
                        `${r.expression}` +
                        (r.domainName ? `\n domain: ${r.domainName}` : '') +
                        (r.status === 'no_data' && r.missing.length ? `\n missing: ${r.missing.join(', ')}` : '')
                      }
                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${chipStyle(r.status)}`}
                    >
                      {r.name}
                    </span>
                  ))
                )}
              </div>

              <button
                onClick={() =>
                  setDomainItem({ listId: selected!._id, itemId: item._id, domainIds: item.domainIds })
                }
                className="mt-3 text-xs font-medium text-blue-600 hover:underline"
              >
                {item.domainIds.length ? 'Edit domains' : '+ Assign domains'}
              </button>
            </div>
          ))}
        </div>
      )}

      {managerOpen && <StrategyManager onClose={() => { setManagerOpen(false); refresh(); }} />}
      {domainItem && (
        <ItemDomainsModal
          listId={domainItem.listId}
          itemId={domainItem.itemId}
          current={domainItem.domainIds}
          onClose={() => setDomainItem(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
