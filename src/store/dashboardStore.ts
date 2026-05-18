import { create } from 'zustand';
import api from '../api/axios';
import type { Transaction } from './transactionStore';

interface Summary {
  totalIncome: number;
  totalExpense: number;
  net: number;
}

interface CategoryBreakdownItem {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  total: number;
}

interface TrendItem {
  month: string;
  income: number;
  expense: number;
}

interface DashboardState {
  summary: Summary | null;
  breakdown: CategoryBreakdownItem[];
  trend: TrendItem[];
  recentTransactions: Transaction[];
  isLoading: boolean;
  fetchSummary: () => Promise<void>;
  fetchCategoryBreakdown: (month?: string) => Promise<void>;
  fetchMonthlyTrend: (months?: number) => Promise<void>;
  fetchRecentTransactions: () => Promise<void>;
}

const useDashboardStore = create<DashboardState>((set) => ({
  summary: null,
  breakdown: [],
  trend: [],
  recentTransactions: [],
  isLoading: false,

  fetchSummary: async () => {
    try {
      const { data } = await api.get('/dashboard/summary');
      set({ summary: data.summary });
    } catch {
      // silently fail — dashboard is non-critical
    }
  },

  fetchCategoryBreakdown: async (month?: string) => {
    try {
      const params = month ? `?month=${month}` : '';
      const { data } = await api.get(`/dashboard/category-breakdown${params}`);
      set({ breakdown: data.breakdown });
    } catch {
      // silently fail
    }
  },

  fetchMonthlyTrend: async (months?: number) => {
    try {
      const params = months ? `?months=${months}` : '';
      const { data } = await api.get(`/dashboard/monthly-trend${params}`);
      set({ trend: data.trend });
    } catch {
      // silently fail
    }
  },

  fetchRecentTransactions: async () => {
    try {
      const { data } = await api.get('/transactions?limit=10&page=1');
      set({ recentTransactions: data.transactions });
    } catch {
      // silently fail
    }
  },
}));

export default useDashboardStore;
