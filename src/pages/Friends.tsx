import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useFriendStore, { type Friend } from '../store/friendStore';
import useSplitStore, { type SharedExpense } from '../store/splitStore';
import { formatCurrency } from '../utils/format';

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

const settleSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
});

type FriendFormData = z.infer<typeof friendSchema>;
type ExpenseFormData = z.infer<typeof expenseSchema>;
type SettleFormData = z.infer<typeof settleSchema>;

// --- Main Page ---

function Friends() {
  const { friends, isLoading, fetchFriends } = useFriendStore();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Friends</h1>
          <p className="mt-1 text-sm text-gray-500">Manage shared expenses and debts</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => setShowAddExpense(true)}
            disabled={friends.length === 0}
            className="flex-1 whitespace-nowrap rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50 sm:flex-none sm:px-4"
          >
            + Add Expense
          </button>
          <button
            onClick={() => setShowAddFriend(true)}
            className="flex-1 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:flex-none sm:px-4"
          >
            + Add Friend
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">You are owed</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{formatCurrency(totalOwed)}</p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">You owe</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{formatCurrency(totalOwe)}</p>
        </div>
      </div>

      {/* Friends List */}
      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : friends.length === 0 ? (
        <div className="mt-8 text-center text-gray-500">
          <p>No friends added yet. Add a friend to start splitting expenses.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {friends.map((friend) => (
            <div
              key={friend._id}
              onClick={() => setSelectedFriend(friend)}
              className="flex cursor-pointer items-center justify-between rounded-lg bg-white p-4 shadow transition-colors hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                  {friend.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{friend.name}</h3>
                  {friend.phone && (
                    <p className="text-xs text-gray-500">{friend.phone}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                {friend.netBalance === 0 ? (
                  <p className="text-sm text-gray-500">settled up</p>
                ) : friend.netBalance > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-green-600">
                      owes you {formatCurrency(friend.netBalance)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold text-red-600">
                      you owe {formatCurrency(Math.abs(friend.netBalance))}
                    </p>
                  </>
                )}
              </div>
              <div className="relative ml-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === friend._id ? null : friend._id);
                  }}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {openMenuId === friend._id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 z-10 mt-1 w-32 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5"
                  >
                    <button
                      onClick={() => { setEditingFriend(friend); setOpenMenuId(null); }}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
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
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {friend ? 'Edit Friend' : 'Add Friend'}
          </DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                {...register('name')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Rahul"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Phone (optional)</label>
              <input
                {...register('phone')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. 9876543210"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email (optional)</label>
              <input
                {...register('email')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. rahul@email.com"
              />
              {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
        <DialogPanel className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Add Shared Expense
          </DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <input
                {...register('description')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Dinner at restaurant"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Total Amount</label>
              <input
                type="number"
                step="any"
                {...register('totalAmount', { valueAsNumber: true })}
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
              {errors.totalAmount && (
                <p className="mt-1 text-sm text-red-600">{errors.totalAmount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                {...register('date')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Paid by</label>
              <select
                {...register('paidBy')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700">Split between</label>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeUser}
                    onChange={(e) => setIncludeUser(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">You</span>
                </label>
                {friends.map((f) => (
                  <label key={f._id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedFriends.includes(f._id)}
                      onChange={() => toggleFriend(f._id)}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{f.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Split method */}
            {selectedFriends.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Split method</label>
                <div className="mt-2 flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={splitMethod === 'equal'}
                      onChange={() => setSplitMethod('equal')}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Equal</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={splitMethod === 'custom'}
                      onChange={() => setSplitMethod('custom')}
                      className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Custom</span>
                  </label>
                </div>

                {/* Split preview */}
                <div className="mt-3 rounded-md bg-gray-50 p-3 space-y-2">
                  {includeUser && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">You</span>
                      <span className="font-medium text-gray-900">
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
                        <span className="text-gray-700">{friend?.name}</span>
                        {splitMethod === 'equal' ? (
                          <span className="font-medium text-gray-900">
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
                            className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedFriends.length === 0}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
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
  const [showSettle, setShowSettle] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    fetchExpenses(friend._id);
  }, [friend._id, fetchExpenses]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="rounded-md px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
        >
          &larr; Back
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-lg font-bold text-blue-700">
            {friend.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{friend.name}</h1>
            {friend.netBalance === 0 ? (
              <p className="text-sm text-gray-500">All settled up</p>
            ) : friend.netBalance > 0 ? (
              <p className="text-sm font-semibold text-green-600">
                owes you {formatCurrency(friend.netBalance)}
              </p>
            ) : (
              <p className="text-sm font-semibold text-red-600">
                you owe {formatCurrency(Math.abs(friend.netBalance))}
              </p>
            )}
          </div>
        </div>
        {friend.netBalance !== 0 && (
          <button
            onClick={() => setShowSettle(true)}
            className="ml-auto rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            Settle Up
          </button>
        )}
      </div>

      {/* Expense History */}
      <div className="mt-6">
        <h2 className="text-lg font-semibold text-gray-900">History</h2>
        {isLoading ? (
          <div className="mt-4 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : expenses.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No shared expenses yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {expenses.map((expense) => (
              <div
                key={expense._id}
                className="flex items-center justify-between rounded-lg bg-white p-4 shadow"
              >
                <div>
                  <div className="flex items-center gap-2">
                    {expense.isSettlement && (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Settlement
                      </span>
                    )}
                    <h3 className="font-medium text-gray-900">{expense.description}</h3>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {new Date(expense.date).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                    {' \u00B7 '}
                    Paid by {expense.paidBy === 'user' ? 'you' : getFriendName(expense, friend)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(expense.totalAmount)}
                  </p>
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === expense._id ? null : expense._id);
                      }}
                      className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                    {openMenuId === expense._id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute right-0 z-10 mt-1 w-32 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5"
                      >
                        <button
                          onClick={() => { deleteExpense(expense._id); setOpenMenuId(null); }}
                          className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settle Modal */}
      {showSettle && (
        <SettleModal
          friend={friend}
          onClose={() => {
            setShowSettle(false);
            fetchExpenses(friend._id);
            onBack();
          }}
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

function SettleModal({ friend, onClose }: { friend: Friend; onClose: () => void }) {
  const { settleUp } = useSplitStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettleFormData>({
    resolver: zodResolver(settleSchema),
    defaultValues: { amount: Math.abs(friend.netBalance) },
  });

  const onSubmit = async (data: SettleFormData) => {
    try {
      await settleUp(friend._id, data.amount);
      onClose();
    } catch {
      // handled by store
    }
  };

  return (
    <Dialog open={true} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            Settle Up with {friend.name}
          </DialogTitle>

          <p className="mt-2 text-sm text-gray-500">
            {friend.netBalance > 0
              ? `${friend.name} owes you ${formatCurrency(friend.netBalance)}`
              : `You owe ${friend.name} ${formatCurrency(Math.abs(friend.netBalance))}`}
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Settlement Amount</label>
              <input
                type="number"
                step="any"
                {...register('amount', { valueAsNumber: true })}
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Settling...' : 'Settle'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Friends;
