import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export interface Investment {
  _id: string;
  name: string;
  type: 'mutual_fund' | 'stocks' | 'fd' | 'ppf' | 'gold' | 'real_estate' | 'crypto' | 'other';
  amountInvested: number;
  currentValue: number;
  dateInvested: string;
  note?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CreateInvestmentData {
  name: string;
  type: Investment['type'];
  amountInvested: number;
  currentValue: number;
  dateInvested: string;
  note?: string;
}

interface InvestmentState {
  investments: Investment[];
  isLoading: boolean;
  fetchInvestments: () => Promise<void>;
  createInvestment: (data: CreateInvestmentData) => Promise<void>;
  updateInvestment: (id: string, data: CreateInvestmentData) => Promise<void>;
  toggleInvestment: (id: string) => Promise<void>;
}

const useInvestmentStore = create<InvestmentState>((set) => ({
  investments: [],
  isLoading: false,

  fetchInvestments: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/investments');
      set({ investments: data.investments, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch investments');
    }
  },

  createInvestment: async (investmentData) => {
    try {
      const { data } = await api.post('/investments', investmentData);
      set((state) => ({ investments: [data.investment, ...state.investments] }));
      toast.success('Investment added');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add investment');
      throw error;
    }
  },

  updateInvestment: async (id, investmentData) => {
    try {
      const { data } = await api.put(`/investments/${id}`, investmentData);
      set((state) => ({
        investments: state.investments.map((i) => (i._id === id ? data.investment : i)),
      }));
      toast.success('Investment updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update investment');
      throw error;
    }
  },

  toggleInvestment: async (id) => {
    try {
      const { data } = await api.patch(`/investments/${id}/toggle`);
      set((state) => ({
        investments: state.investments.map((i) => (i._id === id ? data.investment : i)),
      }));
      toast.success(data.investment.isActive ? 'Marked as active' : 'Marked as exited');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to toggle investment');
    }
  },
}));

export default useInvestmentStore;
