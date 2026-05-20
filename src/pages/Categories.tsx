import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useCategoryStore, { type Category } from '../store/categoryStore';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['income', 'expense']),
  icon: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

function Categories() {
  const { categories, isLoading, fetchCategories, createCategory, updateCategory, deleteCategory } =
    useCategoryStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filtered = filterType === 'all' ? categories : categories.filter((c) => c.type === filterType);
  const defaultCategories = filtered.filter((c) => !c.userId);
  const userCategories = filtered.filter((c) => !!c.userId);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your transaction categories</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Category
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="mt-6 flex gap-2">
        {(['all', 'expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              filterType === t
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {t === 'all' ? 'All' : t === 'expense' ? 'Expense' : 'Income'}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* User Categories */}
          {userCategories.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Your Categories</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {userCategories.map((cat) => (
                  <CategoryCard
                    key={cat._id}
                    category={cat}
                    isCustom
                    onEdit={() => setEditingCategory(cat)}
                    onDelete={() => setDeletingCategory(cat)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Default Categories */}
          {defaultCategories.length > 0 && (
            <div className="mt-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Default Categories</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {defaultCategories.map((cat) => (
                  <CategoryCard key={cat._id} category={cat} />
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="mt-8 text-center text-gray-500">
              <p>No categories found. Add your first custom category.</p>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      <CategoryModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSubmit={async (data) => {
          await createCategory(data);
          setShowCreate(false);
        }}
        title="Add Category"
        submitLabel="Create"
      />

      {/* Edit Modal */}
      {editingCategory && (
        <CategoryModal
          open
          onClose={() => setEditingCategory(null)}
          onSubmit={async (data) => {
            await updateCategory(editingCategory._id, data);
            setEditingCategory(null);
          }}
          title="Edit Category"
          submitLabel="Save"
          defaultValues={{
            name: editingCategory.name,
            type: editingCategory.type,
            icon: editingCategory.icon || '',
          }}
        />
      )}

      {/* Delete Confirmation */}
      {deletingCategory && (
        <DeleteConfirmModal
          category={deletingCategory}
          onClose={() => setDeletingCategory(null)}
          onConfirm={async () => {
            await deleteCategory(deletingCategory._id);
            setDeletingCategory(null);
          }}
        />
      )}
    </div>
  );
}

function CategoryCard({
  category,
  isCustom,
  onEdit,
  onDelete,
}: {
  category: Category;
  isCustom?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow">
      <div className="flex items-center gap-3">
        <span className="text-xl">{category.icon || (category.type === 'income' ? '\u{1F4B0}' : '\u{1F4B8}')}</span>
        <div>
          <h3 className="font-medium text-gray-900">{category.name}</h3>
          <span
            className={`inline-block mt-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
              category.type === 'income'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {category.type}
          </span>
        </div>
      </div>
      {isCustom && (
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            title="Edit"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            title="Delete"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

function CategoryModal({
  open,
  onClose,
  onSubmit,
  title,
  submitLabel,
  defaultValues,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CategoryFormData) => Promise<void>;
  title: string;
  submitLabel: string;
  defaultValues?: CategoryFormData;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: defaultValues || { name: '', type: 'expense', icon: '' },
  });

  useEffect(() => {
    if (open) reset(defaultValues || { name: '', type: 'expense', icon: '' });
  }, [open, reset, defaultValues]);

  const handleFormSubmit = async (data: CategoryFormData) => {
    try {
      await onSubmit(data);
      reset();
    } catch {
      // handled by store
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">{title}</DialogTitle>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                {...register('name')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Groceries"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                {...register('type')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Icon (emoji, optional)</label>
              <input
                {...register('icon')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. \u{1F6D2}"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : submitLabel}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function DeleteConfirmModal({
  category,
  onClose,
  onConfirm,
}: {
  category: Category;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } catch {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">Delete Category</DialogTitle>
          <p className="mt-2 text-sm text-gray-600">
            Are you sure you want to delete <span className="font-medium">"{category.name}"</span>? This action cannot
            be undone.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Categories;
