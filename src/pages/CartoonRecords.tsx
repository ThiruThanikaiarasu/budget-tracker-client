import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { Transaction } from '../store/transactionStore';
import type { Category } from '../store/categoryStore';
import type { Account } from '../store/accountStore';
import Amount from '../components/Amount';
import CartoonIcon, { CartoonTile } from '../components/CartoonIcon';
import ThemedSelect from '../components/ThemedSelect';
import { accountKind, categoryKind, itemKind, kindTint } from '../utils/cartoonKinds';
import { categoryGroups } from '../utils/txCategories';

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
  selectedId, onOpen, onOpenDay,
}: {
  viewYear: number; viewMonth: number; onPrev: () => void; onNext: () => void;
  searchQuery: string; onSearch: (q: string) => void; debouncedSearch: string;
  categories: Category[]; accounts: Account[];
  categoryFilter: string; onCategoryFilter: (id: string) => void;
  accountFilter: string; onAccountFilter: (id: string) => void;
  totalExpense: number; totalIncome: number; recordCount: number;
  transactions: Transaction[]; sortedDates: string[]; grouped: Record<string, Transaction[]>;
  isLoading: boolean; isLoadingMore: boolean; sentinelRef: RefObject<HTMLDivElement | null>;
  selectedId?: string; onOpen: (tx: Transaction) => void; onOpenDay: (dateKey: string) => void;
}) {
  const net = totalIncome - totalExpense;
  const accountTypes = useMemo(() => new Map(accounts.map(a => [a._id, a.type])), [accounts]);
  const coverPct = totalExpense > 0 ? Math.round((totalIncome / totalExpense) * 100) : 0;
  const earnedWidth = totalExpense + totalIncome > 0 ? (totalIncome / (totalExpense + totalIncome)) * 100 : 0;

  // Quick chips: the categories used most in what's loaded, plus the active filter.
  const chipCategories = useMemo(() => {
    const count = new Map<string, number>();
    for (const tx of transactions) if (tx.categoryId) count.set(tx.categoryId._id, (count.get(tx.categoryId._id) ?? 0) + 1);
    const ids = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, 5);
    if (categoryFilter && !ids.includes(categoryFilter)) ids.push(categoryFilter);
    return ids.map(id => categories.find(c => c._id === id)).filter((c): c is Category => !!c);
  }, [transactions, categories, categoryFilter]);

  const tiles = [
    { key: 'spent', label: 'Spent', kind: 'shopping', node: <Amount value={totalExpense} /> },
    { key: 'earned', label: 'Earned', kind: 'salary', node: <Amount value={totalIncome} /> },
    { key: 'net', label: 'Net', kind: 'budgets', node: <Amount value={Math.abs(net)} prefix={net < 0 ? '−' : net > 0 ? '+' : ''} /> },
    { key: 'records', label: 'Records', kind: 'records', node: <>{recordCount}</> },
  ];

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
            <p className="cartoon-stat-value">{t.node}</p>
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
          {pinMeta && (
            <>
              <button type="button" className="cartoon-day-open" onClick={() => pinned && onOpenDay(pinned)} title="Open this day">
                <CalendarBadge month={pinMeta.month} day={pinMeta.day} />
                <div>
                  <p className="cartoon-day-name">{pinMeta.name}</p>
                  <p className="cartoon-day-meta">{pinMeta.meta}</p>
                </div>
              </button>
              <span className="cartoon-day-rule" />
            </>
          )}
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
        const rows = grouped[dateKey];
        const head = dayMeta(dateKey);
        return (
          <section key={dateKey} className="cartoon-day" data-date={dateKey}>
            <div className="cartoon-day-head">
              <button type="button" className="cartoon-day-open" onClick={() => onOpenDay(dateKey)} title="Open this day">
                <CalendarBadge month={head.month} day={head.day} />
                <div>
                  <p className="cartoon-day-name">{head.name}</p>
                  <p className="cartoon-day-meta">{head.meta}</p>
                </div>
              </button>
              <span className="cartoon-day-rule" />
            </div>

            {rows.map(tx => {
              const isSplit = tx.personalShare != null && tx.personalShare !== tx.amount;
              const kind = tx.isAdjustment ? 'cleanup'
                : tx.type === 'transfer' ? 'bank'
                : tx.categoryId ? categoryKind(tx.categoryId.icon, tx.categoryId.name) : 'coins';
              const title = tx.isAdjustment ? 'Clean up' : tx.type === 'transfer' ? 'Transfer' : tx.categoryId?.name || 'Unknown';
              const faces = (tx.items ?? []).map(i => itemKind(i.name)).filter((k): k is string => !!k).slice(0, 3);
              const groups = tx.type === 'transfer' || tx.isAdjustment ? [] : categoryGroups(tx, categories);
              const multiCat = groups.length > 1;
              const catKind = (g: { icon: string; name: string }) => categoryKind(g.icon, g.name);
              const sharers = multiCat && tx.split ? ['You', ...tx.split.splits.map(sp => (typeof sp.friendId === 'string' ? sp.friendId : sp.friendId.name))] : [];
              const tags = (
                <>
                  {tx.merchant && <span className="cartoon-account"><CartoonIcon kind="shopping" size={16} />{tx.merchant}</span>}
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
                  {tx.type === 'income' && tx.receivedFromFriendId && (
                    <span className="cartoon-account"><CartoonIcon kind="face3" size={16} />From {tx.receivedFromFriendId.name}</span>
                  )}
                </>
              );
              const tone = tx.type === 'income' ? 'earn' : tx.type === 'expense' ? 'spend' : 'move';
              return (
                <button
                  key={tx._id}
                  type="button"
                  onClick={() => onOpen(tx)}
                  className={`cartoon-record ${multiCat ? '' : 'is-two-row'} ${tx._id === selectedId ? 'is-selected' : ''}`}
                >
                  {multiCat ? (
                    <span className="cartoon-tile cartoon-stack" style={{ width: 64, height: 64, background: '#fff' }} aria-hidden>
                      <span className="cartoon-stack-main"><CartoonIcon kind={catKind(groups[0])} size={34} /></span>
                      <span className="cartoon-stack-next"><CartoonIcon kind={catKind(groups[1])} size={28} /></span>
                      <span className="cartoon-stack-count">{groups.length}</span>
                    </span>
                  ) : (
                    <CartoonTile kind={kind} size={64} />
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
                    <span className={`cartoon-amount is-${tone}`}>
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
            })}
          </section>
        );
      })}

      <div ref={sentinelRef} className="h-1" />
      {isLoadingMore && <div className="flex justify-center py-4"><div className="cartoon-spinner is-small" /></div>}
    </div>
  );
}
