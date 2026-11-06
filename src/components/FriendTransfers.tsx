import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react';
import DatePicker from './DatePicker';
import Amount from './Amount';
import ThemedSelect from './ThemedSelect';
import { FaceAvatar } from './cartoon';
import useAccountStore from '../store/accountStore';
import useThemeStore from '../store/themeStore';
import api from '../api/axios';
import useSplitStore, { type SharedExpense } from '../store/splitStore';
import type { Friend } from '../store/friendStore';
import type { Transaction } from '../store/transactionStore';
import { formatCurrency } from '../utils/format';
import { renderAccountIcon } from '../utils/accountIcons';
import { todayLocal } from '../utils/localDate';
import { transferThreads, type TransferThread } from '../utils/friendBalance';

const localDay = (d: string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export interface TransferRequest {
  direction: 'sent' | 'received';
  /** Set when this entry pays back part of an earlier transfer. */
  repays?: TransferThread;
}

/** Record money sent to / received from a friend, optionally as a repayment of an earlier transfer. */
export function TransferModal({
  friend,
  request,
  onClose,
  onDone,
}: {
  friend: Friend;
  request: TransferRequest;
  onClose: () => void;
  onDone: () => void;
}) {
  const { createTransfer } = useSplitStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const { direction, repays } = request;
  const sent = direction === 'sent';
  const [amountText, setAmountText] = useState(repays ? String(repays.left) : '');
  const [accountId, setAccountId] = useState('');
  const [date, setDate] = useState(todayLocal());
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const amount = Math.round((parseFloat(amountText) || 0) * 100) / 100;
  const tooMuch = !!repays && amount > repays.left + 0.004;

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts();
  }, [accounts.length, fetchAccounts]);

  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0]._id);
  }, [accounts, accountId]);

  const title = repays
    ? sent ? `Pay ${friend.name} back` : `${friend.name} paid back`
    : sent ? `Send money to ${friend.name}` : `Got money from ${friend.name}`;

  const submit = async () => {
    setSubmitting(true);
    try {
      await createTransfer({
        friendId: friend._id,
        direction,
        amount,
        accountId,
        date,
        note: note.trim() || undefined,
        repaysTransferId: repays?.root._id,
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
            {title}
          </DialogTitle>
          <p className="mt-1 text-sm text-[var(--c-muted)]">
            {repays ? (
              <>Against the <Amount value={repays.root.totalAmount} /> of {fmtDate(repays.root.date)} · <Amount value={repays.left} /> left</>
            ) : sent ? (
              'Money leaves one of your accounts and they owe you that much.'
            ) : (
              'Money lands in one of your accounts and you owe them that much.'
            )}
          </p>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Amount</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm text-[var(--c-muted)]">₹</span>
                <input
                  type="text" inputMode="decimal" autoFocus value={amountText}
                  onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.]/g, ''))}
                  onFocus={(e) => e.currentTarget.select()}
                  className="t-input flex-1" placeholder="0.00" aria-label="Amount"
                />
              </div>
              {tooMuch && repays && (
                <p className="mt-1 text-sm text-[var(--c-expense)]">That's more than the <Amount value={repays.left} /> left.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">
                {sent ? 'Paid from account' : 'Deposit to account'}
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

            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Date</label>
              <div className="mt-1">
                <DatePicker
                  value={date}
                  onChange={setDate}
                  className="block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm focus:border-[var(--c-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--c-accent)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--c-text)]">Note <span className="text-[var(--c-muted)]">(optional)</span></label>
              <input
                value={note} onChange={(e) => setNote(e.target.value)}
                className="t-input mt-1 w-full" placeholder={sent ? 'e.g. For the bike deposit' : 'e.g. Part payment'}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button" onClick={onClose}
                className="rounded-md px-4 py-2 text-sm font-medium text-[var(--c-text)] hover:bg-[var(--c-surface2)]"
              >
                Cancel
              </button>
              <button
                type="button" onClick={submit}
                disabled={submitting || !accountId || amount <= 0 || tooMuch || !date}
                className="t-btn-primary px-4 py-2"
              >
                {submitting ? 'Saving...' : sent ? 'Send' : 'Record'} {amount > 0 && <Amount value={amount} />}
              </button>
            </div>
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}

/**
 * Every transfer with this friend as a thread: the original amount, each
 * repayment with its date, and what is still left.
 */
export function TransferThreads({
  friend,
  threads,
  onRepay,
  onDelete,
}: {
  friend: Friend;
  threads: TransferThread[];
  onRepay: (t: TransferThread) => void;
  onDelete: (id: string) => void;
}) {
  if (threads.length === 0) return null;

  const remove = (id: string) => {
    if (window.confirm('Delete this entry? The money moves back in your account.')) onDelete(id);
  };

  return (
    <div className="mt-6">
      <h2 className="cred-label">Money transfers</h2>
      <div className="mt-3 space-y-3">
        {threads.map((t) => {
          const closed = t.left <= 0.004;
          const status = closed ? 'Fully repaid' : t.repaid > 0 ? 'Partly repaid' : 'Not repaid';
          const pct = Math.min(100, Math.round((t.repaid / t.root.totalAmount) * 100));
          const tone = t.sent ? 'var(--c-income)' : 'var(--c-expense)';
          return (
            <div key={t.root._id} className="rounded-lg bg-[var(--c-surface)] p-4 shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--c-text)]">
                    {t.sent ? 'You lent' : `You borrowed from ${friend.name}`} <Amount value={t.root.totalAmount} />
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--c-muted)]">
                    {fmtDate(t.root.date)}
                    {t.root.description && !/^(sent to|received from) /i.test(t.root.description) && ` · ${t.root.description}`}
                  </p>
                </div>
                <span className="shrink-0 rounded px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--c-surface2)', color: closed ? 'var(--c-income)' : 'var(--c-warning)' }}>
                  {status}
                </span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--c-surface2)]">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} />
              </div>
              <p className="mt-1.5 text-xs text-[var(--c-muted)]">
                <Amount value={t.repaid} /> of <Amount value={t.root.totalAmount} /> {t.sent ? 'paid back' : 'repaid'}
                {!closed && <> · <Amount value={t.left} /> left</>}
              </p>

              {t.repayments.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-[var(--c-border)] pt-3">
                  {t.repayments.map((r) => (
                    <li key={r._id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="text-[var(--c-text)]">
                        {fmtDate(r.date)}
                        <span className="ml-2 text-xs text-[var(--c-muted)]">{t.sent ? `${friend.name} paid back` : 'You paid back'}</span>
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="font-medium text-[var(--c-text)]"><Amount value={r.totalAmount} /></span>
                        <button type="button" onClick={() => remove(r._id)} className="text-xs text-[var(--c-muted)] hover:text-[var(--c-expense)]">Delete</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex items-center justify-between">
                {!closed ? (
                  <button type="button" onClick={() => onRepay(t)} className="text-sm font-medium text-[var(--c-accent)] hover:opacity-80">
                    {t.sent ? `${friend.name} paid back…` : 'I paid back…'}
                  </button>
                ) : <span />}
                {t.repayments.length === 0 && (
                  <button type="button" onClick={() => remove(t.root._id)} className="text-xs text-[var(--c-muted)] hover:text-[var(--c-expense)]">Delete</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The "Fund transfer" tab of the add-record form: money sent to / received from
 * a friend, outside any bill. Same endpoint as Send money / Got money on the
 * friend's page, so balances, repayments and tracking work identically.
 */
export function FundTransferPanel({
  friends,
  initialDate,
  onDone,
  renderAmount,
  showShortcut,
  onPlainExpense,
  editing,
}: {
  friends: Friend[];
  initialDate?: string;
  /**
   * Editing an existing record from the Transfer tab. Passing on / Sent home
   * update it in place (onPlainExpense goes to the form's update); a loan
   * (lent, borrowed, repayment) is a different kind of record, so it is created
   * fresh, keeps the tag, and the old record is removed.
   */
  editing?: Transaction;
  onDone: () => void;
  /** The amount entry the rest of the form uses (typed field on desktop, numpad on mobile). */
  renderAmount: (value: string, onChange: (v: string) => void) => ReactNode;
  /** Desktop panel: show and honour the ⌘↵ shortcut. */
  showShortcut?: boolean;
  /**
   * Money that leaves your account but isn't a loan, booked as a plain expense in
   * `category` with no friend balance: "Sent home" (family) and "Passed on" (someone's
   * money forwarded to a friend).
   */
  onPlainExpense: (
    category: string,
    p: { amount: number; accountId: string; date: string; note?: string; passedToFriendId?: string; passedFrom?: string }
  ) => Promise<void>;
}) {
  const { createTransfer } = useSplitStore();
  const { accounts, fetchAccounts } = useAccountStore();
  const isCartoon = useThemeStore((st) => st.theme === 'cartoon');
  const editingCategory = editing?.categoryId?.name.trim().toLowerCase();
  const [friendId, setFriendId] = useState(editing?.passedToFriendId?._id ?? '');
  const [kind, setKind] = useState<'lent' | 'borrowed' | 'repayment' | 'home' | 'passon'>(
    editingCategory === 'passed on' ? 'passon' : editingCategory === 'sent home' ? 'home' : 'lent'
  );
  // Passing on: who the money came from, typed freely (it goes to `friendId`).
  const [cameFrom, setCameFrom] = useState(editing?.passedFrom ?? '');
  // Same string form the rest of the add-record form uses: '0' = nothing entered.
  const [amountText, setAmountText] = useState(editing ? String(editing.amount) : '0');
  const [accountId, setAccountId] = useState(editing?.accountId?._id ?? '');
  const [date, setDate] = useState(editing ? localDay(editing.date) : initialDate ?? todayLocal());
  // A Passing on note starts with the generated "From X → Y"; only the rest is the user's.
  const [note, setNote] = useState((editing?.note ?? '').replace(/^From .+? → [^·]+(?: · |$)/, ''));
  // Id of the earlier transfer this one pays back; '' = a new transfer.
  const [repaysId, setRepaysId] = useState('');
  const [expenses, setExpenses] = useState<SharedExpense[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const amount = Math.round((parseFloat(amountText) || 0) * 100) / 100;

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts();
  }, [accounts.length, fetchAccounts]);
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0]._id);
  }, [accounts, accountId]);

  // The friend's earlier transfers, to offer the ones this could be paying back.
  useEffect(() => {
    setRepaysId('');
    setExpenses([]);
    if (!friendId) return;
    let cancelled = false;
    api
      .get('/splits', { params: { friendId } })
      .then(({ data }) => { if (!cancelled) setExpenses(data.expenses ?? []); })
      .catch(() => { /* repayment linking is optional */ });
    return () => { cancelled = true; };
  }, [friendId]);

  // A repayment settles one of the friend's open loans, in either direction.
  const openLoans = useMemo(
    () => transferThreads(expenses).filter((t) => t.left > 0.004),
    [expenses]
  );
  // A friend with no open loan can't have a repayment.
  useEffect(() => { if (kind === 'repayment' && openLoans.length === 0) setKind('lent'); }, [kind, openLoans.length]);

  const repays = kind === 'repayment' ? openLoans.find((t) => t.root._id === repaysId) : undefined;
  // lent = you sent it, borrowed = they sent it; a repayment goes the opposite way to the loan it pays back.
  const direction: 'sent' | 'received' = repays ? (repays.sent ? 'received' : 'sent') : kind === 'borrowed' ? 'received' : 'sent';
  const tooMuch = !!repays && amount > repays.left + 0.004;
  const friend = friends.find((f) => f._id === friendId);
  const sent = direction === 'sent';

  const submit = async () => {
    setSubmitting(true);
    try {
      if (kind === 'home') {
        await onPlainExpense('Sent home', { amount, accountId, date, note: note.trim() || undefined });
        onDone();
        return;
      }
      if (kind === 'passon') {
        const route = `From ${cameFrom.trim()} → ${friend?.name ?? '?'}`;
        await onPlainExpense('Passed on', {
          amount, accountId, date,
          note: note.trim() ? `${route} · ${note.trim()}` : route,
          passedToFriendId: friendId,
          passedFrom: cameFrom.trim(),
        });
        onDone();
        return;
      }
      const created = await createTransfer({
        friendId,
        direction,
        amount,
        accountId,
        date,
        note: note.trim() || undefined,
        repaysTransferId: repays?.root._id,
      });
      if (editing) {
        // The loan is a new record: carry the tag over, then remove the one it replaces.
        if (editing.tagId && created?.transactionId) {
          await api.patch(`/transactions/${created.transactionId}/tag`, { tagId: editing.tagId._id });
        }
        await api.delete(`/transactions/${editing._id}`);
      }
      onDone();
    } catch {
      // handled by store
    } finally {
      setSubmitting(false);
    }
  };

  // Same face the friend has on the Friends page (an initial in the other themes) and their balance.
  const friendOptions = friends.map((f) => ({
    value: f._id,
    label: f.name,
    icon: isCartoon ? (
      <FaceAvatar name={f.name} size={26} />
    ) : (
      <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[var(--c-surface2)] text-xs font-bold text-[var(--c-accent)]">
        {f.name.charAt(0).toUpperCase()}
      </span>
    ),
    hint: f.netBalance === 0 ? undefined : f.netBalance > 0 ? `owes you ${formatCurrency(f.netBalance)}` : `you owe ${formatCurrency(-f.netBalance)}`,
  }));

  const canSubmit = !submitting && (kind === 'home' || !!friendId) && (kind !== 'passon' || !!cameFrom.trim()) && !!accountId && amount > 0 && !tooMuch && !!date && !(kind === 'repayment' && !repays);

  // ⌘↵ saves, like the rest of the form. The ref keeps the listener on the latest values.
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const canRef = useRef(canSubmit);
  canRef.current = canSubmit;
  useEffect(() => {
    if (!showShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && canRef.current) { e.preventDefault(); submitRef.current(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showShortcut]);

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4 pt-3" style={{ scrollbarGutter: 'stable' }}>
        <p className="text-sm text-[var(--c-muted)]">
          {kind === 'home' ? (
            <><b className="text-[var(--c-text)]">Sent home.</b> Money you give your family. It's booked as an expense; nobody owes it back.</>
          ) : kind === 'passon' ? (
            <><b className="text-[var(--c-text)]">Passing on.</b> Money someone gave you that belongs to another friend. It leaves your account; neither friend's balance changes.</>
          ) : (
            <><b className="text-[var(--c-text)]">Fund transfer with a friend.</b> Money between you and them, not a bill. It moves your account and what they owe you.</>
          )}
        </p>

        {kind !== 'home' && (
        <div>
          <label className="tx-label mb-1 block text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>{kind === 'passon' ? 'Send to' : 'Friend'}</label>
          <ThemedSelect
            value={friendId}
            onChange={setFriendId}
            placeholder="Choose a friend"
            options={friendOptions}
          />
        </div>
        )}

        <div>
          <label className="tx-label mb-1 block text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Type</label>
          <ThemedSelect
            value={kind}
            onChange={(v) => { setKind(v as typeof kind); setRepaysId(''); }}
            options={[
              { value: 'lent', label: 'I lent', hint: 'I gave them money' },
              { value: 'borrowed', label: 'I borrowed', hint: 'They gave me money' },
              ...(openLoans.length > 0 ? [{ value: 'repayment', label: 'Repayment', hint: 'Paying a loan back' }] : []),
              { value: 'passon', label: 'Passing on', hint: "Someone's money, to a friend" },
              { value: 'home', label: 'Sent home', hint: 'Family, not a loan' },
            ]}
          />
        </div>

        {kind === 'passon' && (
          <div>
            <label className="tx-label mb-1 block text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Money came from</label>
            <input
              value={cameFrom}
              onChange={(e) => setCameFrom(e.target.value)}
              maxLength={60}
              className="t-input w-full"
              placeholder="Who gave it to you, e.g. Savitha"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="tx-label mb-1 block text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
              {sent ? 'From account' : 'Into account'}
            </label>
            <ThemedSelect
              value={accountId}
              onChange={setAccountId}
              options={accounts.map((a) => ({ value: a._id, label: a.name, hint: formatCurrency(a.balance), icon: renderAccountIcon(a.type, a.color, 22) }))}
            />
          </div>
          <div>
            <label className="tx-label mb-1 block text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Date</label>
            <DatePicker
              value={date}
              onChange={setDate}
              className="block w-full rounded-md border border-[var(--c-border)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        {kind === 'repayment' && (
          <div>
            <label className="tx-label mb-1 block text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Repaying which one?</label>
            <ThemedSelect
              value={repaysId}
              onChange={(v) => { setRepaysId(v); const t = openLoans.find((r) => r.root._id === v); if (t && !(parseFloat(amountText) > 0)) setAmountText(String(t.left)); }}
              placeholder="Choose a loan"
              options={openLoans.map((t) => ({
                value: t.root._id,
                label: `${t.sent ? 'You lent' : 'You borrowed'} ${formatCurrency(t.root.totalAmount)} · ${fmtDate(t.root.date)}`,
                hint: `${formatCurrency(t.left)} left`,
              }))}
            />
          </div>
        )}

        <div>
          <label className="tx-label mb-1 block text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>Note (optional)</label>
          <input
            value={note} onChange={(e) => setNote(e.target.value)}
            className="t-input w-full" placeholder={kind === 'passon' ? 'e.g. Rent share' : kind === 'home' ? 'e.g. Monthly for Amma' : kind === 'repayment' ? 'e.g. Part payment' : kind === 'lent' ? 'e.g. Loan for the bike' : 'e.g. Needed for rent'}
          />
        </div>
        {tooMuch && repays && (
          <p className="text-sm text-[var(--c-expense)]">That's more than the <Amount value={repays.left} /> left on it.</p>
        )}
      </div>

      <div className="tx-footer flex-shrink-0 px-4 pb-4 pt-2" style={{ borderTop: '1px solid var(--c-border)', background: 'var(--c-bg)' }}>
        <div className="space-y-2">
          {renderAmount(amountText, setAmountText)}
          <button type="button" onClick={submit} disabled={!canSubmit} className="tx-save t-btn-primary w-full disabled:opacity-40">
            {submitting ? 'Saving…' : kind === 'home' ? 'Send home' : kind === 'passon' ? `Pass on${friend ? ` to ${friend.name}` : ''}` : <>{kind === 'repayment' ? 'Repay' : kind === 'lent' ? 'Lend' : 'Borrow'}{friend && (sent ? ` to ${friend.name}` : ` from ${friend.name}`)}</>}
            {showShortcut && <span className="ml-2 text-[11px] opacity-60">⌘↵</span>}
          </button>
        </div>
      </div>
    </>
  );
}
