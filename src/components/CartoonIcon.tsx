import type { CSSProperties } from 'react';
import { kindTint } from '../utils/cartoonKinds';

// Every drawn icon from the cartoon handoff (64×64 viewBox), keyed by file name.
const ICON_URLS = import.meta.glob('../assets/cartoon/*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const ICONS: Record<string, string> = Object.fromEntries(
  Object.entries(ICON_URLS).map(([path, url]) => [path.split('/').pop()!.replace('.svg', ''), url]),
);

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
      src={ICONS[kind] ?? ICONS.tag}
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
