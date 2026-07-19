import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'light' | 'dark-olive' | 'cred-white' | 'cred-black';

export const THEMES: { id: AppTheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark-olive', label: 'Dark Olive' },
  { id: 'cred-white', label: 'CRED White' },
  { id: 'cred-black', label: 'CRED Black' },
];

interface ThemeStore {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
}

const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'dark-olive',
      setTheme: (theme) => set({ theme }),
    }),
    { name: 'app-theme' }
  )
);

export default useThemeStore;
