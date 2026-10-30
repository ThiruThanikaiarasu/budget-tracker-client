import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import ThemedSelect from '../components/ThemedSelect';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useCategoryStore, { type Category } from '../store/categoryStore';
import useDashboardStore from '../store/dashboardStore';
import useAccountStore from '../store/accountStore';
import useThemeStore from '../store/themeStore';
import Amount from '../components/Amount';
import { CATEGORY_ICONS, renderCategoryIcon } from '../utils/categoryIcons';
import CartoonIcon, { CartoonTile } from '../components/CartoonIcon';
import { CartoonHead, Sticker } from '../components/cartoon';
import { CATEGORY_KINDS, categoryKind } from '../utils/cartoonKinds';
import useCategoryItemStore, { type CategoryItem } from '../store/categoryItemStore';
import ItemFields from '../components/ItemFields';
import EmptyState from '../components/EmptyState';
import useUnitGroupStore, { defaultLabel } from '../store/unitGroupStore';


function GripIcon() {
  return (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
      <circle cx="5" cy="3.5" r="1.2" />
      <circle cx="11" cy="3.5" r="1.2" />
      <circle cx="5" cy="8" r="1.2" />
      <circle cx="11" cy="8" r="1.2" />
      <circle cx="5" cy="12.5" r="1.2" />
      <circle cx="11" cy="12.5" r="1.2" />
    </svg>
  );
}

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['income', 'expense']),
  icon: z.string().optional(),
});
type CategoryFormData = z.infer<typeof categorySchema>;

