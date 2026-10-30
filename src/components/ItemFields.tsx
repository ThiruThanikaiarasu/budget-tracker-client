import { useEffect, useState } from 'react';
import { type CategoryItem, type CategoryItemFormData } from '../store/categoryItemStore';
import useUnitGroupStore, { presetsFor, type Unit } from '../store/unitGroupStore';
import { normalizeName } from '../utils/normalizeName';
import QuantityPicker from './QuantityPicker';
import ValueChipsEditor from './ValueChipsEditor';

/**
 * Item form: name, how it's measured (unit group), which of the group's units
 * it uses, its default quantity, and optional item-specific quick values.
 * Flags a duplicate name (case/space-insensitive) before saving.
 */
export default function ItemFields({
  categoryItems, initial, excludeId, submitLabel, onSubmit, onCancel, onDuplicate,
}: {
  /** Items already in this category — used for the duplicate check. */
  categoryItems: CategoryItem[];
  initial?: Partial<CategoryItemFormData>;
  /** The item being edited, so it doesn't collide with itself. */
  excludeId?: string;
  submitLabel: string;
  onSubmit: (data: CategoryItemFormData) => Promise<void>;
  onCancel?: () => void;
  /** When given, the duplicate warning offers to use the existing item. */
  onDuplicate?: (existing: CategoryItem) => void;
}) {
  const { groups, loaded, fetchGroups } = useUnitGroupStore();
  useEffect(() => { if (!loaded) fetchGroups(); }, [loaded, fetchGroups]);

  const [name, setName] = useState(initial?.name ?? '');
  const [groupId, setGroupId] = useState(initial?.unitGroupId ?? '');
  const group = groups.find((g) => g._id === groupId);
  // Empty = every unit in the group (matches the server's convention).
  const [allowedIds, setAllowedIds] = useState<string[]>(initial?.allowedUnitIds ?? []);
  const [defaultUnitId, setDefaultUnitId] = useState(initial?.defaultUnitId);
  const [defaultQty, setDefaultQty] = useState(initial?.defaultQuantity);
  // Only units whose quick values differ from the group's are kept here.
  const [overrides, setOverrides] = useState<Record<string, number[]>>(() =>
    Object.fromEntries((initial?.presetOverrides ?? []).map((o) => [o.unitId, o.values]))
  );
  const [saving, setSaving] = useState(false);

  const allowedUnits: Unit[] = group
    ? (allowedIds.length > 0 ? group.units.filter((u) => allowedIds.includes(u._id)) : group.units)
    : [];
  const effectiveOverrides = Object.entries(overrides)
    .map(([unitId, values]) => ({ unitId, values }))
    .filter((o) => allowedUnits.some((u) => u._id === o.unitId));
  const setQuickValues = (unit: Unit, values: number[]) =>
    setOverrides((o) => {
      const rest = { ...o };
      delete rest[unit._id];
      const same = values.length === unit.presets.length && values.every((v, i) => v === unit.presets[i]);
      return same ? rest : { ...rest, [unit._id]: values };
    });
  const presetsOf = (u: Unit) => presetsFor({ presetOverrides: effectiveOverrides }, u);

  const key = normalizeName(name);
  const duplicate = key
    ? categoryItems.find((i) => i._id !== excludeId && normalizeName(i.name) === key)
    : undefined;
  const canSave = !!name.trim() && !duplicate && !saving;

  const pickGroup = (id: string) => {
    setGroupId(id);
    setAllowedIds([]);
    setOverrides({});
    const first = groups.find((g) => g._id === id)?.units[0];
    setDefaultUnitId(first?._id);
  };

  const toggleUnit = (unitId: string) => {
    if (!group) return;
    const current = allowedIds.length > 0 ? allowedIds : group.units.map((u) => u._id);
    const next = current.includes(unitId) ? current.filter((id) => id !== unitId) : [...current, unitId];
    if (next.length === 0) return; // keep at least one unit
    setAllowedIds(next.length === group.units.length ? [] : next);
    if (!next.includes(defaultUnitId ?? '')) setDefaultUnitId(group.units.find((u) => next.includes(u._id))?._id);
  };

  const submit = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim(),
        unitGroupId: group?._id,
        allowedUnitIds: group ? allowedIds : undefined,
        defaultUnitId: group ? (allowedUnits.find((u) => u._id === defaultUnitId) ?? allowedUnits[0])?._id : undefined,
        defaultQuantity: defaultQty,
        presetOverrides: group ? effectiveOverrides : undefined,
      });
      setName(''); setDefaultQty(undefined);
    } catch { /* toast shown by the store */ }
    setSaving(false);
  };

  const sectionLabel = 'block text-[10px] uppercase tracking-wider mb-1';
  const chip = (active: boolean) => ({
    background: active ? 'var(--c-accent)' : 'var(--c-surface2)',
    color: active ? 'var(--c-accent-fg)' : 'var(--c-text)',
  });

  return (
    <div className="space-y-3">
      <div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
          placeholder="Item name, e.g. Tomato"
          className="t-input"
          autoFocus
        />
        {duplicate && (
          <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>
            "{duplicate.name}" already exists.
            {onDuplicate && (
              <button type="button" onClick={() => onDuplicate(duplicate)} className="ml-1 font-semibold underline" style={{ color: 'var(--c-accent)' }}>
                Use it
              </button>
            )}
          </p>
        )}
      </div>

      <div>
        <span className={sectionLabel} style={{ color: 'var(--c-muted)' }}>Measured in</span>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => pickGroup('')} className="text-xs rounded-full px-3 py-1" style={chip(!group)}>None</button>
          {groups.map((g) => (
            <button key={g._id} type="button" onClick={() => pickGroup(g._id)} className="text-xs rounded-full px-3 py-1" style={chip(g._id === groupId)}>
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {group && (
        <div>
          <span className={sectionLabel} style={{ color: 'var(--c-muted)' }}>Units for this item</span>
          <div className="flex flex-wrap gap-1.5">
            {group.units.map((u) => {
              const on = allowedUnits.some((a) => a._id === u._id);
              return (
                <button key={u._id} type="button" onClick={() => toggleUnit(u._id)} className="text-xs rounded-full px-3 py-1" style={chip(on)}>
                  {on ? '✓ ' : ''}{u.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <span className={sectionLabel} style={{ color: 'var(--c-muted)' }}>Default quantity</span>
        {group ? (
          <QuantityPicker
            units={allowedUnits}
            presetsOf={presetsOf}
            unitId={defaultUnitId}
            quantity={defaultQty}
            onChange={({ unitId, quantity }) => { setDefaultUnitId(unitId); setDefaultQty(quantity); }}
            label={name}
          />
        ) : (
          <input
            value={defaultQty ?? ''}
            onChange={(e) => setDefaultQty(parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || undefined)}
            inputMode="decimal"
            placeholder="Optional"
            className="t-input w-28 text-sm"
          />
        )}
      </div>

      {group && (
        <div>
          <span className={sectionLabel} style={{ color: 'var(--c-muted)' }}>Quick values</span>
          <div className="space-y-2">
            {allowedUnits.map((u) => (
              <div key={u._id} className="flex items-start gap-2">
                <span className="text-xs font-semibold w-10 pt-1" style={{ color: 'var(--c-text)' }}>{u.name}</span>
                <div className="flex-1 min-w-0">
                  <ValueChipsEditor values={presetsOf(u)} onChange={(v) => setQuickValues(u, v)} label={`${u.name} quick values`} />
                  {overrides[u._id] && (
                    <button type="button" onClick={() => setQuickValues(u, u.presets)} className="text-[10px] font-semibold mt-1" style={{ color: 'var(--c-accent)' }}>
                      Reset to {group.name} defaults ({u.presets.join(', ') || 'none'})
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] mt-1" style={{ color: 'var(--c-muted)' }}>
            Tapped when adding a {name.trim() || 'transaction'}. Changes here apply to this item only.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="t-btn-ghost flex-1">Cancel</button>}
        <button type="button" onClick={submit} disabled={!canSave} className="t-btn-primary flex-1 disabled:opacity-40">
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  );
}
