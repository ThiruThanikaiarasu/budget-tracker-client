import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export type WatchlistExchange = 'NSE' | 'BSE';

export interface WatchlistItem {
  _id: string;
  symbol: string;
  exchange: WatchlistExchange;
  name: string;
  instrumentToken?: number;
  targetBuyPrice?: number;
  notes?: string;
  lastPrice?: number;
  lastPriceAt?: string;
}

export interface Watchlist {
  _id: string;
  name: string;
  color?: string;
  order: number;
  items: WatchlistItem[];
  createdAt: string;
  updatedAt: string;
}

export interface AddItemData {
  symbol: string;
  exchange: WatchlistExchange;
  name: string;
  instrumentToken?: number;
  targetBuyPrice?: number;
  notes?: string;
}

export interface EditItemData {
  name?: string;
  targetBuyPrice?: number;
  notes?: string;
}

interface WatchlistState {
  watchlists: Watchlist[];
  isLoading: boolean;
  fetchWatchlists: () => Promise<void>;
  createList: (name: string, color?: string) => Promise<void>;
  renameList: (id: string, data: { name?: string; color?: string }) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  addItem: (listId: string, data: AddItemData) => Promise<void>;
  editItem: (listId: string, itemId: string, data: EditItemData) => Promise<void>;
  removeItem: (listId: string, itemId: string) => Promise<void>;
}

/** Replace a single list in state with the server's updated copy. */
function replaceList(watchlists: Watchlist[], updated: Watchlist): Watchlist[] {
  return watchlists.map((w) => (w._id === updated._id ? updated : w));
}

const useWatchlistStore = create<WatchlistState>((set) => ({
  watchlists: [],
  isLoading: false,

  fetchWatchlists: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/watchlists');
      set({ watchlists: data.watchlists, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch watchlists');
    }
  },

  createList: async (name, color) => {
    try {
      const { data } = await api.post('/watchlists', { name, color });
      set((state) => ({ watchlists: [...state.watchlists, data.watchlist] }));
      toast.success('Watchlist created');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to create watchlist');
      throw error;
    }
  },

  renameList: async (id, payload) => {
    try {
      const { data } = await api.put(`/watchlists/${id}`, payload);
      set((state) => ({ watchlists: replaceList(state.watchlists, data.watchlist) }));
      toast.success('Watchlist updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update watchlist');
      throw error;
    }
  },

  deleteList: async (id) => {
    try {
      await api.delete(`/watchlists/${id}`);
      set((state) => ({ watchlists: state.watchlists.filter((w) => w._id !== id) }));
      toast.success('Watchlist deleted');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete watchlist');
      throw error;
    }
  },

  addItem: async (listId, itemData) => {
    try {
      const { data } = await api.post(`/watchlists/${listId}/items`, itemData);
      set((state) => ({ watchlists: replaceList(state.watchlists, data.watchlist) }));
      toast.success('Added to watchlist');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add stock');
      throw error;
    }
  },

  editItem: async (listId, itemId, itemData) => {
    try {
      const { data } = await api.put(`/watchlists/${listId}/items/${itemId}`, itemData);
      set((state) => ({ watchlists: replaceList(state.watchlists, data.watchlist) }));
      toast.success('Updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update stock');
      throw error;
    }
  },

  removeItem: async (listId, itemId) => {
    try {
      const { data } = await api.delete(`/watchlists/${listId}/items/${itemId}`);
      set((state) => ({ watchlists: replaceList(state.watchlists, data.watchlist) }));
      toast.success('Removed from watchlist');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to remove stock');
      throw error;
    }
  },
}));

export default useWatchlistStore;
