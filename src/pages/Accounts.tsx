import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import useAccountStore, { type Account } from '../store/accountStore';
import useDashboardStore from '../store/dashboardStore';
import { formatCurrency } from '../utils/format';
import Amount from '../components/Amount';
import { renderAccountIcon } from '../utils/accountIcons';
import CartoonIcon from '../components/CartoonIcon';
import ThemedSelect from '../components/ThemedSelect';
import DatePicker from '../components/DatePicker';
import { todayLocal } from '../utils/localDate';
import { CartoonHead, Sticker, useIsCartoon } from '../components/cartoon';
import { accountKind, kindTint } from '../utils/cartoonKinds';

const ACCOUNT_TYPES = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank_account', label: 'Bank Account' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'upi_wallet', label: 'UPI Wallet' },
  { value: 'investment', label: 'Investment' },
  { value: 'other', label: 'Other' },
] as const;

const ACCOUNT_SUBTITLE: Record<string, string> = {
  cash: 'Cash in hand', bank_account: 'Bank account', credit_card: 'Credit card',
  upi_wallet: 'Wallet', investment: 'Investments', other: 'Other',
};

const COLORS = ['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#F97316'];

const accountTypeEnum = ['cash', 'bank_account', 'credit_card', 'upi_wallet', 'investment', 'other'] as const;

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
  date: z.string().min(1, 'Pick a date'),
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
  // Balances move (transfers, edits): keep the "in hand" figures in step.
  useEffect(() => { if (accounts.length > 0) fetchSummary(); }, [accounts, fetchSummary]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  const isCartoon = useIsCartoon();
  const activeAccounts = accounts.filter(a => a.isActive);
  const totalBalance = activeAccounts.reduce((s, a) => s + a.balance, 0);

  if (isCartoon) {
    return (
      <div className="cartoon-page">
        <CartoonHead
          kicker="Where your money lives"
          title="Accounts"
          actions={
            <>
              <button onClick={() => setShowTransfer(true)} className="cartoon-btn">
                <CartoonIcon kind="coins" size={22} /> Transfer
              </button>
              <button onClick={() => setShowCreate(true)} className="cartoon-btn is-primary">+ Add account</button>
            </>
          }
        />

        <section className="cartoon-hero">
          <span className="cartoon-hero-art">
            <CartoonIcon kind="card" size={84} /><CartoonIcon kind="wallet" size={96} style={{ marginLeft: -26 }} /><CartoonIcon kind="bank" size={84} style={{ marginLeft: -26 }} />
          </span>
          <div className="min-w-0">
            <p className="cartoon-kicker">All accounts together</p>
            <p className="cartoon-hero-amount"><Amount value={totalBalance} /></p>
            <div className="cartoon-chips mt-2">
              <span className="cartoon-pill is-spend"><CartoonIcon kind="shopping" size={20} /> Spent so far <b>{summary ? <Amount value={summary.totalExpense} /> : '—'}</b></span>
              <span className="cartoon-pill is-earn"><CartoonIcon kind="salary" size={20} /> Earned so far <b>{summary ? <Amount value={summary.totalIncome} /> : '—'}</b></span>
            </div>
          </div>
          <div className="cartoon-inhand">
            <p className="cartoon-kicker">In hand right now</p>
            <div className="cartoon-inhand-tiles">
              <div className="cartoon-inhand-tile">
                <CartoonIcon kind="bank" size={44} />
                <div className="min-w-0">
                  <p className="cartoon-inhand-label">UPI</p>
                  <p className="cartoon-inhand-amount">{summary?.inHand ? <Amount value={summary.inHand.upi} /> : '—'}</p>
                  <p className="cartoon-inhand-sub">{summary?.inHand?.accounts.upi.map(a => a.name).join(' + ') || 'bank accounts'}</p>
                </div>
              </div>
              <div className="cartoon-inhand-tile">
                <CartoonIcon kind="cash" size={44} />
                <div className="min-w-0">
                  <p className="cartoon-inhand-label">Cash</p>
                  <p className="cartoon-inhand-amount">{summary?.inHand ? <Amount value={summary.inHand.cash} /> : '—'}</p>
                  <p className="cartoon-inhand-sub">{summary?.inHand?.accounts.cash.map(a => a.name).join(' + ') || 'cash in hand'}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center py-16"><div className="cartoon-spinner" /></div>
        ) : (
          <div className="cartoon-grid">
            {accounts.map(account => {
              const kind = accountKind(account.type);
              const dues = account.type === 'credit_card' && account.balance < 0;
              return (
                <div key={account._id} className="cartoon-card account-card" style={{ opacity: account.isActive ? 1 : 0.5 }}>
                  <div className="flex items-start justify-between">
                    <span className="cartoon-tile" style={{ width: 64, height: 64, background: kindTint(kind) }}>
                      <CartoonIcon kind={kind} size={46} />
                    </span>
                    <div className="relative">
                      <button
                        aria-label={`${account.name} options`}
                        onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === account._id ? null : account._id); }}
                        className="cartoon-dots"
                      >···</button>
                      {openMenuId === account._id && (
                        <div onClick={e => e.stopPropagation()} className="cartoon-menu">
                          <button onClick={() => { setEditingAccount(account); setOpenMenuId(null); }}>Edit</button>
                          <button onClick={() => { toggleAccount(account._id); setOpenMenuId(null); }}>{account.isActive ? 'Disable' : 'Enable'}</button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="cartoon-card-title">{account.name}{!account.isActive && <span className="cartoon-sub"> · disabled</span>}</p>
                    <p className="cartoon-sub">{ACCOUNT_SUBTITLE[account.type]}</p>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="cartoon-card-amount" style={{ color: account.balance < 0 ? 'var(--c-spend-text)' : undefined }}>
                      {account.balance < 0 ? '−' : ''}<Amount value={Math.abs(account.balance)} />
                    </p>
                    {dues && <Sticker tone="spend" tilt={-4}>Card dues</Sticker>}
                  </div>
                </div>
              );
            })}
            <button className="cartoon-card account-add" onClick={() => setShowCreate(true)}>
              <span className="cartoon-round-btn">+</span>
              <span>Add an account</span>
            </button>
          </div>
        )}

        <CreateModal open={showCreate} onClose={() => setShowCreate(false)} onCreate={createAccount} />
        {editingAccount && (
          <EditModal account={editingAccount} onClose={() => setEditingAccount(null)} onUpdate={updateAccount} />
        )}
        <TransferModal open={showTransfer} onClose={() => setShowTransfer(false)} onTransfer={transfer} accounts={activeAccounts} />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      {/* ── Summary header ─────────────────────────────────────────── */}
      <div className="px-4 pt-6 pb-4 text-center" style={{ background: 'var(--c-header-bg)' }}>
        <p className="cred-label">All accounts</p>
        <p className="cred-serif mt-1 text-3xl font-semibold" style={{ color: 'var(--c-text)' }}>
          <Amount value={totalBalance} />
        </p>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="cred-label">Expense so far</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-expense)' }}>
              {summary ? <Amount value={summary.totalExpense} /> : '—'}
            </p>
          </div>
          <div>
            <p className="cred-label">Income so far</p>
            <p className="text-sm font-bold mt-0.5" style={{ color: 'var(--c-income)' }}>
              {summary ? <Amount value={summary.totalIncome} /> : '—'}
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
          <p className="cred-label">Accounts</p>
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
              className="cred-divider flex items-center gap-3 px-4 py-3"
              style={{ opacity: account.isActive ? 1 : 0.4 }}
            >
              {/* Icon circle */}
              {renderAccountIcon(account.type, account.color, 48)}

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
                    <Amount value={account.balance} />
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
          className="cartoon-modal w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl overflow-y-auto"
          style={{ background: 'var(--c-surface)', maxHeight: '90dvh' }}
        >
          <DialogTitle className="cred-serif text-base font-semibold mb-4" style={{ color: 'var(--c-text)' }}>
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
          <ThemedSelect
            value={watch('type')}
            onChange={(v) => setValue('type', v as never, { shouldValidate: true })}
            options={ACCOUNT_TYPES.map(t => ({ value: t.value, label: t.label, icon: renderAccountIcon(t.value as Account['type'], undefined, 22) }))}
          />
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
          <ThemedSelect
            value={watch('type')}
            onChange={(v) => setValue('type', v as never, { shouldValidate: true })}
            options={ACCOUNT_TYPES.map(t => ({ value: t.value, label: t.label, icon: renderAccountIcon(t.value as Account['type'], undefined, 22) }))}
          />
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
  const { register, handleSubmit, reset, watch, setValue, control, formState: { errors, isSubmitting } } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
    defaultValues: { fromAccountId: '', toAccountId: '', amount: undefined as unknown as number, note: '', date: todayLocal() },
  });
  const fromId = watch('fromAccountId');
  const toId = watch('toAccountId');
  const amount = watch('amount');
  const source = accounts.find(a => a._id === fromId);
  const accountItems = accounts.map(a => ({ value: a._id, label: a.name, hint: formatCurrency(a.balance), icon: renderAccountIcon(a.type, a.color, 22) }));
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
          <ThemedSelect
            value={fromId}
            onChange={(v) => setValue('fromAccountId', v, { shouldValidate: true })}
            placeholder="Select account"
            options={accountItems}
          />
          {errors.fromAccountId && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.fromAccountId.message}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>To</label>
          <ThemedSelect
            value={toId}
            onChange={(v) => setValue('toAccountId', v, { shouldValidate: true })}
            placeholder="Select account"
            options={accountItems}
          />
          {sameErr && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>Must be different accounts</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Amount</label>
          <input type="number" step="any" {...register('amount', { valueAsNumber: true })} onWheel={e => e.currentTarget.blur()} className="t-input" placeholder="0.00" />
          {balanceErr && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>Insufficient balance ({formatCurrency(source!.balance)})</p>}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--c-muted)' }}>Date</label>
          <Controller control={control} name="date" render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} inline />} />
          {errors.date && <p className="text-xs mt-1" style={{ color: 'var(--c-expense)' }}>{errors.date.message}</p>}
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
