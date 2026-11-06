import { useState, type ReactNode } from 'react';
import CartoonIcon from './CartoonIcon';
import ItemFields from './ItemFields';
import type { Category } from '../store/categoryStore';
import { isShownInPicker, shortDate, type CategoryItem, type CategoryItemFormData, type ItemStats } from '../store/categoryItemStore';
import { defaultLabel, groupOf, unitsFor, type UnitGroup } from '../store/unitGroupStore';
import { categoryKind, itemKind } from '../utils/cartoonKinds';
import { formatCurrency } from '../utils/format';
import useAccountStore from '../store/accountStore';
import { recurringLine } from '../utils/recurring';

const PAGE = 5;

const GridIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
    <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" />
    <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" />
  </svg>
);

/** Highlights the typed text inside a name. */
function Marked({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term.trim().toLowerCase()) : -1;
  if (at < 0 || !term.trim()) return <>{text}</>;
  const end = at + term.trim().length;
  return <>{text.slice(0, at)}<mark>{text.slice(at, end)}</mark>{text.slice(end)}</>;
}

/** The round little picture for an item: its drawn face, else its first letter. */
function Face({ item, size }: { item: CategoryItem; size: number }) {
  const kind = itemKind(item.name);
  return kind ? <CartoonIcon kind={kind} size={size} /> : <b style={{ fontSize: size * 0.6 }}>{item.name.charAt(0).toUpperCase()}</b>;
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} className={`fi-tg ${on ? '' : 'is-off'}`}
      onClick={(e) => { e.stopPropagation(); onChange(); }}><i /></button>
  );
}

export interface ItemGroup { category: Category; items: CategoryItem[] }

/**
 * The Cartoon Items list: one card per category. Folded, a card still talks in pictures (a strip of its
 * items and what they cost this month); open, it lists the items as flat rows, five at a time. The pill
 * at the far end says how many of the items show up in the add-expense picker, and taps through
 * all on → all off → back to your own mix.
 */
