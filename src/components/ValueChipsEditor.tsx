import { useState } from 'react';

/**
 * Edit a list of numbers as chips: "100 ×  250 ×  [ 750 ] +". Values stay
 * sorted and unique.
 */
export default function ValueChipsEditor({ values, onChange, suffix, label }: {
  values: number[];
  onChange: (values: number[]) => void;
  /** Shown after each value, e.g. the unit name. */
  suffix?: string;
  /** Accessible name for the add box, e.g. "g quick values". */
  label?: string;
}) {
  const [text, setText] = useState('');
  const value = parseFloat(text);
  const canAdd = value > 0 && !values.includes(value);

  const add = () => {
    if (canAdd) onChange([...values, value].sort((a, b) => a - b));
    setText('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 text-xs rounded-full pl-2.5 pr-1 py-0.5"
          style={{ background: 'var(--c-surface2)', color: 'var(--c-text)' }}>
          {v}{suffix ? ` ${suffix}` : ''}
          <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}
            aria-label={`Remove ${v}`} className="leading-none px-1" style={{ color: 'var(--c-muted)' }}>×</button>
        </span>
      ))}
      <span className="inline-flex items-center rounded-full overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value.replace(/[^0-9.]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          inputMode="decimal"
          placeholder="Add"
          aria-label={label ?? 'Add value'}
          className="text-xs px-2.5 py-0.5 outline-none bg-transparent"
          style={{ width: '4rem', color: 'var(--c-text)' }}
        />
        <button type="button" onClick={add} disabled={!canAdd} aria-label="Add value"
          className="text-sm font-bold px-2 disabled:opacity-30"
          style={{ background: 'var(--c-accent)', color: 'var(--c-accent-fg)' }}>+</button>
      </span>
    </div>
  );
}
