import { create } from 'zustand';
import api from '../api/axios';

export interface AnalysisTotals {
  spent: number; items: number; fees: number; discounts: number; roundOff: number;
  bills: number; itemLines: number; merchants: number; avgBill: number; activeDays: number;
}
export interface AnalysisMerchant {
  name: string; noted: boolean; total: number; bills: number; avgBill: number; items: number; fees: number; discounts: number;
  extrasPct: number; lastDate: string; topCategory: string; lines: number;
}
export interface AnalysisExtra { label: string; kind: 'fee' | 'discount' | 'roundoff'; amount: number; count: number; merchants: string[] }
export interface AnalysisCategory { id: string; name: string; icon: string; total: number; items: number; extras: number; bills: number }
export interface AnalysisItem {
  key: string; name: string; categoryId: string; categoryName: string; categoryIcon: string;
  spent: number; buys: number; qty: number | null; unit: string | null;
  avgUnit: number | null; minUnit: number | null; maxUnit: number | null; lastUnit: number | null;
  merchants: { name: string; spent: number }[]; firstDate: string; lastDate: string;
  prevSpent: number; prevAvgUnit: number | null; changePct: number | null;
}
export interface AnalysisInsight { kind: 'merchant' | 'extras' | 'saving' | 'item' | 'price' | 'trend' | 'day'; text: string }
export interface MonthAnalysis {
  month: string; prevMonth: string; basis: 'bill' | 'mine';
  totals: AnalysisTotals; prevTotals: AnalysisTotals | null;
  byDay: { date: string; total: number }[];
  merchants: AnalysisMerchant[]; extras: AnalysisExtra[]; categories: AnalysisCategory[]; items: AnalysisItem[];
  trend: { month: string; spent: number; items: number; fees: number; discounts: number; bills: number }[];
  insights: AnalysisInsight[];
}

interface State {
  data: MonthAnalysis | null;
  loading: boolean;
  failed: boolean;
  fetch: (month?: string, basis?: 'bill' | 'mine') => Promise<void>;
}

const useAnalysisStore = create<State>((set) => ({
  data: null,
  loading: false,
  failed: false,
  fetch: async (month, basis = 'bill') => {
    set({ loading: true, failed: false });
    try {
      const { data } = await api.get('/dashboard/month-analysis', { params: { ...(month ? { month } : {}), basis } });
      set({ data, loading: false });
    } catch {
      set({ loading: false, failed: true });
    }
  },
}));

export default useAnalysisStore;
