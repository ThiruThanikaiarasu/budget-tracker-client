import type { Friend } from '../store/friendStore';
import type { SharedExpense } from '../store/splitStore';

export function splitFriendId(split: SharedExpense['splits'][number]): string {
  return typeof split.friendId === 'object' ? split.friendId._id : split.friendId;
}

// Signed outstanding share of a single (non-settlement) expense for a friend:
// positive => friend owes you, negative => you owe the friend.
export function signedShare(expense: SharedExpense, friendId: string): number {
  const friendSplit = expense.splits.find((s) => splitFriendId(s) === friendId);
  if (expense.paidBy === 'user') {
    return friendSplit ? friendSplit.amount : 0;
  }
  if (expense.paidBy === friendId) {
    const totalSplits = expense.splits.reduce((sum, s) => sum + s.amount, 0);
    return -(expense.totalAmount - totalSplits);
  }
  return 0;
}

export function sharedExpenseLabel(expense: SharedExpense): string {
  const description = expense.description.trim();
  if (description && description.toLowerCase() !== 'shared expense') return description;

  if (expense.transactionId && typeof expense.transactionId !== 'string') {
    return expense.transactionId.categoryId?.name || 'Shared expense';
  }

  return 'Shared expense';
}

// A single expense's contribution to the running net balance, including
// settlements (which cancel debt in the opposite direction).
export function balanceContribution(expense: SharedExpense, friendId: string): number {
  if (!expense.isSettlement) return signedShare(expense, friendId);
  const friendSplit = expense.splits.find((s) => splitFriendId(s) === friendId);
  if (!friendSplit) return 0;
  if (expense.paidBy === 'user') return -friendSplit.amount;
  if (expense.paidBy === friendId) return friendSplit.amount;
  return 0;
}

export function getFriendName(expense: SharedExpense, currentFriend: Friend): string {
  if (expense.paidBy === currentFriend._id) return currentFriend.name;
  // Check populated splits for name
  for (const split of expense.splits) {
    if (typeof split.friendId === 'object' && split.friendId._id === expense.paidBy) {
      return split.friendId.name;
    }
  }
  return 'friend';
}

export interface TransferThread {
  /** The original transfer (not itself a repayment). */
  root: SharedExpense;
  /** True when you sent the money, so the friend owes you back. */
  sent: boolean;
  /** Linked opposite-direction transfers, oldest first. */
  repayments: SharedExpense[];
  repaid: number;
  left: number;
}

// Each original transfer with the repayments linked to it, newest first.
// Repayments are transfers in the opposite direction that point at the original
// through repaysTransferId.
export function transferThreads(expenses: SharedExpense[]): TransferThread[] {
  const transfers = expenses.filter((e) => e.isTransfer);
  const byRoot = new Map<string, SharedExpense[]>();
  for (const t of transfers) {
    if (!t.repaysTransferId) continue;
    byRoot.set(t.repaysTransferId, [...(byRoot.get(t.repaysTransferId) ?? []), t]);
  }
  return transfers
    .filter((t) => !t.repaysTransferId)
    .map((root) => {
      const repayments = (byRoot.get(root._id) ?? []).sort((a, b) => +new Date(a.date) - +new Date(b.date));
      const repaid = Math.round(repayments.reduce((s, r) => s + r.totalAmount, 0) * 100) / 100;
      return {
        root,
        sent: root.settlementMethod === 'paid',
        repayments,
        repaid,
        left: Math.max(0, Math.round((root.totalAmount - repaid) * 100) / 100),
      };
    })
    .sort((a, b) => +new Date(b.root.date) - +new Date(a.root.date));
}
