import { create } from 'zustand';
import toast from 'react-hot-toast';
import api from '../api/axios';

export interface Friend {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  netBalance: number;
  frecencyScore?: number;
  lastInteractedAt?: string;
  createdAt: string;
}

interface CreateFriendData {
  name: string;
  phone?: string;
  email?: string;
}

interface FriendState {
  friends: Friend[];
  isLoading: boolean;
  fetchFriends: () => Promise<void>;
  createFriend: (data: CreateFriendData) => Promise<void>;
  updateFriend: (id: string, data: CreateFriendData) => Promise<void>;
  recordInteraction: (id: string) => void;
}

const useFriendStore = create<FriendState>((set) => ({
  friends: [],
  isLoading: false,

  fetchFriends: async () => {
    set({ isLoading: true });
    try {
      const { data } = await api.get('/friends');
      set({ friends: data.friends, isLoading: false });
    } catch (error: any) {
      set({ isLoading: false });
      toast.error(error.response?.data?.message || 'Failed to fetch friends');
    }
  },

  createFriend: async (friendData) => {
    try {
      await api.post('/friends', friendData);
      // Refetch to get netBalance included
      await useFriendStore.getState().fetchFriends();
      toast.success('Friend added');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to add friend');
      throw error;
    }
  },

  updateFriend: async (id, friendData) => {
    try {
      await api.put(`/friends/${id}`, friendData);
      await useFriendStore.getState().fetchFriends();
      toast.success('Friend updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update friend');
      throw error;
    }
  },

  // Fire-and-forget: bump the friend's frecency and merge the new score back
  // in (preserving the computed netBalance). Powers "frequent friends first".
  recordInteraction: (id) => {
    api.post(`/friends/${id}/interact`)
      .then(({ data }) => {
        set((state) => ({
          friends: state.friends.map((f) =>
            f._id === id
              ? { ...f, frecencyScore: data.friend.frecencyScore, lastInteractedAt: data.friend.lastInteractedAt }
              : f
          ),
        }));
      })
      .catch(() => { /* non-critical; ignore */ });
  },
}));

export default useFriendStore;
