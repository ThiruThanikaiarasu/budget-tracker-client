import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { normalizeName } from '../utils/normalizeName';

export interface SelectItem {
  value: string;
  label: string;
  /** Small drawing/icon shown before the label. */
  icon?: ReactNode;
  /** Muted text at the end of the row (a balance, a count…). */
  hint?: string;
}

/** Lists longer than this get a search box (focused as soon as it opens). */
const SEARCH_FROM = 5;

/**
 * A dropdown that follows the theme (the browser's own <select> can't).
 * Same look as the account and category pickers in the transaction form.
 */
export default function ThemedSelect({
  value, onChange, options, placeholder = 'Select', disabled, className = '', ariaLabel, triggerClassName = 't-select w-full',
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectItem[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Classes for the button (default: the form-field look; pass a chip class for chips). */
  triggerClassName?: string;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Popover className={`relative ${className}`}>
      {({ close }) => (
        <>
          <PopoverButton
            aria-label={ariaLabel}
            disabled={disabled}
            className={triggerClassName}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}
          >
            {selected ? (
              <span className="flex items-center gap-2 truncate">
                {selected.icon && <span className="transaction-select-icon">{selected.icon}</span>}
                <span className="truncate">{selected.label}</span>
              </span>
            ) : (
              <span style={{ color: 'var(--c-muted)' }}>{placeholder}</span>
            )}
            <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </PopoverButton>
          <PopoverPanel
            anchor="bottom start"
            className="cartoon-select-panel themed-select-panel z-[70] mt-2 w-max min-w-[var(--button-width)] max-w-[20rem] rounded-xl shadow-lg outline-none focus:outline-none"
            style={{ background: 'var(--c-surface2)', border: '1px solid var(--c-border)', '--anchor-max-height': '22rem' } as CSSProperties}
          >
            <Options options={options} value={value} onPick={(v) => { onChange(v); close(); }} />
          </PopoverPanel>
        </>
      )}
    </Popover>
  );
}

/** The open list: a search box (long lists) and the options, arrow keys + Enter. */
function Options({ options, value, onPick }: { options: SelectItem[]; value: string; onPick: (v: string) => void }) {
  const [query, setQuery] = useState('');
  const term = normalizeName(query);
  const shown = term ? options.filter((o) => normalizeName(o.label).includes(term)) : options;
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));
  const current = Math.min(active, shown.length - 1);
  const listRef = useRef<HTMLDivElement>(null);
  const searchable = options.length > SEARCH_FROM;

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [current, shown.length]);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = shown.length;
      if (n) setActive((i) => (Math.min(i, n - 1) + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if (e.key === 'Enter' && shown[current]) {
      e.preventDefault();
      onPick(shown[current].value);
    }
  };

  return (
    <div onKeyDown={onKeyDown}>
      {searchable && (
        <div className="cartoon-select-search p-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            placeholder="Search…"
            className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
            style={{ background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
          />
        </div>
      )}
      <div ref={listRef} className="p-1.5 space-y-0.5 overflow-y-auto" style={{ maxHeight: '16rem' }}>
        {shown.length === 0 && <p className="px-3 py-2 text-sm" style={{ color: 'var(--c-muted)' }}>No results</p>}
        {shown.map((o, i) => (
          <button
            key={o.value}
            type="button"
            data-active={i === current}
            onClick={() => onPick(o.value)}
            onMouseMove={() => setActive(i)}
            className={`cartoon-select-opt ${i === current ? 'is-active' : ''} ${o.value === value ? 'is-on' : ''} flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm text-left`}
            style={{ background: i === current || o.value === value ? 'var(--c-surface)' : 'transparent', color: 'var(--c-text)', fontWeight: o.value === value ? 600 : 400 }}
          >
            {o.icon && <span className="transaction-select-icon">{o.icon}</span>}
            <span className="truncate">{o.label}</span>
            {o.hint && <span className="ml-auto pl-3 text-xs whitespace-nowrap" style={{ color: 'var(--c-muted)' }}>{o.hint}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
