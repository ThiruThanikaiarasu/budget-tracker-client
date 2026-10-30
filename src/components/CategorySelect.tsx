import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { renderCategoryIcon } from '../utils/categoryIcons';
import { normalizeName } from '../utils/normalizeName';

type CategoryOption = { _id: string; name: string; icon: string; type?: string };

/**
 * Category dropdown with icons and a search box. Used by the transaction form
 * and the Items page.
 */
export default function CategorySelect({
  categories, value, onChange, onSearchFocusChange, allLabel, placeholder = 'Select', grouped, inline, compact, defaultOpen, onClose,
}: {
  categories: CategoryOption[];
  value: string;
  onChange: (id: string) => void;
  onSearchFocusChange?: (focused: boolean) => void;
  /** Adds a top option with value '' (e.g. "All categories"). */
  allLabel?: string;
  placeholder?: string;
  /** Show Expense / Income section headings (needs `type` on each category). */
  grouped?: boolean;
  /** Open the list in the page flow (pushing content down) instead of
   *  floating — for containers that clip overflow, like small modals. */
  inline?: boolean;
  /** Trigger shows just the icon (the list still opens wide) — for tight rows. */
  compact?: boolean;
  /** Start with the list open (the caller opened this on purpose). */
  defaultOpen?: boolean;
  /** Called when the list closes without a pick (outside click / Escape). */
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Keyboard-highlighted option; the first match by default.
  const [active, setActive] = useState(0);
  const selected = categories.find(c => c._id === value);

  // Case- and space-insensitive, same as the duplicate checks.
  const term = normalizeName(query);
  const filtered = term === ''
    ? categories
    : categories.filter(c => normalizeName(c.name).includes(term));
  const sections = grouped
    ? [
        { label: 'Expense', items: filtered.filter(c => c.type === 'expense') },
        { label: 'Income', items: filtered.filter(c => c.type === 'income') },
      ].filter(s => s.items.length > 0)
    : [{ label: '', items: filtered }];
  // Options in display order, for arrow keys / Tab / Enter.
  const optionIds = [
    ...(allLabel && term === '' ? [''] : []),
    ...sections.flatMap(s => s.items.map(c => c._id)),
  ];
  const activeId = optionIds[Math.min(active, optionIds.length - 1)];

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 10);
      return () => clearTimeout(t);
    }
    // The search input is only ever focused while the panel is open, so
    // closing the panel is equivalent to the search field losing focus.
    onSearchFocusChange?.(false);
  }, [open, onSearchFocusChange]);

  // If the picker disappears while open (the pick replaced it), the search is no longer focused.
  useEffect(() => () => { onSearchFocusChange?.(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (id: string) => { onChange(id); setOpen(false); setQuery(''); };

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [activeId]);

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const n = optionIds.length;
      if (n) setActive(i => (Math.min(i, n - 1) + (e.key === 'ArrowDown' ? 1 : n - 1)) % n);
    } else if ((e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) && activeId !== undefined) {
      // Tab/Enter take the highlighted match straight away — no second Enter.
      e.preventDefault();
      pick(activeId);
      buttonRef.current?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false); setQuery('');
      onClose?.();
      buttonRef.current?.focus();
    }
  };

  const option = (id: string, label: string, icon?: { icon: string; name: string }) => (
    <button
      key={id || '__all'}
      type="button"
      tabIndex={-1}
      data-active={id === activeId}
      onClick={() => pick(id)}
      onMouseMove={() => setActive(optionIds.indexOf(id))}
      className={`cartoon-select-opt ${id === activeId ? 'is-active' : ''} ${id === value ? 'is-on' : ''} flex w-full items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer text-left`}
      style={{
        background: id === activeId || id === value ? 'var(--c-surface)' : 'transparent',
        boxShadow: id === activeId ? 'inset 0 0 0 1px var(--c-border)' : undefined,
        color: 'var(--c-text)',
        fontWeight: id === value ? 600 : 400,
      }}
    >
      {icon && <span className="transaction-select-icon">{renderCategoryIcon(icon.icon, icon.name, 22)}</span>}
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => { if (!open) setActive(Math.max(0, optionIds.indexOf(value))); setOpen(v => !v); }}
        className="t-select w-full"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: compact ? 'center' : 'space-between', gap: compact ? '0.25rem' : '0.5rem',
          ...(compact ? { paddingLeft: 8, paddingRight: 8 } : {}),
        }}
      >
        {selected ? (
          <span className={`flex items-center gap-2 ${compact ? '' : 'truncate'}`} title={compact ? selected.name : undefined}>
            <span className="transaction-select-icon">{renderCategoryIcon(selected.icon, selected.name, 22)}</span>
            {!compact && <span className="truncate">{selected.name}</span>}
          </span>
        ) : allLabel && value === '' ? (
          <span className="truncate">{allLabel}</span>
        ) : (
          <span style={{ color: 'var(--c-muted)' }}>{placeholder}</span>
        )}
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div
          className={`cartoon-select-panel ${inline ? 'mt-2 w-full rounded-xl' : 'absolute z-50 mt-2 w-full rounded-xl shadow-lg'}`}
          style={{
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)',
            ...(inline ? {} : { top: '100%', left: 0 }),
            ...(compact ? { width: '16rem', maxWidth: '80vw' } : {}),
          }}
        >
          <div className="cartoon-select-search p-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setActive(0); }}
              onKeyDown={onSearchKeyDown}
              onFocus={() => onSearchFocusChange?.(true)}
              placeholder="Search category..."
              className="w-full rounded-lg px-3 py-1.5 text-sm outline-none"
              style={{ background: 'var(--c-surface)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
            />
          </div>
          {/* Inline lists get a fixed height so filtering doesn't resize the
              surrounding container (which made centred modals jump). */}
          <div ref={listRef} className="p-1.5 space-y-0.5 overflow-y-auto" style={inline ? { height: '14rem' } : { maxHeight: '14rem' }}>
            {allLabel && term === '' && option('', allLabel)}
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-sm" style={{ color: 'var(--c-muted)' }}>No results</p>
            ) : sections.map(section => (
              <div key={section.label || 'all'} className="space-y-0.5">
                {section.label && (
                  <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-muted)' }}>
                    {section.label}
                  </p>
                )}
                {section.items.map(c => option(c._id, c.name, c))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
