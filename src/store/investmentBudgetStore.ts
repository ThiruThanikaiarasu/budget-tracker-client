import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';
import type { InvestmentType } from './investmentStore';

export interface InvestedEntry {
  type: InvestmentType;
  amount: number;
}

export interface MonthlyInvestmentBudget {
  month: string; // YYYY-MM
  budget: number;
  invested: InvestedEntry[];
}

interface InvestmentBudgetState {
  current: MonthlyInvestmentBudget | null;
  isLoading: boolean;
  fetchBudget: (month: string) => Promise<void>;
  saveBudget: (month: string, data: { budget: number; invested: InvestedEntry[] }) => Promise<void>;
}

const useInvestmentBudgetStore = create<InvestmentBudgetState>((set) => ({
  current: null,
  isLoading: false,

  fetchBudget: async (month) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/investment-budgets/${month}`);
      set({ current: data.budget, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch monthly budget');
    }
  },

  saveBudget: async (month, payload) => {
    try {
      const { data } = await api.put(`/investment-budgets/${month}`, payload);
      set({ current: data.budget });
      toast.success('Monthly budget saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save monthly budget');
      throw error;
    }
  },
}));

export default useInvestmentBudgetStore;
