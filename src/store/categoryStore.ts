import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export interface Category {
  _id: string;
  name: string;
  type: 'income' | 'expense';
  icon: string;
  userId?: string;
}

interface CategoryFormData {
  name: string;
  type: 'income' | 'expense';
  icon?: string;
}

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  fetchCategories: () => Promise<void>;
  createCategory: (data: CategoryFormData) => Promise<void>;
  updateCategory: (id: string, data: CategoryFormData) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  reorderCategories: (orderedIds: string[]) => Promise<void>;
}

const useCategoryStore = create<CategoryState>((set) => ({
  categories: [],
  isLoading: false,

  fetchCategories: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/categories');
      set({ categories: data.categories, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch categories');
    }
  },

  createCategory: async (formData) => {
    try {
      const { data } = await api.post('/categories', formData);
      set((state) => ({ categories: [...state.categories, data.category] }));
      toast.success('Category created');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create category');
      throw error;
    }
  },

  updateCategory: async (id, formData) => {
    try {
      const { data } = await api.put(`/categories/${id}`, formData);
      set((state) => ({
        categories: state.categories.map((c) => (c._id === id ? data.category : c)),
      }));
      toast.success('Category updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update category');
      throw error;
    }
  },

  deleteCategory: async (id) => {
    try {
      await api.delete(`/categories/${id}`);
      set((state) => ({
        categories: state.categories.filter((c) => c._id !== id),
      }));
      toast.success('Category removed');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove category');
      throw error;
    }
  },

  reorderCategories: async (orderedIds) => {
    // Update store immediately so navigation away/back keeps the order
    set((state) => {
      const orderMap = new Map(orderedIds.map((id, i) => [id, i]));
      return {
        categories: [...state.categories].sort((a, b) => {
          const ai = orderMap.has(a._id) ? orderMap.get(a._id)! : 9999;
          const bi = orderMap.has(b._id) ? orderMap.get(b._id)! : 9999;
          return ai - bi;
        }),
      };
    });
    try {
      await api.patch('/categories/reorder', { orderedIds });
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save order');
    }
  },
}));

export default useCategoryStore;
