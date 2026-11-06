import type { Transaction } from '../store/transactionStore';
import { categoryKind, itemKind } from './cartoonKinds';

/**
 * A loan with a friend, by what actually happened: you lent or borrowed, or one
 * was paid back. Only account-to-account moves are a "Transfer".
 */
export function friendMoneyTitle(f: NonNullable<Transaction['transferFriend']>): string {
  if (f.repayment) return f.direction === 'sent' ? 'Paid back' : 'Got back';
  return f.direction === 'sent' ? 'Lent' : 'Borrowed';
}

// Items whose own picture should stand for the whole record (a subscription is
// the Netflix, not "Subscriptions"). Produce faces stay small, beside the title.
const RECORD_ITEM_KINDS = new Set(['apple-music', 'netflix']);

/** The cartoon picture a record shows. */
export function kindOf(tx: Transaction): string {
  if (tx.isAdjustment) return 'cleanup';
  if (tx.transferFriend) {
    const f = tx.transferFriend;
    return f.repayment ? (f.direction === 'sent' ? 'paid-back' : 'got-back') : f.direction === 'sent' ? 'lent' : 'borrowed';
  }
  // Paying a credit card's bill from another account.
  if (tx.type === 'transfer') return tx.toAccountId?.type === 'credit_card' ? 'card' : 'bank';
  if (tx.items?.length === 1) {
    const k = itemKind(tx.items[0].name);
    if (k && RECORD_ITEM_KINDS.has(k)) return k;
  }
  return tx.categoryId ? categoryKind(tx.categoryId.icon, tx.categoryId.name) : 'other';
}

/** The title a record shows. */
export function titleOf(tx: Transaction): string {
  if (tx.isAdjustment) return 'Clean up';
  if (tx.transferFriend) return friendMoneyTitle(tx.transferFriend);
  if (tx.type === 'transfer') return 'Transfer';
  return tx.categoryId?.name || 'Unknown';
}
