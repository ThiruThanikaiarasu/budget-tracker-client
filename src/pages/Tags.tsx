import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import Amount from '../components/Amount';
import type { Transaction } from '../store/transactionStore';
import { monthShort } from '../utils/tagMonth';

interface TagSummary {
  _id: string;
  name: string;
  /** Calendar month the group belongs to, "YYYY-MM". */
  month: string;
  count: number;
  /** Expenses plus account transfers tagged with it. */
  out: number;
  /** Income tagged with it. */
  in: number;
  last: string;
}

/** One tag name with all its months, e.g. Rent -> Nov 2026, Oct 2026. */
interface TagFamily {
  key: string;
  name: string;
  months: TagSummary[];
  count: number;
  out: number;
  in: number;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const round = (n: number) => Math.round(n * 100) / 100;

// What a row says about itself in the list.
function describe(tx: Transaction): string {
  if (tx.type === 'transfer') return `${tx.accountId?.name ?? '?'} → ${tx.toAccountId?.name ?? '?'}`;
  const from = tx.type === 'income' && tx.receivedFromFriendId ? `From ${tx.receivedFromFriendId.name}` : '';
  return [tx.note, from, tx.merchant, tx.categoryId?.name].find((x) => x?.trim()) || (tx.type === 'income' ? 'Income' : 'Expense');
}

// Out / in / net for a card or a month row.
function Totals({ out, inn }: { out: number; inn: number }) {
  const left = round(out - inn);
  return (
    <div className="grid grid-cols-3 gap-3 rounded-lg bg-[var(--c-surface2)] p-3 text-center">
      <div>
        <p className="cred-label">Went out</p>
        <p className="mt-0.5 font-bold text-[var(--c-expense)]"><Amount value={out} /></p>
      </div>
      <div>
        <p className="cred-label">Came in</p>
        <p className="mt-0.5 font-bold text-[var(--c-income)]"><Amount value={inn} /></p>
      </div>
      <div>
        <p className="cred-label">{left >= 0 ? 'Net out' : 'Net in'}</p>
        <p className="mt-0.5 font-bold text-[var(--c-text)]"><Amount value={Math.abs(left)} /></p>
      </div>
    </div>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 text-[var(--c-muted)] transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

/**
 * Tags, grouped by name: each name (Rent) is one collapsed card with its total
 * across every month. Open it for the months, newest first; open a month for
 * its entries.
 */
function Tags() {
  const [tags, setTags] = useState<TagSummary[] | null>(null);
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  // Id of the month whose entries are showing.
  const [openMonth, setOpenMonth] = useState<string | null>(null);
  const [entries, setEntries] = useState<Transaction[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // ?tag=<id> (from "Open # Rent · Nov 2026 →" in Records) opens that name and month.
  const [params] = useSearchParams();
  const deepLink = params.get('tag');

  useEffect(() => {
    api.get('/transactions/tags').then(({ data }) => {
      setTags(data.tags);
      const target = (data.tags as TagSummary[]).find((t) => t._id === deepLink);
      if (target) {
        setOpenFamily(target.name.toLowerCase());
        toggleMonth(target._id);
      }
    }).catch(() => setTags([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLink]);

  const families = useMemo<TagFamily[]>(() => {
    const byName = new Map<string, TagFamily>();
    for (const t of tags ?? []) {
      const key = t.name.toLowerCase();
      const f = byName.get(key) ?? { key, name: t.name, months: [], count: 0, out: 0, in: 0 };
      f.months.push(t);
      f.count += t.count;
      f.out += t.out;
      f.in += t.in;
      byName.set(key, f);
    }
    for (const f of byName.values()) f.months.sort((a, b) => b.month.localeCompare(a.month));
    // The tag used most recently first.
    return [...byName.values()].sort((a, b) => b.months[0].month.localeCompare(a.months[0].month) || a.name.localeCompare(b.name));
  }, [tags]);

  const toggleFamily = (key: string) => {
    setOpenFamily(openFamily === key ? null : key);
    setOpenMonth(null);
  };

  const toggleMonth = async (tagId: string) => {
    if (openMonth === tagId) { setOpenMonth(null); return; }
    setOpenMonth(tagId);
    setEntries([]);
    setLoadingEntries(true);
    try {
      const { data } = await api.get('/transactions', { params: { tagId, limit: 100 } });
      setEntries(data.transactions);
    } finally {
      setLoadingEntries(false);
    }
  };

  return (
    <div className="p-6 pb-24">
      <p className="cred-label">Group related entries</p>
      <h1 className="cred-serif text-2xl font-semibold" style={{ color: 'var(--c-text)' }}>Tags</h1>
      <p className="mt-1 text-sm text-[var(--c-muted)]">
        Open any record and tap “+ Tag”. Each tag is one name in one month, so Rent · Oct and Rent · Nov stay apart.
      </p>

      {tags === null ? (
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--c-accent)] border-t-transparent" />
        </div>
      ) : families.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--c-muted)]">No tags yet.</p>
      ) : (
        <div className="mt-5 space-y-3">
          {families.map((f) => {
            const isOpen = openFamily === f.key;
            return (
              <div key={f.key} className="rounded-lg bg-[var(--c-surface)] p-4 shadow">
                <button type="button" onClick={() => toggleFamily(f.key)} className="block w-full text-left" aria-expanded={isOpen}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="flex items-center gap-2 text-lg font-semibold text-[var(--c-text)]">
                      <Chevron open={isOpen} /># {f.name}
                    </p>
                    <span className="text-xs text-[var(--c-muted)]">
                      {f.months.length} {f.months.length === 1 ? 'month' : 'months'} · {f.count} {f.count === 1 ? 'entry' : 'entries'}
                    </span>
                  </div>
                  <div className="mt-3">
                    <Totals out={f.out} inn={f.in} />
                  </div>
                  {!isOpen && f.months.length > 1 && (
                    <p className="mt-2 text-xs text-[var(--c-muted)]">All months together · tap to see each month</p>
                  )}
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-2 border-t border-[var(--c-border)] pt-3">
                    {f.months.map((m) => {
                      const monthOpen = openMonth === m._id;
                      const left = round(m.out - m.in);
                      return (
                        <div key={m._id} className="rounded-lg border border-[var(--c-border)]">
                          <button type="button" onClick={() => toggleMonth(m._id)} className="block w-full px-3 py-2.5 text-left" aria-expanded={monthOpen}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--c-text)]">
                                <Chevron open={monthOpen} />{monthShort(m.month, true)}
                              </p>
                              <p className="text-xs text-[var(--c-muted)]">
                                out <Amount value={m.out} /> · in <Amount value={m.in} /> · {left >= 0 ? 'net out' : 'net in'}{' '}
                                <b className="text-[var(--c-text)]"><Amount value={Math.abs(left)} /></b>
                              </p>
                            </div>
                          </button>
                          {monthOpen && (
                            <ul className="divide-y divide-[var(--c-border)] border-t border-[var(--c-border)] px-3">
                              {loadingEntries ? (
                                <li className="py-3 text-sm text-[var(--c-muted)]">Loading…</li>
                              ) : entries.map((tx) => (
                                <li key={tx._id} className="flex items-center justify-between gap-3 py-2.5">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-[var(--c-text)]">{describe(tx)}</p>
                                    <p className="text-xs text-[var(--c-muted)]">
                                      {fmtDate(tx.date)}{tx.type === 'transfer' ? ' · account transfer' : ''}
                                    </p>
                                  </div>
                                  <p className={`shrink-0 text-sm font-semibold ${tx.type === 'income' ? 'text-[var(--c-income)]' : 'text-[var(--c-expense)]'}`}>
                                    <Amount value={tx.amount} prefix={tx.type === 'income' ? '+' : '−'} />
                                  </p>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Tags;
