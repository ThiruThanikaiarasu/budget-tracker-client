import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export interface Split {
  friendId: { _id: string; name: string } | string;
  amount: number;
}

export interface SharedExpense {
  _id: string;
  transactionId?: {
    _id: string;
    categoryId?: { _id: string; name: string; icon: string } | null;
    /** The bill's lines (name/qty/unit are snapshots taken when it was saved). */
    items?: { name: string; quantity?: number; unit?: string; amount: number }[];
    charges?: { label: string; amount: number }[];
  } | string;
  description: string;
  totalAmount: number;
  paidBy: string;
  date: string;
  splits: Split[];
  isSettlement: boolean;
  coveredExpenseIds?: string[];
  settlementMethod?: 'received' | 'paid' | 'waived';
  /** A direct "Send money" / "Got money" entry with a friend (always a settlement). */
  isTransfer?: boolean;
  /** On a transfer: the earlier opposite-direction transfer this one repays. */
  repaysTransferId?: string;
  createdAt: string;
}

export interface TransferPayload {
  friendId: string;
  /** sent = you gave them money, received = they gave you money. */
  direction: 'sent' | 'received';
  amount: number;
  accountId: string;
  date?: string;
  note?: string;
  repaysTransferId?: string;
}

export interface SettlePayload {
  friendId: string;
  amount: number;
  method: 'received' | 'paid' | 'waived';
  friendOwes: boolean;
  accountId?: string;
  coveredExpenseIds?: string[];
  /** Part of the debt forgiven in the same step (partial payment + waive the rest). */
  waivedAmount?: number;
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
  createTransfer: (payload: TransferPayload) => Promise<{ transactionId?: string } | null>;
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

  createTransfer: async (payload) => {
    try {
      const { data } = await api.post('/splits/transfer', payload);
      toast.success(payload.direction === 'sent' ? 'Money sent recorded' : 'Money received recorded');
      return data.transfer ?? null;
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to record transfer');
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
