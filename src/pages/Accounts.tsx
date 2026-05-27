import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useAccountStore, { type Account } from '../store/accountStore';
import useDashboardStore from '../store/dashboardStore';
import { formatCurrency } from '../utils/format';

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'upi_wallet', label: 'UPI Wallet' },
  { value: 'other', label: 'Other' },
] as const;

const TYPE_ICONS: Record<Account['type'], string> = {
  cash: '💵',
  bank_account: '🏦',
  credit_card: '💳',
  upi_wallet: '📱',
  other: '💼',
};

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'];

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
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  note: z.string().optional(),
});

type CreateFormData = z.infer<typeof createSchema>;
type EditFormData = z.infer<typeof editSchema>;
type TransferFormData = z.infer<typeof transferSchema>;

function Accounts() {
  const { accounts, isLoading, fetchAccounts, createAccount, updateAccount, toggleAccount, transfer } = useAccountStore();
  const { summary, fetchSummary } = useDashboardStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts();
    fetchSummary();
  }, [fetchAccounts, fetchSummary]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const activeAccounts = accounts.filter(a => a.isActive);
  const totalBalance = activeAccounts.reduce((s, a) => s + a.balance, 0);

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* ── Summary header ─────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-4 text-center" style={{ background: 'var(--c-header-bg)' }}>
        <p className="text-base font-semibold" style={{ color: 'var(--c-text)' }}>
          [ All Accounts {formatCurrency(totalBalance)} ]
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Expense so far</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-expense)' }}>
              {summary ? formatCurrency(summary.totalExpense) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Income so far</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-income)' }}>
              {summary ? formatCurrency(summary.totalIncome) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Action bar ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex gap-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
        <button onClick={() => setShowTransfer(true)} className="t-btn-outline flex-1 text-center">
          Transfer
        </button>
      </div>

      {/* ── Account list ───────────────────────────────────────────── */}
      <div className="px-0">
        {/* Section label */}
        <div className="px-4 pt-4 pb-2">
          <p className="text-sm font-bold" style={{ color: 'var(--c-text)' }}>Accounts</p>
          <div className="mt-1 h-px" style={{ background: 'var(--c-border)' }} />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--c-border)', borderTopColor: 'var(--c-accent)' }} />
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2">
            <span className="text-4xl opacity-30">🏦</span>
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>No accounts yet</p>
          </div>
        ) : (
          accounts.map(account => (
            <div
              key={account._id}
              className="flex items-center gap-3 px-4 py-3"
              style={{
                borderBottom: '1px solid var(--c-border)',
                opacity: account.isActive ? 1 : 0.4,
              }}
            >
              {/* Icon circle */}
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0"
                style={{ backgroundColor: account.color || 'var(--c-surface2)' }}
              >
                {TYPE_ICONS[account.type]}
              </div>

              {/* Name + balance */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--c-text)' }}>
                    {account.name}
                  </p>
                  {!account.isActive && (
                    <span className="text-[10px] rounded-full px-2 py-0.5" style={{ background: 'var(--c-surface2)', color: 'var(--c-muted)' }}>
                      Disabled
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>
                  Balance:&nbsp;
                  <span
                    className="font-semibold"
                    style={{ color: account.balance >= 0 ? 'var(--c-income)' : 'var(--c-expense)' }}
                  >
                    {formatCurrency(account.balance)}
                  </span>
                </p>
              </div>

              {/* Three-dot menu */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === account._id ? null : account._id); }}
                  className="p-2 rounded-lg"
                  style={{ color: 'var(--c-muted)' }}
                >
                  ···
                </button>
                {openMenuId === account._id && (
                  <div
                    onClick={e => e.stopPropagation()}
                    className="absolute right-0 z-20 mt-1 w-36 rounded-xl py-1 shadow-xl"
                    style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}
                  >
                    <button
                      onClick={() => { setEditingAccount(account); setOpenMenuId(null); }}
                      className="block w-full px-4 py-2.5 text-left text-sm"
                      style={{ color: 'var(--c-text)' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => { toggleAccount(account._id); setOpenMenuId(null); }}
                      className="block w-full px-4 py-2.5 text-left text-sm"
                      style={{ color: 'var(--c-text)' }}
                    >
                      {account.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── FAB ────────────────────────────────────────────────────── */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-20 right-5 w-14 h-14 rounded-full flex items-center justify-center shadow-lg z-10 text-2xl font-light"
        style={{ background: 'var(--c-surface2)', color: 'var(--c-accent)' }}
      >
        +
      </button>

      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={createAccount} />
      {editingAccount && (
        <EditModal account={editingAccount} onClose={() => setEditingAccount(null)} onUpdate={updateAccount} />
      )}
      <TransferModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        onTransfer={transfer}
        accounts={activeAccounts}
      />
    </div>
  );
}

// ── Shared modal wrapper ──────────────────────────────────────────────
function ModalWrap({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/60" />
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <DialogPanel
          className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl"
          style={{ background: 'var(--c-surface)' }}
        >
          <DialogTitle className="text-base font-bold mb-4" style={{ color: 'var(--c-text)' }}>
            {title}
          </DialogTitle>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 flex-wrap mt-1">
      {COLORS.map(c => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-7 h-7 rounded-full border-2 transition-transform"
          style={{ backgroundColor: c, borderColor: value === c ? 'var(--c-text)' : 'transparent', transform: value === c ? 'scale(1.2)' : 'scale(1)' }}
        />
      ))}
    </div>
  );
}

function CreateModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (d: CreateFormData) => Promise<void> }) {
  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { type: 'bank_account', balance: undefined as unknown as number, color: COLORS[0] },
  });
  const selectedColor = watch('color');
  const onSubmit = async (data: CreateFormData) => { try { await onCreate(data); reset(); onClose(); } catch {} };
  if (!open) return null;
  return (
    <ModalWrap title="Add Account" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Name</label>
          <input {...register('name')} className="t-input" placeholder="e.g. HDFC Savings" />
          {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Type</label>
          <select {...register('type')} className="t-select">
            {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Initial Balance</label>
          <input type="number" step="any" {...register('balance', { valueAsNumber: true })} onWheel={e => e.currentTarget.blur()} className="t-input" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Color</label>
          <ColorPicker value={selectedColor || ''} onChange={c => setValue('color', c)} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="t-btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="t-btn-primary flex-1">{isSubmitting ? 'Creating...' : 'Create'}</button>
        </div>
      </form>
    </ModalWrap>
  );
}

function EditModal({ account, onClose, onUpdate }: { account: Account; onClose: () => void; onUpdate: (id: string, data: EditFormData) => Promise<void> }) {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: account.name, type: account.type, color: account.color || COLORS[0] },
  });
  const selectedColor = watch('color');
  const onSubmit = async (data: EditFormData) => { try { await onUpdate(account._id, data); onClose(); } catch {} };
  return (
    <ModalWrap title="Edit Account" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Name</label>
          <input {...register('name')} className="t-input" />
          {errors.name && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Type</label>
          <select {...register('type')} className="t-select">
            {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Color</label>
          <ColorPicker value={selectedColor || ''} onChange={c => setValue('color', c)} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="t-btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="t-btn-primary flex-1">{isSubmitting ? 'Saving...' : 'Save'}</button>
        </div>
      </form>
    </ModalWrap>
  );
}

function TransferModal({ open, onClose, onTransfer, accounts }: { open: boolean; onClose: () => void; onTransfer: (d: TransferFormData) => Promise<void>; accounts: Account[] }) {
  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: undefined as unknown as number, note: '' },
  });
  const fromId = watch('fromAccountId');
  const toId = watch('toAccountId');
  const amount = watch('amount');
  const source = accounts.find(a => a._id === fromId);
  const sameErr = fromId && toId && fromId === toId;
  const balanceErr = source && amount > 0 && amount > source.balance;

  const onSubmit = async (data: TransferFormData) => {
    if (data.fromAccountId === data.toAccountId) return;
    const src = accounts.find(a => a._id === data.fromAccountId);
    if (src && data.amount > src.balance) return;
    try { await onTransfer(data); reset(); onClose(); } catch {}
  };
  if (!open) return null;
  return (
    <ModalWrap title="Transfer Funds" onClose={onClose}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>From</label>
          <select {...register('fromAccountId')} className="t-select">
            <option value="">Select account</option>
            {accounts.map(a => <option key={a._id} value={a._id}>{a.name} ({formatCurrency(a.balance)})</option>)}
          </select>
          {errors.fromAccountId && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.fromAccountId.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>To</label>
          <select {...register('toAccountId')} className="t-select">
            <option value="">Select account</option>
            {accounts.map(a => <option key={a._id} value={a._id}>{a.name} ({formatCurrency(a.balance)})</option>)}
          </select>
          {sameErr && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>Must be different accounts</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Amount</label>
          <input type="number" step="any" {...register('amount', { valueAsNumber: true })} onWheel={e => e.currentTarget.blur()} className="t-input" placeholder="0.00" />
          {balanceErr && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>Insufficient balance ({formatCurrency(source!.balance)})</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Note (optional)</label>
          <input {...register('note')} className="t-input" placeholder="e.g. Monthly savings" />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="t-btn-ghost flex-1">Cancel</button>
          <button type="submit" disabled={isSubmitting || !!sameErr || !!balanceErr} className="t-btn-primary flex-1">{isSubmitting ? 'Transferring...' : 'Transfer'}</button>
        </div>
      </form>
    </ModalWrap>
  );
}

export default Accounts;
