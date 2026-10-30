import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

/** A sub-category under a Category, e.g. "Tomato" under Groceries. */
export interface CategoryItem {
  _id: string;
  categoryId: string;
  name: string;
  /** How it's measured (see unitGroupStore); unit ids below belong to this group. */
  unitGroupId?: string;
  /** Units offered for this item; absent/empty = all of the group's. */
  allowedUnitIds?: string[];
  defaultUnitId?: string;
  defaultQuantity?: number;
  /** Item-specific quick values replacing the group's for a unit. */
  presetOverrides?: { unitId: string; values: number[] }[];
  /** Legacy free-text unit (pre unit groups); the server migrates it. */
  unit?: string;
  /** Listed in the transaction form's item picker; absent on older items = true. */
  showInPicker?: boolean;
}

/** Purchase summary for an item, from transactions that list it. */
export interface ItemStats {
  itemId: string;
  count: number;
  lastDate: string;
  lastAmount: number;
  /** Average days between purchases — how long one usually lasts. */
  avgIntervalDays: number | null;
}

/** One purchase of an item. */
export interface ItemPurchase {
  transactionId: string;
  date: string;
  quantity?: number;
  unit?: string;
  amount: number;
}

/** Fetch every purchase of an item, newest first (not cached — always fresh). */
export async function fetchItemHistory(itemId: string): Promise<ItemPurchase[]> {
  const { data } = await api.get(`/category-items/${itemId}/history`);
  return data.history;
}

/** Whole days from `from` to `to` (dates only, time ignored). */
export function daysBetween(from: string | Date, to: string | Date): number {
  const day = (d: string | Date) => {
    const x = new Date(d);
    return Date.UTC(x.getFullYear(), x.getMonth(), x.getDate());
  };
  return Math.round((day(to) - day(from)) / 86_400_000);
}

/** "14 Jul" (adds the year when it isn't this year). */
export function shortDate(d: string | Date): string {
  const x = new Date(d);
  const sameYear = x.getFullYear() === new Date().getFullYear();
  return x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** Older items have no flag — they're shown. */
export const isShownInPicker = (item: CategoryItem) => item.showInPicker !== false;

export interface CategoryItemFormData {
  name: string;
  unitGroupId?: string;
  allowedUnitIds?: string[];
  defaultUnitId?: string;
  defaultQuantity?: number;
  presetOverrides?: { unitId: string; values: number[] }[];
}

interface CategoryItemState {
  items: CategoryItem[];
  loaded: boolean;
  fetchItems: () => Promise<void>;
  createItem: (categoryId: string, data: CategoryItemFormData) => Promise<CategoryItem>;
  updateItem: (id: string, data: CategoryItemFormData) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  setShownInPicker: (ids: string[], show: boolean) => Promise<void>;
  stats: Record<string, ItemStats>;
  fetchStats: () => Promise<void>;
}

// All of the user's items are loaded once (the list is small) and filtered by
// category in the UI.
const useCategoryItemStore = create<CategoryItemState>((set) => ({
  items: [],
  loaded: false,
  stats: {},

  fetchStats: async () => {
    try {
      const { data } = await api.get('/category-items/stats');
      set({ stats: Object.fromEntries((data.stats as ItemStats[]).map((s) => [s.itemId, s])) });
    } catch {
      // Stats are a nice-to-have; the page works without them.
    }
  },

  fetchItems: async () => {
    try {
      const { data } = await api.get('/category-items');
      set({ items: data.items, loaded: true });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch items');
    }
  },

  createItem: async (categoryId, formData) => {
    try {
      const { data } = await api.post('/category-items', { categoryId, ...formData });
      set((state) => ({ items: [...state.items, data.item] }));
      return data.item;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add item');
      throw error;
    }
  },

  updateItem: async (id, formData) => {
    try {
      const { data } = await api.put(`/category-items/${id}`, formData);
      set((state) => ({ items: state.items.map((i) => (i._id === id ? data.item : i)) }));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update item');
      throw error;
    }
  },

  // Optimistic: tick/untick immediately, roll back if the server rejects it.
  setShownInPicker: async (ids, show) => {
    const idSet = new Set(ids);
    const previous = new Map<string, boolean | undefined>();
    set((state) => ({
      items: state.items.map((i) => {
        if (!idSet.has(i._id)) return i;
        previous.set(i._id, i.showInPicker);
        return { ...i, showInPicker: show };
      }),
    }));
    try {
      await api.patch('/category-items/visibility', { ids, showInPicker: show });
    } catch (error: any) {
      set((state) => ({
        items: state.items.map((i) => (previous.has(i._id) ? { ...i, showInPicker: previous.get(i._id) } : i)),
      }));
      toast.error(error.response?.data?.message || 'Failed to update items');
    }
  },

  deleteItem: async (id) => {
    try {
      await api.delete(`/category-items/${id}`);
      set((state) => ({ items: state.items.filter((i) => i._id !== id) }));
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete item');
      throw error;
    }
  },
}));

export default useCategoryItemStore;
