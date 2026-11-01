import { animate } from 'motion';
import { iconUrl } from '../components/CartoonIcon';

/** Motion rules for the whole app: respect "reduce motion", never block, never loop forever. */
export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** The default spring (stiff, a little bouncy). */
export const SPRING = { type: 'spring', stiffness: 500, damping: 28 } as const;

/** A short buzz on phones (the optional haptic; callers decide when). */
export const buzz = (ms = 10) => { try { navigator.vibrate?.(ms); } catch { /* not supported */ } };

/** Squash a button as if something landed on it, then spring back. */
export const squash = (el: Element | null | undefined) => {
  if (!el || prefersReducedMotion()) return;
  animate(el, { scaleY: [1, 0.85, 1], scaleX: [1, 1.1, 1] }, { duration: 0.32 });
};

/** Pop a badge (1 → 1.35 → 1). */
export const pop = (el: Element | null | undefined) => {
  if (!el) return;
  animate(el, { scale: prefersReducedMotion() ? [1, 1] : [1, 1.35, 1] }, { duration: 0.3 });
};

/** Flights queue 80ms apart so adding several things quickly reads as a stream. */
let nextFlight = 0;

/**
 * Fly a copy of an icon along a curved arc (peaking ~120px above the straight
 * line) from `from` to `to`, spinning and shrinking, 450ms. When it lands the
 * target squashes and `onLand` runs. The action itself has already happened;
 * this only decorates it.
 */
export function flyIcon({ kind, from, to, size = 44, onLand }: {
  kind: string;
  from: DOMRect;
  to: Element;
  size?: number;
  onLand?: () => void;
}) {
  if (prefersReducedMotion()) { onLand?.(); return; }
  const wait = Math.max(0, nextFlight - performance.now());
  nextFlight = performance.now() + wait + 80;

  window.setTimeout(() => {
    const end = to.getBoundingClientRect();
    const sx = from.left + from.width / 2 - size / 2;
    const sy = from.top + from.height / 2 - size / 2;
    const ex = end.left + end.width / 2 - size / 2;
    const ey = end.top + end.height / 2 - size / 2;
    const cx = (sx + ex) / 2;
    const cy = Math.min(sy, ey) - 120; // control point: the arc's peak
    const img = document.createElement('img');
    img.src = iconUrl(kind);
    img.width = size; img.height = size; img.alt = '';
    Object.assign(img.style, { position: 'fixed', left: '0', top: '0', zIndex: '200', pointerEvents: 'none', willChange: 'transform' });
    document.body.appendChild(img);
    animate(0, 1, {
      duration: 0.45,
      ease: 'easeInOut',
      onUpdate: (t: number) => {
        const u = 1 - t;
        const x = u * u * sx + 2 * u * t * cx + t * t * ex;
        const y = u * u * sy + 2 * u * t * cy + t * t * ey;
        img.style.transform = `translate(${x}px, ${y}px) rotate(${-15 + 35 * t}deg) scale(${1 - 0.6 * t})`;
      },
      onComplete: () => { img.remove(); squash(to); onLand?.(); },
    });
  }, wait);
}
