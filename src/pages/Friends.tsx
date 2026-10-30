import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import DatePicker from '../components/DatePicker';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useThemeStore from '../store/themeStore';
import CartoonIcon from '../components/CartoonIcon';
import { CartoonHead, FaceAvatar, Sticker } from '../components/cartoon';
import useFriendStore, { type Friend } from '../store/friendStore';
import useSplitStore, { type SharedExpense } from '../store/splitStore';
import useAccountStore from '../store/accountStore';
import { formatCurrency } from '../utils/format';
import Amount from '../components/Amount';
import ThemedSelect from '../components/ThemedSelect';
import { renderAccountIcon } from '../utils/accountIcons';
import { sortByFrecency } from '../utils/frecency';

// --- Schemas ---

const friendSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
});

const expenseSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  totalAmount: z.number().positive('Amount must be positive'),
  paidBy: z.string().min(1, 'Select who paid'),
  date: z.string().min(1, 'Date is required'),
});

type FriendFormData = z.infer<typeof friendSchema>;
type ExpenseFormData = z.infer<typeof expenseSchema>;

// --- Balance helpers (mirror the server's split balance rules) ---

function splitFriendId(split: SharedExpense['splits'][number]): string {
  return typeof split.friendId === 'object' ? split.friendId._id : split.friendId;
}

