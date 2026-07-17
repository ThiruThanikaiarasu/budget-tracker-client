import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';
import type { InvestmentType } from './investmentStore';

export interface TargetEntry {
  type: InvestmentType;
  pct: number;
}

interface TargetState {
  targets: TargetEntry[];
  isLoading: boolean;
  fetchTargets: () => Promise<void>;
  saveTargets: (targets: TargetEntry[]) => Promise<void>;
}

const useTargetStore = create<TargetState>((set) => ({
  targets: [],
  isLoading: false,

  fetchTargets: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/targets');
      set({ targets: data.targets, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch targets');
    }
  },

  saveTargets: async (targets) => {
    try {
      const { data } = await api.put('/targets', { targets });
      set({ targets: data.targets });
      toast.success('Target allocation saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save targets');
      throw error;
    }
  },
}));

export default useTargetStore;
