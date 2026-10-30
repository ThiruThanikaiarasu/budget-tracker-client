import { useEffect, useState } from 'react';
import useUnitGroupStore, { type UnitGroup, type UnitGroupFormData } from '../store/unitGroupStore';
import { normalizeName } from '../utils/normalizeName';
import EmptyState from './EmptyState';
import ValueChipsEditor from './ValueChipsEditor';

type UnitDraft = { key: string; _id?: string; name: string; factor: string; presets: number[] };

const draftKey = () => Math.random().toString(36).slice(2);

/** Unit groups (Weight, Volume, Count…): their units, conversions and quick values. */
export default function UnitGroupsManager() {
  const { groups, loaded, fetchGroups, createGroup, updateGroup, deleteGroup } = useUnitGroupStore();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);

  useEffect(() => { if (!loaded) fetchGroups(); }, [loaded, fetchGroups]);

  return (
    <div className="px-4 pb-8">
      <div className="sticky top-0 z-10 py-3" style={{ background: 'var(--c-bg)' }}>
        <button
          type="button"
          onClick={() => setEditingId('new')}
          className="w-full py-3 rounded-xl text-xs font-bold uppercase tracking-wider"
          style={{ border: '1px solid var(--c-accent)', color: 'var(--c-accent)', background: 'var(--c-bg)' }}
        >
          ⊕ New unit group
        </button>
      </div>

      {editingId === 'new' && (
        <GroupEditor
          groups={groups}
          onSave={async (data) => { await createGroup(data); setEditingId(null); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {groups.map((g) => editingId === g._id ? (
        <GroupEditor
          key={g._id}
          group={g}
          groups={groups}
          onSave={async (data) => { await updateGroup(g._id, data); setEditingId(null); }}
          onCancel={() => setEditingId(null)}
        />
      ) : (
        <GroupCard key={g._id} group={g} onEdit={() => setEditingId(g._id)} onDelete={() => deleteGroup(g._id).catch(() => {})} />
      ))}

      {loaded && groups.length === 0 && editingId !== 'new' && (
        <EmptyState icon="⚖️" message="No unit groups yet — add one to measure items" />
      )}
    </div>
  );
}

function GroupCard({ group, onEdit, onDelete }: { group: UnitGroup; onEdit: () => void; onDelete: () => void }) {
  const base = group.units.find((u) => u.factor === 1) ?? group.units[0];
  return (
    <div className="rounded-xl p-3 mb-2" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center gap-2 mb-2">
        <p className="flex-1 text-sm font-semibold" style={{ color: 'var(--c-text)' }}>{group.name}</p>
        <button type="button" onClick={onEdit} className="text-xs font-semibold px-2" style={{ color: 'var(--c-accent)' }}>Edit</button>
        <button type="button" onClick={onDelete} className="text-xs font-semibold px-2" style={{ color: 'var(--c-expense)' }}>Delete</button>
      </div>
      <div className="space-y-1">
        {group.units.map((u) => (
          <div key={u._id} className="flex items-baseline gap-2 text-xs">
            <span className="w-14 font-semibold" style={{ color: 'var(--c-text)' }}>{u.name}</span>
            <span className="w-28" style={{ color: 'var(--c-muted)' }}>
              {u === base ? 'base unit' : `= ${u.factor} ${base.name}`}
            </span>
            <span className="flex-1 truncate" style={{ color: 'var(--c-muted)' }}>
              {u.presets.length > 0 ? `quick: ${u.presets.join(', ')}` : 'no quick values'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GroupEditor({ group, groups, onSave, onCancel }: {
  group?: UnitGroup;
  groups: UnitGroup[];
  onSave: (data: UnitGroupFormData) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(group?.name ?? '');
  const [units, setUnits] = useState<UnitDraft[]>(() =>
    group
      ? group.units.map((u) => ({ key: draftKey(), _id: u._id, name: u.name, factor: String(u.factor), presets: u.presets }))
      : [{ key: draftKey(), name: '', factor: '1', presets: [] }]
  );
  const [saving, setSaving] = useState(false);

  const update = (key: string, patch: Partial<UnitDraft>) => setUnits((us) => us.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  // Validation mirrors the server so problems show before saving.
  const nameClash = groups.find((g) => g._id !== group?._id && normalizeName(g.name) === normalizeName(name) && name.trim());
  const filled = units.filter((u) => u.name.trim());
  const unitKeys = filled.map((u) => normalizeName(u.name));
  const dupUnit = unitKeys.find((k, i) => unitKeys.indexOf(k) !== i);
  const badFactor = filled.some((u) => !(parseFloat(u.factor) > 0));
  const error = nameClash ? `"${nameClash.name}" already exists.`
    : dupUnit ? 'A unit is listed twice.'
    : badFactor ? 'Each unit needs a conversion above 0.'
    : filled.length === 0 ? 'Add at least one unit.'
    : '';
  const canSave = !!name.trim() && !error && !saving;
  const baseName = filled.find((u) => parseFloat(u.factor) === 1)?.name || 'base';

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        units: filled.map((u) => ({ _id: u._id, name: u.name.trim(), factor: parseFloat(u.factor), presets: u.presets })),
      });
    } catch { /* toast shown by the store */ }
    setSaving(false);
  };

  return (
    <div className="rounded-xl p-3 mb-2 space-y-3" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-accent)' }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Weight" className="t-input" autoFocus />

      <div className="space-y-2">
        <div className="grid grid-cols-[4.5rem_5.5rem_1.5rem] gap-2 text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
          <span>Unit</span><span>= {baseName}</span><span />
        </div>
        {units.map((u) => (
          <div key={u.key} className="space-y-1.5 pb-2" style={{ borderBottom: '1px dashed var(--c-border)' }}>
            <div className="grid grid-cols-[4.5rem_5.5rem_1.5rem] gap-2 items-center">
              <input value={u.name} onChange={(e) => update(u.key, { name: e.target.value })} placeholder="kg" className="t-input text-xs py-1" aria-label="Unit name" />
              <input value={u.factor} onChange={(e) => update(u.key, { factor: e.target.value.replace(/[^0-9.]/g, '') })}
                inputMode="decimal" placeholder="1000" className="t-input text-xs py-1" aria-label="Amount of the base unit" />
              <button type="button" onClick={() => setUnits((us) => us.filter((x) => x.key !== u.key))} disabled={units.length === 1}
                aria-label="Remove unit" className="text-base leading-none disabled:opacity-30" style={{ color: 'var(--c-muted)' }}>×</button>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-[10px] uppercase tracking-wider pt-1 w-[4.5rem]" style={{ color: 'var(--c-muted)' }}>Quick</span>
              <ValueChipsEditor values={u.presets} onChange={(presets) => update(u.key, { presets })} label={`${u.name || 'unit'} quick values`} />
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setUnits((us) => [...us, { key: draftKey(), name: '', factor: '', presets: [] }])}
          className="text-xs font-semibold" style={{ color: 'var(--c-accent)' }}>+ Add unit</button>
        <p className="text-[10px]" style={{ color: 'var(--c-muted)' }}>
          Give the smallest unit 1; the others say how many of it they hold (kg = 1000 g). This lets prices be compared per kg later.
          {group && ' Removing a unit drops it from items that use it; past transactions keep their record.'}
        </p>
      </div>

      {error && <p className="text-xs" style={{ color: 'var(--c-expense)' }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="t-btn-ghost flex-1">Cancel</button>
        <button type="button" onClick={save} disabled={!canSave} className="t-btn-primary flex-1 disabled:opacity-40">
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
