import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import useThemeStore from '../store/themeStore';
import CartoonIcon from './CartoonIcon';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Values are 'YYYY-MM-DD' strings (what <input type="date"> used), always in
// local time — never through Date.parse, which would read them as UTC.
const pad = (n: number) => String(n).padStart(2, '0');
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function fromValue(value?: string): Date | undefined {
  const m = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : undefined;
}
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a?: Date, b?: Date) => !!a && !!b && toValue(a) === toValue(b);

/**
 * Calendar date picker that looks the same in every browser (the native
 * <input type="date"> popup differs per engine). Keyboard: arrows move,
 * PageUp/PageDown change month, Enter picks, Escape closes.
 */
export default function DatePicker({ value, onChange, inline, className = 't-input', placeholder = 'Pick a date' }: {
  value?: string;
  onChange: (value: string) => void;
  /** Open in the page flow instead of floating — for containers that clip overflow. */
  inline?: boolean;
  className?: string;
  placeholder?: string;
}) {
  const isCartoon = useThemeStore((st) => st.theme === 'cartoon');
  const selected = fromValue(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'days' | 'months'>('days');
  // The keyboard-highlighted day; its month is the month on screen.
  const [cursor, setCursor] = useState<Date>(selected ?? today);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Open towards the left when the popup would run past the edge of the area
  // it sits in (e.g. from the right-hand Date box) — otherwise it widens the
  // scroll area and the whole form jumps sideways.
  const [alignRight, setAlignRight] = useState(false);
  useLayoutEffect(() => {
    if (!open || inline) { setAlignRight(false); return; }
    const panel = panelRef.current;
    if (!panel) return;
    let clip: HTMLElement | null = panel.parentElement;
    while (clip && !/(auto|scroll|hidden)/.test(getComputedStyle(clip).overflowX)) clip = clip.parentElement;
    const edge = clip ? clip.getBoundingClientRect().right : window.innerWidth;
    setAlignRight(panel.getBoundingClientRect().left + panel.offsetWidth > edge - 8);
  }, [open, inline]);

  const openPicker = () => {
    setCursor(selected ?? today);
    setView('days');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Keep focus on the panel so the keyboard works right after opening.
  useEffect(() => { if (open) gridRef.current?.focus({ preventScroll: true }); }, [open, view]);

  // Inside a scrolling container (the transaction modal) the panel can open
  // below the visible area — scroll just enough to show all of it.
  useEffect(() => { if (open) panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [open]);

  const pick = (d: Date) => { onChange(toValue(d)); setOpen(false); };

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const shiftMonth = (n: number) => {
    // Clamp the day so Jan 31 → Feb 28 rather than rolling into March.
    const last = new Date(year, month + n + 1, 0).getDate();
    setCursor(new Date(year, month + n, Math.min(cursor.getDate(), last)));
  };

  const first = new Date(year, month, 1);
  const days = Array.from({ length: 42 }, (_, i) => addDays(first, i - first.getDay()));

  const onKeyDown = (e: KeyboardEvent) => {
    const moves: Record<string, () => void> = view === 'days'
      ? {
          ArrowLeft: () => setCursor(addDays(cursor, -1)),
          ArrowRight: () => setCursor(addDays(cursor, 1)),
          ArrowUp: () => setCursor(addDays(cursor, -7)),
          ArrowDown: () => setCursor(addDays(cursor, 7)),
          PageUp: () => shiftMonth(e.shiftKey ? -12 : -1),
          PageDown: () => shiftMonth(e.shiftKey ? 12 : 1),
          Enter: () => pick(cursor),
        }
      : {
          ArrowLeft: () => shiftMonth(-1),
          ArrowRight: () => shiftMonth(1),
          ArrowUp: () => shiftMonth(-3),
          ArrowDown: () => shiftMonth(3),
          Enter: () => setView('days'),
        };
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    // stopPropagation keeps page-level shortcuts (the amount numpad) out of it.
    if (moves[e.key]) { e.preventDefault(); e.stopPropagation(); moves[e.key](); }
  };

  const label = selected
    ? selected.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const yesterday = addDays(today, -1);
  const navBtn = 'w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--c-surface)]';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`${className} w-full`}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', textAlign: 'left' }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="truncate" style={label ? undefined : { color: 'var(--c-muted)' }}>{label || placeholder}</span>
        {isCartoon ? <CartoonIcon kind="calendar" size={26} /> : (
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--c-muted)' }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>)}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose date"
          data-datepicker
          className={inline ? 'mt-2 w-full max-w-xs rounded-xl p-2.5' : 'absolute z-50 mt-2 w-72 rounded-xl p-2.5 shadow-lg'}
          style={{
            background: 'var(--c-surface2)', border: '1px solid var(--c-border)', color: 'var(--c-text)',
            ...(inline ? {} : alignRight ? { top: '100%', right: 0 } : { top: '100%', left: 0 }),
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <button
              type="button"
              onClick={() => setView(view === 'days' ? 'months' : 'days')}
              className="flex items-center gap-1 text-sm font-semibold rounded-lg px-2 py-1 hover:bg-[var(--c-surface)]"
            >
              {view === 'days' ? `${MONTHS[month]} ${year}` : year}
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: view === 'months' ? 'rotate(180deg)' : undefined }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            <div className="flex">
              <button type="button" className={navBtn} onClick={() => shiftMonth(view === 'days' ? -1 : -12)} aria-label={view === 'days' ? 'Previous month' : 'Previous year'}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
              </button>
              <button type="button" className={navBtn} onClick={() => shiftMonth(view === 'days' ? 1 : 12)} aria-label={view === 'days' ? 'Next month' : 'Next year'}>
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </div>

          <div ref={gridRef} tabIndex={-1} onKeyDown={onKeyDown} className="outline-none">
            {view === 'days' ? (
              <div className="grid grid-cols-7 gap-0.5 text-center">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="text-[10px] uppercase tracking-wider py-0.5" style={{ color: 'var(--c-muted)' }}>{w}</span>
                ))}
                {days.map((d) => {
                  const isSelected = sameDay(d, selected);
                  const isToday = sameDay(d, today);
                  const outside = d.getMonth() !== month;
                  const isCursor = sameDay(d, cursor);
                  return (
                    <button
                      key={toValue(d)}
                      type="button"
                      tabIndex={-1}
                      onClick={() => pick(d)}
                      onMouseEnter={() => { if (d.getMonth() === month && d.getFullYear() === year) setCursor(d); }}
                      aria-label={d.toDateString()}
                      aria-pressed={isSelected}
                      className="h-8 rounded-full text-sm tabular-nums"
                      style={{
                        background: isSelected ? 'var(--c-accent)' : isCursor ? 'var(--c-surface)' : 'transparent',
                        color: isSelected ? 'var(--c-accent-fg)' : outside ? 'var(--c-muted)' : 'var(--c-text)',
                        opacity: outside && !isSelected ? 0.5 : 1,
                        fontWeight: isSelected || isToday ? 600 : 400,
                        boxShadow: isToday && !isSelected ? 'inset 0 0 0 1px var(--c-accent)' : undefined,
                      }}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {MONTHS.map((m, i) => {
                  const isSelected = !!selected && selected.getFullYear() === year && selected.getMonth() === i;
                  return (
                    <button
                      key={m}
                      type="button"
                      tabIndex={-1}
                      onClick={() => { shiftMonth(i - month); setView('days'); }}
                      className="h-10 rounded-lg text-sm"
                      style={{
                        background: isSelected ? 'var(--c-accent)' : i === month ? 'var(--c-surface)' : 'transparent',
                        color: isSelected ? 'var(--c-accent-fg)' : 'var(--c-text)',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {m.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-1.5 mt-2 pt-2" style={{ borderTop: '1px solid var(--c-border)' }}>
            {[{ label: 'Today', d: today }, { label: 'Yesterday', d: yesterday }].map(({ label: l, d }) => (
              <button
                key={l}
                type="button"
                onClick={() => pick(d)}
                className="text-xs rounded-full px-3 py-1"
                style={{
                  background: sameDay(d, selected) ? 'var(--c-accent)' : 'var(--c-surface)',
                  color: sameDay(d, selected) ? 'var(--c-accent-fg)' : 'var(--c-text)',
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
