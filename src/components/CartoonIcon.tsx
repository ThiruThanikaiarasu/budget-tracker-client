import type { CSSProperties } from 'react';
import { kindTint } from '../utils/cartoonKinds';

// Every drawn icon from the cartoon handoff (64×64 viewBox), keyed by file name.
const ICON_URLS = import.meta.glob('../assets/cartoon/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(ICON_URLS).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]),
);

// New icons named before their files land: until then, show what they used to.
const STAND_IN: Record<string, string> = {
  lent: 'coins', borrowed: 'coins', 'paid-back': 'coins', 'got-back': 'coins',
  'apple-music': 'subscription', netflix: 'subscription', other: 'tag',
};
const url = (kind: string) => ICONS[kind] ?? ICONS[STAND_IN[kind]] ?? ICONS.tag;

/** The image URL of a drawn icon (for effects that need their own copy of it). */
export const iconUrl = (kind: string) => url(kind);

/** One drawn icon from the cartoon kit. Unknown kinds fall back to the tag. */
export default function CartoonIcon({ kind, size = 28, className, style, label }: {
  kind: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
  label?: string;
}) {
  return (
    <img
      src={url(kind)}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      draggable={false}
      className={className}
      style={{ flexShrink: 0, ...style }}
    />
  );
}

/** The tinted square tile holding a category's drawn icon. */
export function CartoonTile({ kind, size = 40, className = '' }: { kind: string; size?: number; className?: string }) {
  return (
    <span className={`cartoon-tile ${className}`} style={{ width: size, height: size, background: kindTint(kind) }}>
      <CartoonIcon kind={kind} size={Math.round(size * 0.72)} />
    </span>
  );
}
