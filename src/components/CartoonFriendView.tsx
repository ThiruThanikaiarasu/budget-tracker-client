import { useMemo, useState } from 'react';
import CartoonIcon, { CartoonTile } from './CartoonIcon';
import { FaceAvatar } from './cartoon';
import Amount from './Amount';
import RemindButton from './RemindButton';
import ExportStatementSheet from './ExportStatementSheet';
import type { Friend } from '../store/friendStore';
import type { ReactNode } from 'react';
import type { SharedExpense } from '../store/splitStore';
import type { TransferRequest } from './FriendTransfers';
import useAuthStore from '../store/authStore';
import { categoryKind } from '../utils/cartoonKinds';
import { billsWith, dayGroups, reminderLines, type StmtBill } from '../utils/friendStatement';

type Filter = 'open' | 'theyOwe' | 'youOwe' | 'settled';
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export interface SettleRequest { amount: number; friendOwes: boolean; coveredExpenseIds: string[] }

/**
 * The Cartoon-theme friend page: who owes whom at the top, the bills grouped by day below, and
 * "Export PDF" for a statement to send. State that outlives the view (selection, settle dialog)
 * stays with FriendDetail, which passes it in.
 */
export default function CartoonFriendView({
  friend, netBalance, expenses, isLoading, selectionMode, selectedIds, onToggleSelect, onSelectMode, onSettle, onDelete, onBack, onTransfer, transfers,
}: {
  friend: Friend; netBalance: number; expenses: SharedExpense[]; isLoading: boolean;
  selectionMode: boolean; selectedIds: Set<string>;
  onToggleSelect: (id: string) => void; onSelectMode: (on: boolean) => void;
  onSettle: (r: SettleRequest) => void; onDelete: (id: string) => void; onBack: () => void;
  onTransfer: (r: TransferRequest) => void;
  /** The friend's transfer threads, rendered by FriendDetail. */
  transfers: ReactNode;
}) {
  const you = (useAuthStore((s) => s.user?.name) ?? 'You').trim().split(/\s+/)[0];
  const [filter, setFilter] = useState<Filter>('open');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const bills = useMemo(() => billsWith(expenses, friend._id), [expenses, friend._id]);
  const open = useMemo(() => bills.filter((b) => !b.settled), [bills]);
  // Every uncovered shared expense, including any with no share on either side, so Settle up clears them all.
  const openIds = useMemo(() => {
    const covered = new Set(expenses.flatMap((e) => (e.isSettlement ? e.coveredExpenseIds ?? [] : [])));
    // Transfers ride along: they already count in the balance Settle up clears.
    return expenses.filter((e) => (!e.isSettlement && !covered.has(e._id)) || e.isTransfer).map((e) => e._id);
  }, [expenses]);
  const payments = useMemo(() => expenses.filter((e) => e.isSettlement && !e.isTransfer), [expenses]);
  // Everything ever shared, so the two tiles read as "what each of you has covered for the other".
  const lent = useMemo(() => bills.reduce((s, b) => s + (b.signed > 0 ? b.signed : 0), 0), [bills]);
  const borrowed = useMemo(() => bills.reduce((s, b) => s + (b.signed < 0 ? -b.signed : 0), 0), [bills]);

  const shown = useMemo(() => bills.filter((b) =>
    filter === 'settled' ? b.settled
    : b.settled ? false
    : filter === 'theyOwe' ? b.signed > 0
    : filter === 'youOwe' ? b.signed < 0
    : true), [bills, filter]);
  const days = useMemo(() => dayGroups(shown), [shown]);
  const showPayments = filter === 'settled' && payments.length > 0;

  const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const selectedTotal = open.reduce((s, b) => s + (selectedIds.has(b.id) ? b.signed : 0), 0);

  const chip = (id: Filter, label: string, face?: string) => (
    <button key={id} type="button" aria-pressed={filter === id}
      className={`cartoon-chip ${filter === id ? 'is-on' : ''} ${id === 'settled' && filter !== id ? 'cartoon-chip-dashed' : ''}`}
      onClick={() => setFilter(id)}>
      {face && <FaceAvatar name={face} size={26} />}{label}
    </button>
  );

  const row = (b: StmtBill) => {
    const picked = selectedIds.has(b.id);
    const canPick = selectionMode && !b.settled;
    const paid = b.paidByFriend ? friend.name : 'You';
    return (
      <div key={b.id} className={`cartoon-row fv-row ${picked ? 'is-picked' : ''} ${b.settled ? 'is-settled' : ''}`}
        onClick={canPick ? () => onToggleSelect(b.id) : undefined}>
        {canPick && <span className={`bill-check ${picked ? 'is-on' : ''}`} aria-hidden>{picked && '✓'}</span>}
        <CartoonTile kind={categoryKind(b.cat?.icon, b.cat?.name ?? b.label)} size={58} />
        <div className="min-w-0 flex-1">
          <p className="cartoon-card-title fv-title">{b.label}</p>
          <span className={`fv-paid ${b.paidByFriend ? 'is-friend' : 'is-you'}`}>
            <FaceAvatar name={b.paidByFriend ? friend.name : you} size={22} />{paid} paid {money(b.total)}
          </span>
        </div>
        <div className="fv-amt">
          {b.signed > 0
            ? <b className="friend-balance friend-balance-positive" style={{ color: 'var(--c-earn-text)' }}><Amount value={b.signed} prefix="+" /></b>
            : <b className="friend-balance friend-balance-negative" style={{ color: 'var(--c-spend-text)' }}><Amount value={-b.signed} prefix="−" /></b>}
          <small style={{ color: b.signed > 0 ? 'var(--c-earn-text)' : 'var(--c-spend-text)' }}>{b.signed > 0 ? `${friend.name} owes` : 'you owe'}</small>
        </div>
        {!selectionMode && (
          <div className="relative">
            <button type="button" aria-label="Bill options" className="cartoon-dots"
              onClick={(e) => { e.stopPropagation(); setMenuId(menuId === b.id ? null : b.id); }}>···</button>
            {menuId === b.id && (
              <div className="cartoon-menu" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="is-danger" onClick={() => { onDelete(b.id); setMenuId(null); }}>Delete</button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="cartoon-page fv-page" onClick={() => setMenuId(null)}>
      <div className="fv-bar">
        <button type="button" className="fv-pill" onClick={onBack}>← Friends</button>
        <div className="fv-bar-right">
          {open.length > 0 && (
            <button type="button" className="fv-pill" onClick={() => onSelectMode(!selectionMode)}>{selectionMode ? 'Cancel' : 'Select'}</button>
          )}
          <button type="button" className="fv-pill is-sun" disabled={isLoading || bills.length === 0} onClick={() => setExporting(true)}>
            <CartoonIcon kind="receipt" size={22} /> Export PDF
          </button>
        </div>
      </div>

      <section className="fv-card">
        <FaceAvatar name={friend.name} size={116} />
        <div className="min-w-0">
          <h1 className="fv-name">{friend.name}</h1>
          {netBalance === 0 ? (
            <p className="fv-owes"><b style={{ color: 'var(--c-earn-text)' }}>All square</b></p>
          ) : (
            <p className="fv-owes">
              {netBalance > 0 ? 'owes you' : 'you owe'}
              <b className={`friend-balance ${netBalance > 0 ? 'friend-balance-positive' : 'friend-balance-negative'}`}
                style={{ color: netBalance > 0 ? 'var(--c-earn-text)' : 'var(--c-spend-text)' }}>
                <Amount value={Math.abs(netBalance)} />
              </b>
            </p>
          )}
          <div className="fv-actions">
            {netBalance !== 0 && (
              <button type="button" className="fv-pill is-green"
                onClick={() => onSettle({ amount: Math.abs(netBalance), friendOwes: netBalance > 0, coveredExpenseIds: openIds })}>
                <CartoonIcon kind="coins" size={22} /> Settle up
              </button>
            )}
            <button type="button" className="fv-pill" onClick={() => onTransfer({ direction: 'sent' })}>Send money</button>
            <button type="button" className="fv-pill" onClick={() => onTransfer({ direction: 'received' })}>Got money</button>
            {netBalance > 0 && (
              <RemindButton friend={friend.name} amount={netBalance} lines={reminderLines(bills, netBalance)} dateLabel={today}
                className="fv-pill" label="Remind on WhatsApp" />
            )}
          </div>
        </div>
      </section>

      <div className="fv-tiles">
        <div className="fv-tile is-earn">
          <span className="fv-arrow"><FaceAvatar name={you} size={34} />→<FaceAvatar name={friend.name} size={34} /></span>
          <div><p className="cartoon-kicker">YOU PAID FOR {friend.name.toUpperCase()}</p><b className="friend-balance friend-balance-positive" style={{ color: 'var(--c-earn-text)' }}><Amount value={lent} /></b></div>
        </div>
        <div className="fv-tile is-spend">
          <span className="fv-arrow"><FaceAvatar name={friend.name} size={34} />→<FaceAvatar name={you} size={34} /></span>
          <div><p className="cartoon-kicker">{friend.name.toUpperCase()} PAID FOR YOU</p><b className="friend-balance friend-balance-negative" style={{ color: 'var(--c-spend-text)' }}><Amount value={borrowed} /></b></div>
        </div>
      </div>

      {transfers}

      <div className="cartoon-chips">
        {chip('open', 'Not settled')}
        {chip('theyOwe', `${friend.name} owes`, friend.name)}
        {chip('youOwe', 'You owe', you)}
        {chip('settled', 'Settled')}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="cartoon-spinner" /></div>
      ) : days.length === 0 && !showPayments ? (
        <p className="cartoon-empty">
          {filter === 'settled' ? 'Nothing settled yet.' : bills.length === 0 ? 'No shared bills with ' + friend.name + ' yet.' : 'Nothing here — all settled up.'}
        </p>
      ) : (
        <>
          {days.map((d) => (
            <div key={d.key} className="cartoon-day">
              <div className="cartoon-day-head">
                <span className="cartoon-cal" aria-hidden="true">
                  <span className="cartoon-cal-top">{MONTHS[d.date.getMonth()]}</span>
                  <span className="cartoon-cal-day">{d.date.getDate()}</span>
                </span>
                <span className="cartoon-day-name">{d.date.toLocaleDateString('en-IN', { weekday: 'long' })}</span>
                <span className="cartoon-day-rule" />
                {d.net !== 0 && filter !== 'settled' && (
                  <span className={`fv-day-net ${d.net > 0 ? 'is-earn' : 'is-spend'}`}>
                    {d.net > 0 ? `${friend.name} owes` : 'you owe'} {money(Math.abs(d.net))}
                  </span>
                )}
              </div>
              {d.bills.map(row)}
            </div>
          ))}
          {showPayments && (
            <div className="cartoon-day">
              <div className="cartoon-day-head"><span className="cartoon-day-name">Payments</span><span className="cartoon-day-rule" /></div>
              {payments.map((p) => (
                <div key={p._id} className="cartoon-row fv-row is-settled">
                  <CartoonTile kind="settlement" size={58} />
                  <div className="min-w-0 flex-1">
                    <p className="cartoon-card-title fv-title">
                      {p.settlementMethod === 'received' ? `Received from ${friend.name}` : p.settlementMethod === 'paid' ? `Paid to ${friend.name}` : p.settlementMethod === 'waived' ? 'Waived' : 'Settlement'}
                    </p>
                    <span className="cartoon-sub">{new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  <div className="fv-amt"><b><Amount value={p.totalAmount} /></b></div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {selectionMode && selectedIds.size > 0 && (
        <div className="fv-selbar">
          <span><b>{selectedIds.size} selected</b> · {money(Math.abs(selectedTotal))}</span>
          <button type="button" className="fv-pill is-sun" disabled={selectedTotal === 0}
            onClick={() => onSettle({ amount: Math.abs(selectedTotal), friendOwes: selectedTotal >= 0, coveredExpenseIds: [...selectedIds] })}>
            Settle selected
          </button>
        </div>
      )}

      {exporting && (
        <ExportStatementSheet friend={friend} expenses={expenses} netLive={netBalance} selectedIds={selectedIds} onClose={() => setExporting(false)} />
      )}
    </div>
  );
}
