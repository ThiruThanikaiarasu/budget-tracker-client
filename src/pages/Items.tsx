import { useEffect, useState } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useCategoryStore, { type Category } from '../store/categoryStore';
import useCategoryItemStore, {
  isShownInPicker, fetchItemHistory, daysBetween, shortDate,
  type CategoryItem, type ItemStats, type ItemPurchase,
} from '../store/categoryItemStore';
import { formatCurrency } from '../utils/format';
import useAccountStore from '../store/accountStore';
import { recurringLine } from '../utils/recurring';
import ItemFields from '../components/ItemFields';
import CategorySelect from '../components/CategorySelect';
import EmptyState from '../components/EmptyState';
import { renderCategoryIcon } from '../utils/categoryIcons';
import useUnitGroupStore, { defaultLabel, groupOf, unitsFor, type UnitGroup } from '../store/unitGroupStore';
import UnitGroupsManager from '../components/UnitGroupsManager';
import { normalizeName } from '../utils/normalizeName';
import useThemeStore from '../store/themeStore';
import CartoonIcon from '../components/CartoonIcon';
import { CartoonHead } from '../components/cartoon';
import useSessionState from '../hooks/useSessionState';
import CartoonItemsList from '../components/CartoonItemsList';
import useDashboardStore from '../store/dashboardStore';
import useAuthStore from '../store/authStore';
import { getCurrentFinancialMonth } from '../utils/financialMonth';

const ALL = ''; // CategorySelect's "All categories" value

/**
 * Every sub-category item in one place: filter by category, search, and add
 * items (pick the category, default quantity and unit) without going through
 * the Categories page.
 */
