import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export interface Strategy {
  _id: string;
  name: string;
  description?: string;
  prompt?: string;
  expression: string;
  variables: string[];
  enabled: boolean;
}

export type DomainKind = 'asset_class' | 'sector';

export interface Domain {
  _id: string;
  name: string;
  kind: DomainKind;
  parent?: string;
  color?: string;
  order: number;
}

export interface StrategyLink {
  _id: string;
  strategyId: string;
  domainId: string;
  params: Record<string, number>;
  enabled: boolean;
}

export type StrategyStatus = 'green' | 'red' | 'no_data';

export interface StrategyResult {
  strategyId: string;
  name: string;
  expression: string;
  domainId: string;
  domainName?: string;
  status: StrategyStatus;
  missing: string[];
  value?: number | boolean;
}

export interface AnalysisItem {
  _id: string;
  symbol: string;
  exchange: string;
  name: string;
  lastPrice?: number;
  targetBuyPrice?: number;
  domainIds: string[];
  results: StrategyResult[];
  summary: { green: number; red: number; noData: number; greenPct: number; redPct: number };
}

interface StrategyState {
  strategies: Strategy[];
  domains: Domain[];
  linksByStrategy: Record<string, StrategyLink[]>;
  analysis: AnalysisItem[];
  isLoading: boolean;

  fetchStrategies: () => Promise<void>;
  createStrategy: (data: Partial<Strategy>) => Promise<void>;
  updateStrategy: (id: string, data: Partial<Strategy>) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;

  fetchDomains: () => Promise<void>;
  createDomain: (data: Partial<Domain>) => Promise<void>;
  updateDomain: (id: string, data: Partial<Domain>) => Promise<void>;
  deleteDomain: (id: string) => Promise<void>;

  fetchLinks: (strategyId: string) => Promise<void>;
  upsertLink: (
    strategyId: string,
    domainId: string,
    params: Record<string, number>,
    enabled?: boolean
  ) => Promise<void>;
  deleteLink: (strategyId: string, domainId: string) => Promise<void>;

  fetchAnalysis: (watchlistId: string) => Promise<void>;
}

function err(e: any, fallback: string) {
  toast.error(e.response?.data?.message || fallback);
}

const useStrategyStore = create<StrategyState>((set, get) => ({
  strategies: [],
  domains: [],
  linksByStrategy: {},
  analysis: [],
  isLoading: false,

  fetchStrategies: async () => {
    try {
      const { data } = await api.get('/strategies');
      set({ strategies: data.strategies });
    } catch (e) {
      err(e, 'Failed to load strategies');
    }
  },
  createStrategy: async (payload) => {
    try {
      const { data } = await api.post('/strategies', payload);
      set((s) => ({ strategies: [data.strategy, ...s.strategies] }));
      toast.success('Strategy created');
    } catch (e) {
      err(e, 'Failed to create strategy');
      throw e;
    }
  },
  updateStrategy: async (id, payload) => {
    try {
      const { data } = await api.put(`/strategies/${id}`, payload);
      set((s) => ({ strategies: s.strategies.map((x) => (x._id === id ? data.strategy : x)) }));
      toast.success('Strategy updated');
    } catch (e) {
      err(e, 'Failed to update strategy');
      throw e;
    }
  },
  deleteStrategy: async (id) => {
    try {
      await api.delete(`/strategies/${id}`);
      set((s) => ({ strategies: s.strategies.filter((x) => x._id !== id) }));
      toast.success('Strategy deleted');
    } catch (e) {
      err(e, 'Failed to delete strategy');
    }
  },

  fetchDomains: async () => {
    try {
      const { data } = await api.get('/domains');
      set({ domains: data.domains });
    } catch (e) {
      err(e, 'Failed to load domains');
    }
  },
  createDomain: async (payload) => {
    try {
      const { data } = await api.post('/domains', payload);
      set((s) => ({ domains: [...s.domains, data.domain] }));
      toast.success('Domain created');
    } catch (e) {
      err(e, 'Failed to create domain');
      throw e;
    }
  },
  updateDomain: async (id, payload) => {
    try {
      const { data } = await api.put(`/domains/${id}`, payload);
      set((s) => ({ domains: s.domains.map((x) => (x._id === id ? data.domain : x)) }));
      toast.success('Domain updated');
    } catch (e) {
      err(e, 'Failed to update domain');
      throw e;
    }
  },
  deleteDomain: async (id) => {
    try {
      await api.delete(`/domains/${id}`);
      set((s) => ({ domains: s.domains.filter((x) => x._id !== id) }));
      toast.success('Domain deleted');
    } catch (e) {
      err(e, 'Failed to delete domain');
    }
  },

  fetchLinks: async (strategyId) => {
    try {
      const { data } = await api.get(`/strategies/${strategyId}/domains`);
      set((s) => ({ linksByStrategy: { ...s.linksByStrategy, [strategyId]: data.links } }));
    } catch (e) {
      err(e, 'Failed to load links');
    }
  },
  upsertLink: async (strategyId, domainId, params, enabled) => {
    try {
      await api.put(`/strategies/${strategyId}/domains/${domainId}`, { params, enabled });
      await get().fetchLinks(strategyId);
      toast.success('Saved');
    } catch (e) {
      err(e, 'Failed to save link');
      throw e;
    }
  },
  deleteLink: async (strategyId, domainId) => {
    try {
      await api.delete(`/strategies/${strategyId}/domains/${domainId}`);
      await get().fetchLinks(strategyId);
    } catch (e) {
      err(e, 'Failed to remove link');
    }
  },

  fetchAnalysis: async (watchlistId) => {
    set({ isLoading: true });
    try {
      const { data } = await api.get(`/watchlists/${watchlistId}/analysis`);
      set({ analysis: data.items, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
      err(e, 'Failed to analyze wishlist');
    }
  },
}));

export default useStrategyStore;
