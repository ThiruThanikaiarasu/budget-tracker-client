import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export interface Account {
  _id: string;
  name: string;
  type: 'cash' | 'bank_account' | 'credit_card' | 'upi_wallet' | 'investment' | 'other';
  balance: number;
  color?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateAccountData {
  name: string;
  type: Account['type'];
  balance?: number;
  color?: string;
}

interface UpdateAccountData {
  name: string;
  type: Account['type'];
  color?: string;
}

interface TransferData {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  note?: string;
}

interface AccountState {
  accounts: Account[];
  isLoading: boolean;
  fetchAccounts: () => Promise<void>;
  createAccount: (data: CreateAccountData) => Promise<void>;
  updateAccount: (id: string, data: UpdateAccountData) => Promise<void>;
  toggleAccount: (id: string) => Promise<void>;
  transfer: (data: TransferData) => Promise<void>;
}

const useAccountStore = create<AccountState>((set) => ({
  accounts: [],
  isLoading: false,

  fetchAccounts: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/accounts');
      set({ accounts: data.accounts, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch accounts');
    }
  },

  createAccount: async (accountData) => {
    try {
      const { data } = await api.post('/accounts', accountData);
      set((state) => ({ accounts: [data.account, ...state.accounts] }));
      toast.success('Account created');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create account');
      throw error;
    }
  },

  updateAccount: async (id, accountData) => {
    try {
      const { data } = await api.put(`/accounts/${id}`, accountData);
      set((state) => ({
        accounts: state.accounts.map((a) => (a._id === id ? data.account : a)),
      }));
      toast.success('Account updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update account');
      throw error;
    }
  },

  transfer: async (transferData) => {
    try {
      await api.post('/transfers', transferData);
      await useAccountStore.getState().fetchAccounts();
      toast.success('Transfer completed');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Transfer failed');
      throw error;
    }
  },

  toggleAccount: async (id) => {
    try {
      const { data } = await api.patch(`/accounts/${id}/toggle`);
      set((state) => ({
        accounts: state.accounts.map((a) => (a._id === id ? data.account : a)),
      }));
      toast.success(data.account.isActive ? 'Account enabled' : 'Account disabled');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to toggle account');
    }
  },
}));

export default useAccountStore;
