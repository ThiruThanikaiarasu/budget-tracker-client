import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useInvestmentStore, { type Investment } from '../store/investmentStore';
import { formatCurrency } from '../utils/format';

const INVESTMENT_TYPES = [
  { value: 'mutual_fund', label: 'Mutual Fund' },
  { value: 'stocks', label: 'Stocks' },
  { value: 'fd', label: 'Fixed Deposit' },
  { value: 'ppf', label: 'PPF' },
  { value: 'gold', label: 'Gold' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'other', label: 'Other' },
] as const;

const TYPE_ICONS: Record<Investment['type'], string> = {
  mutual_fund: '\u{1F4CA}',
  stocks: '\u{1F4C8}',
  fd: '\u{1F3E6}',
  ppf: '\u{1F3DB}\uFE0F',
  gold: '\u{1FA99}',
  real_estate: '\u{1F3E0}',
  crypto: '\u{1FA99}',
  other: '\u{1F4BC}',
};

const investmentTypeEnum = [
  'mutual_fund', 'stocks', 'fd', 'ppf', 'gold', 'real_estate', 'crypto', 'other',
] as const;

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(investmentTypeEnum),
  amountInvested: z.number().min(0, 'Must be 0 or more'),
  currentValue: z.number().min(0, 'Must be 0 or more'),
  dateInvested: z.string().min(1, 'Date is required'),
  note: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

function Investments() {
  const { investments, isLoading, fetchInvestments, toggleInvestment } = useInvestmentStore();
  const [showCreate, setShowCreate] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvestments();
  }, [fetchInvestments]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const activeInvestments = investments.filter((i) => i.isActive);
  const totalInvested = activeInvestments.reduce((sum, i) => sum + i.amountInvested, 0);
  const totalCurrentValue = activeInvestments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalGainLoss = totalCurrentValue - totalInvested;
  const totalGainLossPct = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Investments</h1>
          <p className="mt-1 text-sm text-gray-500">Track your investment portfolio</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Add Investment
        </button>
      </div>

      {/* Portfolio Summary */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Total Invested</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(totalInvested)}</p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Current Value</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{formatCurrency(totalCurrentValue)}</p>
        </div>
        <div className="rounded-lg bg-white p-5 shadow">
          <p className="text-sm font-medium text-gray-500">Overall Gain/Loss</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              totalGainLoss >= 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {totalGainLoss >= 0 ? '+' : ''}
            {formatCurrency(totalGainLoss)}{' '}
            <span className="text-sm font-medium">
              ({totalGainLossPct >= 0 ? '+' : ''}
              {totalGainLossPct.toFixed(1)}%)
            </span>
          </p>
        </div>
      </div>

      {/* Investment List */}
      {isLoading ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : investments.length === 0 ? (
        <div className="mt-8 text-center text-gray-500">
          <p>No investments yet. Add your first investment to start tracking.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {investments.map((investment) => {
            const gainLoss = investment.currentValue - investment.amountInvested;
            const gainLossPct =
              investment.amountInvested > 0
                ? (gainLoss / investment.amountInvested) * 100
                : 0;

            return (
              <div
                key={investment._id}
                className={`rounded-lg bg-white p-4 shadow transition-opacity ${
                  !investment.isActive ? 'opacity-50' : ''
                }`}
              >
                {/* Three-dot menu */}
                <div className="absolute right-2 top-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === investment._id ? null : investment._id);
                    }}
                    className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                  {openMenuId === investment._id && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 z-10 mt-1 w-36 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5"
                    >
                      <button
                        onClick={() => { setEditingInvestment(investment); setOpenMenuId(null); }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => { toggleInvestment(investment._id); setOpenMenuId(null); }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {investment.isActive ? 'Mark Exited' : 'Mark Active'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TYPE_ICONS[investment.type]}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{investment.name}</h3>
                        {!investment.isActive && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                            Exited
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {INVESTMENT_TYPES.find((t) => t.value === investment.type)?.label}
                        {' \u00B7 '}
                        {new Date(investment.dateInvested).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mr-8 text-right">
                    <p className="text-sm text-gray-500">
                      Invested: {formatCurrency(investment.amountInvested)}
                    </p>
                    <p className="font-semibold text-gray-900">
                      {formatCurrency(investment.currentValue)}
                    </p>
                    <p
                      className={`text-sm font-medium ${
                        gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {gainLoss >= 0 ? '+' : ''}
                      {formatCurrency(gainLoss)} ({gainLossPct >= 0 ? '+' : ''}
                      {gainLossPct.toFixed(1)}%)
                    </p>
                  </div>
                </div>

                {investment.note && (
                  <p className="mt-2 text-xs text-gray-500">{investment.note}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      <InvestmentModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Edit Modal */}
      {editingInvestment && (
        <InvestmentModal
          open={true}
          onClose={() => setEditingInvestment(null)}
          investment={editingInvestment}
        />
      )}
    </div>
  );
}

// --- Investment Modal (Add / Edit) ---

function InvestmentModal({
  open,
  onClose,
  investment,
}: {
  open: boolean;
  onClose: () => void;
  investment?: Investment;
}) {
  const { createInvestment, updateInvestment } = useInvestmentStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: investment
      ? {
          name: investment.name,
          type: investment.type,
          amountInvested: investment.amountInvested,
          currentValue: investment.currentValue,
          dateInvested: new Date(investment.dateInvested).toISOString().slice(0, 10),
          note: investment.note || '',
        }
      : {
          name: '',
          type: 'mutual_fund',
          amountInvested: undefined as unknown as number,
          currentValue: undefined as unknown as number,
          dateInvested: new Date().toISOString().slice(0, 10),
          note: '',
        },
  });

  const onSubmit = async (data: FormData) => {
    try {
      if (investment) {
        await updateInvestment(investment._id, data);
      } else {
        await createInvestment(data);
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
            {investment ? 'Edit Investment' : 'Add Investment'}
          </DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <input
                {...register('name')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. SBI Bluechip MF"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Type</label>
              <select
                {...register('type')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {INVESTMENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Amount Invested</label>
              <input
                type="number"
                step="any"
                {...register('amountInvested', { valueAsNumber: true })}
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
              {errors.amountInvested && (
                <p className="mt-1 text-sm text-red-600">{errors.amountInvested.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Current Value</label>
              <input
                type="number"
                step="any"
                {...register('currentValue', { valueAsNumber: true })}
                onWheel={(e) => e.currentTarget.blur()}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="0.00"
              />
              {errors.currentValue && (
                <p className="mt-1 text-sm text-red-600">{errors.currentValue.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Date Invested</label>
              <input
                type="date"
                {...register('dateInvested')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {errors.dateInvested && (
                <p className="mt-1 text-sm text-red-600">{errors.dateInvested.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
              <input
                {...register('note')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="e.g. SIP started Jan 2024"
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
                disabled={isSubmitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : investment ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

export default Investments;
