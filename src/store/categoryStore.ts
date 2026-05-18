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

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  fetchCategories: () => Promise<void>;
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
}));

export default useCategoryStore;
