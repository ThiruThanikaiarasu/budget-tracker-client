import type { ReactNode } from 'react';
import useThemeStore from '../store/themeStore';
import CartoonIcon from './CartoonIcon';

/** True while the illustrated Cartoon theme is active. */
export const useIsCartoon = () => useThemeStore((s) => s.theme === 'cartoon');

/** Kicker + big display title with optional action buttons on the right. */
export function CartoonHead({ kicker, title, actions }: { kicker: string; title: string; actions?: ReactNode }) {
  return (
    <div className="cartoon-head">
      <div className="min-w-0">
        <p className="cartoon-kicker">{kicker}</p>
        <h1 className="cartoon-title">{title}</h1>
      </div>
      {actions && <div className="cartoon-head-actions">{actions}</div>}
    </div>
  );
}

/** Rotated label sticker (NEW, CARD DUES, SYSTEM, ...). */
export function Sticker({ children, tone = 'spend', tilt = -4 }: { children: ReactNode; tone?: 'spend' | 'earn' | 'grape' | 'sun' | 'sky'; tilt?: number }) {
  return <span className={`cartoon-sticker-tag is-${tone}`} style={{ transform: `rotate(${tilt}deg)` }}>{children}</span>;
}

const FACE_KINDS = ['face', 'face2', 'face3'];
const FACE_TINTS = ['#FFF0C2', '#DDF3E2', '#DDF3FF', '#E4DAFF', '#FFE1DB', '#F9E3EE'];

/** Round drawn face for a person; the same name always gets the same face and tint. */
export function FaceAvatar({ name, size = 56 }: { name: string; size?: number }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span className="cartoon-face" style={{ width: size, height: size, background: FACE_TINTS[h % FACE_TINTS.length] }}>
      <CartoonIcon kind={FACE_KINDS[h % FACE_KINDS.length]} size={Math.round(size * 0.78)} />
    </span>
  );
}
