import { useEffect, useState } from 'react';
import useStrategyStore, { type Strategy } from '../../store/strategyStore';

/** Variables the evaluator fills from live/cached data — everything else in a
 *  formula is a per-domain param the user sets on each link. */
const METRIC_VARS = new Set([
  'price', 'currentPrice', 'targetBuyPrice', 'marketCap', 'pe', 'pb', 'bookValue',
  'eps', 'roe', 'roce', 'dividendYield', 'faceValue', 'high52', 'low52', 'debtToEquity',
]);

export default function StrategyManager({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'strategies' | 'domains'>('strategies');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex gap-1">
            {(['strategies', 'domains'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${
                  tab === t ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button onClick={onClose} className="rounded-md px-2 py-1 text-gray-400 hover:bg-gray-100">✕</button>
        </div>
        <div className="overflow-y-auto p-4">
          {tab === 'strategies' ? <StrategiesTab /> : <DomainsTab />}
        </div>
      </div>
    </div>
  );
}

// ── Strategies ─────────────────────────────────────────────────────────
function StrategiesTab() {
  const { strategies, createStrategy, updateStrategy, deleteStrategy } = useStrategyStore();
  const [editing, setEditing] = useState<Strategy | 'new' | null>(null);

  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Strategies (formulas)</h3>
        <button onClick={() => setEditing('new')} className="rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700">
          + New
        </button>
      </div>

      {strategies.length === 0 && <p className="text-sm text-gray-400">No strategies yet.</p>}

      {strategies.map((s) => (
        <div key={s._id} className="rounded-md border border-gray-200 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{s.name}</p>
              <code className="text-xs text-gray-500">{s.expression}</code>
              {s.description && <p className="mt-0.5 text-xs text-gray-400">{s.description}</p>}
            </div>
            <div className="flex shrink-0 gap-1">
              <button onClick={() => setEditing(s)} className="rounded px-2 py-1 text-xs text-gray-500 hover:bg-gray-100">Edit</button>
              <button onClick={() => deleteStrategy(s._id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
            </div>
          </div>
          <LinkEditor strategy={s} />
        </div>
      ))}

      {editing && (
        <StrategyForm
          strategy={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            if (editing === 'new') await createStrategy(data);
            else await updateStrategy(editing._id, data);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function StrategyForm({
  strategy,
  onClose,
  onSave,
}: {
  strategy?: Strategy;
  onClose: () => void;
  onSave: (data: Partial<Strategy>) => Promise<void>;
}) {
  const [name, setName] = useState(strategy?.name ?? '');
  const [prompt, setPrompt] = useState(strategy?.prompt ?? '');
  const [description, setDescription] = useState(strategy?.description ?? '');
  const [expression, setExpression] = useState(strategy?.expression ?? '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim() || !expression.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), prompt, description, expression: expression.trim() });
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900">{strategy ? 'Edit strategy' : 'New strategy'}</h2>

        <label className="mt-4 block text-sm font-medium text-gray-700">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="x/2"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />

        <label className="mt-3 block text-sm font-medium text-gray-700">Description (optional)</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />

        <label className="mt-3 block text-sm font-medium text-gray-700">Prompt (plain-English definition)</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={2}
          placeholder="buy-zone when price is under half its 52-week high"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />

        <label className="mt-3 block text-sm font-medium text-gray-700">Formula</label>
        <input value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="price < high52 / divisor"
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none" />
        <p className="mt-1 text-xs text-gray-400">
          Use metrics (price, high52, low52, pe, pb, roe, roce, eps, dividendYield, debtToEquity, targetBuyPrice) and your own params (e.g. divisor). Must resolve to true/false.
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving || !name.trim() || !expression.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Hook a strategy to domains, with per-domain params (the non-metric variables). */
function LinkEditor({ strategy }: { strategy: Strategy }) {
  const { domains, linksByStrategy, fetchLinks, upsertLink, deleteLink } = useStrategyStore();
  const links = linksByStrategy[strategy._id] ?? [];
  const paramVars = strategy.variables.filter((v) => !METRIC_VARS.has(v));

  useEffect(() => {
    fetchLinks(strategy._id);
  }, [strategy._id, fetchLinks]);

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Applies to domains</p>
      {domains.length === 0 ? (
        <p className="text-xs text-gray-400">Create domains first (Domains tab).</p>
      ) : (
        <div className="space-y-2">
          {domains.map((d) => {
            const link = links.find((l) => l.domainId === d._id);
            return (
              <div key={d._id} className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!link}
                    onChange={(e) =>
                      e.target.checked
                        ? upsertLink(strategy._id, d._id, Object.fromEntries(paramVars.map((p) => [p, 0])))
                        : deleteLink(strategy._id, d._id)
                    }
                  />
                  {d.name}
                </label>
                {link &&
                  paramVars.map((p) => (
                    <label key={p} className="flex items-center gap-1 text-xs text-gray-500">
                      {p}
                      <input
                        type="number"
                        defaultValue={link.params[p] ?? 0}
                        onBlur={(e) =>
                          upsertLink(strategy._id, d._id, { ...link.params, [p]: Number(e.target.value) })
                        }
                        className="w-16 rounded border border-gray-300 px-1.5 py-0.5 text-xs"
                      />
                    </label>
                  ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Domains ────────────────────────────────────────────────────────────
function DomainsTab() {
  const { domains, createDomain, deleteDomain } = useStrategyStore();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'asset_class' | 'sector'>('asset_class');
  const [parent, setParent] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await createDomain({ name: name.trim(), kind, parent: kind === 'sector' && parent ? parent : undefined });
    setName('');
    setParent('');
  };

  const assetClasses = domains.filter((d) => d.kind === 'asset_class');

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Domains</h3>

      <div className="flex flex-wrap items-end gap-2 rounded-md border border-gray-200 p-3">
        <div>
          <label className="block text-xs text-gray-500">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="stock / gold / Financial Services"
            className="mt-1 w-56 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500">Kind</label>
          <select value={kind} onChange={(e) => setKind(e.target.value as 'asset_class' | 'sector')}
            className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="asset_class">asset class</option>
            <option value="sector">sector</option>
          </select>
        </div>
        {kind === 'sector' && (
          <div>
            <label className="block text-xs text-gray-500">Under</label>
            <select value={parent} onChange={(e) => setParent(e.target.value)}
              className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">—</option>
              {assetClasses.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={add} className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Add</button>
      </div>

      <div className="space-y-1">
        {domains.map((d) => (
          <div key={d._id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
            <span className="text-sm text-gray-800">
              {d.name}
              <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">
                {d.kind === 'sector' ? 'sector' : 'asset class'}
              </span>
            </span>
            <button onClick={() => deleteDomain(d._id)} className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