function Items() {
  const { categories, fetchCategories } = useCategoryStore();
  const { items, fetchItems, createItem, updateItem, deleteItem, setShownInPicker, stats, fetchStats } = useCategoryItemStore();
  const [historyItem, setHistoryItem] = useState<CategoryItem | null>(null);
  const [filter, setFilter] = useState<string>(ALL);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tab, setTab] = useState<'items' | 'units'>('items');
  const { groups: unitGroups, fetchGroups } = useUnitGroupStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const isCartoon = useThemeStore((st) => st.theme === 'cartoon');
  // Category cards folded to just their header (kept across a refresh).
  const [collapsedIds, setCollapsedIds] = useSessionState<string[]>('items.collapsed', []);
  const [view, setView] = useSessionState<'list' | 'grid'>('items.view', 'list');
  const [tipGone, setTipGone] = useSessionState('items.tipGone', false, 'local');
  // What each category cost this month, for the folded cards.
  const { breakdown, fetchCategoryBreakdown } = useDashboardStore();
  const startDay = useAuthStore((st) => st.user?.financialMonthStartDay) ?? 1;
  const spend = Object.fromEntries(breakdown.map((b) => [b.categoryId, b.total]));

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    fetchCategories();
    // Unit groups first: loading them migrates legacy free-text item units.
    fetchGroups().then(fetchItems);
    fetchStats();
  }, [fetchCategories, fetchItems, fetchGroups, fetchStats]);

  useEffect(() => { if (isCartoon) fetchCategoryBreakdown(getCurrentFinancialMonth(startDay)); }, [isCartoon, startDay, fetchCategoryBreakdown]);

  const term = normalizeName(search);
  const visibleItems = items.filter((i) => !term || normalizeName(i.name).includes(term));
  // Category order matches the Categories page. With "All", only categories
  // that have (matching) items are listed; a single picked category is always shown.
  const groups = categories
    .filter((c) => (filter === ALL ? true : c._id === filter))
    .map((c) => ({ category: c, items: visibleItems.filter((i) => i.categoryId === c._id) }))
    .filter((g) => filter !== ALL || g.items.length > 0);

  const remove = async (item: CategoryItem) => {
    setDeletingId(item._id);
    try { await deleteItem(item._id); } catch { /* toast shown by the store */ }
    setDeletingId(null);
  };

  // A search always shows its matches, so folding only applies while the box is empty.
  const isFolded = (id: string) => !term && collapsedIds.includes(id);
  const toggleFold = (id: string) => setCollapsedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const allFolded = groups.length > 0 && groups.every((g) => collapsedIds.includes(g.category._id));
  const foldAll = () => setCollapsedIds(allFolded ? [] : groups.map((g) => g.category._id));

  if (isCartoon) {
    return (
      <div className="cartoon-page">
        <CartoonHead
          kicker="Things you buy again and again"
          title="Items"
          actions={
            <div className="cartoon-seg-pill" role="tablist">
              {(['items', 'units'] as const).map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={tab === t ? 'is-on' : ''}>
                  {t === 'items' ? 'Items' : <><CartoonIcon kind="weight" size={20} /> Units</>}
                </button>
              ))}
            </div>
          }
        />
        {tab === 'units' ? <UnitGroupsManager /> : (
          <>
            <div className="cartoon-toolbar">
              <div className="cartoon-toolbar-cat"><CategorySelect categories={categories} value={filter} onChange={setFilter} allLabel="All categories" grouped /></div>
              <label className="cartoon-search" style={{ flex: 1, minWidth: 180, height: 48, boxShadow: '3px 3px 0 var(--c-ink)' }}>
                <span aria-hidden>🔍</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" />
                {search && <button type="button" aria-label="Clear search" className="fi-clear" onClick={() => setSearch('')}>✕</button>}
              </label>
              <div className="fi-seg" role="group" aria-label="Layout">
                <button type="button" aria-pressed={view === 'list'} title="List" className={view === 'list' ? 'is-on' : ''} onClick={() => setView('list')}>☰</button>
                <button type="button" aria-pressed={view === 'grid'} title="Grid" className={view === 'grid' ? 'is-on' : ''} onClick={() => setView('grid')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" /></svg>
                </button>
              </div>
              {groups.length > 1 && !term && (
                <button type="button" className="fi-ib" title={allFolded ? 'Expand all' : 'Collapse all'} aria-label={allFolded ? 'Expand all' : 'Collapse all'} onClick={foldAll}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 7l5-4 5 4M5 13l5 4 5-4" /></svg>
                </button>
              )}
              <button type="button" onClick={() => setShowAdd(true)} className="cartoon-btn is-primary">+ Add item</button>
            </div>
            {!tipGone && (
              <div className="fi-tip">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" /><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" /></svg>
                <span>Tile on = shows in the add-expense picker. Off items still turn up in search.</span>
                <button type="button" aria-label="Dismiss" onClick={() => setTipGone(true)}>✕</button>
              </div>
            )}

            <CartoonItemsList
              groups={groups} allItems={items} term={term} search={search}
              hiddenGroups={filter === ALL ? categories.length - groups.length : 0}
              view={view} isFolded={isFolded} onToggleFold={toggleFold} spend={spend} stats={stats} unitGroups={unitGroups}
              editingId={editingId} setEditingId={setEditingId} menuId={openMenuId} setMenuId={setOpenMenuId}
              deletingId={deletingId} onDelete={remove} onHistory={setHistoryItem} onUpdate={updateItem} onSetPicker={setShownInPicker}
            />

            {groups.length === 0 && (
              search
                ? <EmptyState icon="🔍" message={`No items matching "${search.trim()}"`} />
                : <EmptyState icon="🧺" message="No items yet — add one to get started" />
            )}

            <div className="cartoon-note-card cartoon-more">
              <span className="flex">{['onion', 'carrot', 'milk', 'rice'].map((k) => <CartoonIcon key={k} kind={k} size={40} />)}</span>
              More regulars waiting? Add onions, milk, rice and anything else you buy every week.
            </div>
          </>
        )}

        {historyItem && <HistoryModal item={historyItem} stats={stats[historyItem._id]} onClose={() => setHistoryItem(null)} />}
        {showAdd && (
          <AddItemModal categories={categories} initialCategoryId={filter === ALL ? '' : filter} onClose={() => setShowAdd(false)} onCreate={createItem} />
        )}
      </div>
    );
  }

  return (
    // 100% (not 100vh): fill the layout's scroll area without overflowing it,
    // so an empty page doesn't get a scrollbar.
    <div style={{ background: 'var(--c-bg)', minHeight: '100%' }}>
      <div className="px-4 pt-6 pb-4 text-center" style={{ background: 'var(--c-header-bg)' }}>
        <p className="cred-label">items</p>
        <p className="cred-serif mt-1 text-3xl font-semibold" style={{ color: 'var(--c-text)' }}>{items.length}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
          {tab === 'items'
            ? 'Ticked items are listed when you add a transaction — the rest are still found by search'
            : 'How items are measured — units, conversions and quick values'}
        </p>
        <div className="inline-flex mt-3 rounded-full p-1 gap-1" style={{ background: 'var(--c-surface2)' }} role="tablist">
          {(['items', 'units'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{ background: tab === t ? 'var(--c-accent)' : 'transparent', color: tab === t ? 'var(--c-accent-fg)' : 'var(--c-muted)' }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {tab === 'units' ? <UnitGroupsManager /> : <>
      {/* Toolbar — pinned so filter/search/add stay reachable while scrolling */}
      <div className="sticky top-0 z-10 px-4 py-3 space-y-2" style={{ background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)' }}>
        <div className="flex gap-2">
          <div className="flex-1 min-w-0">
            <CategorySelect categories={categories} value={filter} onChange={setFilter} allLabel="All categories" grouped />
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="px-4 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap"
            style={{ border: '1px solid var(--c-accent)', color: 'var(--c-accent)' }}
          >
            ⊕ Add item
          </button>
        </div>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…" className="t-input" />
      </div>

      <div className="px-4 pb-8">
        {groups.map(({ category, items: groupItems }) => {
          const shownCount = groupItems.filter(isShownInPicker).length;
          const allShown = groupItems.length > 0 && shownCount === groupItems.length;
          return (
            <section key={category._id} className="pt-5">
              <div className="flex items-center gap-2.5 pb-1">
                <span className="category-row-icon">{renderCategoryIcon(category.icon, category.name, 28)}</span>
                <p className="cred-label flex-1 truncate">{category.name}</p>
                {groupItems.length > 0 && (
                  <span className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--c-muted)' }}>
                    {shownCount}/{groupItems.length} in picker
                    <Switch
                      on={allShown}
                      onChange={() => setShownInPicker(groupItems.map((i) => i._id), !allShown)}
                      label={`Show all ${category.name} items in the picker`}
                    />
                  </span>
                )}
              </div>

              {groupItems.length === 0 && (
                <p className="text-sm py-4" style={{ color: 'var(--c-muted)' }}>No items yet</p>
              )}

              {groupItems.map((item) => editingId === item._id ? (
                <div key={item._id} className="my-3">
                  <ItemFields
                    categoryItems={items.filter((i) => i.categoryId === category._id)}
                    excludeId={item._id}
                    initial={item}
                    card={{ meta: stats[item._id] ? `Last ${shortDate(stats[item._id].lastDate)} · ${formatCurrency(stats[item._id].lastAmount)}` : undefined }}
                    submitLabel="Save"
                    onSubmit={async (data) => { await updateItem(item._id, data); setEditingId(null); }}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <ItemListRow
                  key={item._id}
                  faded={!!editingId}
                  item={item}
                  unitGroups={unitGroups}
                  stats={stats[item._id]}
                  onHistory={() => { setHistoryItem(item); setOpenMenuId(null); }}
                  menuOpen={openMenuId === item._id}
                  onToggleMenu={() => setOpenMenuId(openMenuId === item._id ? null : item._id)}
                  onTogglePicker={(on) => setShownInPicker([item._id], on)}
                  onEdit={() => { setEditingId(item._id); setOpenMenuId(null); }}
                  onDelete={() => { remove(item); setOpenMenuId(null); }}
                  deleting={deletingId === item._id}
                />
              ))}
            </section>
          );
        })}

        {groups.length === 0 && (
          search
            ? <EmptyState icon="🔍" message={`No items matching "${search.trim()}"`} />
            : <EmptyState icon="🧺" message="No items yet — add one to get started" />
        )}
      </div>
      </>}

      {historyItem && (
        <HistoryModal item={historyItem} stats={stats[historyItem._id]} onClose={() => setHistoryItem(null)} />
      )}

      {showAdd && (
        <AddItemModal
          categories={categories}
          initialCategoryId={filter === ALL ? '' : filter}
          onClose={() => setShowAdd(false)}
          onCreate={createItem}
        />
      )}
    </div>
  );
}

/** Small on/off switch (role="switch"). */
function Switch({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={onChange}
      className="relative inline-flex flex-shrink-0 rounded-full transition-colors"
      style={{ width: 34, height: 20, background: on ? 'var(--c-accent)' : 'var(--c-border)' }}
    >
      <span
        className="absolute rounded-full transition-transform"
        style={{
          top: 2, left: 2, width: 16, height: 16, background: on ? 'var(--c-accent-fg)' : 'var(--c-surface)',
          transform: on ? 'translateX(14px)' : 'translateX(0)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
        }}
      />
    </button>
  );
}

/** One item: initial avatar, name + measurement summary, picker switch, ⋯ menu. */
function ItemListRow({ item, unitGroups, stats, onHistory, menuOpen, onToggleMenu, onTogglePicker, onEdit, onDelete, deleting, faded }: {
  item: CategoryItem;
  /** Another item is being edited: step back so the edit card stands out. */
  faded?: boolean;
  unitGroups: UnitGroup[];
  stats?: ItemStats;
  onHistory: () => void;
  menuOpen: boolean;
  onToggleMenu: () => void;
  onTogglePicker: (on: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const shown = isShownInPicker(item);
  const group = groupOf(item, unitGroups);
  const units = unitsFor(item, unitGroups).map((u) => u.name).join(', ');
  const def = defaultLabel(item, unitGroups);
  const accounts = useAccountStore((st) => st.accounts);
  const summary = item.recurring
    ? recurringLine(item.recurring, accounts)
    : [group ? `${group.name} · ${units}` : 'Not measured', def && `default ${def}`].filter(Boolean).join(' · ');

  return (
    <div className="cred-divider flex items-center gap-3 py-3" style={{ opacity: deleting ? 0.4 : faded ? 0.5 : 1 }}>
      <span
        className="flex items-center justify-center rounded-full flex-shrink-0 text-sm font-semibold"
        style={{ width: 40, height: 40, background: 'var(--c-surface2)', color: shown ? 'var(--c-text)' : 'var(--c-muted)', border: '1px solid var(--c-border)' }}
      >
        {item.name.charAt(0).toUpperCase()}
      </span>

      <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left">
        <p className="text-sm font-medium truncate" style={{ color: shown ? 'var(--c-text)' : 'var(--c-muted)' }}>{item.name}</p>
        <p className="text-xs truncate" style={{ color: 'var(--c-muted)' }}>{summary}</p>
        {stats && (
          <p className="text-[11px] truncate mt-0.5" style={{ color: 'var(--c-muted)' }}>
            Last bought {shortDate(stats.lastDate)} · {formatCurrency(stats.lastAmount)}
            {stats.avgIntervalDays !== null && ` · lasts ~${stats.avgIntervalDays} days`}
            {stats.count > 1 && ` · ${stats.count}×`}
          </p>
        )}
      </button>

      <Switch on={shown} onChange={() => onTogglePicker(!shown)} label={`Show ${item.name} in the add-transaction picker`} />

      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleMenu(); }}
          aria-label={`${item.name} options`}
          className="p-2"
          style={{ color: 'var(--c-muted)' }}
        >
          ···
        </button>
        {menuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 z-20 mt-1 w-32 rounded-xl py-1 shadow-xl"
            style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
          >
            <button type="button" onClick={onEdit} className="block w-full px-4 py-2.5 text-left text-sm" style={{ color: 'var(--c-text)' }}>Edit</button>
            <button type="button" onClick={onHistory} className="block w-full px-4 py-2.5 text-left text-sm" style={{ color: 'var(--c-text)' }}>History</button>
            <button type="button" onClick={onDelete} disabled={deleting} className="block w-full px-4 py-2.5 text-left text-sm" style={{ color: 'var(--c-expense)' }}>Delete</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Every purchase of an item, newest first, with how long each one lasted. */
function HistoryModal({ item, stats, onClose }: { item: CategoryItem; stats?: ItemStats; onClose: () => void }) {
  const [history, setHistory] = useState<ItemPurchase[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchItemHistory(item._id).then(setHistory).catch(() => setFailed(true));
  }, [item._id]);

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 flex items-end sm:items-start justify-center p-0 sm:p-4 sm:pt-[10vh]">
        <DialogPanel className="cartoon-modal w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl overflow-y-auto max-h-[90dvh] sm:max-h-[85dvh]" style={{ background: 'var(--c-surface)' }}>
          <DialogTitle className="cred-serif text-base font-semibold" style={{ color: 'var(--c-text)' }}>{item.name}</DialogTitle>
          {stats && (
            <p className="text-xs mt-1 mb-4" style={{ color: 'var(--c-muted)' }}>
              Bought {stats.count}×{stats.avgIntervalDays !== null && ` · one usually lasts ~${stats.avgIntervalDays} days`}
            </p>
          )}

          {failed ? (
            <p className="text-sm py-4" style={{ color: 'var(--c-expense)' }}>Couldn't load the history.</p>
          ) : history === null ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--c-border)', borderTopColor: 'var(--c-accent)' }} />
            </div>
          ) : history.length === 0 ? (
            <EmptyState compact icon="🧾" message={`No purchases of ${item.name} yet`} />
          ) : (
            <div>
              {history.map((p, i) => {
                // The next-newer purchase replaced this one.
                const replacedBy = i > 0 ? history[i - 1] : null;
                const qty = [p.quantity, p.unit].filter(Boolean).join(' ');
                return (
                  <div key={`${p.transactionId}-${i}`} className="cred-divider flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: 'var(--c-text)' }}>
                        {shortDate(p.date)}{qty && <span style={{ color: 'var(--c-muted)' }}> · {qty}</span>}
                      </p>
                      <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>
                        {replacedBy
                          ? `Lasted ${daysBetween(p.date, replacedBy.date)} days`
                          : `In use · ${daysBetween(p.date, new Date())} days so far`}
                      </p>
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{formatCurrency(p.amount)}</span>
                  </div>
                );
              })}
            </div>
          )}

          <button type="button" onClick={onClose} className="t-btn-ghost w-full mt-4">Close</button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function AddItemModal({ categories, initialCategoryId, onClose, onCreate }: {
  categories: Category[];
  initialCategoryId: string;
  onClose: () => void;
  onCreate: (categoryId: string, data: { name: string; defaultQuantity?: number; unit?: string }) => Promise<CategoryItem>;
}) {
  const items = useCategoryItemStore((s) => s.items);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [added, setAdded] = useState<string[]>([]);

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" />
      {/* Top-anchored on desktop (not centred) so the panel grows downward
          instead of re-centring and jumping as its content changes. */}
      <div className="fixed inset-0 flex items-end sm:items-start justify-center p-0 sm:p-4 sm:pt-[10vh]">
        <DialogPanel className="cartoon-modal w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl overflow-y-auto max-h-[90dvh] sm:max-h-[85dvh]" style={{ background: 'var(--c-surface)' }}>
          <DialogTitle className="cred-serif text-base font-semibold mb-4" style={{ color: 'var(--c-text)' }}>Add Item</DialogTitle>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Category</label>
          <div className="mb-3">
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={(id) => { setCategoryId(id); setAdded([]); }}
              placeholder="Select a category"
              grouped
              inline
            />
          </div>
          {categoryId ? (
            // Stays open after each add so several items can be entered in a row.
            <ItemFields
              key={`${categoryId}-${added.length}`}
              categoryItems={items.filter((i) => i.categoryId === categoryId)}
              submitLabel="Add item"
              onSubmit={async (data) => {
                const item = await onCreate(categoryId, data);
                setAdded((a) => [...a, item.name]);
              }}
            />
          ) : (
            <p className="text-sm py-2" style={{ color: 'var(--c-muted)' }}>Pick a category first.</p>
          )}
          {added.length > 0 && (
            <p className="text-xs mt-3" style={{ color: 'var(--c-income)' }}>Added: {added.join(', ')}</p>
          )}
          <button type="button" onClick={onClose} className="t-btn-ghost w-full mt-4">Done</button>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Items;
