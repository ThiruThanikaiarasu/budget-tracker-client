import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useBudgetStore from './budgetStore';
import useFriendStore from './friendStore';

export interface Transaction {
  _id: string;
  userId: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  /** User's own share of `amount` when split with friends; absent for non-split. */
  personalShare?: number;
  categoryId?: { _id: string; name: string; icon: string };
  accountId?: { _id: string; name: string };
  toAccountId?: { _id: string; name: string };
  /** Populated when a friend paid on behalf of the user. */
  paidByFriendId?: { _id: string; name: string };
  note?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  /** Present when the transaction was split with friends. */
  split?: {
    paidBy: 'user' | string;
    splits: { friendId: { _id: string; name: string } | string; amount: number }[];
  } | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface TransactionFilters {
  dateFrom?: string;
  dateTo?: string;
  type?: string;
  categoryId?: string;
  accountId?: string;
  page?: number;
  append?: boolean;
}

interface CreateTransactionData {
  type: 'income' | 'expense';
  amount: number;
  categoryId?: string;
  accountId?: string;
  toAccountId?: string;
  note?: string;
  date: string;
  paidByFriendId?: string;
  splits?: { friendId: string; amount: number }[];
}

interface TransactionState {
  transactions: Transaction[];
  pagination: Pagination;
  isLoading: boolean;
  isLoadingMore: boolean;
  fetchTransactions: (filters?: TransactionFilters) => Promise<void>;
  createTransaction: (data: CreateTransactionData) => Promise<void>;
  updateTransaction: (id: string, data: CreateTransactionData) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
}

const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },
  isLoading: false,
  isLoadingMore: false,

  fetchTransactions: async (filters) => {
    const append = filters?.append ?? false;
    set(append ? { isLoadingMore: true } : { isLoading: true });
    try {
      const params = new URLSearchParams();
      if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters?.dateTo) params.set('dateTo', filters.dateTo);
      if (filters?.type) params.set('type', filters.type);
      if (filters?.categoryId) params.set('categoryId', filters.categoryId);
      if (filters?.accountId) params.set('accountId', filters.accountId);
      if (filters?.page) params.set('page', String(filters.page));

      const { data } = await api.get(`/transactions?${params.toString()}`);

      if (append) {
        set((state) => ({
          transactions: [...state.transactions, ...data.transactions],
          pagination: data.pagination,
          isLoadingMore: false,
        }));
      } else {
        set({
          transactions: data.transactions,
          pagination: data.pagination,
          isLoading: false,
        });
      }
    } catch (error: any) {
      set({ isLoading: false, isLoadingMore: false });
      toast.error(error.response?.data?.message || 'Failed to fetch transactions');
    }
  },

  createTransaction: async (txData) => {
    try {
      const { data } = await api.post('/transactions', txData);
      set((state) => ({
        transactions: [data.transaction, ...state.transactions],
        pagination: { ...state.pagination, total: state.pagination.total + 1 },
      }));
      toast.success('Transaction created');
      useBudgetStore.getState().refreshActive();
      useFriendStore.getState().fetchFriends();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create transaction');
      throw error;
    }
  },

  updateTransaction: async (id, txData) => {
    try {
      const { data } = await api.put(`/transactions/${id}`, txData);
      set((state) => ({
        transactions: state.transactions.map((t) =>
          t._id === id ? data.transaction : t
        ),
      }));
      toast.success('Transaction updated');
      useBudgetStore.getState().refreshActive();
      useFriendStore.getState().fetchFriends();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update transaction');
      throw error;
    }
  },

  deleteTransaction: async (id) => {
    try {
      await api.delete(`/transactions/${id}`);
      set((state) => ({
        transactions: state.transactions.filter((t) => t._id !== id),
        pagination: { ...state.pagination, total: state.pagination.total - 1 },
      }));
      toast.success('Transaction deleted');
      useBudgetStore.getState().refreshActive();
      useFriendStore.getState().fetchFriends();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete transaction');
    }
  },
}));

export default useTransactionStore;
