import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useTransactionStore, { type Transaction } from '../store/transactionStore';
import useCategoryStore from '../store/categoryStore';
import useAccountStore from '../store/accountStore';
import useFriendStore, { type Friend } from '../store/friendStore';
import { formatCurrency } from '../utils/format';

const transactionSchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().positive('Amount must be positive'),
  categoryId: z.string().min(1, 'Category is required'),
  accountId: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  note: z.string().optional(),
});

type TransactionFormData = z.infer<typeof transactionSchema>;

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function Transactions() {
  const {
    transactions,
    pagination,
    isLoading,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
  } = useTransactionStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const { friends, fetchFriends } = useFriendStore();

  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as { openCreate?: boolean; initialType?: 'income' | 'expense' } | null;

  const [showCreate, setShowCreate] = useState(!!navState?.openCreate);
  const [createInitialType] = useState<'income' | 'expense' | undefined>(
    navState?.initialType
  );
  const [returnToDashboardOnClose, setReturnToDashboardOnClose] = useState(!!navState?.openCreate);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (navState?.openCreate) {
      // Clear router state so a refresh/back doesn't reopen the modal.
      navigate(location.pathname, { replace: true, state: null });
    }
    // Only run on mount based on the initial nav state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCloseCreate = () => {
    setShowCreate(false);
    if (returnToDashboardOnClose) {
      setReturnToDashboardOnClose(false);
      navigate('/dashboard');
    }
  };

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [accountFilter, setAccountFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  useEffect(() => {
    fetchCategories();
    fetchAccounts();
    fetchFriends();
  }, [fetchCategories, fetchAccounts, fetchFriends]);

  const loadTransactions = useCallback(
    (page?: number) => {
      fetchTransactions({
        type: typeFilter || undefined,
        categoryId: categoryFilter || undefined,
        accountId: accountFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
      });
    },
    [fetchTransactions, typeFilter, categoryFilter, accountFilter, dateFrom, dateTo]
  );

  useEffect(() => {
    loadTransactions(1);
  }, [loadTransactions]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      await deleteTransaction(id);
    }
  };

  const amountColor = (type: string) => {
    if (type === 'income') return 'text-green-600';
    if (type === 'expense') return 'text-red-600';
    return 'text-blue-600';
  };

  const amountPrefix = (type: string) => {
    if (type === 'income') return '+';
    if (type === 'expense') return '-';
    return '';
  };

  const activeAccounts = accounts.filter((a) => a.isActive);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
          <p className="mt-1 text-sm text-gray-500">View and manage your transactions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Transaction
        </button>
      </div>

      {/* Filter Bar */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-lg bg-white p-4 shadow">
        <div>
          <label className="block text-xs font-medium text-gray-500">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Category</label>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">Account</label>
          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Accounts</option>
            {accounts.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Transaction List */}
      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : transactions.length === 0 ? (
        <div className="mt-8 text-center text-gray-500">
          <p>No transactions found.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Note</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Account</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => (
                <tr key={tx._id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {formatDate(tx.date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {tx.type === 'transfer' ? (
                      <span className="text-blue-600">Transfer</span>
                    ) : tx.categoryId ? (
                      <span>
                        {tx.categoryId.icon} {tx.categoryId.name}
                      </span>
                    ) : (
                      <span className="text-gray-400">--</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {tx.note || '--'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {tx.accountId ? (
                      <>
                        {tx.accountId.name}
                        {tx.toAccountId && (
                          <span className="text-gray-400">
                            {' -> '}{tx.toAccountId.name}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                        Debt
                      </span>
                    )}
                  </td>
                  <td className={`whitespace-nowrap px-4 py-3 text-right text-sm font-semibold ${amountColor(tx.type)}`}>
                    {amountPrefix(tx.type)}{formatCurrency(tx.amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === tx._id ? null : tx._id);
                        }}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="More actions"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                      {openMenuId === tx._id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 z-10 mt-1 w-32 rounded-md bg-white py-1 text-left shadow-lg ring-1 ring-black ring-opacity-5"
                        >
                          {tx.type !== 'transfer' && (
                            <button
                              onClick={() => { setEditingTransaction(tx); setOpenMenuId(null); }}
                              className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => { handleDelete(tx._id); setOpenMenuId(null); }}
                            className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.page} of {pagination.pages} ({pagination.total} transactions)
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => loadTransactions(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => loadTransactions(pagination.page + 1)}
              disabled={pagination.page >= pagination.pages}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Create Modal */}
      <TransactionModal
        open={showCreate}
        onClose={handleCloseCreate}
        onSubmit={createTransaction}
        categories={categories}
        accounts={activeAccounts}
        friends={friends}
        initialType={createInitialType}
      />

      {/* Edit Modal */}
      {editingTransaction && (
        <TransactionModal
          open={true}
          onClose={() => setEditingTransaction(null)}
          onSubmit={(data) => updateTransaction(editingTransaction._id, data)}
          categories={categories}
          accounts={activeAccounts}
          friends={friends}
          transaction={editingTransaction}
        />
      )}
    </div>
  );
}

function TransactionModal({
  open,
  onClose,
  onSubmit,
  categories,
  accounts,
  friends,
  transaction,
  initialType,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  categories: { _id: string; name: string; type: string; icon: string }[];
  accounts: { _id: string; name: string }[];
  friends: Friend[];
  transaction?: Transaction;
  initialType?: 'income' | 'expense';
}) {
  const isEdit = !!transaction;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: transaction
      ? {
          type: transaction.type as 'income' | 'expense',
          amount: transaction.amount,
          categoryId: transaction.categoryId?._id || '',
          accountId: transaction.accountId?._id || '',
          date: transaction.date.slice(0, 10),
          note: transaction.note || '',
        }
      : {
          type: initialType ?? 'expense',
          amount: undefined as unknown as number,
          categoryId: '',
          accountId: '',
          date: new Date().toISOString().slice(0, 10),
          note: '',
        },
  });

  const selectedType = watch('type');
  const filteredCategories = categories.filter((c) => c.type === selectedType);

  useEffect(() => {
    if (!isEdit && accounts.length > 0) {
      const icici = accounts.find((a) => a.name.toUpperCase().includes('ICICI'));
      if (icici) setValue('accountId', icici._id);
    }
  }, [isEdit, accounts, setValue]);

  // Friend/split state
  const [whoPaid, setWhoPaid] = useState<'user' | string>('user');
  const [isSplit, setIsSplit] = useState(false);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<string, number>>({});

  const totalAmount = watch('amount');
  const hasFriends = friends.length > 0;
  const showFriendFlow = hasFriends && selectedType === 'expense';
  const friendPaid = whoPaid !== 'user';

  const toggleFriend = (friendId: string) => {
    setSelectedFriends((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  // Equal split calc
  const participantCount = selectedFriends.length + 1; // always include user
  const equalShare = participantCount > 0 ? totalAmount / participantCount : 0;

  const handleFormSubmit = async (data: TransactionFormData) => {
    try {
      const payload: any = {
        type: data.type,
        amount: data.amount,
        categoryId: data.categoryId,
        date: data.date,
        note: data.note,
      };

      if (friendPaid) {
        // Friend paid — no account, track as debt
        payload.paidByFriendId = whoPaid;
      } else {
        // User paid — normal account deduction
        payload.accountId = data.accountId;
      }

      // Build splits if splitting
      if (showFriendFlow && isSplit && selectedFriends.length > 0) {
        payload.splits = selectedFriends.map((friendId) => ({
          friendId,
          amount: Math.round((splitAmounts[friendId] ?? equalShare) * 100) / 100,
        }));
      }

      await onSubmit(payload);
      reset();
      setWhoPaid('user');
      setIsSplit(false);
      setSelectedFriends([]);
      setSplitAmounts({});
      onClose();
    } catch {
      // handled by store
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="mt-4 space-y-4" autoComplete="off">
            {/* Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setValue('type', 'income');
                    setValue('categoryId', '');
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                    selectedType === 'income'
                      ? 'bg-green-600 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValue('type', 'expense');
                    setValue('categoryId', '');
                  }}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                    selectedType === 'expense'
                      ? 'bg-red-600 text-white'
                      : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Expense
                </button>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                step="any"
                {...register('amount', { valueAsNumber: true })}
                onWheel={(e) => e.currentTarget.blur()}
                onFocus={(e) => e.currentTarget.select()}
                autoComplete="off"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
              {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Category</label>
              <select
                {...register('categoryId')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select category</option>
                {filteredCategories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-sm text-red-600">{errors.categoryId.message}</p>
              )}
            </div>

            {/* Who Paid — only for expense when friends exist */}
            {showFriendFlow && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Who paid?</label>
                <select
                  value={whoPaid}
                  onChange={(e) => setWhoPaid(e.target.value)}
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
            )}

            {/* Account — only when user paid */}
            {!friendPaid && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Account</label>
                <select
                  {...register('accountId')}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {accounts.map((a) => (
                    <option key={a._id} value={a._id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {errors.accountId && (
                  <p className="mt-1 text-sm text-red-600">{errors.accountId.message}</p>
                )}
              </div>
            )}

            {/* Is this a split? — only for expense with friends */}
            {showFriendFlow && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Is this a split?</label>
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSplit(false)}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                      !isSplit
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    No
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSplit(true);
                      if (friends.length === 1 && selectedFriends.length === 0) {
                        setSelectedFriends([friends[0]._id]);
                      }
                    }}
                    className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                      isSplit
                        ? 'bg-blue-600 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Yes
                  </button>
                </div>
              </div>
            )}

            {/* Split details */}
            {showFriendFlow && isSplit && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Split with</label>
                <div className="mt-2 space-y-2">
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

                {/* Split preview */}
                {selectedFriends.length > 0 && totalAmount > 0 && (
                  <div className="mt-3 rounded-md bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">You</span>
                      <span className="font-medium text-gray-900">
                        {formatCurrency(
                          totalAmount -
                            selectedFriends.reduce(
                              (sum, id) => sum + (splitAmounts[id] ?? equalShare),
                              0
                            )
                        )}
                      </span>
                    </div>
                    {selectedFriends.map((friendId) => {
                      const friend = friends.find((f) => f._id === friendId);
                      return (
                        <div key={friendId} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{friend?.name}</span>
                          <input
                            type="number"
                            step="any"
                            value={splitAmounts[friendId] ?? Math.round(equalShare * 100) / 100}
                            onChange={(e) =>
                              setSplitAmounts((prev) => ({
                                ...prev,
                                [friendId]: parseFloat(e.target.value) || 0,
                              }))
                            }
                            onWheel={(e) => e.currentTarget.blur()}
                            onFocus={(e) => e.currentTarget.select()}
                            autoComplete="off"
                            className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                {...register('date')}
                autoComplete="off"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.date && <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>}
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
              <input
                {...register('note')}
                autoComplete="off"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Grocery shopping"
              />
            </div>

            {/* Actions */}
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
                {isSubmitting ? (isEdit ? 'Saving...' : 'Creating...') : isEdit ? 'Save' : 'Create'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Transactions;