// Signed outstanding share of a single (non-settlement) expense for a friend:
// positive => friend owes you, negative => you owe the friend.
function signedShare(expense: SharedExpense, friendId: string): number {
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

function sharedExpenseLabel(expense: SharedExpense): string {
  const description = expense.description.trim();
  if (description && description.toLowerCase() !== 'shared expense') return description;

  if (expense.transactionId && typeof expense.transactionId !== 'string') {
    return expense.transactionId.categoryId?.name || 'Shared expense';
  }

  return 'Shared expense';
}

// A single expense's contribution to the running net balance, including
// settlements (which cancel debt in the opposite direction).
function balanceContribution(expense: SharedExpense, friendId: string): number {
  if (!expense.isSettlement) return signedShare(expense, friendId);
  const friendSplit = expense.splits.find((s) => splitFriendId(s) === friendId);
  if (!friendSplit) return 0;
  if (expense.paidBy === 'user') return -friendSplit.amount;
  if (expense.paidBy === friendId) return friendSplit.amount;
  return 0;
}

// CSV of every shared expense and settlement with this friend (outstanding and settled).
function downloadFriendCsv(friend: Friend, expenses: SharedExpense[]) {
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  // Leading =,+,-,@ would run as a formula in Excel; applied to free-text columns only.
  const text = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
  const covered = new Set(expenses.flatMap((e) => (e.isSettlement ? e.coveredExpenseIds ?? [] : [])));
  const rows = [['Date', 'Type', 'Description', 'Paid by', 'Total amount', 'Balance effect', 'Status', 'Settlement method']];
  for (const e of [...expenses].sort((a, b) => +new Date(b.date) - +new Date(a.date))) {
    rows.push([
      new Date(e.date).toISOString().slice(0, 10),
      e.isSettlement ? 'Settlement' : 'Expense',
      e.isSettlement ? 'Settlement' : text(sharedExpenseLabel(e)),
      e.paidBy === 'user' ? 'You' : text(getFriendName(e, friend)),
      e.totalAmount.toFixed(2),
      // + friend owes you, - you owe friend
      balanceContribution(e, friend._id).toFixed(2),
      e.isSettlement ? '' : covered.has(e._id) ? 'Settled' : 'Outstanding',
      e.settlementMethod ?? '',
    ]);
  }
  const csv = '\uFEFF' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${friend.name.replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Main Page ---

function Friends() {
  const { friends, isLoading, fetchFriends, recordInteraction } = useFriendStore();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const isCartoon = useThemeStore((st) => st.theme === 'cartoon');

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const totalOwed = friends.reduce(
    (sum, f) => sum + (f.netBalance > 0 ? f.netBalance : 0),
    0
  );
  const totalOwe = friends.reduce(
    (sum, f) => sum + (f.netBalance < 0 ? Math.abs(f.netBalance) : 0),
    0
  );

  if (selectedFriend) {
    return (
      <FriendDetail
        friend={selectedFriend}
        onBack={() => {
          setSelectedFriend(null);
          fetchFriends();
        }}
      />
    );
  }

  if (isCartoon) {
    const topOwing = friends.filter((f) => f.netBalance > 0).sort((a, b) => b.netBalance - a.netBalance).slice(0, 3);
    const maxOwed = topOwing[0]?.netBalance ?? 1;
    return (
      <div className="cartoon-page">
        <CartoonHead
          kicker="Shared bills and who owes whom"
          title="Friends"
          actions={
            <>
              <button onClick={() => setShowAddExpense(true)} disabled={friends.length === 0} className="cartoon-btn">
                <CartoonIcon kind="pizza" size={22} /> Split an expense
              </button>
              <button onClick={() => setShowAddFriend(true)} className="cartoon-btn is-primary">+ Add friend</button>
            </>
          }
        />

        <div className="cartoon-tiles-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div className="cartoon-stat is-earn flex items-center gap-4">
            <CartoonIcon kind="social" size={56} />
            <div>
              <p className="cartoon-kicker">You are owed</p>
              <p className="cartoon-stat-big friend-balance friend-balance-positive" style={{ color: 'var(--c-earn-text)', margin: 0 }}><Amount value={totalOwed} /></p>
            </div>
          </div>
          <div className="cartoon-stat is-spend flex items-center gap-4">
            <CartoonIcon kind="coins" size={56} />
            <div>
              <p className="cartoon-kicker">You owe</p>
              <p className="cartoon-stat-big friend-balance friend-balance-negative" style={{ color: 'var(--c-spend-text)', margin: 0 }}><Amount value={totalOwe} /></p>
            </div>
          </div>
        </div>

        {topOwing.length > 0 && (
          <section className="cartoon-panel">
            <h2 className="cartoon-section-title">Who owes you most</h2>
            <div className="flex flex-col gap-3">
              {topOwing.map((f) => (
                <div key={f._id} className="cartoon-owe-row">
                  <FaceAvatar name={f.name} size={44} />
                  <span className="cartoon-owe-name">{f.name}</span>
                  <div className="cartoon-bar" style={{ margin: 0, height: 22 }}><span style={{ width: `${(f.netBalance / maxOwed) * 100}%`, background: 'var(--c-leaf)' }} /></div>
                  <b className="cartoon-money" style={{ color: 'var(--c-earn-text)' }}><Amount value={f.netBalance} /></b>
                </div>
              ))}
            </div>
          </section>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12"><div className="cartoon-spinner" /></div>
        ) : friends.length === 0 ? (
          <p className="cartoon-empty">No friends added yet. Add a friend to start splitting expenses.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {sortByFrecency(friends).map((friend) => (
              <div
                key={friend._id}
                role="button" tabIndex={0}
                onClick={() => { recordInteraction(friend._id); setSelectedFriend(friend); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { recordInteraction(friend._id); setSelectedFriend(friend); } }}
                className="cartoon-row cartoon-friend"
              >
                <FaceAvatar name={friend.name} size={60} />
                <div className="min-w-0 flex-1">
                  <p className="cartoon-card-title">{friend.name}</p>
                  {friend.phone && <p className="cartoon-sub" style={{ fontSize: 12 }}>{friend.phone}</p>}
                </div>
                {friend.netBalance === 0 ? (
                  <Sticker tone="earn" tilt={-2}>✓ All square</Sticker>
                ) : friend.netBalance > 0 ? (
                  <span className="cartoon-pill is-earn friend-balance friend-balance-positive">owes you <b><Amount value={friend.netBalance} /></b></span>
                ) : (
                  <span className="cartoon-pill is-spend friend-balance friend-balance-negative">you owe <b><Amount value={Math.abs(friend.netBalance)} /></b></span>
                )}
                <div className="relative">
                  <button
                    aria-label={`${friend.name} options`} className="cartoon-dots"
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === friend._id ? null : friend._id); }}
                  >···</button>
                  {openMenuId === friend._id && (
                    <div onClick={(e) => e.stopPropagation()} className="cartoon-menu">
                      <button onClick={() => { setEditingFriend(friend); setOpenMenuId(null); }}>Edit</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <FriendModal open={showAddFriend} onClose={() => setShowAddFriend(false)} />
        {editingFriend && <FriendModal open={true} onClose={() => setEditingFriend(null)} friend={editingFriend} />}
        {showAddExpense && <AddExpenseModal friends={friends} onClose={() => { setShowAddExpense(false); fetchFriends(); }} />}
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="cred-serif text-2xl font-semibold" style={{ color: 'var(--c-text)' }}>Friends</h1>
          <p className="mt-1 text-sm text-[var(--c-muted)]">Manage shared expenses and debts</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => setShowAddExpense(true)}
            disabled={friends.length === 0}
            className="t-btn-outline flex-1 whitespace-nowrap sm:flex-none"
          >
            + Add Expense
          </button>
          <button
            onClick={() => setShowAddFriend(true)}
            className="t-btn-primary flex-1 whitespace-nowrap sm:flex-none"
          >
            + Add Friend
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-[var(--c-surface)] p-5 shadow">
          <p className="cred-label">You are owed</p>
          <p className="friend-balance friend-balance-positive cred-serif mt-1 text-2xl font-semibold" style={{ color: 'var(--c-income)' }}>
            <Amount value={totalOwed} />
          </p>
        </div>
        <div className="rounded-lg bg-[var(--c-surface)] p-5 shadow">
          <p className="cred-label">You owe</p>
          <p className="friend-balance friend-balance-negative cred-serif mt-1 text-2xl font-semibold" style={{ color: 'var(--c-expense)' }}>
            <Amount value={totalOwe} />
          </p>
        </div>
      </div>

      {/* Friends List */}
      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--c-accent)] border-t-transparent" />
        </div>
      ) : friends.length === 0 ? (
        <div className="mt-8 text-center text-[var(--c-muted)]">
          <p>No friends added yet. Add a friend to start splitting expenses.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {sortByFrecency(friends).map((friend) => (
            <div
              key={friend._id}
              onClick={() => { recordInteraction(friend._id); setSelectedFriend(friend); }}
              className="flex cursor-pointer items-center justify-between rounded-lg bg-[var(--c-surface)] p-4 shadow transition-colors hover:bg-[var(--c-surface2)]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--c-surface2)] text-sm font-bold text-[var(--c-accent)]">
                  {friend.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--c-text)]">{friend.name}</h3>
                  {friend.phone && (
                    <p className="text-xs text-[var(--c-muted)]">{friend.phone}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                {friend.netBalance === 0 ? (
                  <p className="text-sm text-[var(--c-muted)]">settled up</p>
                ) : friend.netBalance > 0 ? (
                  <p className="friend-balance friend-balance-positive text-sm font-semibold text-[var(--c-income)]">
                    owes you <Amount value={friend.netBalance} />
                  </p>
                ) : (
                  <p className="friend-balance friend-balance-negative text-sm font-semibold text-[var(--c-expense)]">
                    you owe <Amount value={Math.abs(friend.netBalance)} />
                  </p>
                )}
              </div>
              <div className="relative ml-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === friend._id ? null : friend._id);
                  }}
                  className="rounded-md p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-surface2)] hover:text-[var(--c-text)]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {openMenuId === friend._id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 z-10 mt-1 w-32 rounded-md bg-[var(--c-surface)] py-1 shadow-lg border border-[var(--c-border)]"
                  >
                    <button
                      onClick={() => { setEditingFriend(friend); setOpenMenuId(null); }}
                      className="block w-full px-4 py-2 text-left text-sm text-[var(--c-text)] hover:bg-[var(--c-surface2)]"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Friend Modal */}
      <FriendModal
        open={showAddFriend}
        onClose={() => setShowAddFriend(false)}
      />

      {/* Edit Friend Modal */}
      {editingFriend && (
        <FriendModal
          open={true}
          onClose={() => setEditingFriend(null)}
          friend={editingFriend}
        />
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <AddExpenseModal
          friends={friends}
          onClose={() => {
            setShowAddExpense(false);
            fetchFriends();
          }}
        />
      )}
    </div>
  );
}

// --- Friend Modal (Add / Edit) ---

function FriendModal({
  open,
  onClose,
  friend,
}: {
  open: boolean;
  onClose: () => void;
  friend?: Friend;
}) {
  const { createFriend, updateFriend } = useFriendStore();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FriendFormData>({
    resolver: zodResolver(friendSchema),
    defaultValues: friend
      ? { name: friend.name, phone: friend.phone || '', email: friend.email || '' }
      : { name: '', phone: '', email: '' },
  });

  const onSubmit = async (data: FriendFormData) => {
    try {
      if (friend) {
        await updateFriend(friend._id, data);
      } else {
        await createFriend(data);
      }
      reset();
      onClose();
    } catch {
      // handled by store
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="cartoon-modal w-full max-w-md rounded-lg bg-[var(--c-surface)] p-6 shadow-xl">
          <DialogTitle className="cred-serif text-lg font-semibold" style={{ color: 'var(--c-text)' }}>
            {friend ? 'Edit Friend' : 'Add Friend'}
          </DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Name</label>
              <input
                {...register('name')}
                className="mt-1 block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
                placeholder="e.g. Rahul"
              />
              {errors.name && <p className="mt-1 text-sm text-[var(--c-expense)]">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Phone (optional)</label>
              <input
                {...register('phone')}
                className="mt-1 block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
                placeholder="e.g. 9876543210"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Email (optional)</label>
              <input
                {...register('email')}
                className="mt-1 block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
                placeholder="e.g. rahul@email.com"
              />
              {errors.email && <p className="mt-1 text-sm text-[var(--c-expense)]">{errors.email.message}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-surface2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-[var(--c-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : friend ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// --- Add Expense Modal ---

function AddExpenseModal({
  friends,
  onClose,
}: {
  friends: Friend[];
  onClose: () => void;
}) {
  const { createExpense } = useSplitStore();
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>({});
  const [includeUser, setIncludeUser] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      description: '',
      totalAmount: undefined as unknown as number,
      paidBy: 'user',
      date: new Date().toISOString().slice(0, 10),
    },
  });

  const totalAmount = watch('totalAmount');

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  // Calculate equal split
  const participantCount = selectedFriends.length + (includeUser ? 1 : 0);
  const equalShare = participantCount > 0 ? totalAmount / participantCount : 0;

  const onSubmit = async (data: ExpenseFormData) => {
    if (selectedFriends.length === 0) return;

    const splits =
      splitMethod === 'equal'
        ? selectedFriends.map((friendId) => ({
            friendId,
            amount: Math.round(equalShare * 100) / 100,
          }))
        : selectedFriends.map((friendId) => ({
            friendId,
            amount: customAmounts[friendId] || 0,
          }));

    try {
      await createExpense({
        description: data.description,
        totalAmount: data.totalAmount,
        paidBy: data.paidBy,
        date: data.date,
        splits,
      });
      onClose();
    } catch {
      // handled by store
    }
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="cartoon-modal w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-[var(--c-surface)] p-6 shadow-xl">
          <DialogTitle className="cred-serif text-lg font-semibold" style={{ color: 'var(--c-text)' }}>
            Add Shared Expense
          </DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Description</label>
              <input
                {...register('description')}
                className="mt-1 block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
                placeholder="e.g. Dinner at restaurant"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-[var(--c-expense)]">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Total Amount</label>
              <input
                type="number"
                step="any"
                {...register('totalAmount', { valueAsNumber: true })}
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
                placeholder="0.00"
              />
              {errors.totalAmount && (
                <p className="mt-1 text-sm text-[var(--c-expense)]">{errors.totalAmount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Date</label>
              <div className="mt-1">
                <Controller
                  control={control}
                  name="date"
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      className="block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
                    />
                  )}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Paid by</label>
              <select
                {...register('paidBy')}
                className="mt-1 block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
              >
                <option value="user">You</option>
                {friends.map((f) => (
                  <option key={f._id} value={f._id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Select friends to split with */}
            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Split between</label>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeUser}
                    onChange={(e) => setIncludeUser(e.target.checked)}
                    className="h-4 w-4 rounded border-[var(--c-border)] text-[var(--c-accent)] focus:ring-[var(--c-accent)]"
                  />
                  <span className="text-sm text-[var(--c-text)]">You</span>
                </label>
                {friends.map((f) => (
                  <label key={f._id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedFriends.includes(f._id)}
                      onChange={() => toggleFriend(f._id)}
                      className="h-4 w-4 rounded border-[var(--c-border)] text-[var(--c-accent)] focus:ring-[var(--c-accent)]"
                    />
                    <span className="text-sm text-[var(--c-text)]">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Split method */}
            {selectedFriends.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[var(--c-text)]">Split method</label>
                <div className="mt-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={splitMethod === 'equal'}
                      onChange={() => setSplitMethod('equal')}
                      className="h-4 w-4 border-[var(--c-border)] text-[var(--c-accent)] focus:ring-[var(--c-accent)]"
                    />
                    <span className="text-sm text-[var(--c-text)]">Equal</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={splitMethod === 'custom'}
                      onChange={() => setSplitMethod('custom')}
                      className="h-4 w-4 border-[var(--c-border)] text-[var(--c-accent)] focus:ring-[var(--c-accent)]"
                    />
                    <span className="text-sm text-[var(--c-text)]">Custom</span>
                  </label>
                </div>

                {/* Split preview */}
                <div className="mt-3 rounded-md bg-[var(--c-surface2)] p-3 space-y-2">
                  {includeUser && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--c-text)]">You</span>
                      <span className="font-medium text-[var(--c-text)]">
                        {splitMethod === 'equal'
                          ? formatCurrency(equalShare)
                          : formatCurrency(
                              totalAmount -
                                selectedFriends.reduce(
                                  (sum, id) => sum + (customAmounts[id] || 0),
                                  0
                                )
                            )}
                      </span>
                    </div>
                  )}
                  {selectedFriends.map((friendId) => {
                    const friend = friends.find((f) => f._id === friendId);
                    return (
                      <div key={friendId} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--c-text)]">{friend?.name}</span>
                        {splitMethod === 'equal' ? (
                          <span className="font-medium text-[var(--c-text)]">
                            {formatCurrency(equalShare)}
                          </span>
                        ) : (
                          <input
                            type="number"
                            step="any"
                            value={customAmounts[friendId] || ''}
                            onChange={(e) =>
                              setCustomAmounts((prev) => ({
                                ...prev,
                                [friendId]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-28 rounded-md border border-[var(--c-border)] px-2 py-1 text-right text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
                            placeholder="0.00"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-surface2)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedFriends.length === 0}
                className="rounded-md bg-[var(--c-accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// --- Friend Detail Page ---

function FriendDetail({ friend, onBack }: { friend: Friend; onBack: () => void }) {
  const { expenses, isLoading, fetchExpenses, deleteExpense } = useSplitStore();
  const { fetchFriends } = useFriendStore();
  const [settleTarget, setSettleTarget] = useState<{
    amount: number;
    friendOwes: boolean;
    coveredExpenseIds: string[];
  } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);

  // Expenses cleared by a settlement move out of the outstanding list.
  const coveredIds = useMemo(() => {
    const ids = new Set<string>();
    for (const e of expenses) {
      if (e.isSettlement && e.coveredExpenseIds) {
        for (const id of e.coveredExpenseIds) ids.add(id);
      }
    }
    return ids;
  }, [expenses]);

  const openExpenses = useMemo(
    () => expenses.filter((e) => !e.isSettlement && !coveredIds.has(e._id)),
    [expenses, coveredIds]
  );
  const settlements = useMemo(
    () => expenses.filter((e) => e.isSettlement),
    [expenses]
  );
  const hasHistory = settlements.length > 0;

  // Live net balance from the fetched expenses, so the page stays correct after
  // a partial settle without waiting on the parent to refresh the friend prop.
  const netBalance = useMemo(
    () => expenses.reduce((sum, e) => sum + balanceContribution(e, friend._id), 0),
    [expenses, friend._id]
  );

  const breakdown = useMemo(() => {
    let lent = 0;
    let borrowed = 0;
    for (const expense of openExpenses) {
      const share = signedShare(expense, friend._id);
      if (share > 0) lent += share;
      else borrowed += -share;
    }
    return { lent, borrowed };
  }, [openExpenses, friend._id]);

  const selectedTotal = useMemo(() => {
    let total = 0;
    for (const e of openExpenses) {
      if (selectedIds.has(e._id)) total += signedShare(e, friend._id);
    }
    return total;
  }, [openExpenses, selectedIds, friend._id]);

  const exitSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const afterSettle = () => {
    setSettleTarget(null);
    exitSelection();
    fetchExpenses(friend._id);
    fetchFriends();
  };

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    fetchExpenses(friend._id);
  }, [friend._id, fetchExpenses]);

  if (showHistory) {
    return (
      <SettlementHistory
        friend={friend}
        settlements={settlements}
        onBack={() => setShowHistory(false)}
      />
    );
  }

  return (
    <div className="p-6 pb-24">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="-ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-[var(--c-muted)] hover:bg-[var(--c-surface2)]"
          >
            &larr; Back
          </button>
          <button
            onClick={() => downloadFriendCsv(friend, expenses)}
            disabled={isLoading || expenses.length === 0}
            className="rounded-md px-2 py-1 text-sm font-medium text-[var(--c-accent)] hover:bg-[var(--c-surface2)] disabled:opacity-40"
          >
            Export CSV
          </button>
        </div>

        <div className="mt-3 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--c-surface2)] text-2xl font-bold text-[var(--c-accent)]">
            {friend.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="cred-serif mt-2 text-xl font-semibold" style={{ color: 'var(--c-text)' }}>{friend.name}</h1>
          {netBalance === 0 ? (
            <p className="mt-0.5 text-sm text-[var(--c-muted)]">All settled up</p>
          ) : netBalance > 0 ? (
            <p className="friend-balance friend-balance-positive mt-0.5 text-sm font-semibold text-[var(--c-income)]">
              owes you <Amount value={netBalance} />
            </p>
          ) : (
            <p className="friend-balance friend-balance-negative mt-0.5 text-sm font-semibold text-[var(--c-expense)]">
              you owe <Amount value={Math.abs(netBalance)} />
            </p>
          )}
          {netBalance !== 0 && (
            <button
              onClick={() =>
                setSettleTarget({
                  amount: Math.abs(netBalance),
                  friendOwes: netBalance > 0,
                  coveredExpenseIds: openExpenses.map((e) => e._id),
                })
              }
              className="t-btn-primary mt-3 px-6 py-2"
            >
              Settle up
            </button>
          )}
        </div>
      </div>

      {/* Outstanding items */}
      <div className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="cred-label">Outstanding</h2>
          {openExpenses.length > 0 &&
            (selectionMode ? (
              <button
                onClick={exitSelection}
                className="text-sm font-medium text-[var(--c-muted)] hover:text-[var(--c-text)]"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setSelectionMode(true)}
                className="text-sm font-medium text-[var(--c-accent)] hover:opacity-80"
              >
                Select
              </button>
            ))}
        </div>

        {/* Debt breakdown summary */}
        {!isLoading && openExpenses.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-[var(--c-surface2)] p-3">
            <div className="text-center">
              <p className="cred-label">You lent</p>
              <p className="friend-balance friend-balance-positive mt-0.5 text-base font-bold text-[var(--c-income)]"><Amount value={breakdown.lent} /></p>
            </div>
            <div className="text-center">
              <p className="cred-label">You borrowed</p>
              <p className="friend-balance friend-balance-negative mt-0.5 text-base font-bold text-[var(--c-expense)]"><Amount value={breakdown.borrowed} /></p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="mt-4 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--c-accent)] border-t-transparent" />
          </div>
        ) : openExpenses.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--c-muted)]">
            {hasHistory ? 'All settled up. Nothing outstanding.' : 'No shared expenses yet.'}
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {openExpenses.map((expense) => {
              const selected = selectedIds.has(expense._id);
              const share = signedShare(expense, friend._id);
              return (
                <div
                  key={expense._id}
                  onClick={selectionMode ? () => toggleSelect(expense._id) : undefined}
                  className={`flex items-center justify-between rounded-lg bg-[var(--c-surface)] p-4 shadow ${
                    selectionMode ? 'cursor-pointer' : ''
                  } ${selected ? 'ring-2 ring-[var(--c-accent)]' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selected}
                        readOnly
                        className="h-4 w-4 rounded border-[var(--c-border)] text-[var(--c-accent)]"
                      />
                    )}
                    <div>
                      <h3 className="font-medium text-[var(--c-text)]">{sharedExpenseLabel(expense)}</h3>
                      <p className="mt-1 text-xs text-[var(--c-muted)]">
                        {new Date(expense.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {' \u00B7 '}
                        Paid by {expense.paidBy === 'user' ? 'you' : getFriendName(expense, friend)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--c-text)]">
                        <Amount value={expense.totalAmount} />
                      </p>
                      {share > 0 ? (
                        <p className="friend-balance friend-balance-positive text-xs font-medium text-[var(--c-income)]">
                          {friend.name} owes <Amount value={share} prefix="+" />
                        </p>
                      ) : share < 0 ? (
                        <p className="friend-balance friend-balance-negative text-xs font-medium text-[var(--c-expense)]">
                          you owe <Amount value={-share} prefix="−" />
                        </p>
                      ) : null}
                    </div>
                    {!selectionMode && (
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === expense._id ? null : expense._id);
                          }}
                          className="rounded-md p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-surface2)] hover:text-[var(--c-text)]"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                          </svg>
                        </button>
                        {openMenuId === expense._id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 z-10 mt-1 w-32 rounded-md bg-[var(--c-surface)] py-1 shadow-lg border border-[var(--c-border)]"
                          >
                            <button
                              onClick={() => { deleteExpense(expense._id); setOpenMenuId(null); }}
                              className="block w-full px-4 py-2 text-left text-sm text-[var(--c-expense)] hover:bg-[var(--c-surface2)]"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Previously settled -> history */}
        {hasHistory && (
          <button
            onClick={() => setShowHistory(true)}
            className="mt-4 flex w-full items-center justify-between rounded-lg bg-[var(--c-surface)] p-4 text-left shadow hover:bg-[var(--c-surface2)]"
          >
            <span className="text-sm font-medium text-[var(--c-text)]">
              Previously settled
              <span className="ml-1 text-[var(--c-muted)]">\u00B7 {settlements.length}</span>
            </span>
            <span className="text-[var(--c-muted)]">&rarr;</span>
          </button>
        )}
      </div>

      {/* Sticky selection action bar */}
      {selectionMode && selectedIds.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--c-border)] bg-[var(--c-surface)] p-4 shadow-lg">
          <div className="mx-auto flex max-w-3xl items-center justify-between">
            <div className="text-sm text-[var(--c-text)]">
              <span className="font-semibold">{selectedIds.size} selected</span>
              <span className="ml-2 text-[var(--c-muted)]"><Amount value={Math.abs(selectedTotal)} /></span>
            </div>
            <button
              onClick={() =>
                setSettleTarget({
                  amount: Math.abs(selectedTotal),
                  friendOwes: selectedTotal >= 0,
                  coveredExpenseIds: [...selectedIds],
                })
              }
              disabled={selectedTotal === 0}
              className="t-btn-primary px-5 py-2"
            >
              Settle selected
            </button>
          </div>
        </div>
      )}

      {/* Settle Modal */}
      {settleTarget && (
        <SettleModal
          friend={friend}
          amount={settleTarget.amount}
          friendOwes={settleTarget.friendOwes}
          coveredExpenseIds={settleTarget.coveredExpenseIds}
          onClose={() => setSettleTarget(null)}
          onDone={afterSettle}
        />
      )}
    </div>
  );
}

function getFriendName(expense: SharedExpense, currentFriend: Friend): string {
  if (expense.paidBy === currentFriend._id) return currentFriend.name;
  // Check populated splits for name
  for (const split of expense.splits) {
    if (typeof split.friendId === 'object' && split.friendId._id === expense.paidBy) {
      return split.friendId.name;
    }
  }
  return 'friend';
}

// --- Settle Modal ---

function SettleModal({
  friend,
  amount,
  friendOwes,
  coveredExpenseIds,
  onClose,
  onDone,
}: {
  friend: Friend;
  amount: number;
  friendOwes: boolean;
  coveredExpenseIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { settleUp } = useSplitStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const [step, setStep] = useState<'method' | 'account'>('method');
  const [method, setMethod] = useState<'received' | 'paid'>(
    friendOwes ? 'received' : 'paid'
  );
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // How much actually changed hands, and what happens to any rest.
  const fullText = String(Math.round(amount * 100) / 100);
  const [paidText, setPaidText] = useState(fullText);
  const [rest, setRest] = useState<'keep' | 'waive'>('keep');
  const paid = Math.round((parseFloat(paidText) || 0) * 100) / 100;
  const left = Math.round((amount - paid) * 100) / 100;
  const partial = paid > 0 && left > 0.004;
  const tooMuch = paid > amount + 0.004;
  const paidOk = paid > 0 && !tooMuch;

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts();
  }, [accounts.length, fetchAccounts]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0]._id);
  }, [accounts, accountId]);

  const submit = async (m: 'received' | 'paid' | 'waived') => {
    setSubmitting(true);
    try {
      // A partial payment that keeps the rest owed can't tick off whole bills;
      // paying in full, or paying and forgiving the rest, clears them all.
      const clearsAll = m === 'waived' || !partial || rest === 'waive';
      await settleUp({
        friendId: friend._id,
        amount: m === 'waived' ? amount : paid,
        method: m,
        friendOwes,
        accountId: m === 'waived' ? undefined : accountId,
        coveredExpenseIds: clearsAll ? coveredExpenseIds : [],
        waivedAmount: m !== 'waived' && partial && rest === 'waive' ? left : undefined,
      });
      onDone();
    } catch {
      // handled by store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="cartoon-modal w-full max-w-md rounded-lg bg-[var(--c-surface)] p-6 shadow-xl">
          <DialogTitle className="cred-serif text-lg font-semibold" style={{ color: 'var(--c-text)' }}>
            Settle Up with {friend.name}
          </DialogTitle>

          <p className="mt-2 text-sm text-[var(--c-muted)]">
            {friendOwes ? `${friend.name} owes you ` : `You owe ${friend.name} `}
            <Amount value={amount} />
          </p>

          {step === 'method' ? (
            <div className="mt-4 space-y-2">
              <button
                onClick={() => { setMethod(friendOwes ? 'received' : 'paid'); setStep('account'); }}
                className="flex w-full flex-col rounded-lg border border-[var(--c-border)] p-3 text-left hover:border-[var(--c-income)] hover:bg-[var(--c-surface2)]"
              >
                <span className="text-sm font-medium text-[var(--c-text)]">
                  {friendOwes ? 'They paid me' : 'I paid them'}
                </span>
                <span className="text-xs text-[var(--c-muted)]">
                  {friendOwes
                    ? 'Money lands in one of your accounts'
                    : 'Money leaves one of your accounts'}
                </span>
              </button>
              <button
                onClick={() => submit('waived')}
                disabled={submitting}
                className="flex w-full flex-col rounded-lg border border-[var(--c-border)] p-3 text-left hover:border-[var(--c-warning)] hover:bg-[var(--c-surface2)] disabled:opacity-50"
              >
                <span className="text-sm font-medium text-[var(--c-text)]">
                  {friendOwes ? 'Waive it off (on me)' : 'They waived it'}
                </span>
                <span className="text-xs text-[var(--c-muted)]">
                  {friendOwes
                    ? 'Forgive the debt — counts as your expense'
                    : 'Debt forgiven — just clears the balance'}
                </span>
              </button>

              <div className="flex justify-end pt-2">
                <button
                  onClick={onClose}
                  className="rounded-md px-4 py-2 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-surface2)]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--c-text)]">
                  {method === 'received' ? `How much did ${friend.name} pay?` : `How much did you pay ${friend.name}?`}
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-[var(--c-muted)]">₹</span>
                  <input
                    type="text" inputMode="decimal" autoFocus value={paidText}
                    onChange={(e) => setPaidText(e.target.value.replace(/[^0-9.]/g, ''))}
                    onFocus={(e) => e.currentTarget.select()}
                    className="t-input flex-1" placeholder={fullText} aria-label="Amount settled"
                  />
                  {paidText !== fullText && (
                    <button type="button" className="text-xs font-semibold underline" onClick={() => setPaidText(fullText)}>Full</button>
                  )}
                </div>
                {tooMuch && <p className="mt-1 text-sm text-[var(--c-expense)]">That's more than the <Amount value={amount} /> owed.</p>}
              </div>

              {partial && (
                <div>
                  <p className="text-sm font-medium text-[var(--c-text)]">The other <Amount value={left} /></p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setRest('keep')} className={`settle-opt ${rest === 'keep' ? 'is-on' : ''}`}>
                      <span className="settle-opt-title">Keep it owed</span>
                      <span className="settle-opt-sub">{friendOwes ? `${friend.name} still owes you this` : 'You still owe this'}</span>
                    </button>
                    <button type="button" onClick={() => setRest('waive')} className={`settle-opt ${rest === 'waive' ? 'is-on' : ''}`}>
                      <span className="settle-opt-title">{friendOwes ? 'Waive it off' : 'They waive it'}</span>
                      <span className="settle-opt-sub">{friendOwes ? 'Forgive it — counts as your expense' : 'Forgiven — just clears it'}</span>
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--c-text)]">
                  {method === 'received' ? 'Deposit to account' : 'Pay from account'}
                </label>
                <ThemedSelect
                  className="mt-1"
                  value={accountId}
                  onChange={setAccountId}
                  options={accounts.map((a) => ({ value: a._id, label: a.name, hint: formatCurrency(a.balance), icon: renderAccountIcon(a.type, a.color, 22) }))}
                />
                {accounts.length === 0 && (
                  <p className="mt-1 text-sm text-[var(--c-expense)]">No accounts found. Add an account first.</p>
                )}
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('method')}
                  className="rounded-md px-4 py-2 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-surface2)]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => submit(method)}
                  disabled={submitting || !accountId || !paidOk}
                  className="t-btn-primary px-4 py-2"
                >
                  {submitting ? 'Settling...' : partial && rest === 'waive'
                    ? <>Settle <Amount value={paid} /> &amp; waive <Amount value={left} /></>
                    : <>Settle <Amount value={paidOk ? paid : amount} /></>}
                </button>
              </div>
            </div>
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// --- Settlement History ---

function SettlementHistory({
  friend,
  settlements,
  onBack,
}: {
  friend: Friend;
  settlements: SharedExpense[];
  onBack: () => void;
}) {
  const methodLabel = (m?: string) =>
    m === 'received' ? 'Received' : m === 'paid' ? 'Paid' : m === 'waived' ? 'Waived' : 'Settled';

  return (
    <div className="p-6">
      <button
        onClick={onBack}
        className="-ml-2 flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-[var(--c-muted)] hover:bg-[var(--c-surface2)]"
      >
        &larr; Back
      </button>
      <h1 className="cred-serif mt-3 text-xl font-semibold" style={{ color: 'var(--c-text)' }}>Settlement history</h1>
      <p className="mt-0.5 text-sm text-[var(--c-muted)]">with {friend.name}</p>

      {settlements.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--c-muted)]">No settlements yet.</p>
      ) : (
        <div className="mt-4 space-y-3">
          {settlements.map((s) => (
            <div key={s._id} className="rounded-lg p-4 shadow" style={{ background: 'var(--c-surface)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="rounded px-2 py-0.5 text-xs font-medium"
                    style={{
                      background: 'var(--c-surface2)',
                      color: s.settlementMethod === 'waived' ? 'var(--c-warning)' : 'var(--c-income)',
                    }}
                  >
                    {methodLabel(s.settlementMethod)}
                  </span>
                  <span className="text-xs text-[var(--c-muted)]">
                    {new Date(s.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                <p className="text-sm font-semibold text-[var(--c-text)]"><Amount value={s.totalAmount} /></p>
              </div>
              {s.coveredExpenseIds && s.coveredExpenseIds.length > 0 && (
                <p className="mt-2 text-xs text-[var(--c-muted)]">
                  Cleared {s.coveredExpenseIds.length} item
                  {s.coveredExpenseIds.length > 1 ? 's' : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Friends;
