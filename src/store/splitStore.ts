import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export interface Split {
  friendId: { _id: string; name: string } | string;
  amount: number;
}

export interface SharedExpense {
  _id: string;
  description: string;
  totalAmount: number;
  paidBy: string;
  date: string;
  splits: Split[];
  isSettlement: boolean;
  coveredExpenseIds?: string[];
  settlementMethod?: 'received' | 'paid' | 'waived';
  createdAt: string;
}

export interface SettlePayload {
  friendId: string;
  amount: number;
  method: 'received' | 'paid' | 'waived';
  friendOwes: boolean;
  accountId?: string;
  coveredExpenseIds?: string[];
}

interface CreateExpenseData {
  description: string;
  totalAmount: number;
  paidBy: string;
  date?: string;
  splits: { friendId: string; amount: number }[];
}

interface SplitState {
  expenses: SharedExpense[];
  isLoading: boolean;
  fetchExpenses: (friendId?: string) => Promise<void>;
  createExpense: (data: CreateExpenseData) => Promise<void>;
  settleUp: (payload: SettlePayload) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
}

const useSplitStore = create<SplitState>((set) => ({
  expenses: [],
  isLoading: false,

  fetchExpenses: async (friendId) => {
    set({ isLoading: true });
    try {
      const params = friendId ? { friendId } : {};
      const { data } = await api.get('/splits', { params });
      set({ expenses: data.expenses, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch expenses');
    }
  },

  createExpense: async (expenseData) => {
    try {
      await api.post('/splits', expenseData);
      toast.success('Shared expense added');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add expense');
      throw error;
    }
  },

  settleUp: async (payload) => {
    try {
      await api.post('/splits/settle', payload);
      toast.success('Settlement recorded');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Settlement failed');
      throw error;
    }
  },

  deleteExpense: async (id) => {
    try {
      await api.delete(`/splits/${id}`);
      set((state) => ({
        expenses: state.expenses.filter((e) => e._id !== id),
      }));
      toast.success('Expense deleted');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete expense');
    }
  },
}));

export default useSplitStore;
