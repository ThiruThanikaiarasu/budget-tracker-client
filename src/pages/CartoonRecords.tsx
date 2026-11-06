import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import type { Transaction } from '../store/transactionStore';
import type { Category } from '../store/categoryStore';
import type { Account } from '../store/accountStore';
import Amount from '../components/Amount';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { monthShort } from '../utils/tagMonth';
import { tagVars } from '../utils/tagColor';
import TagRibbon from '../components/TagRibbon';
import { kindOf, titleOf } from '../utils/recordLook';
import RecurringBadge from '../components/RecurringBadge';
import useRecurringInfo from '../hooks/useRecurringInfo';
import CartoonIcon, { CartoonTile } from '../components/CartoonIcon';
import ThemedSelect from '../components/ThemedSelect';
import { accountKind, categoryKind, itemKind, kindTint } from '../utils/cartoonKinds';
import { categoryGroups } from '../utils/txCategories';
import { DayMixBar } from '../components/CartoonDayView';
import { summariseDay } from '../utils/daySummary';
import { motion } from 'motion/react';
import { reactionFor } from '../utils/amountReaction';
import { prefersReducedMotion } from '../utils/motion';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function fmtTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();
}

/** The user's own money in a record: their share when split, else the full amount. */
function ownAmount(tx: Transaction): number {
  return tx.personalShare != null ? tx.personalShare : tx.amount;
}

/** Small pie showing what slice of the bill is the user's. */
function SharePie({ share }: { share: number }) {
  const r = 7, c = 2 * Math.PI * r;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8.5" fill="#fff" stroke="var(--c-ink)" strokeWidth="2" />
      <circle cx="10" cy="10" r={r / 2} fill="none" stroke="var(--c-tomato)" strokeWidth={r}
        strokeDasharray={`${(Math.min(Math.max(share, 0), 1) * c) / 2} ${c}`} transform="rotate(-90 10 10)" />
    </svg>
  );
}

function CalendarBadge({ month, day }: { month: string; day: number }) {
  return (
    <span className="cartoon-cal" aria-hidden="true">
      <span className="cartoon-cal-top">{month}</span>
      <span className="cartoon-cal-day">{day}</span>
    </span>
  );
}

