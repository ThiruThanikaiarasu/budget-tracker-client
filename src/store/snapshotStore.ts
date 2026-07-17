import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';
import type { InvestmentType } from './investmentStore';

export interface SnapshotHolding {
  name: string;
  symbol?: string;
  type: InvestmentType;
  sector?: string;
  invested: number;
  current: number;
}

export interface PortfolioSnapshot {
  _id: string;
  date: string;
  cadence: 'weekly' | 'monthly' | 'manual';
  totalInvested: number;
  totalCurrent: number;
  holdings: SnapshotHolding[];
  benchmarkSymbol?: string;
  benchmarkLevel?: number;
}

interface SnapshotState {
  snapshots: PortfolioSnapshot[];
  isLoading: boolean;
  fetchSnapshots: () => Promise<void>;
  takeSnapshot: () => Promise<void>;
}

const useSnapshotStore = create<SnapshotState>((set) => ({
  snapshots: [],
  isLoading: false,

  fetchSnapshots: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/snapshots');
      set({ snapshots: data.snapshots, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch snapshots');
    }
  },

  takeSnapshot: async () => {
    try {
      await api.post('/snapshots');
      const { data } = await api.get('/snapshots');
      set({ snapshots: data.snapshots });
      toast.success('Snapshot saved');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to take snapshot');
      throw error;
    }
  },
}));

export default useSnapshotStore;
