import { create } from 'zustand';
import api from '../api/axios';
import type { WatchlistExchange } from './watchlistStore';

export interface PricePoint {
  date: string;
  close: number;
}

export interface Fundamentals {
  marketCap?: number;
  pe?: number;
  pb?: number;
  bookValue?: number;
  eps?: number;
  roe?: number;
  roce?: number;
  dividendYield?: number;
  faceValue?: number;
  high52?: number;
  low52?: number;
  debtToEquity?: number;
  industry?: string;
}

export interface StockAnalysis {
  symbol: string;
  exchange: WatchlistExchange;
  name: string;
  currentPrice?: number;
  fundamentals: Fundamentals;
  priceSeries: PricePoint[];
  source?: string;
  fetchedAt: string;
}

interface StockAnalysisState {
  analysis: StockAnalysis | null;
  isLoading: boolean;
  notFound: boolean;
  fetchAnalysis: (symbol: string, exchange: WatchlistExchange) => Promise<void>;
  reset: () => void;
}

const useStockAnalysisStore = create<StockAnalysisState>((set) => ({
  analysis: null,
  isLoading: false,
  notFound: false,

  fetchAnalysis: async (symbol, exchange) => {
    set({ isLoading: true, notFound: false, analysis: null });
    try {
      const { data } = await api.get(`/stock-analysis/${symbol}`, { params: { exchange } });
      set({ analysis: data.analysis, isLoading: false });
    } catch (error: any) {
      if (error.response?.status === 404) {
        set({ isLoading: false, notFound: true });
      } else {
        set({ isLoading: false });
      }
    }
  },

  reset: () => set({ analysis: null, isLoading: false, notFound: false }),
}));

export default useStockAnalysisStore;
