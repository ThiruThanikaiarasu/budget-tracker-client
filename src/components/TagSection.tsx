import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Amount from './Amount';
import CartoonIcon from './CartoonIcon';
import TagRibbon from './TagRibbon';
import useTransactionStore, { type TagChoice, type TagRef, type Transaction } from '../store/transactionStore';
import { monthShort } from '../utils/tagMonth';
import { tagVars } from '../utils/tagColor';
import { kindOf, titleOf } from '../utils/recordLook';

interface TagGroup extends TagRef {
  count: number;
  out: number;
  in: number;
}

const localDay = (d: string) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

/**
 * The record's tag in view mode: a dashed box with the ribbon and "change". The
 * picker sheet offers this month's groups, creating one, earlier months (picking
 * one starts a new group in this entry's month), and same-day records that
 * aren't tagged yet, ticked ones joining the same group on Done.
 */
export default function TagSection({ tx }: { tx: Transaction }) {
  const setTag = useTransactionStore((s) => s.setTag);
  const transactions = useTransactionStore((s) => s.transactions);
  // The detail panel keeps its own copy of the record, so the saved tag lives here.
  const [current, setCurrent] = useState<TagRef | null>(tx.tagId ?? null);
  const [editing, setEditing] = useState(false);
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState<TagChoice | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const d = new Date(tx.date);
  const entryMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const open = () => {
    setQuery(current?.name ?? '');
    setChoice(current ? { tagId: current._id } : null);
    setTicked(new Set());
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) return;
    api.get('/transactions/tags')
      .then(({ data }) => setGroups(data.tags ?? []))
      .catch(() => { /* the sheet still allows creating one */ });
  }, [editing]);

  const typed = query.trim();
  const matches = (g: TagGroup) => !typed || g.name.toLowerCase().includes(typed.toLowerCase());
  const thisMonth = groups.filter((g) => g.month === entryMonth && matches(g));
  const thisMonthNames = new Set(groups.filter((g) => g.month === entryMonth).map((g) => g.name.toLowerCase()));
  // One row per name from other months, newest first; hidden when this month already has it.
  const earlier = useMemo(() => {
    const seen = new Set<string>();
    return groups
      .filter((g) => g.month !== entryMonth && matches(g) && !thisMonthNames.has(g.name.toLowerCase()))
      .sort((a, b) => b.month.localeCompare(a.month))
      .filter((g) => (seen.has(g.name.toLowerCase()) ? false : (seen.add(g.name.toLowerCase()), true)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, entryMonth, typed]);
  const canCreate = !!typed && !thisMonthNames.has(typed.toLowerCase());

  const sameDay = transactions.filter(
    (t) => t._id !== tx._id && !t.tagId && localDay(t.date) === localDay(tx.date)
  );

  const isChosen = (c: TagChoice) =>
    !!choice && (c.tagId ? choice.tagId === c.tagId : !!c.name && choice.name?.toLowerCase() === c.name.toLowerCase());

  const done = async () => {
    setSaving(true);
    try {
      let tag = current;
      const changed = !!choice && !(choice.tagId && choice.tagId === current?._id);
      if (changed) tag = await setTag(tx._id, choice!);
      if (tag) for (const id of ticked) await setTag(id, { tagId: tag._id });
      if (ticked.size > 0 && tag) toast.success(`Tagged ${ticked.size + (changed ? 1 : 0)} in # ${tag.name}`);
      setCurrent(tag);
      setEditing(false);
    } catch {
      // handled by store
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      setCurrent(await setTag(tx._id, {}));
      setEditing(false);
    } catch {
      // handled by store
    } finally {
      setSaving(false);
    }
  };

  const groupRow = (g: TagGroup, faded = false) => {
    const c: TagChoice = faded ? { name: g.name } : { tagId: g._id };
    const on = isChosen(c);
    return (
      <button key={g._id} type="button" onClick={() => setChoice(c)} aria-pressed={on}
        className={`tag-pick ${on ? 'is-on' : ''} ${faded ? 'is-faded' : ''}`} style={tagVars(g.name)}>
        <span className="tag-pick-dot" />
        <span className="tag-pick-name"># {g.name} · {monthShort(g.month)}</span>
        <span className="tag-pick-meta">{`₹${(g.out || g.in).toLocaleString('en-IN')}`} · {g.count}</span>
        {on && <span className="tag-pick-check">✓</span>}
      </button>
    );
  };

  return (
    <div className="mt-3 space-y-3">
      <div className="tag-section" style={tagVars(current?.name ?? 'tag')}>
        <span className="tag-section-label">Tag</span>
        {current ? <TagRibbon tag={current} long /> : <span className="tag-section-none">No tag yet</span>}
        {!editing && (
          <button type="button" className="tag-section-change" onClick={open}>{current ? 'change' : 'add'}</button>
        )}
      </div>

      {editing && (
        <div className="tag-sheet">
          <div className="tag-search">
            <span aria-hidden>🔍</span>
            <input autoFocus value={query} maxLength={40} placeholder="Tag name, e.g. Rent" aria-label="Tag name"
              onChange={(e) => setQuery(e.target.value)} />
            {query && <button type="button" aria-label="Clear" onClick={() => setQuery('')}>✕</button>}
          </div>

          {thisMonth.length > 0 && <p className="tag-sheet-label">This month ({monthShort(entryMonth)})</p>}
          {thisMonth.map((g) => groupRow(g))}

          {canCreate && (
            <button type="button" onClick={() => setChoice({ name: typed })}
              className={`tag-create ${isChosen({ name: typed }) ? 'is-on' : ''}`} style={tagVars(typed)}>
              <span className="tag-create-plus">+</span>
              Create <b># {typed} · {monthShort(entryMonth)}</b>
            </button>
          )}

          {earlier.length > 0 && (
            <p className="tag-sheet-label">Earlier months · <span>picking one makes a new {monthShort(entryMonth).split(' ')[0]} group</span></p>
          )}
          {earlier.map((g) => groupRow(g, true))}

          {sameDay.length > 0 && <p className="tag-sheet-label">Same day, not tagged yet</p>}
          {sameDay.map((t) => {
            const on = ticked.has(t._id);
            return (
              <button key={t._id} type="button" className="tag-sameday" aria-pressed={on}
                onClick={() => setTicked((prev) => { const n = new Set(prev); if (n.has(t._id)) n.delete(t._id); else n.add(t._id); return n; })}>
                <span className={`tag-check ${on ? 'is-on' : ''}`}>{on && '✓'}</span>
                <CartoonIcon kind={kindOf(t)} size={22} />
                <span className="tag-sameday-name">{t.note && t.type !== 'transfer' ? t.note : titleOf(t)}</span>
                <span className={`tag-sameday-amt is-${t.type}`}>
                  <Amount value={t.amount} prefix={t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''} />
                </span>
              </button>
            );
          })}

          <div className="tag-sheet-actions">
            {current ? (
              <button type="button" className="tag-remove" disabled={saving} onClick={remove}>Remove tag</button>
            ) : (
              <button type="button" className="tag-remove is-plain" onClick={() => setEditing(false)}>Cancel</button>
            )}
            <button type="button" className="t-btn-primary tag-done" disabled={saving || (!choice && !current)} onClick={done}>
              {saving ? 'Saving…' : ticked.size > 0 ? `Tag ${ticked.size} more · Done` : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
