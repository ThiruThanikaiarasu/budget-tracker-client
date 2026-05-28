import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useCategoryStore, { type Category } from '../store/categoryStore';
import useDashboardStore from '../store/dashboardStore';
import useAccountStore from '../store/accountStore';
import { formatCurrency } from '../utils/format';
import { CATEGORY_ICONS, renderCategoryIcon } from '../utils/categoryIcons';


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
  const { categories, isLoading, fetchCategories, createCategory, updateCategory, deleteCategory, reorderCategories } = useCategoryStore();
  const { summary, fetchSummary } = useDashboardStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [incomeItems, setIncomeItems] = useState<Category[]>([]);
  const [expenseItems, setExpenseItems] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchSummary();
    fetchAccounts();
  }, [fetchCategories, fetchSummary, fetchAccounts]);

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

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* ── Summary header ─────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-4 text-center" style={{ background: 'var(--c-header-bg)' }}>
        <p className="text-base font-semibold" style={{ color: 'var(--c-text)' }}>
          [ All Accounts {formatCurrency(totalBalance)} ]
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Expense so far</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-expense)' }}>
              {summary ? formatCurrency(summary.totalExpense) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Income so far</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-income)' }}>
              {summary ? formatCurrency(summary.totalIncome) : '—'}
            </p>
          </div>
        </div>
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
              <div className="px-4 pt-4 pb-2">
                <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>Income categories</p>
                <div className="mt-1 h-px" style={{ background: 'var(--c-border)' }} />
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
                  />
                ))}
              </SortableContext>
            </div>
          )}

          {/* ── Expense categories ───────────────────────────────── */}
          {expenseItems.length > 0 && (
            <div>
              <div className="px-4 pt-4 pb-2">
                <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>Expense categories</p>
                <div className="mt-1 h-px" style={{ background: 'var(--c-border)' }} />
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
                  />
                ))}
              </SortableContext>
            </div>
          )}

          {categories.length === 0 && (
            <div className="flex flex-col items-center py-16 gap-2">
              <span className="text-4xl opacity-30">🏷️</span>
              <p className="text-sm" style={{ color: 'var(--c-muted)' }}>No categories yet</p>
            </div>
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

      {/* ── Add new category button ──────────────────────────── */}
      <div className="px-4 py-6">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-3 rounded-xl text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2"
          style={{ border: '1px solid var(--c-accent)', color: 'var(--c-accent)' }}
        >
          <span className="text-lg leading-none">⊕</span>
          Add New Category
        </button>
      </div>

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
  isOverlay?: boolean;
  dragListeners?: Record<string, unknown>;
}

function SortableCategoryRow({
  category,
  openMenuId,
  setOpenMenuId,
  onEdit,
  onDelete,
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
        dragListeners={listeners as Record<string, unknown>}
      />
    </div>
  );
}

function CategoryRow({ category, openMenuId, setOpenMenuId, onEdit, onDelete, isOverlay, dragListeners }: RowProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3"
      style={{
        borderBottom: isOverlay ? 'none' : '1px solid var(--c-border)',
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
      {renderCategoryIcon(category.icon, category.name, 40)}

      {/* Name */}
      <p className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>
        {category.name}
      </p>

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
              className="absolute right-0 z-20 mt-1 w-32 rounded-xl py-1 shadow-xl"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
            >
              <button
                onClick={() => { onEdit(); setOpenMenuId(null); }}
                className="block w-full px-4 py-2.5 text-left text-sm"
                style={{ color: 'var(--c-text)' }}
              >
                Edit
              </button>
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
        <DialogPanel className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl overflow-y-auto" style={{ background: 'var(--c-surface)', maxHeight: '90dvh' }}>
          <DialogTitle className="text-base font-bold mb-4" style={{ color: 'var(--c-text)' }}>{title}</DialogTitle>
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

  useEffect(() => { if (open) reset(defaultValues || { name: '', type: 'expense', icon: '' }); }, [open, reset, defaultValues]);
  const handleFormSubmit = async (data: CategoryFormData) => { try { await onSubmit(data); reset(); } catch {} };
  if (!open) return null;

  return (
    <ModalWrap title={title} onClose={onClose}>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Name</label>
          <input {...register('name')} className="t-input" placeholder="e.g. Groceries" />
          {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Type</label>
          <select {...register('type')} className="t-select">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        {/* ── Icon picker ──────────────────────────────────────────── */}
        <div>
          <label className="block text-xs font-medium mb-2" style={{ color: 'var(--c-muted)' }}>Icon</label>
          <div
            className="grid rounded-xl p-3"
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
                className="flex flex-col items-center gap-1 rounded-xl transition-all"
                style={{
                  padding: '8px 4px',
                  outline: selectedIcon === icon.key ? `2.5px solid var(--c-accent)` : '2.5px solid transparent',
                  outlineOffset: '1px',
                  background: selectedIcon === icon.key ? 'var(--c-surface2)' : 'transparent',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
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
