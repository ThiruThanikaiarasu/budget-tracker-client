import { useState } from 'react';
import type { Unit } from '../store/unitGroupStore';

/**
 * Pick a unit (only the ones given — e.g. Tomato: g / kg) and a quantity from
 * that unit's quick values, or type a custom amount.
 */
export default function QuantityPicker({ units, presetsOf, unitId, quantity, onChange, label }: {
  units: Unit[];
  presetsOf: (unit: Unit) => number[];
  unitId?: string;
  quantity?: number;
  onChange: (value: { unitId?: string; quantity?: number }) => void;
  /** Accessible name prefix, e.g. the item name. */
  label?: string;
}) {
  const unit = units.find((u) => u._id === unitId) ?? units[0];
  const presets = unit ? presetsOf(unit) : [];
  // Local text so "0." / "" can be typed; the parent only sees numbers.
  const [text, setText] = useState(quantity ? String(quantity) : '');
  const [lastQuantity, setLastQuantity] = useState(quantity);
  if (quantity !== lastQuantity) {
    setLastQuantity(quantity);
    if ((parseFloat(text) || undefined) !== quantity) setText(quantity ? String(quantity) : '');
  }

  const chip = (active: boolean) => ({
    background: active ? 'var(--c-accent)' : 'var(--c-surface2)',
    color: active ? 'var(--c-accent-fg)' : 'var(--c-text)',
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {units.length > 1 && (
        <div className="flex rounded-full p-0.5" style={{ background: 'var(--c-surface2)' }} role="radiogroup" aria-label={`${label ?? ''} unit`}>
          {units.map((u) => (
            <button
              key={u._id}
              type="button"
              role="radio"
              aria-checked={u._id === unit?._id}
              onClick={() => onChange({ unitId: u._id, quantity })}
              className="text-xs font-semibold rounded-full px-2.5 py-0.5"
              style={u._id === unit?._id ? chip(true) : { color: 'var(--c-muted)' }}
            >
              {u.name}
            </button>
          ))}
        </div>
      )}
      {presets.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onChange({ unitId: unit?._id, quantity: p })}
          className="text-xs rounded-full px-2.5 py-1"
          style={chip(quantity === p)}
        >
          {p}{units.length === 1 ? ` ${unit?.name}` : ''}
        </button>
      ))}
      <input
        value={text}
        onChange={(e) => {
          const v = e.target.value.replace(/[^0-9.]/g, '');
          setText(v);
          onChange({ unitId: unit?._id, quantity: parseFloat(v) || undefined });
        }}
        inputMode="decimal"
        placeholder="Custom"
        aria-label={`${label ?? ''} quantity`}
        className="t-input text-xs py-1"
        style={{ width: '5rem' }}
      />
      {units.length === 1 && <span className="text-xs" style={{ color: 'var(--c-muted)' }}>{unit?.name}</span>}
    </div>
  );
}