export default function CartoonRecords({
  viewYear, viewMonth, onPrev, onNext,
  searchQuery, onSearch, debouncedSearch,
  categories, accounts, categoryFilter, onCategoryFilter, accountFilter, onAccountFilter,
  totalExpense, totalIncome, recordCount,
  transactions, sortedDates, grouped, isLoading, isLoadingMore, sentinelRef,
  selectedId, onOpen, onOpenDay, openDayKey,
}: {
  viewYear: number; viewMonth: number; onPrev: () => void; onNext: () => void;
  searchQuery: string; onSearch: (q: string) => void; debouncedSearch: string;
  categories: Category[]; accounts: Account[];
  categoryFilter: string; onCategoryFilter: (id: string) => void;
  accountFilter: string; onAccountFilter: (id: string) => void;
  totalExpense: number; totalIncome: number; recordCount: number;
  transactions: Transaction[]; sortedDates: string[]; grouped: Record<string, Transaction[]>;
  isLoading: boolean; isLoadingMore: boolean; sentinelRef: RefObject<HTMLDivElement | null>;
  selectedId?: string; onOpen: (tx: Transaction) => void; onOpenDay: (dateKey: string) => void; openDayKey?: string | null;
}) {
  const net = totalIncome - totalExpense;
  const accountTypes = useMemo(() => new Map(accounts.map(a => [a._id, a.type])), [accounts]);
  const coverPct = totalExpense > 0 ? Math.round((totalIncome / totalExpense) * 100) : 0;
  const earnedWidth = totalExpense + totalIncome > 0 ? (totalIncome / (totalExpense + totalIncome)) * 100 : 0;

  const recurringInfo = useRecurringInfo();

  // Entries that share a tag on the same day fold into one card (collapsed by default).
  // The same tag on different days stays as separate rows with just the chip.
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const navigate = useNavigate();

  // How many entries each tag group has all month (for "same 4 entries all month").
  const [monthCounts, setMonthCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    api.get('/transactions/tags')
      .then(({ data }) => setMonthCounts(new Map((data.tags ?? []).map((t: { _id: string; count: number }) => [t._id, t.count]))))
      .catch(() => { /* the footer just omits the count */ });
  }, [transactions]);

  // For a lone tagged entry: the other days its group shows up on (loaded rows only).
  const tagDays = useMemo(() => {
    const days = new Map<string, Map<string, number>>();
    for (const key of sortedDates) {
      for (const t of grouped[key] ?? []) {
        if (!t.tagId) continue;
        const m = days.get(t.tagId._id) ?? new Map<string, number>();
        m.set(key, (m.get(key) ?? 0) + 1);
        days.set(t.tagId._id, m);
      }
    }
    return days;
  }, [sortedDates, grouped]);

  const groupOf = (tx: Transaction, dateKey: string, rows: Transaction[]) => {
    const tagId = tx.tagId?._id;
    if (!tagId) return null;
    const members = rows.filter((r) => r.tagId?._id === tagId);
    if (members.length < 2) return null;
    const key = `${dateKey}:${tagId}`;
    return { key, members, open: openGroups.has(key), first: members[0]._id === tx._id };
  };

  // Quick chips: the categories used most in what's loaded, plus the active filter.
  const chipCategories = useMemo(() => {
    const count = new Map<string, number>();
    for (const tx of transactions) if (tx.categoryId) count.set(tx.categoryId._id, (count.get(tx.categoryId._id) ?? 0) + 1);
    const ids = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 5);
    if (categoryFilter && !ids.includes(categoryFilter)) ids.push(categoryFilter);
    return ids.map(id => categories.find(c => c._id === id)).filter((c): c is Category => !!c);
  }, [transactions, categories, categoryFilter]);

  const tiles = [
    { key: 'spent', label: 'Spent', kind: 'shopping', node: <Amount value={totalExpense} />, long: totalExpense >= 10000 },
    { key: 'earned', label: 'Earned', kind: 'salary', node: <Amount value={totalIncome} />, long: totalIncome >= 10000 },
    { key: 'net', label: 'Net', kind: 'budgets', node: <Amount value={Math.abs(net)} prefix={net < 0 ? '−' : net > 0 ? '+' : ''} />, long: Math.abs(net) >= 10000 },
    { key: 'records', label: 'Records', kind: 'records', node: <>{recordCount}</>, long: false },
  ];

  // Records that just appeared (a save) get a flash and a little slide-in; the first load doesn't.
  const seenIds = useRef<Set<string> | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    const ids = transactions.map(t => t._id);
    if (seenIds.current === null) { if (ids.length) seenIds.current = new Set(ids); return; }
    const added = ids.filter(id => !seenIds.current!.has(id));
    ids.forEach(id => seenIds.current!.add(id));
    if (added.length === 0 || added.length > 3) return;
    setFreshIds(new Set(added));
    const timer = window.setTimeout(() => setFreshIds(new Set()), 1500);
    return () => window.clearTimeout(timer);
  }, [transactions]);

  // What a normal spend looks like per category (own amounts, newest first), for the amount stickers.
  const usualByCategory = useMemo(() => {
    const map = new Map<string, { id: string; amount: number }[]>();
    [...transactions].filter(t => t.type === 'expense' && !t.isAdjustment && t.categoryId)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .forEach(t => { const k = t.categoryId!._id; map.set(k, [...(map.get(k) ?? []), { id: t._id, amount: ownAmount(t) }]); });
    return map;
  }, [transactions]);

  // Header content for a day, shared by the in-flow header and the pinned bar.
  const dayMeta = (dateKey: string) => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const rows = grouped[dateKey] ?? [];
    const dayIn = rows.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const dayOut = rows.filter(t => t.type === 'expense').reduce((sum, t) => sum + ownAmount(t), 0);
    const parts = [`${rows.length} record${rows.length === 1 ? '' : 's'}`];
    if (dayIn) parts.push(`in ₹${dayIn.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    if (dayOut) parts.push(`out ₹${dayOut.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`);
    return { month: MONTHS[m - 1].slice(0, 3).toUpperCase(), day: d, name: DAYS[new Date(y, m - 1, d).getDay()], meta: parts.join(' · ') };
  };

  // A whole day as one button: date badge, name, a dotted line, the day's mix and its total pill.
  const renderDayRow = (dateKey: string) => {
    const head = dayMeta(dateKey);
    const rows = grouped[dateKey] ?? [];
    const sum = summariseDay(rows, categories);
    const income = rows.filter(t => t.type === 'income' && !t.isAdjustment).reduce((a, t) => a + t.amount, 0);
    const open = openDayKey === dateKey;
    const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    return (
      <button type="button" className={`cartoon-day-row ${open ? 'is-open' : ''}`} onClick={() => onOpenDay(dateKey)} aria-expanded={open}>
        <CalendarBadge month={head.month} day={head.day} />
        <span className="cartoon-day-text">
          <span className="cartoon-day-name">{head.name}</span>
          <span className="cartoon-day-meta">{rows.length} record{rows.length === 1 ? '' : 's'}</span>
        </span>
        <span className="cartoon-day-rule" />
        {sum.catRows.length > 0 && <DayMixBar rows={sum.catRows} />}
        <span className="cartoon-day-pill">
          {sum.yourSpend > 0 ? money(sum.yourSpend) : income > 0 ? `+${money(income)}` : money(0)}
          <b aria-hidden>{open ? '‹' : '›'}</b>
        </span>
      </button>
    );
  };

  // Pinned day bar. It shows the day of the first record still visible under the
  // bar's bottom edge, and only once that day's own header has scrolled off. So
  // the bar always has one of its day's records right beneath it, and the next day
  // takes over as soon as the last record of the previous day slides under.
  const rootRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = (categoryFilter ? 1 : 0) + (accountFilter ? 1 : 0);
  useEffect(() => {
    const root = rootRef.current;
    const scroller = root?.closest('main');
    if (!root || !scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const top = scroller.getBoundingClientRect().top;
      const barBottom = top + (pinRef.current?.offsetHeight || 76);
      let next: string | null = null;
      for (const sec of root.querySelectorAll<HTMLElement>('.cartoon-day')) {
        const last = sec.lastElementChild as HTMLElement | null;
        if (!last || last.getBoundingClientRect().bottom <= barBottom) continue;
        const head = sec.querySelector('.cartoon-day-head');
        if (head && head.getBoundingClientRect().top <= top) next = sec.dataset.date ?? null;
        break;
      }
      setPinned(prev => (prev === next ? prev : next));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    scroller.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      scroller.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sortedDates, grouped]);
  const pinMeta = pinned && grouped[pinned] ? dayMeta(pinned) : null;

  return (
    <div className="cartoon-records" ref={rootRef}>
      {/* Month switcher */}
      <header className="cartoon-month">
        <button type="button" onClick={onPrev} className="cartoon-round-btn" aria-label="Previous month">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="text-center">
          <p className="cartoon-kicker">Payment history</p>
          <h1 className="cartoon-month-title">{MONTHS[viewMonth]} {viewYear}</h1>
        </div>
        <button type="button" onClick={onNext} className="cartoon-round-btn" aria-label="Next month">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </header>

      {/* Search + filter toggle */}
      <div className="cartoon-search-row">
      <label className="cartoon-search">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16" y2="16" /></svg>
        <input
          type="search"
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
          placeholder="Search notes, category or amount"
          aria-label="Search transactions this month"
        />
        {searchQuery && (
          <button type="button" onClick={() => onSearch('')} aria-label="Clear search" className="cartoon-search-clear">×</button>
        )}
      </label>
      <button
        type="button"
        className={`cartoon-filter-btn ${filtersOpen ? 'is-on' : ''}`}
        onClick={() => setFiltersOpen(o => !o)}
        aria-expanded={filtersOpen}
        aria-label="Filters"
      >
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="7" x2="20" y2="7" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="17" x2="14" y2="17" /></svg>
        {filterCount > 0 && <span className="cartoon-filter-count">{filterCount}</span>}
      </button>
      </div>

      {/* Quick filters */}
      {filtersOpen && <div className="cartoon-chips">
        <button type="button" className={`cartoon-chip ${categoryFilter ? '' : 'is-on'}`} onClick={() => onCategoryFilter('')}>Everything</button>
        {chipCategories.map(c => (
          <button
            key={c._id}
            type="button"
            className={`cartoon-chip ${categoryFilter === c._id ? 'is-on' : ''}`}
            onClick={() => onCategoryFilter(categoryFilter === c._id ? '' : c._id)}
          >
            <CartoonIcon kind={categoryKind(c.icon, c.name)} size={22} />
            {c.name}
          </button>
        ))}
        <ThemedSelect
          value={accountFilter}
          onChange={onAccountFilter}
          ariaLabel="Filter by account"
          triggerClassName="cartoon-chip cartoon-chip-dashed"
          options={[
            { value: '', label: 'All accounts', icon: <CartoonIcon kind="wallet" size={22} /> },
            ...accounts.map(a => ({ value: a._id, label: a.name, icon: <CartoonIcon kind={accountKind(a.type)} size={22} /> })),
          ]}
        />
      </div>}

      {/* Summary tiles */}
      <div className="cartoon-tiles">
        {tiles.map(t => (
          <div key={t.key} className={`cartoon-stat cartoon-stat-${t.key}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="cartoon-label">{t.label}</p>
              <CartoonIcon kind={t.kind} size={30} />
            </div>
            <p className={`cartoon-stat-value ${t.long ? 'is-long' : ''}`}>{t.node}</p>
          </div>
        ))}
      </div>

      {/* Earnings vs spending */}
      <div className="cartoon-cover">
        <CartoonIcon kind="salary" size={28} />
        <div className="cartoon-cover-bar" role="img" aria-label={`Earnings cover ${coverPct}% of spending`}>
          <span style={{ width: `${earnedWidth}%` }} />
        </div>
        <CartoonIcon kind="shopping" size={26} />
        <p className="cartoon-cover-text">Earnings cover {coverPct}% of spending</p>
      </div>

      {/* Pinned day bar (zero-height sticky anchor) */}
      <div className="cartoon-pin" aria-hidden={!pinMeta}>
        <div ref={pinRef} className={`cartoon-day-head cartoon-pin-bar ${pinMeta ? 'is-on' : ''}`}>
          {pinMeta && pinned && renderDayRow(pinned)}
        </div>
      </div>

      {/* Records */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="cartoon-spinner" />
        </div>
      ) : sortedDates.length === 0 ? (
        <div className="cartoon-empty">
          <CartoonIcon kind="receipt" size={72} />
          <p>{debouncedSearch ? 'No matching records this month' : 'No records this month yet'}</p>
        </div>
      ) : sortedDates.map(dateKey => {
        const rows = clusterByTag(grouped[dateKey]);
        return (
          <section key={dateKey} className="cartoon-day" data-date={dateKey}>
            <div className="cartoon-day-head">{renderDayRow(dateKey)}</div>

            {rows.map(tx => {
              const grp = groupOf(tx, dateKey, rows);
              if (grp) {
                if (!grp.first) return null;
                return (
                  <TagStack
                    key={grp.key}
                    members={grp.members}
                    open={grp.open}
                    onToggle={() => toggleGroup(grp.key)}
                    onOpen={onOpen}
                    monthCount={monthCounts.get(tx.tagId!._id)}
                    onOpenTag={() => navigate(`/tags?tag=${tx.tagId!._id}`)}
                    accountTypes={accountTypes}
                  />
                );
              }
              const rec = recurringInfo(tx);
              const isSplit = tx.personalShare != null && tx.personalShare !== tx.amount;
              const kind = kindOf(tx);
              const title = titleOf(tx);
              // Small item pictures beside the title, minus one the big tile already shows (Netflix).
              const faces = (tx.items ?? []).map(i => itemKind(i.name)).filter((k): k is string => !!k && k !== kind).slice(0, 3);
              const groups = tx.type === 'transfer' || tx.isAdjustment ? [] : categoryGroups(tx, categories);
              const multiCat = groups.length > 1;
              const catKind = (g: { icon: string; name: string }) => categoryKind(g.icon, g.name);
              const sharers = multiCat && tx.split ? ['You', ...tx.split.splits.map(sp => (typeof sp.friendId === 'string' ? sp.friendId : sp.friendId.name))] : [];
              const tags = (
                <>
                  {tx.merchant && <span className="cartoon-account"><CartoonIcon kind="shopping" size={16} />{tx.merchant}</span>}
                  {tx.transferFriend && (
                    <span className="cartoon-account">
                      <CartoonIcon kind="face2" size={16} />
                      {tx.transferFriend.direction === 'sent' ? '→' : '←'} {tx.transferFriend.name}
                    </span>
                  )}
                  {tx.tagId && <TagRibbon tag={tx.tagId} />}
                  {tx.accountId ? (
                    <span className="cartoon-account">
                      <CartoonIcon kind={accountKind(accountTypes.get(tx.accountId._id))} size={16} />
                      {tx.accountId.name}{tx.type === 'transfer' && tx.toAccountId ? ` → ${tx.toAccountId.name}` : ''}
                    </span>
                  ) : (
                    <span className="cartoon-account">
                      <CartoonIcon kind="face2" size={16} />
                      {tx.paidByFriendId ? `Paid by ${tx.paidByFriendId.name}` : 'Debt'}
                    </span>
                  )}
                  {tx.passedToFriendId && (
                    <span className="cartoon-account"><CartoonIcon kind="face2" size={16} />→ {tx.passedToFriendId.name}</span>
                  )}
                  {tx.type === 'income' && tx.receivedFromFriendId && (
                    <span className="cartoon-account"><CartoonIcon kind="face3" size={16} />From {tx.receivedFromFriendId.name}</span>
                  )}
                </>
              );
              const usual = tx.type === 'expense' && !tx.isAdjustment && tx.categoryId
                ? (usualByCategory.get(tx.categoryId._id) ?? []).filter(x => x.id !== tx._id).map(x => x.amount)
                : [];
              const reaction = tx.type === 'expense' && !tx.isAdjustment ? reactionFor(ownAmount(tx), usual) : null;
              const tone = tx.type === 'income' ? 'earn' : tx.type === 'expense' ? 'spend' : 'move';
              const row = (
                <button
                  key={tx._id}
                  type="button"
                  onClick={() => onOpen(tx)}
                  className={`cartoon-record ${multiCat ? '' : 'is-two-row'} ${tx._id === selectedId ? 'is-selected' : ''} ${freshIds.has(tx._id) ? 'is-fresh' : ''} ${rec?.autopay ? 'has-ribbon' : ''}`}
                >
                  {rec?.autopay && <span className="autopay-ribbon" aria-label="Autopay">↻ AUTO PAY</span>}
                  {multiCat ? (
                    <span className="cartoon-tile cartoon-stack" style={{ width: 64, height: 64, background: '#fff' }} aria-hidden>
                      <span className="cartoon-stack-main"><CartoonIcon kind={catKind(groups[0])} size={34} /></span>
                      <span className="cartoon-stack-next"><CartoonIcon kind={catKind(groups[1])} size={28} /></span>
                      <span className="cartoon-stack-count">{groups.length}</span>
                    </span>
                  ) : (
                    <span className="rec-wrap">
                      <CartoonTile kind={kind} size={64} />
                      {rec && !rec.autopay && <RecurringBadge autopay={false} overlay />}
                    </span>
                  )}
                  <div className="cartoon-record-body">
                    <div className="cartoon-record-line">
                      <span className="cartoon-record-title">
                        {multiCat ? (groups.length === 2 ? `${groups[0].name} + ${groups[1].name}` : `${groups[0].name} + ${groups.length - 1} more`) : title}
                      </span>
                      <span className="cartoon-tick" aria-label="Synced">✓</span>
                      <span className="cartoon-record-time">{fmtTime(tx.date)}</span>
                      {isSplit && (
                        <span className="cartoon-badge"><CartoonIcon kind="pizza" size={16} />{multiCat && sharers.length > 1 ? `Split ${sharers.length} ways` : 'Split'}</span>
                      )}
                      {tx.isAdjustment && <span className="cartoon-sticker">✦ New journey</span>}
                    </div>
                    <div className="cartoon-record-line cartoon-record-sub is-nowrap">
                      {multiCat && (
                        <span className="cartoon-catbar">
                          {groups.map((g) => (
                            <span key={g.id ?? g.name} className="cartoon-catbar-slice" style={{ flexGrow: g.total, background: kindTint(catKind(g)) }}>
                              <CartoonIcon kind={catKind(g)} size={16} />
                              {g.total / tx.amount > 0.12 && <b>₹{Math.round(g.total)}</b>}
                            </span>
                          ))}
                        </span>
                      )}
                      {!multiCat && faces.length > 0 && (
                        <span className="cartoon-faces">{faces.map((f, i) => <CartoonIcon key={i} kind={f} size={22} />)}</span>
                      )}
                      {(tx.note || tx.items?.length) ? (
                        <span className={`cartoon-note ${tx.note ? '' : 'is-empty'}`}>
                          {tx.note || tx.items!.map(i => i.name).join(', ')}
                        </span>
                      ) : null}
                      {/* Tags follow the note on the same line... */}
                      {!multiCat && tags}
                    </div>
                    {/* ...but a bill with several categories gives them a line of their own. */}
                    {multiCat && <div className="cartoon-record-line cartoon-record-sub cartoon-record-tags">{tags}</div>}
                  </div>
                  <div className="cartoon-record-amount">
                    {reaction && (
                      <motion.span
                        className={`cartoon-reaction is-${reaction}`}
                        initial={reaction === 'ouch' || reaction === 'sweat' ? { rotate: 0 } : false}
                        animate={(reaction === 'ouch' || reaction === 'sweat') && !prefersReducedMotion() ? { rotate: [0, -6, 6, 0] } : {}}
                        transition={{ duration: 0.5, delay: 0.2 }}
                        title={reaction === 'calm' ? 'Less than usual for this' : 'More than usual for this'}
                      >
                        <CartoonIcon kind={reaction === 'calm' ? 'tomato' : 'wallet'} size={18} />
                        {reaction === 'calm' ? 'calm' : reaction === 'ouch' ? 'ouch' : 'ouch!!'}
                        {reaction === 'sweat' && <i aria-hidden>💦</i>}
                      </motion.span>
                    )}
                    <span className={`cartoon-amount is-${tone}${reaction === 'sweat' ? ' is-shake' : ''}`}>
                      <Amount value={ownAmount(tx)} prefix={tx.type === 'expense' ? '−' : tx.type === 'income' ? '+' : ''} />
                    </span>
                    {isSplit && (
                      <span className="cartoon-share">
                        <SharePie share={tx.personalShare! / tx.amount} />
                        your share of <Amount value={tx.amount} decClassName="" />
                      </span>
                    )}
                  </div>
                </button>
              );
              // A lone tagged entry: say where else its group turns up this month.
              const elsewhere = tx.tagId
                ? [...(tagDays.get(tx.tagId._id) ?? new Map<string, number>())].filter(([key]) => key !== dateKey)
                : [];
              if (elsewhere.length === 0) return row;
              const more = elsewhere.reduce((sum, [, n]) => sum + n, 0);
              const on = elsewhere.map(([key]) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })).join(', ');
              return (
                <Fragment key={tx._id}>
                  {row}
                  <span className="tag-more-pill" style={tagVars(tx.tagId!.name)}>
                    +{more} more in # {tx.tagId!.name} · {monthShort(tx.tagId!.month).split(' ')[0]} on {on}
                  </span>
                </Fragment>
              );
            })}
          </section>
        );
      })}

      <div ref={sentinelRef} className="h-1" />
      {isLoadingMore && <div className="flex justify-center py-4"><div className="cartoon-spinner is-small" /></div>}
    </div>
  );
}

