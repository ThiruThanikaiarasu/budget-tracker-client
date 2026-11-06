import { useEffect } from 'react';
import useCategoryStore from '../store/categoryStore';
import useCategoryItemStore from '../store/categoryItemStore';
import type { Transaction } from '../store/transactionStore';

/**
 * Says whether a record is a recurring payment, and whether it autopays: it was
 * added by a schedule, or its category or one of its items is set to recur.
 * Returns null for ordinary records.
 */
export default function useRecurringInfo(): (tx: Transaction) => { autopay: boolean } | null {
  const categories = useCategoryStore((s) => s.categories);
  const items = useCategoryItemStore((s) => s.items);
  const itemsLoaded = useCategoryItemStore((s) => s.loaded);
  const fetchItems = useCategoryItemStore((s) => s.fetchItems);
  useEffect(() => { if (!itemsLoaded) fetchItems(); }, [itemsLoaded, fetchItems]);

  return (tx) => {
    const sources: ({ autopay: boolean } | undefined)[] = [];

    // Added by a schedule: its key says which one.
    if (tx.recurringKey) {
      const [kind, id] = tx.recurringKey.split(':');
      sources.push(
        (kind === 'item' ? items.find((i) => i._id === id) : categories.find((c) => c._id === id))?.recurring
      );
    }
    // Entered by hand under a recurring category or item.
    sources.push(categories.find((c) => c._id === tx.categoryId?._id)?.recurring);
    for (const line of tx.items ?? []) {
      if (line.itemId) sources.push(items.find((i) => i._id === line.itemId)?.recurring);
    }

    const found = sources.filter((s): s is { autopay: boolean } => !!s);
    if (found.length === 0 && !tx.recurringKey) return null;
    return { autopay: found.some((s) => s.autopay) };
  };
}
