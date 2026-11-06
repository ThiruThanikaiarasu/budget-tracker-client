import { useEffect, useState } from 'react';
import CartoonIcon from './CartoonIcon';
import ValueChipsEditor from './ValueChipsEditor';
import useUnitGroupStore, { type Unit, type UnitGroup, type UnitGroupFormData } from '../store/unitGroupStore';
import useCategoryItemStore, { type CategoryItem } from '../store/categoryItemStore';
import { itemKind } from '../utils/cartoonKinds';
import { normalizeName } from '../utils/normalizeName';

// Each group gets its own colour pair: the base unit strong, the bigger units lighter.
const THEMES = [
  { base: '#FFC83D', next: '#F58A2A', tile: '#FFF2D6' },
  { base: '#6CC4F5', next: '#BDE6FB', tile: '#E3F3FD' },
  { base: '#4CB86A', next: '#CDEBD6', tile: '#E4F4E8' },
  { base: '#9B7BE0', next: '#DDD0F7', tile: '#EEE8FB' },
  { base: '#F7A8C8', next: '#FBDCE9', tile: '#FDEBF3' },
];

const TEMPLATES: { label: string; emoji: string; name: string; units: { name: string; factor: number; presets: number[] }[] }[] = [
  { label: 'Length', emoji: '📏', name: 'Length', units: [{ name: 'cm', factor: 1, presets: [10, 50] }, { name: 'm', factor: 100, presets: [1, 2] }] },
  { label: 'Pack', emoji: '📦', name: 'Pack', units: [{ name: 'pack', factor: 1, presets: [1, 2, 3] }, { name: 'carton', factor: 12, presets: [1] }] },
  { label: 'Roll', emoji: '🧻', name: 'Roll', units: [{ name: 'roll', factor: 1, presets: [1, 2, 4] }, { name: 'bundle', factor: 6, presets: [1] }] },
  { label: 'Custom', emoji: '✏️', name: '', units: [{ name: '', factor: 1, presets: [] }] },
];

const groupKind = (name: string) => {
  const n = name.toLowerCase();
  return n.includes('weight') ? 'weight' : n.includes('vol') ? 'volume' : n.includes('count') ? 'count' : n.includes('pack') ? 'items' : n.includes('roll') ? 'receipt' : 'tag';
};
const num = (n: number) => String(Math.round(n * 1e6) / 1e6);
const baseOf = (g: { units: Unit[] }) => g.units.find((u) => u.factor === 1) ?? g.units[0];
const draftKey = () => Math.random().toString(36).slice(2);

