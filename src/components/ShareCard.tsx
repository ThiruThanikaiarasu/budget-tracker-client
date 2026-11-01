import { forwardRef } from 'react';
import CartoonIcon from './CartoonIcon';
import { FaceAvatar } from './cartoon';
import { itemKind } from '../utils/cartoonKinds';
import type { ShareLine } from '../utils/shareLines';

const TINTS = ['#6EC1F5', '#9FD3A5', '#F5B8D0', '#C9B8F5', '#FFC83D', '#F5A98A'];
export const tintFor = (name: string) => {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
};

/** The picture sent on WhatsApp: who owes whom, what for, and a Pay button. 380px wide, in the friend's colour. */
const ShareCard = forwardRef<HTMLDivElement, {
  friend: string; you: string; amount: number; lines: ShareLine[]; date: string; hasUpi: boolean;
}>(function ShareCard({ friend, you, amount, lines, date, hasUpi }, ref) {
  const money = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  return (
    <div ref={ref} className="sharecard" style={{ background: tintFor(friend) }}>
      <div className="sharecard-top"><span><CartoonIcon kind="wallet" size={26} /> Budget Tracker</span><span>{date}</span></div>
      <div className="sharecard-faces">
        <FaceAvatar name={friend} size={92} />
        <span className="sharecard-mid"><CartoonIcon kind="coins" size={40} /><b>→</b></span>
        <FaceAvatar name={you} size={92} />
      </div>
      <p className="sharecard-line">{friend}, you owe {you}</p>
      <p className="sharecard-amount">{money(amount)}</p>
      <div className="sharecard-lines">
        {lines.slice(0, 6).map((l, i) => (
          <div key={i} className="sharecard-item">
            <CartoonIcon kind={itemKind(l.name) ?? 'items'} size={22} />
            <span>{l.name}</span>
            <em>{l.how}</em>
            <b>{money(l.amount)}</b>
          </div>
        ))}
        {lines.length > 6 && <p className="sharecard-more">+ {lines.length - 6} more</p>}
      </div>
      <div className="sharecard-pay">{hasUpi ? `Pay ${money(amount)} on UPI` : `Please settle ${money(amount)}`}</div>
    </div>
  );
});
export default ShareCard;