function Categories() {
  const isCredWhite = useThemeStore((s) => s.theme === 'cred-white');
  const isCartoon = useThemeStore((s) => s.theme === 'cartoon');
  const { categories, isLoading, fetchCategories, createCategory, updateCategory, deleteCategory, reorderCategories } = useCategoryStore();
  const { summary, fetchSummary } = useDashboardStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const fetchItems = useCategoryItemStore((s) => s.fetchItems);
  const [showCreate, setShowCreate] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [itemsCategory, setItemsCategory] = useState<Category | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [incomeItems, setIncomeItems] = useState<Category[]>([]);
  const [expenseItems, setExpenseItems] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchSummary();
    fetchAccounts();
    fetchItems();
  }, [fetchCategories, fetchSummary, fetchAccounts, fetchItems]);

  useEffect(() => {
    setIncomeItems(categories.filter(c => c.type === 'income'));
    setExpenseItems(categories.filter(c => c.type === 'expense'));
  }, [categories]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 5 } }),
  );

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id as string);
    setOpenMenuId(null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeIdStr = active.id as string;
    const overIdStr = over.id as string;
    const inIncome = incomeItems.some(c => c._id === activeIdStr);

    if (inIncome) {
      const oldIdx = incomeItems.findIndex(c => c._id === activeIdStr);
      const newIdx = incomeItems.findIndex(c => c._id === overIdStr);
      if (oldIdx === -1 || newIdx === -1) return;
      const newIncome = arrayMove(incomeItems, oldIdx, newIdx);
      setIncomeItems(newIncome);
      reorderCategories([...newIncome, ...expenseItems].map(c => c._id));
    } else {
      const oldIdx = expenseItems.findIndex(c => c._id === activeIdStr);
      const newIdx = expenseItems.findIndex(c => c._id === overIdStr);
      if (oldIdx === -1 || newIdx === -1) return;
      const newExpense = arrayMove(expenseItems, oldIdx, newIdx);
      setExpenseItems(newExpense);
      reorderCategories([...incomeItems, ...newExpense].map(c => c._id));
    }
  }

  const allItems = [...incomeItems, ...expenseItems];
  const activeItem = activeId ? allItems.find(c => c._id === activeId) : null;
  const totalBalance = accounts.filter(a => a.isActive).reduce((s, a) => s + a.balance, 0);

  if (isCartoon) {
    const section = (title: string, color: string, list: Category[]) => (
      <section className="flex flex-col gap-3">
        <h2 className="cartoon-section-title flex items-center gap-2">
          <i className="cartoon-swatch" style={{ background: color }} /> {title}
          <span className="cartoon-count">{list.length}</span>
        </h2>
        <SortableContext items={list.map(c => c._id)} strategy={rectSortingStrategy}>
          <div className="cartoon-cat-grid">
            {list.map(cat => (
              <SortableCategoryRow
                key={cat._id} category={cat} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                onEdit={() => setEditingCategory(cat)} onDelete={() => setDeletingCategory(cat)} onItems={() => setItemsCategory(cat)}
              />
            ))}
            {title === 'Money out' && (
              <button className="cartoon-card cartoon-cat-add" onClick={() => setShowCreate(true)}>+ Add one</button>
            )}
          </div>
        </SortableContext>
      </section>
    );
    return (
      <div className="cartoon-page">
        <CartoonHead
          kicker="Sort your spending"
          title="Categories"
          actions={<button onClick={() => setShowCreate(true)} className="cartoon-btn is-primary">+ New category</button>}
        />
        {isLoading ? (
          <div className="flex justify-center py-16"><div className="cartoon-spinner" /></div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {section('Money out', 'var(--c-tomato)', expenseItems)}
            {section('Money in', 'var(--c-leaf)', incomeItems)}
            {categories.length === 0 && <EmptyState icon="🏷️" message="No categories yet" />}
            <DragOverlay dropAnimation={null}>
              {activeItem ? (
                <CategoryRow category={activeItem} isOverlay openMenuId={null} setOpenMenuId={() => {}} onEdit={() => {}} onDelete={() => {}} />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        <CategoryModal
          open={showCreate} onClose={() => setShowCreate(false)}
          onSubmit={async (data) => { await createCategory(data); setShowCreate(false); }}
          title="New category" submitLabel="Create"
        />
        {editingCategory && (
          <CategoryModal
            open onClose={() => setEditingCategory(null)}
            onSubmit={async (data) => { await updateCategory(editingCategory._id, data); setEditingCategory(null); }}
            title="Edit category" submitLabel="Save changes"
            defaultValues={{ name: editingCategory.name, type: editingCategory.type as 'income' | 'expense', icon: editingCategory.icon || '' }}
          />
        )}
        {itemsCategory && <CategoryItemsModal category={itemsCategory} onClose={() => setItemsCategory(null)} />}
        {deletingCategory && (
          <DeleteConfirmModal
            category={deletingCategory} onClose={() => setDeletingCategory(null)}
            onConfirm={async () => { await deleteCategory(deletingCategory._id); setDeletingCategory(null); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="categories-page" style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* ── Summary header ─────────────────────────────────────────── */}
      <div className="categories-header px-4 pt-6 pb-4 text-center" style={{ background: 'var(--c-header-bg)' }}>
        <p className="cred-label">{isCredWhite ? 'categories' : 'All accounts'}</p>
        <p className="cred-serif mt-1 text-3xl font-semibold" style={{ color: 'var(--c-text)' }}>
          <Amount value={totalBalance} />
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="cred-label">Expense so far</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-expense)' }}>
              {summary ? <Amount value={summary.totalExpense} /> : '—'}
            </p>
          </div>
          <div>
            <p className="cred-label">Income so far</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-income)' }}>
              {summary ? <Amount value={summary.totalIncome} /> : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Add new category — pinned to the top so it's reachable while scrolling ── */}
      <div className="categories-add sticky top-0 z-10 px-4 py-3" style={{ background: 'var(--c-bg)' }}>
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
          style={{ border: '1px solid var(--c-accent)', color: 'var(--c-accent)', background: 'var(--c-bg)' }}
        >
          <span className="text-lg leading-none">⊕</span>
          Add New Category
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--c-border)', borderTopColor: 'var(--c-accent)' }} />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* ── Income categories ────────────────────────────────── */}
          {incomeItems.length > 0 && (
            <div>
              <div className="categories-section-heading px-4 pt-4 pb-2">
                <p className="cred-label">Income categories</p>
              </div>
              <SortableContext items={incomeItems.map(c => c._id)} strategy={verticalListSortingStrategy}>
                {incomeItems.map(cat => (
                  <SortableCategoryRow
                    key={cat._id}
                    category={cat}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    onEdit={() => setEditingCategory(cat)}
                    onDelete={() => setDeletingCategory(cat)}
                    onItems={() => setItemsCategory(cat)}
                  />
                ))}
              </SortableContext>
            </div>
          )}

          {/* ── Expense categories ───────────────────────────────── */}
          {expenseItems.length > 0 && (
            <div>
              <div className="categories-section-heading px-4 pt-4 pb-2">
                <p className="cred-label">Expense categories</p>
              </div>
              <SortableContext items={expenseItems.map(c => c._id)} strategy={verticalListSortingStrategy}>
                {expenseItems.map(cat => (
                  <SortableCategoryRow
                    key={cat._id}
                    category={cat}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    onEdit={() => setEditingCategory(cat)}
                    onDelete={() => setDeletingCategory(cat)}
                    onItems={() => setItemsCategory(cat)}
                  />
                ))}
              </SortableContext>
            </div>
          )}

          {categories.length === 0 && (
            <EmptyState icon="🏷️" message="No categories yet" />
          )}

          <DragOverlay dropAnimation={null}>
            {activeItem ? (
              <CategoryRow
                category={activeItem}
                isOverlay
                openMenuId={null}
                setOpenMenuId={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Modals */}
      <CategoryModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async (data) => { await createCategory(data); setShowCreate(false); }}
        title="Add Category"
        submitLabel="Create"
      />
      {editingCategory && (
        <CategoryModal
          open
          onClose={() => setEditingCategory(null)}
          onSubmit={async (data) => { await updateCategory(editingCategory._id, data); setEditingCategory(null); }}
          title="Edit Category"
          submitLabel="Save"
          defaultValues={{ name: editingCategory.name, type: editingCategory.type as 'income' | 'expense', icon: editingCategory.icon || '' }}
        />
      )}
      {itemsCategory && (
        <CategoryItemsModal category={itemsCategory} onClose={() => setItemsCategory(null)} />
      )}
      {deletingCategory && (
        <DeleteConfirmModal
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
          onConfirm={async () => { await deleteCategory(deletingCategory._id); setDeletingCategory(null); }}
        />
      )}
    </div>
  );
}

interface RowProps {
  category: Category;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Manage the category's sub-category items. */
  onItems?: () => void;
  isOverlay?: boolean;
  dragListeners?: Record<string, unknown>;
}

function SortableCategoryRow({
  category,
  openMenuId,
  setOpenMenuId,
  onEdit,
  onDelete,
  onItems,
}: Omit<RowProps, 'isOverlay' | 'dragListeners'>) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: category._id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      {...attributes}
    >
      <CategoryRow
        category={category}
        openMenuId={openMenuId}
        setOpenMenuId={setOpenMenuId}
        onEdit={onEdit}
        onDelete={onDelete}
        onItems={onItems}
        dragListeners={listeners as Record<string, unknown>}
      />
    </div>
  );
}

function CategoryRow({ category, openMenuId, setOpenMenuId, onEdit, onDelete, onItems, isOverlay, dragListeners }: RowProps) {
  const items = useCategoryItemStore((s) => s.items).filter((i) => i.categoryId === category._id);
  const preview = items.slice(0, 3).map((i) => i.name).join(', ') + (items.length > 3 ? ` +${items.length - 3}` : '');
  const isCartoon = useThemeStore((s) => s.theme === 'cartoon');
  if (isCartoon) {
    const isSystem = ['settlement', 'waived', 'clean up'].includes(category.name.trim().toLowerCase());
    return (
      <div className={`cartoon-cat ${isOverlay ? 'is-overlay' : ''}`}>
        <div className="cartoon-grip" style={{ touchAction: 'none' }} {...(dragListeners ?? {})} aria-label="Drag to reorder"><GripIcon /></div>
        <CartoonTile kind={categoryKind(category.icon, category.name)} size={54} />
        <button type="button" onClick={onItems} disabled={!onItems || isOverlay} className="min-w-0 flex-1 text-left">
          <p className="cartoon-cat-name">{category.name}</p>
          {isSystem ? <Sticker tone="grape" tilt={-2}>System</Sticker>
            : items.length > 0 && <p className="cartoon-sub" style={{ fontSize: 12 }}>{preview}</p>}
        </button>
        {!isOverlay && (
          <div className="relative">
            <button
              aria-label={`${category.name} options`} className="cartoon-dots" onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === category._id ? null : category._id); }}
            >···</button>
            {openMenuId === category._id && (
              <div onClick={e => e.stopPropagation()} className="cartoon-menu">
                <button onClick={() => { onEdit(); setOpenMenuId(null); }}>Edit</button>
                {onItems && <button onClick={() => { onItems(); setOpenMenuId(null); }}>Items</button>}
                <button className="is-danger" onClick={() => { onDelete(); setOpenMenuId(null); }}>{category.userId ? 'Delete' : 'Remove'}</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className={`category-row ${isOverlay ? 'is-overlay flex items-center gap-3 px-4 py-3' : 'cred-divider flex items-center gap-3 px-4 py-3'}`}
      style={{
        background: isOverlay ? 'var(--c-surface)' : undefined,
        boxShadow: isOverlay ? '0 8px 32px rgba(0,0,0,0.18)' : undefined,
        borderRadius: isOverlay ? '14px' : undefined,
      }}
    >
      {/* Drag handle — long-press on mobile, click-drag on desktop */}
      <div
        className="flex-shrink-0 cursor-grab active:cursor-grabbing select-none"
        style={{ color: 'var(--c-muted)', opacity: 0.45, touchAction: 'none' }}
        {...(dragListeners ?? {})}
      >
        <GripIcon />
      </div>

      {/* Icon circle */}
      <span className="category-row-icon">{renderCategoryIcon(category.icon, category.name, 40)}</span>

      {/* Name + items — tap to manage the category's items */}
      <button
        type="button"
        onClick={onItems}
        disabled={!onItems || isOverlay}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>{category.name}</p>
        <p className="text-xs truncate" style={{ color: 'var(--c-muted)' }}>
          {items.length > 0 ? preview : '+ Add items'}
        </p>
      </button>

      {/* Three-dot menu — all categories now */}
      {!isOverlay && (
        <div className="relative flex-shrink-0">
          <button
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === category._id ? null : category._id); }}
            className="p-2"
            style={{ color: 'var(--c-muted)' }}
          >
            ···
          </button>
          {openMenuId === category._id && (
            <div
              onClick={e => e.stopPropagation()}
              className="category-row-menu absolute right-0 z-20 mt-1 w-32 rounded-xl py-1 shadow-xl"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
            >
              <button
                onClick={() => { onEdit(); setOpenMenuId(null); }}
                className="block w-full px-4 py-2.5 text-left text-sm"
                style={{ color: 'var(--c-text)' }}
              >
                Edit
              </button>
              {onItems && (
                <button
                  onClick={() => { onItems(); setOpenMenuId(null); }}
                  className="block w-full px-4 py-2.5 text-left text-sm"
                  style={{ color: 'var(--c-text)' }}
                >
                  Items
                </button>
              )}
              <button
                onClick={() => { onDelete(); setOpenMenuId(null); }}
                className="block w-full px-4 py-2.5 text-left text-sm"
                style={{ color: 'var(--c-expense)' }}
              >
                {category.userId ? 'Delete' : 'Remove'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ModalWrap({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <DialogPanel className="cartoon-modal category-modal w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl overflow-y-auto" style={{ background: 'var(--c-surface)', maxHeight: '90dvh' }}>
          <DialogTitle className="cred-serif text-base font-semibold mb-4" style={{ color: 'var(--c-text)' }}>{title}</DialogTitle>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function CategoryModal({ open, onClose, onSubmit, title, submitLabel, defaultValues }: {
  open: boolean; onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  title: string; submitLabel: string;
  defaultValues?: CategoryFormData;
}) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: defaultValues || { name: '', type: 'expense', icon: '' },
  });
  const selectedIcon = watch('icon');
  const isCartoon = useThemeStore((s) => s.theme === 'cartoon');
  const typeValue = watch('type');
  const nameValue = watch('name');

  useEffect(() => { if (open) reset(defaultValues || { name: '', type: 'expense', icon: '' }); }, [open, reset, defaultValues]);
  const handleFormSubmit = async (data: CategoryFormData) => { try { await onSubmit(data); reset(); } catch {} };
  if (!open) return null;

  return (
    <ModalWrap title={title} onClose={onClose}>
      {isCartoon ? (
        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <CartoonTile kind={categoryKind(selectedIcon, nameValue || '')} size={84} className="is-big" />
            <div className="flex-1 min-w-0">
              <label className="cartoon-kicker">Name</label>
              <input {...register('name')} className="t-input mt-1" placeholder="e.g. Groceries" />
              {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.name.message}</p>}
            </div>
          </div>
          <div className="cartoon-seg">
            <button type="button" className={typeValue === 'expense' ? 'is-on is-spend' : ''} onClick={() => setValue('type', 'expense')}>Money out</button>
            <button type="button" className={typeValue === 'income' ? 'is-on is-earn' : ''} onClick={() => setValue('type', 'income')}>Money in</button>
          </div>
          <div>
            <p className="cartoon-kicker mb-2">Picture</p>
            <div className="cartoon-pic-grid">
              {CATEGORY_KINDS.map(kind => {
                const on = categoryKind(selectedIcon, nameValue || '') === kind && !!selectedIcon?.startsWith('kind:');
                return (
                  <button key={kind} type="button" aria-label={kind} aria-pressed={on} className={`cartoon-pic ${on ? 'is-on' : ''}`}
                    onClick={() => setValue('icon', on ? '' : `kind:${kind}`)}>
                    <CartoonIcon kind={kind} size={40} />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="cartoon-btn flex-1">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="cartoon-btn is-primary flex-1">{isSubmitting ? 'Saving...' : submitLabel}</button>
          </div>
        </form>
      ) : (
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Name</label>
          <input {...register('name')} className="t-input" placeholder="e.g. Groceries" />
          {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Type</label>
          <ThemedSelect
            value={watch('type')}
            onChange={(v) => setValue('type', v as 'expense' | 'income', { shouldValidate: true })}
            options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]}
          />
        </div>

        {/* ── Icon picker ──────────────────────────────────────────── */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--c-muted)' }}>Icon</label>
          <div
            className="category-icon-picker grid rounded-xl p-3"
            style={{
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '12px',
              background: 'var(--c-bg)',
              border: '1px solid var(--c-border)',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {CATEGORY_ICONS.map(icon => (
              <button
                key={icon.key}
                type="button"
                onClick={() => setValue('icon', selectedIcon === icon.key ? '' : icon.key)}
                title={icon.label}
                className="category-icon-option flex flex-col items-center gap-1 rounded-xl transition-all"
                style={{
                  padding: '8px 4px',
                  outline: selectedIcon === icon.key ? `2.5px solid var(--c-accent)` : '2.5px solid transparent',
                  outlineOffset: '1px',
                  background: selectedIcon === icon.key ? 'var(--c-surface2)' : 'transparent',
                }}
              >
                <div
                  className="category-picker-icon w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: icon.bg }}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="white">
                    {Array.isArray(icon.d)
                      ? icon.d.map((d, i) => <path key={i} d={d} />)
                      : <path d={icon.d} />}
                  </svg>
                </div>
                <span className="text-[9px] leading-tight text-center truncate w-full" style={{ color: 'var(--c-muted)' }}>
                  {icon.label}
                </span>
              </button>
            ))}
          </div>
          {selectedIcon && CATEGORY_ICONS.find(i => i.key === selectedIcon) && (
            <p className="text-xs mt-1.5" style={{ color: 'var(--c-muted)' }}>
              Selected: {CATEGORY_ICONS.find(i => i.key === selectedIcon)?.label}
            </p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="t-btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="t-btn-primary flex-1">{isSubmitting ? 'Saving...' : submitLabel}</button>
        </div>
      </form>
      )}
    </ModalWrap>
  );
}

function CategoryItemsModal({ category, onClose }: { category: Category; onClose: () => void }) {
  const { items, loaded, fetchItems, createItem, updateItem, deleteItem } = useCategoryItemStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const categoryItems = items.filter((i) => i.categoryId === category._id);
  const { groups: unitGroups, loaded: unitsLoaded, fetchGroups } = useUnitGroupStore();
  useEffect(() => { if (!unitsLoaded) fetchGroups(); }, [unitsLoaded, fetchGroups]);

  useEffect(() => { if (!loaded) fetchItems(); }, [loaded, fetchItems]);

  const remove = async (item: CategoryItem) => {
    setDeletingId(item._id);
    try { await deleteItem(item._id); } catch { /* toast shown by the store */ }
    setDeletingId(null);
  };

  return (
    <ModalWrap title={`${category.name} · Items`} onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--c-muted)' }}>
        Items you can pick when adding a {category.name} expense. The default quantity and unit are prefilled and can be changed per purchase.
      </p>
      <ItemFields
        key={`add-${categoryItems.length}`}
        categoryItems={categoryItems}
        submitLabel="Add item"
        onSubmit={async (data) => { await createItem(category._id, data); }}
      />

      <div className="mt-4 space-y-1">
        {categoryItems.length === 0 && (
          <EmptyState compact icon="🧺" message="No items yet — add one above" />
        )}
        {categoryItems.map((item) => editingId === item._id ? (
          <div key={item._id} className="rounded-xl p-3" style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border)' }}>
            <ItemFields
              categoryItems={categoryItems}
              excludeId={item._id}
              initial={item}
              submitLabel="Save"
              onSubmit={async (data) => { await updateItem(item._id, data); setEditingId(null); }}
              onCancel={() => setEditingId(null)}
            />
          </div>
        ) : (
          <div key={item._id} className="cred-divider flex items-center gap-2 py-2">
            <p className="flex-1 text-sm truncate" style={{ color: 'var(--c-text)' }}>{item.name}</p>
            <span className="text-xs" style={{ color: 'var(--c-muted)' }}>{defaultLabel(item, unitGroups)}</span>
            <button type="button" onClick={() => setEditingId(item._id)} className="text-xs font-semibold px-2" style={{ color: 'var(--c-accent)' }}>Edit</button>
            <button type="button" onClick={() => remove(item)} disabled={deletingId === item._id} className="text-xs font-semibold px-2 disabled:opacity-40" style={{ color: 'var(--c-expense)' }}>Delete</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={onClose} className="t-btn-ghost w-full mt-4">Done</button>
    </ModalWrap>
  );
}

function DeleteConfirmModal({ category, onClose, onConfirm }: { category: Category; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [isDeleting, setIsDeleting] = useState(false);
  const isDefault = !category.userId;
  const handleDelete = async () => { setIsDeleting(true); try { await onConfirm(); } catch { setIsDeleting(false); } };
  return (
    <ModalWrap title={isDefault ? 'Remove Category' : 'Delete Category'} onClose={onClose}>
      <p className="text-sm mb-4" style={{ color: 'var(--c-muted)' }}>
        {isDefault
          ? <>Remove <span className="font-semibold" style={{ color: 'var(--c-text)' }}>"{category.name}"</span> from your list? You can re-add it later as a custom category.</>
          : <>Delete <span className="font-semibold" style={{ color: 'var(--c-text)' }}>"{category.name}"</span>? This cannot be undone.</>
        }
      </p>
      <div className="flex gap-3">
        <button onClick={onClose} className="t-btn-ghost flex-1">Cancel</button>
        <button onClick={handleDelete} disabled={isDeleting} className="t-btn-primary flex-1" style={{ background: 'var(--c-expense)', color: '#fff' }}>
          {isDeleting ? (isDefault ? 'Removing...' : 'Deleting...') : (isDefault ? 'Remove' : 'Delete')}
        </button>
      </div>
    </ModalWrap>
  );
}

export default Categories;
