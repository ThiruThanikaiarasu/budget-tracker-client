import { useEffect, useState } from 'react';

/**
 * useState that survives a page refresh, falling back to `initial` if storage is unavailable.
 * sessionStorage by default (this tab only); pass 'local' to keep it across tabs and visits.
 */
export default function useSessionState<T>(key: string, initial: T, store: 'session' | 'local' = 'session') {
  const area = () => (store === 'local' ? localStorage : sessionStorage);
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = area().getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch { /* storage unavailable: use the default */ }
    return initial;
  });

  useEffect(() => {
    try { area().setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: nothing to keep */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue] as const;
}
