import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useWatchlistStore, { type WatchlistItem } from '../../store/watchlistStore';

const EXCHANGES = ['NSE', 'BSE'] as const;

const schema = z.object({
  symbol: z.string().min(1, 'Symbol is required'),
  exchange: z.enum(EXCHANGES),
  name: z.string().min(1, 'Name is required'),
  targetBuyPrice: z
    .union([z.number().min(0, 'Must be 0 or more'), z.nan()])
    .optional(),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const inputClass =
  'mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

export default function WatchlistItemModal({
  open,
  onClose,
  listId,
  item,
}: {
  open: boolean;
  onClose: () => void;
  listId: string;
  item?: WatchlistItem;
}) {
  const { addItem, editItem } = useWatchlistStore();
  const isEdit = !!item;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      symbol: item?.symbol ?? '',
      exchange: item?.exchange ?? 'NSE',
      name: item?.name ?? '',
      targetBuyPrice: item?.targetBuyPrice,
      notes: item?.notes ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const targetBuyPrice =
      values.targetBuyPrice === undefined || Number.isNaN(values.targetBuyPrice)
        ? undefined
        : values.targetBuyPrice;
    try {
      if (isEdit && item) {
        await editItem(listId, item._id, {
          name: values.name,
          targetBuyPrice,
          notes: values.notes || undefined,
        });
      } else {
        await addItem(listId, {
          symbol: values.symbol.trim().toUpperCase(),
          exchange: values.exchange,
          name: values.name,
          targetBuyPrice,
          notes: values.notes || undefined,
        });
      }
      onClose();
    } catch {
      /* toast handled in store */
    }
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <DialogTitle className="text-lg font-bold text-gray-900">
            {isEdit ? 'Edit stock' : 'Add stock to watchlist'}
          </DialogTitle>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">Symbol</label>
                <input
                  {...register('symbol')}
                  disabled={isEdit}
                  placeholder="e.g. SBIN"
                  className={`${inputClass} uppercase ${isEdit ? 'bg-gray-100 text-gray-500' : ''}`}
                />
                {errors.symbol && <p className="mt-1 text-xs text-red-600">{errors.symbol.message}</p>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Exchange</label>
                <select {...register('exchange')} disabled={isEdit} className={`${inputClass} ${isEdit ? 'bg-gray-100 text-gray-500' : ''}`}>
                  {EXCHANGES.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Name</label>
              <input {...register('name')} placeholder="e.g. State Bank of India" className={inputClass} />
              {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Target buy price (optional)</label>
              <input
                type="number"
                step="0.01"
                {...register('targetBuyPrice', { valueAsNumber: true })}
                placeholder="Alert when price drops to this"
                className={inputClass}
              />
              {errors.targetBuyPrice && (
                <p className="mt-1 text-xs text-red-600">{errors.targetBuyPrice.message}</p>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
              <textarea {...register('notes')} rows={2} className={inputClass} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSubmitting ? 'Saving…' : isEdit ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