/** Unit groups (Weight, Volume, Count…) as cards: the conversion ladder, quick taps, and which items use it. */
export default function CartoonUnitGroups() {
  const { groups, loaded, fetchGroups, createGroup, updateGroup, deleteGroup } = useUnitGroupStore();
  const { items, updateItem } = useCategoryItemStore();
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [template, setTemplate] = useState(TEMPLATES[3]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [guardId, setGuardId] = useState<string | null>(null);

  useEffect(() => { if (!loaded) fetchGroups(); }, [loaded, fetchGroups]);
  useEffect(() => {
    const close = () => setMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const usersOf = (g: UnitGroup) => items.filter((i) => i.unitGroupId === g._id);
  const askDelete = (g: UnitGroup) => {
    setMenuId(null);
    if (usersOf(g).length > 0) setGuardId(g._id);
    else deleteGroup(g._id).catch(() => {});
  };

  const strip = (list: CategoryItem[]) => (
    <span className="fi-strip">
      {list.slice(0, 5).map((i) => {
        const k = itemKind(i.name);
        return <span key={i._id} className="fi-st">{k ? <CartoonIcon kind={k} size={26} /> : <b>{i.name.charAt(0).toUpperCase()}</b>}</span>;
      })}
      {list.length > 5 && <span className="fi-st is-more">+{list.length - 5}</span>}
    </span>
  );

  return (
    <div className="ug-grid">
      {groups.map((g, gi) => {
        const theme = THEMES[gi % THEMES.length];
        if (editingId === g._id) {
          return (
            <UnitEditor key={g._id} group={g} groups={groups} theme={theme}
              onSave={async (data) => { await updateGroup(g._id, data); setEditingId(null); }} onCancel={() => setEditingId(null)} />
          );
        }
        const users = usersOf(g);
        if (guardId === g._id) {
          return (
            <GuardCard key={g._id} group={g} users={users} others={groups.filter((x) => x._id !== g._id)} strip={strip(users)}
              onKeep={() => setGuardId(null)}
              onMove={async (targetId) => {
                for (const it of users) await updateItem(it._id, { name: it.name, unitGroupId: targetId });
                await deleteGroup(g._id);
                setGuardId(null);
              }} />
          );
        }
        const base = baseOf(g);
        const ladder = [...g.units].sort((a, b) => a.factor - b.factor);
        const big = ladder[ladder.length - 1];
        const mult = big.factor >= 100 ? 1.5 : 1;
        return (
          <article key={g._id} className="ug-card">
            <header className="ug-head">
              <span className="ug-tile" style={{ background: theme.tile }}><CartoonIcon kind={groupKind(g.name)} size={42} /></span>
              <div className="min-w-0 flex-1">
                <h2 className="ug-name">{g.name}</h2>
                <p className="ug-sub">base unit {base.name}</p>
              </div>
              <div className="relative">
                <button type="button" className="cartoon-dots" aria-label={`${g.name} options`}
                  onClick={(e) => { e.stopPropagation(); setMenuId(menuId === g._id ? null : g._id); }}>···</button>
                {menuId === g._id && (
                  <div className="cartoon-menu" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => { setEditingId(g._id); setMenuId(null); }}>Edit</button>
                    <button type="button" className="is-danger" onClick={() => askDelete(g)}>Delete</button>
                  </div>
                )}
              </div>
            </header>

            <div className="ug-ladder">
              {ladder.map((u, i) => (
                <span key={u._id} className="ug-step">
                  {i > 0 && <span className="ug-arrow"><i>×{num(u.factor / ladder[i - 1].factor)}</i><svg width="64" height="14" viewBox="0 0 64 14" aria-hidden><path d="M2 7h58M52 2l8 5-8 5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>}
                  <span className="ug-unit" style={{ background: u === base ? theme.base : theme.next }}>
                    {u === base && <em>★ base</em>}{u.name}
                  </span>
                </span>
              ))}
            </div>

            <p className="ug-label">QUICK TAPS IN THE ADD PANEL</p>
            <div className="ug-taps">
              {ladder.map((u) => (
                <div key={u._id} className="ug-tap-row">
                  <span>{u.name}</span>
                  <span className="ug-chips">{u.presets.length > 0 ? u.presets.map((p) => <b key={p} className="fi-chip is-sun">{p}</b>) : <small>no quick values</small>}</span>
                </div>
              ))}
            </div>

            <footer className="ug-foot">
              {users.length > 0 && strip(users)}
              <span className="ug-count">{users.length} {users.length === 1 ? 'item' : 'items'}</span>
              <span className="fi-sp" />
              {big !== base && <span className="ug-example">{num(mult)} {big.name} = {num(mult * big.factor / base.factor)} {base.name}</span>}
            </footer>
          </article>
        );
      })}

      {editingId === 'new' ? (
        <UnitEditor groups={groups} theme={THEMES[groups.length % THEMES.length]} template={template}
          onSave={async (data) => { await createGroup(data); setEditingId(null); }} onCancel={() => setEditingId(null)} />
      ) : (
        <div className="ug-new">
          <span className="ug-plus">+</span>
          <h2>New unit group</h2>
          <p>Start from a template</p>
          <div className="ug-templates">
            {TEMPLATES.map((t) => (
              <button key={t.label} type="button" className="fi-mb" onClick={() => { setTemplate(t); setEditingId('new'); }}>{t.emoji} {t.label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GuardCard({ group, users, others, strip, onKeep, onMove }: {
  group: UnitGroup; users: CategoryItem[]; others: UnitGroup[]; strip: React.ReactNode; onKeep: () => void; onMove: (targetId: string) => Promise<void>;
}) {
  const [target, setTarget] = useState(others[0]?._id ?? '');
  const [busy, setBusy] = useState(false);
  const names = group.units.map((u) => u.name).join(' or ');
  return (
    <article className="ug-card is-guard">
      <h2 className="ug-guard-title">🚫 Can’t delete {group.name} yet</h2>
      <p className="ug-guard-sub">{users.length} {users.length === 1 ? 'item measures' : 'items measure'} in {names}</p>
      {strip}
      {others.length > 0 ? (
        <div className="ug-move">
          <span>Move them to</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)} className="ug-select" aria-label="Move items to">
            {others.map((o) => <option key={o._id} value={o._id}>{o.name}</option>)}
          </select>
        </div>
      ) : <p className="ug-guard-sub">Add another unit group first, then move them there.</p>}
      <div className="ug-actions">
        <button type="button" className="fv-pill" onClick={onKeep}>Keep</button>
        {others.length > 0 && (
          <button type="button" className="fv-pill is-danger" disabled={busy || !target}
            onClick={async () => { setBusy(true); try { await onMove(target); } catch { /* toast shown by the store */ } setBusy(false); }}>
            {busy ? 'Moving…' : 'Move & delete'}
          </button>
        )}
      </div>
    </article>
  );
}

type Draft = { key: string; _id?: string; name: string; factor: string; presets: number[] };

function UnitEditor({ group, groups, theme, template, onSave, onCancel }: {
  group?: UnitGroup; groups: UnitGroup[]; theme: (typeof THEMES)[number];
  template?: (typeof TEMPLATES)[number]; onSave: (data: UnitGroupFormData) => Promise<void>; onCancel: () => void;
}) {
  const [name, setName] = useState(group?.name ?? template?.name ?? '');
  const [units, setUnits] = useState<Draft[]>(() => {
    if (group) {
      const base = baseOf(group);
      return [base, ...group.units.filter((u) => u !== base)].map((u) => ({ key: draftKey(), _id: u._id, name: u.name, factor: String(u.factor), presets: u.presets }));
    }
    return (template?.units ?? TEMPLATES[3].units).map((u) => ({ key: draftKey(), name: u.name, factor: String(u.factor), presets: u.presets }));
  });
  const [saving, setSaving] = useState(false);
  const update = (key: string, patch: Partial<Draft>) => setUnits((us) => us.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  // Same checks as the server, so problems show before saving.
  const filled = units.filter((u) => u.name.trim());
  const keys = filled.map((u) => normalizeName(u.name));
  const nameClash = groups.find((g) => g._id !== group?._id && normalizeName(g.name) === normalizeName(name) && name.trim());
  const error = nameClash ? `"${nameClash.name}" already exists.`
    : keys.some((k, i) => keys.indexOf(k) !== i) ? 'A unit is listed twice.'
    : filled.some((u) => !(parseFloat(u.factor) > 0)) ? 'Each unit needs a conversion above 0.'
    : filled.length === 0 ? 'Add at least one unit.' : '';
  const canSave = !!name.trim() && !error && !saving;
  const base = units[0];
  const baseName = base?.name.trim() || 'base';
  const big = units.slice(1).filter((u) => u.name.trim() && parseFloat(u.factor) > 0).sort((a, b) => parseFloat(b.factor) - parseFloat(a.factor))[0];

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), units: filled.map((u) => ({ _id: u._id, name: u.name.trim(), factor: parseFloat(u.factor), presets: u.presets })) });
    } catch { /* toast shown by the store */ }
    setSaving(false);
  };

  return (
    <article className="ug-card is-edit">
      <header className="ug-head">
        <span className="ug-tile" style={{ background: theme.tile }}><CartoonIcon kind={groupKind(name)} size={42} /></span>
        <h2 className="ug-name flex-1">{group ? `Editing ${group.name}` : 'New unit group'}</h2>
      </header>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name, e.g. Weight" className="ug-input" aria-label="Group name" autoFocus={!group} />

      {units.map((u, i) => (
        <div key={u.key} className="ug-erow">
          <div className="ug-eline">
            <input value={u.name} onChange={(e) => update(u.key, { name: e.target.value })} placeholder={i === 0 ? 'g' : 'kg'}
              className={`ug-input is-unit ${i === 0 ? 'is-base' : ''}`} style={i === 0 ? { background: theme.base } : undefined} aria-label="Unit name" />
            {i === 0 ? <span className="ug-sub">base unit ★</span> : (
              <>
                <span>=</span>
                <input value={u.factor} onChange={(e) => update(u.key, { factor: e.target.value.replace(/[^0-9.]/g, '') })} inputMode="decimal" placeholder="1000"
                  className="ug-input is-factor" aria-label={`How many ${baseName} in one ${u.name || 'unit'}`} />
                <span className="ug-sub">{baseName}</span>
                <button type="button" className="ug-trash" aria-label="Remove unit" onClick={() => setUnits((us) => us.filter((x) => x.key !== u.key))}>🗑</button>
              </>
            )}
          </div>
          <ValueChipsEditor values={u.presets} onChange={(presets) => update(u.key, { presets })} label={`${u.name || 'unit'} quick values`} />
        </div>
      ))}

      <button type="button" className="ug-add" onClick={() => setUnits((us) => [...us, { key: draftKey(), name: '', factor: '', presets: [] }])}>
        + Add a unit (like quintal = 100 kg)
      </button>
      {big && <p className="ug-preview">Preview: 2.5 {big.name} shows as {num(2.5 * parseFloat(big.factor) / (parseFloat(base.factor) || 1))} {baseName} in reports</p>}
      {error && <p className="ug-error">{error}</p>}
      <div className="ug-actions">
        <button type="button" className="fv-pill" onClick={onCancel}>Cancel</button>
        <button type="button" className="fv-pill is-sun" disabled={!canSave} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </article>
  );
}