// The sub-line a record uses, for the compact rows inside a tag stack.
// "🏛 SBI · 🙂 → Bala": the account first, then who else is involved, each with its icon.
function subOf(tx: Transaction, accountTypes: Map<string, Account['type']>): ReactNode {
  const acct = (a?: { _id: string; name: string }) =>
    a && <><CartoonIcon kind={accountKind(accountTypes.get(a._id))} size={15} />{a.name}</>;
  const parts: ReactNode[] = [];
  if (tx.type === 'transfer') {
    parts.push(<>{acct(tx.accountId)} → {tx.toAccountId?.name ?? '?'}</>);
  } else {
    if (tx.merchant) parts.push(<><CartoonIcon kind="shopping" size={15} />{tx.merchant}</>);
    if (tx.accountId) parts.push(acct(tx.accountId));
    else if (tx.paidByFriendId) parts.push(<><CartoonIcon kind="face2" size={15} />Paid by {tx.paidByFriendId.name}</>);
  }
  const friend = tx.passedToFriendId
    ? `→ ${tx.passedToFriendId.name}`
    : tx.transferFriend
      ? `${tx.transferFriend.direction === 'sent' ? '→' : '←'} ${tx.transferFriend.name}`
      : tx.receivedFromFriendId ? `From ${tx.receivedFromFriendId.name}` : null;
  if (friend) parts.push(<><CartoonIcon kind="face2" size={15} />{friend}</>);
  return parts.map((p, i) => <span key={i} className="tag-rail-part">{i > 0 && <i>·</i>}{p}</span>);
}
const rupees = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// "Bala paid +₹12,000, you moved ₹24,000 ICICI → Cash"
function stackSummary(members: Transaction[]): string {
  const parts: string[] = [];
  for (const m of members.filter((x) => x.type === 'income')) {
    const who = m.receivedFromFriendId?.name || m.merchant || m.note || m.categoryId?.name || 'Someone';
    parts.push(`${who} paid +${rupees(m.amount)}`);
  }
  const routes = new Map<string, number>();
  for (const m of members.filter((x) => x.type === 'transfer')) {
    const route = `${m.accountId?.name ?? '?'} → ${m.toAccountId?.name ?? '?'}`;
    routes.set(route, (routes.get(route) ?? 0) + m.amount);
  }
  for (const [route, total] of routes) parts.push(`you moved ${rupees(total)} ${route}`);
  const spent = members.filter((x) => x.type === 'expense').reduce((sum, m) => sum + m.amount, 0);
  if (spent > 0) parts.push(`you spent ${rupees(spent)}`);
  return parts.join(', ');
}

