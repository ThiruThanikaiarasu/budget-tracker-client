import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useAccountStore, { type Account } from '../store/accountStore';
import { formatCurrency } from '../utils/format';

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'upi_wallet', label: 'UPI Wallet' },
  { value: 'other', label: 'Other' },
] as const;

const TYPE_ICONS: Record<Account['type'], string> = {
  cash: '\u{1F4B5}',
  bank_account: '\u{1F3E6}',
  credit_card: '\u{1F4B3}',
  upi_wallet: '\u{1F4F1}',
  other: '\u{1F4BC}',
};

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316',
];

const accountTypeEnum = ['cash', 'bank_account', 'credit_card', 'upi_wallet', 'other'] as const;

const createSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(accountTypeEnum),
  balance: z.number(),
  color: z.string().optional(),
});

const editSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(accountTypeEnum),
  color: z.string().optional(),
});

const transferSchema = z.object({
  fromAccountId: z.string().min(1, 'Select source'),
  toAccountId: z.string().min(1, 'Select destination'),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;
type TransferFormData = z.infer<typeof transferSchema>;

function Accounts() {
  const { accounts, isLoading, fetchAccounts, createAccount, updateAccount, toggleAccount, transfer } =
    useAccountStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const totalBalance = accounts
    .filter((a) => a.isActive)
    .reduce((sum, a) => sum + a.balance, 0);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your financial accounts</p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() => setShowTransfer(true)}
            className="flex-1 whitespace-nowrap rounded-lg border border-blue-600 px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 sm:flex-none sm:px-4"
          >
            Transfer
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex-1 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 sm:flex-none sm:px-4"
          >
            + Add Account
          </button>
        </div>
      </div>

      {/* Total Balance Bar */}
      <div className="mt-6 rounded-lg bg-white p-5 shadow">
        <p className="text-sm font-medium text-gray-500">Total Balance (Active Accounts)</p>
        <p className={`mt-1 text-3xl font-bold ${totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {formatCurrency(totalBalance)}
        </p>
      </div>

      {/* Account Cards */}
      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="mt-8 text-center text-gray-500">
          <p>No accounts yet. Add your first account to get started.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div
              key={account._id}
              className={`relative rounded-lg bg-white p-5 shadow transition-opacity ${
                !account.isActive ? 'opacity-50' : ''
              }`}
            >
              {/* Color accent */}
              {account.color && (
                <div
                  className="absolute left-0 top-0 h-full w-1 rounded-l-lg"
                  style={{ backgroundColor: account.color }}
                />
              )}

              {/* Three-dot menu */}
              <div className="absolute right-2 top-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === account._id ? null : account._id);
                  }}
                  className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </button>
                {openMenuId === account._id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 z-10 mt-1 w-36 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5"
                  >
                    <button
                      onClick={() => { setEditingAccount(account); setOpenMenuId(null); }}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { toggleAccount(account._id); setOpenMenuId(null); }}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {account.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-2xl">{TYPE_ICONS[account.type]}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{account.name}</h3>
                    {!account.isActive && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {ACCOUNT_TYPES.find((t) => t.value === account.type)?.label}
                  </p>
                </div>
              </div>

              <p
                className={`mt-4 text-xl font-bold ${
                  account.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(account.balance)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={createAccount} />

      {/* Edit Modal */}
      {editingAccount && (
        <EditModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onUpdate={updateAccount}
        />
      )}

      {/* Transfer Modal */}
      <TransferModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        onTransfer={transfer}
        accounts={accounts.filter((a) => a.isActive)}
      />
    </div>
  );
}

function CreateModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (data: CreateFormData) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { type: 'bank_account', balance: undefined as unknown as number, color: COLORS[0] },
  });

  const selectedColor = watch('color');

  const onSubmit = async (data: CreateFormData) => {
    try {
      await onCreate(data);
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
          <DialogTitle className="text-lg font-semibold text-gray-900">Add Account</DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                {...register('name')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. HDFC Savings"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                {...register('type')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Initial Balance</label>
              <input
                type="number"
                step="any"
                {...register('balance', { valueAsNumber: true })}
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <div className="mt-2 flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue('color', c)}
                    className={`h-7 w-7 rounded-full border-2 ${
                      selectedColor === c ? 'border-gray-900' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
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
                {isSubmitting ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function EditModal({
  account,
  onClose,
  onUpdate,
}: {
  account: Account;
  onClose: () => void;
  onUpdate: (id: string, data: EditFormData) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: account.name,
      type: account.type,
      color: account.color || COLORS[0],
    },
  });

  const selectedColor = watch('color');

  const onSubmit = async (data: EditFormData) => {
    try {
      await onUpdate(account._id, data);
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
          <DialogTitle className="text-lg font-semibold text-gray-900">Edit Account</DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                {...register('name')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                {...register('type')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Color</label>
              <div className="mt-2 flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setValue('color', c)}
                    className={`h-7 w-7 rounded-full border-2 ${
                      selectedColor === c ? 'border-gray-900' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
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
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function TransferModal({
  open,
  onClose,
  onTransfer,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  onTransfer: (data: TransferFormData) => Promise<void>;
  accounts: Account[];
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: undefined as unknown as number, note: '' },
  });

  const fromAccountId = watch('fromAccountId');
  const toAccountId = watch('toAccountId');
  const amount = watch('amount');

  const sourceAccount = accounts.find((a) => a._id === fromAccountId);
  const sameAccountError = fromAccountId && toAccountId && fromAccountId === toAccountId;
  const insufficientBalance = sourceAccount && amount > 0 && amount > sourceAccount.balance;

  const onSubmit = async (data: TransferFormData) => {
    if (data.fromAccountId === data.toAccountId) return;
    const source = accounts.find((a) => a._id === data.fromAccountId);
    if (source && data.amount > source.balance) return;
    try {
      await onTransfer(data);
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
          <DialogTitle className="text-lg font-semibold text-gray-900">Transfer Funds</DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">From Account</label>
              <select
                {...register('fromAccountId')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select source account</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({formatCurrency(a.balance)})
                  </option>
                ))}
              </select>
              {errors.fromAccountId && (
                <p className="mt-1 text-sm text-red-600">{errors.fromAccountId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">To Account</label>
              <select
                {...register('toAccountId')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select destination account</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name} ({formatCurrency(a.balance)})
                  </option>
                ))}
              </select>
              {errors.toAccountId && (
                <p className="mt-1 text-sm text-red-600">{errors.toAccountId.message}</p>
              )}
              {sameAccountError && (
                <p className="mt-1 text-sm text-red-600">Source and destination must be different</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Amount</label>
              <input
                type="number"
                step="any"
                {...register('amount', { valueAsNumber: true })}
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
              )}
              {insufficientBalance && (
                <p className="mt-1 text-sm text-red-600">
                  Insufficient balance (available: {formatCurrency(sourceAccount!.balance)})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
              <input
                {...register('note')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. Monthly savings"
              />
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
                disabled={isSubmitting || !!sameAccountError || !!insufficientBalance}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Transferring...' : 'Transfer'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Accounts;
