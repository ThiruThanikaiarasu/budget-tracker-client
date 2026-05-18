import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export interface CategoryBudget {
  categoryId: { _id: string; name: string; icon: string } | string;
  limit: number;
  frequency: 'daily' | 'monthly';
}

export interface Budget {
  _id: string;
  month: string;
  overallLimit?: number;
  categoryBudgets: CategoryBudget[];
}

export interface DaySummary {
  day: number;
  spent: number;
  dailyLimit: number | null;
  isOver: boolean;
}

export interface CategorySummaryItem {
  categoryId: { _id: string; name: string; icon: string };
  limit: number;
  frequency: 'daily' | 'monthly';
  dailyLimit: number | null;
  totalSpent: number;
}

export interface MonthlySummary {
  month: string;
  daysInMonth: number;
  overallLimit: number | null;
  dailyLimit: number | null;
  totalSpent: number;
  days: DaySummary[];
  categorySummary: CategorySummaryItem[];
}

export interface TodayCategoryStatus {
  categoryId: { _id: string; name: string; icon: string };
  frequency: 'daily' | 'monthly';
  limit: number;
  effectiveLimit: number;
  spent: number;
  isOver: boolean;
}

export interface TodaySummary {
  dailyLimit: number | null;
  spent: number;
  isOver: boolean;
  categoryStatus: TodayCategoryStatus[];
}

interface BudgetState {
  budget: Budget | null;
  monthlySummary: MonthlySummary | null;
  todaySummary: TodaySummary | null;
  isLoading: boolean;
  fetchBudget: (month: string) => Promise<void>;
  upsertBudget: (data: {
    month: string;
    overallLimit?: number;
    categoryBudgets?: { categoryId: string; limit: number; frequency: 'daily' | 'monthly' }[];
  }) => Promise<void>;
  fetchMonthlySummary: (month: string) => Promise<void>;
  fetchTodaySummary: () => Promise<void>;
}

const useBudgetStore = create<BudgetState>((set) => ({
  budget: null,
  monthlySummary: null,
  todaySummary: null,
  isLoading: false,

  fetchBudget: async (month) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/budgets/${month}`);
      set({ budget: data.budget, isLoading: false });
    } catch (error: any) {
      set({ budget: null, isLoading: false });
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.message || 'Failed to fetch budget');
      }
    }
  },

  upsertBudget: async (budgetData) => {
    try {
      const { data } = await api.post('/budgets', budgetData);
      set({ budget: data.budget });
      toast.success('Budget saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save budget');
      throw error;
    }
  },

  fetchMonthlySummary: async (month) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/budgets/${month}/summary`);
      set({ monthlySummary: data.summary, isLoading: false });
    } catch (error: any) {
      set({ monthlySummary: null, isLoading: false });
      if (error.response?.status !== 404) {
        toast.error(error.response?.data?.message || 'Failed to fetch summary');
      }
    }
  },

  fetchTodaySummary: async () => {
    try {
      const { data } = await api.get('/budgets/today');
      set({ todaySummary: data.summary });
    } catch {
      set({ todaySummary: null });
    }
  },
}));

export default useBudgetStore;
