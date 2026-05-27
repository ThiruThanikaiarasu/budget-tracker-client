import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppTheme = 'light' | 'dark-olive';

export const THEMES: { id: AppTheme; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark-olive', label: 'Dark Olive' },
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
