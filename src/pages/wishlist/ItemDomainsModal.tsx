import { useState } from 'react';
import useWatchlistStore from '../../store/watchlistStore';
import useStrategyStore from '../../store/strategyStore';

/**
 * Assign a wishlist item to one or more domains (its asset class + optional
 * sector). Every strategy hooked to those domains is then evaluated for it.
 */
export default function ItemDomainsModal({
  listId,
  itemId,
  current,
  onClose,
  onSaved,
}: {
  listId: string;
  itemId: string;
  current: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { domains } = useStrategyStore();
  const { editItem } = useWatchlistStore();
  const [selected, setSelected] = useState<string[]>(current);
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const save = async () => {
    setSaving(true);
    try {
      await editItem(listId, itemId, { domainIds: selected });
      onSaved();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">Assign domains</h2>
        <p className="mt-1 text-sm text-gray-500">Pick the asset class and, for a stock, its sector.</p>

        {domains.length === 0 ? (
          <p className="mt-4 text-sm text-gray-400">No domains yet — create some in “Manage strategies & domains”.</p>
        ) : (
          <div className="mt-4 max-h-64 space-y-1 overflow-y-auto">
            {domains.map((d) => (
              <label key={d._id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-gray-50">
                <input type="checkbox" checked={selected.includes(d._id)} onChange={() => toggle(d._id)} />
                <span className="text-sm text-gray-800">{d.name}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                  {d.kind === 'sector' ? 'sector' : 'asset class'}
                </span>
              </label>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
