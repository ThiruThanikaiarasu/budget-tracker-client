import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useInvestmentStore, {
  type Investment,
  type InvestmentType,
  type CreateInvestmentData,
} from '../../store/investmentStore';
import { ASSET_CLASS_MAP, type AssetClassMeta } from './assetClasses';
import { formatCurrency } from '../../utils/format';

const EXCHANGES = ['NSE', 'BSE', 'NASDAQ', 'NYSE', 'other'] as const;

const holdingsSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  symbol: z.string().optional(),
  exchange: z.enum(EXCHANGES).optional(),
  sector: z.string().optional(),
  quantity: z.number({ error: 'Required' }).min(0, 'Must be 0 or more'),
  avgBuyPrice: z.number({ error: 'Required' }).min(0, 'Must be 0 or more'),
  currentPrice: z.number({ error: 'Required' }).min(0, 'Must be 0 or more'),
  dateInvested: z.string().min(1, 'Date is required'),
  note: z.string().optional(),
});

const lumpSumSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  amountInvested: z.number({ error: 'Required' }).min(0, 'Must be 0 or more'),
  currentValue: z.number({ error: 'Required' }).min(0, 'Must be 0 or more'),
  dateInvested: z.string().min(1, 'Date is required'),
  note: z.string().optional(),
});

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function HoldingModal({
  open,
  onClose,
  assetClass,
  investment,
}: {
  open: boolean;
  onClose: () => void;
  assetClass: InvestmentType;
  investment?: Investment;
}) {
  const meta = ASSET_CLASS_MAP[assetClass];
  const isHoldings = meta.mode === 'holdings';

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-semibold text-gray-900">
            {investment ? 'Edit' : 'Add'} {meta.label} Holding
          </DialogTitle>
          {isHoldings ? (
            <HoldingsForm
              meta={meta}
              assetClass={assetClass}
              investment={investment}
              onClose={onClose}
            />
          ) : (
            <LumpSumForm
              assetClass={assetClass}
              investment={investment}
              onClose={onClose}
            />
          )}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

// --- Holdings mode (symbol / qty / price) ---

function HoldingsForm({
  meta,
  assetClass,
  investment,
  onClose,
}: {
  meta: AssetClassMeta;
  assetClass: InvestmentType;
  investment?: Investment;
  onClose: () => void;
}) {
  const { createInvestment, updateInvestment } = useInvestmentStore();
  type FormData = z.infer<typeof holdingsSchema>;

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(holdingsSchema),
    defaultValues: investment
      ? {
          name: investment.name,
          symbol: investment.symbol ?? '',
          exchange: investment.exchange,
          sector: investment.sector ?? '',
          quantity: investment.quantity,
          avgBuyPrice: investment.avgBuyPrice,
          currentPrice: investment.currentPrice ?? investment.avgBuyPrice,
          dateInvested: new Date(investment.dateInvested).toISOString().slice(0, 10),
          note: investment.note ?? '',
        }
      : {
          name: '',
          symbol: '',
          exchange: meta.value === 'us_stock' ? 'NASDAQ' : 'NSE',
          sector: '',
          quantity: undefined as unknown as number,
          avgBuyPrice: undefined as unknown as number,
          currentPrice: undefined as unknown as number,
          dateInvested: today(),
          note: '',
        },
  });

  const qty = watch('quantity');
  const avg = watch('avgBuyPrice');
  const cur = watch('currentPrice');
  const invested = qty && avg ? qty * avg : 0;
  const value = qty && cur ? qty * cur : 0;
  const pnl = value - invested;

  const onSubmit = async (data: FormData) => {
    const payload: CreateInvestmentData = {
      ...data,
      type: assetClass,
      symbol: data.symbol || undefined,
      sector: data.sector || undefined,
      currency: assetClass === 'us_stock' ? 'USD' : 'INR',
    };
    try {
      if (investment) await updateInvestment(investment._id, payload);
      else await createInvestment(payload);
      reset();
      onClose();
    } catch {
      /* handled by store */
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Symbol</label>
          <input {...register('symbol')} className={inputClass} placeholder="e.g. RELIANCE" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Exchange</label>
          <select {...register('exchange')} className={inputClass}>
            {EXCHANGES.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input {...register('name')} className={inputClass} placeholder="e.g. Reliance Industries" />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      {meta.hasSector && (
        <div>
          <label className="block text-sm font-medium text-gray-700">Sector</label>
          <input {...register('sector')} className={inputClass} placeholder="e.g. Energy" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700">Qty</label>
          <input
            type="number"
            step="any"
            {...register('quantity', { valueAsNumber: true })}
            onWheel={(e) => e.currentTarget.blur()}
            className={inputClass}
            placeholder="0"
          />
          {errors.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Avg buy</label>
          <input
            type="number"
            step="any"
            {...register('avgBuyPrice', { valueAsNumber: true })}
            onWheel={(e) => e.currentTarget.blur()}
            className={inputClass}
            placeholder="0.00"
          />
          {errors.avgBuyPrice && <p className="mt-1 text-xs text-red-600">{errors.avgBuyPrice.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Current</label>
          <input
            type="number"
            step="any"
            {...register('currentPrice', { valueAsNumber: true })}
            onWheel={(e) => e.currentTarget.blur()}
            className={inputClass}
            placeholder="0.00"
          />
          {errors.currentPrice && <p className="mt-1 text-xs text-red-600">{errors.currentPrice.message}</p>}
        </div>
      </div>

      {/* Live derived preview */}
      <div className="rounded-md bg-gray-50 p-3 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Invested</span>
          <span className="font-medium text-gray-900">{formatCurrency(invested)}</span>
        </div>
        <div className="mt-1 flex justify-between text-gray-600">
          <span>Current value</span>
          <span className="font-medium text-gray-900">{formatCurrency(value)}</span>
        </div>
        <div className="mt-1 flex justify-between text-gray-600">
          <span>P&amp;L</span>
          <span className={`font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {pnl >= 0 ? '+' : ''}{formatCurrency(pnl)}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Date invested</label>
        <input type="date" {...register('dateInvested')} className={inputClass} />
        {errors.dateInvested && <p className="mt-1 text-sm text-red-600">{errors.dateInvested.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
        <input {...register('note')} className={inputClass} placeholder="e.g. long-term hold" />
      </div>

      <FormActions isSubmitting={isSubmitting} isEdit={!!investment} onClose={onClose} />
    </form>
  );
}

// --- Lump-sum mode (FD / PPF / gold / real estate / other) ---

function LumpSumForm({
  assetClass,
  investment,
  onClose,
}: {
  assetClass: InvestmentType;
  investment?: Investment;
  onClose: () => void;
}) {
  const { createInvestment, updateInvestment } = useInvestmentStore();
  type FormData = z.infer<typeof lumpSumSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(lumpSumSchema),
    defaultValues: investment
      ? {
          name: investment.name,
          amountInvested: investment.amountInvested,
          currentValue: investment.currentValue,
          dateInvested: new Date(investment.dateInvested).toISOString().slice(0, 10),
          note: investment.note ?? '',
        }
      : {
          name: '',
          amountInvested: undefined as unknown as number,
          currentValue: undefined as unknown as number,
          dateInvested: today(),
          note: '',
        },
  });

  const onSubmit = async (data: FormData) => {
    const payload: CreateInvestmentData = { ...data, type: assetClass, currency: 'INR' };
    try {
      if (investment) await updateInvestment(investment._id, payload);
      else await createInvestment(payload);
      reset();
      onClose();
    } catch {
      /* handled by store */
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Name</label>
        <input {...register('name')} className={inputClass} placeholder="e.g. SBI Fixed Deposit" />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Amount invested</label>
        <input
          type="number"
          step="any"
          {...register('amountInvested', { valueAsNumber: true })}
          onWheel={(e) => e.currentTarget.blur()}
          className={inputClass}
          placeholder="0.00"
        />
        {errors.amountInvested && <p className="mt-1 text-sm text-red-600">{errors.amountInvested.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Current value</label>
        <input
          type="number"
          step="any"
          {...register('currentValue', { valueAsNumber: true })}
          onWheel={(e) => e.currentTarget.blur()}
          className={inputClass}
          placeholder="0.00"
        />
        {errors.currentValue && <p className="mt-1 text-sm text-red-600">{errors.currentValue.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Date invested</label>
        <input type="date" {...register('dateInvested')} className={inputClass} />
        {errors.dateInvested && <p className="mt-1 text-sm text-red-600">{errors.dateInvested.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
        <input {...register('note')} className={inputClass} placeholder="e.g. matures Dec 2027" />
      </div>

      <FormActions isSubmitting={isSubmitting} isEdit={!!investment} onClose={onClose} />
    </form>
  );
}

function FormActions({
  isSubmitting,
  isEdit,
  onClose,
}: {
  isSubmitting: boolean;
  isEdit: boolean;
  onClose: () => void;
}) {
  return (
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
        {isSubmitting ? 'Saving...' : isEdit ? 'Save' : 'Add'}
      </button>
    </div>
  );
}
