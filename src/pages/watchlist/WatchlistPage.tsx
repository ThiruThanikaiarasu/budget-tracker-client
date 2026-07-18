import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useWatchlistStore, { type Watchlist, type WatchlistItem } from '../../store/watchlistStore';
import { formatCurrency } from '../../utils/format';
import WatchlistItemModal from './WatchlistItemModal';

const LIST_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#ec4899', '#64748b'];

/** Buy-zone / distance-to-target info for a row, or null if not computable. */
function targetInfo(item: WatchlistItem) {
  if (item.targetBuyPrice == null || item.lastPrice == null) return null;
  const diffPct = ((item.lastPrice - item.targetBuyPrice) / item.targetBuyPrice) * 100;
  return { diffPct, inBuyZone: item.lastPrice <= item.targetBuyPrice };
}

export default function WatchlistPage() {
  const {
    watchlists,
    isLoading,
    fetchWatchlists,
    createList,
    renameList,
    deleteList,
    removeItem,
  } = useWatchlistStore();

  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [listModal, setListModal] = useState<{ mode: 'create' | 'rename'; list?: Watchlist } | null>(null);
  const [itemModal, setItemModal] = useState<{ listId: string; item?: WatchlistItem } | null>(null);

  const openDetail = (item: WatchlistItem) =>
    navigate(`/stocks/${item.symbol}?exchange=${item.exchange}&name=${encodeURIComponent(item.name)}`);

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  // Derive the active list: the chosen one, else fall back to the first.
  // Avoids storing selection in an effect (stays valid as lists load/change).
  const selected =
    watchlists.find((w) => w._id === selectedId) ?? watchlists[0] ?? null;

  const handleDeleteList = async (list: Watchlist) => {
    if (!window.confirm(`Delete watchlist "${list.name}"? This removes its ${list.items.length} stock(s).`)) return;
    await deleteList(list._id);
  };

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
          <p className="mt-1 text-sm text-gray-500">Track stocks and watch for your buy price</p>
        </div>
        <button
          onClick={() => setListModal({ mode: 'create' })}
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + New list
        </button>
      </div>

      {isLoading && watchlists.length === 0 ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : watchlists.length === 0 ? (
        <div className="rounded-lg bg-white p-10 text-center shadow">
          <p className="text-gray-900 font-medium">No watchlists yet</p>
          <p className="mt-1 text-sm text-gray-500">Create a list and start tracking stocks to buy on a dip.</p>
          <button
            onClick={() => setListModal({ mode: 'create' })}
            className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Create your first list
          </button>
        </div>
      ) : (
        <>
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

          {/* Selected list */}
          {selected && (
            <div className="rounded-lg bg-white shadow">
              {/* List header */}
              <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-4">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: selected.color || '#94a3b8' }} />
                  <h2 className="truncate text-lg font-semibold text-gray-900">{selected.name}</h2>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setListModal({ mode: 'rename', list: selected })}
                    className="rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDeleteList(selected)}
                    className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setItemModal({ listId: selected._id })}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    + Add stock
                  </button>
                </div>
              </div>

              {/* Items */}
              {selected.items.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-500">
                  No stocks yet. Add one and set a target buy price.
                </p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {selected.items.map((item) => {
                    const ti = targetInfo(item);
                    return (
                      <li
                        key={item._id}
                        onClick={() => openDetail(item)}
                        className="flex cursor-pointer items-center justify-between gap-3 p-4 transition hover:bg-gray-50"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-blue-700 hover:underline">{item.symbol}</span>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
                              {item.exchange}
                            </span>
                            {ti?.inBuyZone && (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                                BUY ZONE
                              </span>
                            )}
                          </div>
                          <p className="truncate text-xs text-gray-500">{item.name}</p>
                          {item.notes && <p className="mt-0.5 truncate text-xs text-gray-400">{item.notes}</p>}
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {item.lastPrice != null ? formatCurrency(item.lastPrice) : '—'}
                          </p>
                          <p className="text-xs text-gray-500">
                            Target {item.targetBuyPrice != null ? formatCurrency(item.targetBuyPrice) : '—'}
                          </p>
                          {ti && (
                            <p className={`text-xs font-medium ${ti.inBuyZone ? 'text-green-600' : 'text-gray-400'}`}>
                              {ti.diffPct > 0 ? '+' : ''}{ti.diffPct.toFixed(1)}% vs target
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 flex-col gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setItemModal({ listId: selected._id, item }); }}
                            className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-gray-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeItem(selected._id, item._id); }}
                            className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          >
                            Remove
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {listModal && (
        <ListModal
          mode={listModal.mode}
          list={listModal.list}
          onClose={() => setListModal(null)}
          onCreate={createList}
          onRename={renameList}
        />
      )}

      {itemModal && (
        <WatchlistItemModal
          open
          listId={itemModal.listId}
          item={itemModal.item}
          onClose={() => setItemModal(null)}
        />
      )}
    </div>
  );
}

// ── Inline create/rename list modal ───────────────────────────────────
function ListModal({
  mode,
  list,
  onClose,
  onCreate,
  onRename,
}: {
  mode: 'create' | 'rename';
  list?: Watchlist;
  onClose: () => void;
  onCreate: (name: string, color?: string) => Promise<void>;
  onRename: (id: string, data: { name?: string; color?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(list?.name ?? '');
  const [color, setColor] = useState(list?.color ?? LIST_COLORS[0]);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (mode === 'create') await onCreate(name.trim(), color);
      else if (list) await onRename(list._id, { name: name.trim(), color });
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">
          {mode === 'create' ? 'New watchlist' : 'Rename watchlist'}
        </h2>
        <label className="mt-4 block text-sm font-medium text-gray-700">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. To Buy on Dip"
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <label className="mt-4 block text-sm font-medium text-gray-700">Colour</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {LIST_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-7 w-7 rounded-full border-2 ${color === c ? 'border-gray-900' : 'border-transparent'}`}
              style={{ background: c }}
            />
          ))}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !name.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