export default function CartoonItemsList({
  groups, allItems, term, search, hiddenGroups, view, isFolded, onToggleFold, spend, stats, unitGroups,
  editingId, setEditingId, menuId, setMenuId, deletingId, onDelete, onHistory, onUpdate, onSetPicker,
}: {
  groups: ItemGroup[]; allItems: CategoryItem[]; term: string; search: string; hiddenGroups: number;
  view: 'list' | 'grid'; isFolded: (id: string) => boolean; onToggleFold: (id: string) => void;
  spend: Record<string, number>; stats: Record<string, ItemStats>; unitGroups: UnitGroup[];
  editingId: string | null; setEditingId: (id: string | null) => void;
  menuId: string | null; setMenuId: (id: string | null) => void; deletingId: string | null;
  onDelete: (item: CategoryItem) => void; onHistory: (item: CategoryItem) => void;
  onUpdate: (id: string, data: CategoryItemFormData) => Promise<void>;
  onSetPicker: (ids: string[], on: boolean) => Promise<void>;
}) {
  // How many rows each card shows (5 at a time), and each card's "own mix" to return to after all on / all off.
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [mixes, setMixes] = useState<Record<string, string[]>>({});
  const searching = !!term;
  const accounts = useAccountStore((s) => s.accounts);

  const cyclePicker = (groupId: string, items: CategoryItem[]) => {
    const on = items.filter(isShownInPicker).map((i) => i._id);
    const ids = items.map((i) => i._id);
    if (on.length === ids.length) {                       // all on → all off
      setMixes((m) => ({ ...m, [groupId]: m[groupId] ?? ids }));
      void onSetPicker(ids, false);
    } else if (on.length === 0) {                         // all off → back to your own mix
      const mix = mixes[groupId] ?? ids;
      void onSetPicker(mix, true);
      const rest = ids.filter((id) => !mix.includes(id));
      if (rest.length) void onSetPicker(rest, false);
    } else {                                              // some → all on, remembering the mix
      setMixes((m) => ({ ...m, [groupId]: on }));
      void onSetPicker(ids, true);
    }
  };

  const pill = (groupId: string, items: CategoryItem[]) => {
    const n = items.filter(isShownInPicker).length;
    const state = n === items.length ? 'all' : n === 0 ? 'none' : 'some';
    return (
      <button type="button" className={`fi-pill is-${state}`} title="All on → all off → back to your own mix"
        aria-label={`${n} of ${items.length} in the picker`}
        onClick={(e) => { e.stopPropagation(); cyclePicker(groupId, items); }}>
        <GridIcon /><b>{n}/{items.length}</b>
      </button>
    );
  };

  const row = (item: CategoryItem, catItems: CategoryItem[]): ReactNode => {
    if (editingId === item._id) {
      return (
        <div key={item._id} className="fi-edit">
          <ItemFields categoryItems={catItems} excludeId={item._id} initial={item} submitLabel="Save"
            card={{ meta: stats[item._id] ? `Last ${shortDate(stats[item._id].lastDate)} · ${formatCurrency(stats[item._id].lastAmount).replace(/\.00$/, '')}` : undefined }}
            onSubmit={async (data) => { await onUpdate(item._id, data); setEditingId(null); }} onCancel={() => setEditingId(null)} />
        </div>
      );
    }
    const shown = isShownInPicker(item);
    const st = stats[item._id];
    const group = groupOf(item, unitGroups);
    const unit = unitsFor(item, unitGroups)[0]?.name ?? item.unit;
    const usual = defaultLabel(item, unitGroups);
    const often = !!st && st.count >= 2 && st.avgIntervalDays !== null && st.avgIntervalDays <= 7;
    return (
      <div key={item._id} className={`fi-row ${shown ? '' : 'is-off'}`} style={{ opacity: deletingId === item._id ? 0.4 : editingId ? 0.5 : 1 }}>
        <span className="fi-ri"><Face item={item} size={40} /></span>
        <button type="button" className="fi-rb" onClick={() => { setEditingId(item._id); setMenuId(null); }}>
          <span className="fi-rn"><Marked text={item.name} term={term ? search : ''} />{often && <span className="fi-badge">🔁 bought often</span>}</span>
          <span className="fi-rc">
            {group || unit ? <span className="fi-chip">{unit}</span> : <span className="fi-chip">✏️ Not measured</span>}
            {usual && <span className="fi-chip is-sun">Usual {usual}</span>}
            {item.recurring && <span className="fi-meta">{recurringLine(item.recurring, accounts)}</span>}
            {st && !item.recurring && (
              <span className="fi-meta">
                Last {shortDate(st.lastDate)} · {formatCurrency(st.lastAmount).replace(/\.00$/, '')}
                {st.avgIntervalDays !== null && ` · lasts ~${st.avgIntervalDays} ${st.avgIntervalDays === 1 ? 'day' : 'days'}`}
              </span>
            )}
          </span>
        </button>
        <Toggle on={shown} onChange={() => void onSetPicker([item._id], !shown)} label={`Show ${item.name} in the add-expense picker`} />
        <div className="relative">
          <button type="button" aria-label={`${item.name} options`} className="cartoon-dots"
            onClick={(e) => { e.stopPropagation(); setMenuId(menuId === item._id ? null : item._id); }}>···</button>
          {menuId === item._id && (
            <div className="cartoon-menu" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => { setEditingId(item._id); setMenuId(null); }}>Edit</button>
              <button type="button" onClick={() => { onHistory(item); setMenuId(null); }}>History</button>
              <button type="button" className="is-danger" disabled={deletingId === item._id} onClick={() => { onDelete(item); setMenuId(null); }}>Delete</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const tile = (item: CategoryItem) => {
    const shown = isShownInPicker(item);
    return (
      <button key={item._id} type="button" className={`fi-tile ${shown ? '' : 'is-off'}`} title={shown ? item.name : `${item.name} — not in the picker`}
        onClick={() => { setEditingId(item._id); setMenuId(null); }}>
        <Face item={item} size={44} />
        <span><Marked text={item.name} term={term ? search : ''} /></span>
      </button>
    );
  };

  return (
    <>
      {groups.map(({ category, items }) => {
        const folded = isFolded(category._id);
        const limit = limits[category._id] ?? PAGE;
        const visible = searching ? items : items.slice(0, limit);
        const rest = items.length - visible.length;
        const editing = items.find((i) => i._id === editingId);
        return (
          <section key={category._id} className={`fi-group ${folded ? 'is-col' : ''}`}>
            <div className="fi-head" role="button" tabIndex={0} aria-expanded={!folded}
              onClick={() => !searching && onToggleFold(category._id)}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !searching) { e.preventDefault(); onToggleFold(category._id); } }}>
              <span className={`fi-chev ${folded ? '' : 'is-open'}`} aria-hidden>
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M6 3l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <span className="fi-gi"><CartoonIcon kind={categoryKind(category.icon, category.name)} size={30} /></span>
              <span className="fi-gn">{category.name}</span>
              <span className="fi-gc">{searching ? `${items.length} match` : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}</span>
              {folded && items.length > 0 && (
                <>
                  <span className="fi-strip">
                    {items.slice(0, 5).map((i) => <span key={i._id} className="fi-st"><Face item={i} size={26} /></span>)}
                    {items.length > 5 && <span className="fi-st is-more">+{items.length - 5}</span>}
                  </span>
                </>
              )}
              <span className="fi-spend">₹{Math.round(spend[category._id] ?? 0).toLocaleString('en-IN')} this month</span>
              <span className="fi-sp" />
              {items.length > 0 && pill(category._id, items)}
            </div>

            {!folded && (
              <>
                {items.length === 0 && <p className="fi-empty">No items yet</p>}
                {view === 'list' ? (
                  <div className="fi-rows">{visible.map((i) => row(i, allItems.filter((x) => x.categoryId === category._id)))}</div>
                ) : (
                  <div className="fi-gridwrap">
                    {editing && row(editing, allItems.filter((x) => x.categoryId === category._id))}
                    <div className="fi-grid">{visible.map(tile)}</div>
                    <p className="fi-note">Faded sticker = not in the picker</p>
                  </div>
                )}
                {!searching && items.length > PAGE && (
                  <div className="fi-more">
                    {rest > 0 && <button type="button" className="fi-mb is-sun" onClick={() => setLimits((l) => ({ ...l, [category._id]: limit + PAGE }))}>Show {Math.min(PAGE, rest)} more</button>}
                    {rest > 0 && <button type="button" className="fi-mb" onClick={() => setLimits((l) => ({ ...l, [category._id]: items.length }))}>Show all {items.length}</button>}
                    <button type="button" className="fi-mb is-ghost" onClick={() => { onToggleFold(category._id); setLimits((l) => ({ ...l, [category._id]: PAGE })); }}>▴ Collapse</button>
                    <span className="fi-sp" />
                    <span className="fi-cnt">{visible.length} of {items.length}</span>
                  </div>
                )}
              </>
            )}
          </section>
        );
      })}
      {searching && hiddenGroups > 0 && (
        <div className="fi-hidden">{hiddenGroups} {hiddenGroups === 1 ? 'group' : 'groups'} with no match folded away</div>
      )}
      {searching && <p className="fi-note" style={{ marginTop: 0 }}>Clear search → groups go back to how you left them</p>}
    </>
  );
}