/**
 * Entries that share a tag on the same day, folded into one stack: the tag, how
 * many, and out / in / net for that day. Open, they sit on one coloured rail
 * (no tag chip each: the rail says it), with a link to the whole month's group.
 */
function TagStack({ members, open, onToggle, onOpen, monthCount, onOpenTag, accountTypes }: {
  members: Transaction[];
  open: boolean;
  onToggle: () => void;
  onOpen: (tx: Transaction) => void;
  /** Entries in this group across the whole month, when known. */
  monthCount?: number;
  onOpenTag: () => void;
  accountTypes: Map<string, Account['type']>;
}) {
  const tag = members[0].tagId!;
  const out = members.filter((m) => m.type !== 'income').reduce((sum, m) => sum + m.amount, 0);
  const inn = members.filter((m) => m.type === 'income').reduce((sum, m) => sum + m.amount, 0);
  const net = Math.round((out - inn) * 100) / 100;
  return (
    <div className={`tag-stack ${open ? 'is-open' : 'is-closed'}`} style={tagVars(tag.name)}>
      <button type="button" className="tag-stack-head" onClick={onToggle} aria-expanded={open}>
        <TagRibbon tag={tag} />
        <span className="tag-count-pill">{members.length} entries today</span>
        <span className="tag-stack-totals">
          <small>
            {out > 0 && <span className="is-out">out {rupees(out)}</span>}
            {inn > 0 && <span className="is-in">in {rupees(inn)}</span>}
          </small>
          <span className={`tag-stack-net ${net >= 0 ? 'is-out' : 'is-in'}`}>
            <em>net</em><Amount value={Math.abs(net)} />
          </span>
        </span>
        <span className={`tag-chev ${open ? 'is-open' : ''}`} aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18" /></svg>
        </span>
      </button>

      {!open ? (
        <div className="tag-stack-sum">
          <span className="tag-avatars">
            {members.map((m) => <span key={m._id}><CartoonIcon kind={kindOf(m)} size={22} /></span>)}
          </span>
          <span className="tag-stack-text">{stackSummary(members)}</span>
        </div>
      ) : (
        <>
          <div className="tag-rail-list">
            {members.map((m) => (
              <button key={m._id} type="button" className="tag-rail-row" onClick={() => onOpen(m)}>
                <CartoonTile kind={kindOf(m)} size={46} />
                <span className="tag-rail-body">
                  <span className="tag-rail-title">{titleOf(m)} <small>{fmtTime(m.date)}</small></span>
                  <span className="tag-rail-sub">{subOf(m, accountTypes)}</span>
                </span>
                <span className={`tag-rail-amt is-${m.type === 'income' ? 'earn' : m.type === 'expense' ? 'spend' : 'move'}`}>
                  <Amount value={m.amount} prefix={m.type === 'income' ? '+' : m.type === 'expense' ? '−' : ''} />
                </span>
              </button>
            ))}
          </div>
          <div className="tag-stack-foot">
            <button type="button" onClick={onOpenTag}>Open # {tag.name} · {monthShort(tag.month)} →</button>
            {monthCount != null && (
              <span>{monthCount === members.length ? `same ${monthCount} entries all month` : `${monthCount} entries all month`}</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Keep entries that share a tag on the same day side by side, at the first one's place. */
function clusterByTag(rows: Transaction[]): Transaction[] {
  const byTag = new Map<string, Transaction[]>();
  for (const tx of rows) {
    if (tx.tagId) byTag.set(tx.tagId._id, [...(byTag.get(tx.tagId._id) ?? []), tx]);
  }
  const placed = new Set<string>();
  const out: Transaction[] = [];
  for (const tx of rows) {
    if (placed.has(tx._id)) continue;
    const mates = tx.tagId ? byTag.get(tx.tagId._id) ?? [tx] : [tx];
    for (const m of mates) { placed.add(m._id); out.push(m); }
  }
  return out;
}
