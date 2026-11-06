import { useEffect, useState } from 'react';
import api from '../api/axios';
import Amount from './Amount';
import useTransactionStore, { type TagChoice, type TagRef } from '../store/transactionStore';
import { monthShort } from '../utils/tagMonth';

interface TagGroup extends TagRef {
  count: number;
  out: number;
  in: number;
}

/**
 * A transaction's tag group: shows it as a chip, or "+ Tag" when there is none.
 * Click, type a name (say "Rent"), and the existing groups with that name are
 * listed by month and amount to pick from, or start a new one for this entry's
 * month. Works on any transaction, transfers included.
 */
export default function TagChip({
  id,
  tag,
  date,
  className = '',
}: {
  id: string;
  tag?: TagRef;
  /** The entry's own date: a brand-new group is created for this month. */
  date: string;
  className?: string;
}) {
  const setTag = useTransactionStore((s) => s.setTag);
  const [editing, setEditing] = useState(false);
  // The detail panel holds its own copy of the transaction, so keep the saved value here.
  const [current, setCurrent] = useState<TagRef | null>(tag ?? null);
  const [value, setValue] = useState('');
  const [groups, setGroups] = useState<TagGroup[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    api
      .get('/transactions/tags')
      .then(({ data }) => setGroups(data.tags ?? []))
      .catch(() => { /* the picker just has nothing to suggest */ });
  }, [editing]);

  const save = async (choice: TagChoice) => {
    setSaving(true);
    try {
      setCurrent(await setTag(id, choice));
      setEditing(false);
    } catch {
      // handled by store
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setValue(current?.name ?? ''); setEditing(true); }}
        className={`${className} ${current ? '' : 'opacity-70'}`}
        title={current ? 'Change tag' : 'Add a tag'}
      >
        {current ? `# ${current.name} · ${monthShort(current.month)}` : '+ Tag'}
      </button>
    );
  }

  const typed = value.trim();
  const entryMonth = (() => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })();
  const matches = groups.filter((g) => !typed || g.name.toLowerCase().includes(typed.toLowerCase()));
  // Offer a new group unless that exact name + month already exists.
  const exists = groups.some((g) => g.name.toLowerCase() === typed.toLowerCase() && g.month === entryMonth);

  return (
    <span className="flex w-full basis-full flex-col gap-2 py-1">
      <span className="flex items-center gap-2">
        <input
          autoFocus
          value={value}
          maxLength={40}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && typed && !exists) save({ name: typed });
            if (e.key === 'Escape') setEditing(false);
          }}
          placeholder="Tag name, e.g. Rent"
          aria-label="Tag"
          className="t-input min-w-0 flex-1"
        />
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="shrink-0 rounded-md px-2 py-1.5 text-sm font-medium text-[var(--c-muted)] hover:bg-[var(--c-surface2)]"
        >
          Cancel
        </button>
      </span>

      <span className="flex flex-col gap-1">
        {matches.map((g) => (
          <button
            key={g._id}
            type="button"
            disabled={saving}
            onClick={() => save({ tagId: g._id })}
            className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm hover:bg-[var(--c-surface2)] ${
              current?._id === g._id ? 'border-[var(--c-accent)]' : 'border-[var(--c-border)]'
            }`}
          >
            <span className="font-semibold text-[var(--c-text)]"># {g.name} · {monthShort(g.month)}</span>
            <span className="text-xs text-[var(--c-muted)]">
              <Amount value={g.out || g.in} /> · {g.count} {g.count === 1 ? 'entry' : 'entries'}
            </span>
          </button>
        ))}
        {typed && !exists && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ name: typed })}
            className="rounded-lg border border-dashed border-[var(--c-border)] px-3 py-2 text-left text-sm font-semibold text-[var(--c-accent)] hover:bg-[var(--c-surface2)]"
          >
            + New “{typed}” for {monthShort(entryMonth)}
          </button>
        )}
        {current && (
          <button
            type="button"
            disabled={saving}
            onClick={() => save({})}
            className="px-1 py-1 text-left text-xs text-[var(--c-muted)] hover:text-[var(--c-expense)]"
          >
            Remove from # {current.name} · {monthShort(current.month)}
          </button>
        )}
      </span>
    </span>
  );
}
