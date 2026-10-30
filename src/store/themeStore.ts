import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'light' | 'dark-olive' | 'cred-white' | 'cred-black' | 'cartoon';

export const THEMES: { id: AppTheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark-olive', label: 'Dark Olive' },
  { id: 'cred-white', label: 'CRED White' },
  { id: 'cred-black', label: 'CRED Black' },
  { id: 'cartoon', label: 'Cartoon' },
];

interface ThemeStore {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'cartoon',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'app-theme',
      // v1: the cartoon redesign becomes the look everyone lands on once;
      // picking another theme in Settings still sticks after that.
      version: 1,
      migrate: () => ({ theme: 'cartoon' as AppTheme }),
    }
  )
);

export default useThemeStore;
