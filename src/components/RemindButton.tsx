import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import ShareCard from './ShareCard';
import CartoonIcon from './CartoonIcon';
import useAuthStore from '../store/authStore';
import { getUpiId, type ShareLine } from '../utils/shareLines';
import { prefersReducedMotion } from '../utils/motion';

const nextPaint = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

/**
 * "Remind": makes the share card as a PNG (pixelRatio 2) and shares it with the
 * Web Share API when the device can share files; otherwise downloads the PNG and
 * copies the text. The text carries a UPI deep link when a UPI ID is saved in Settings.
 * While it works the button shows a little receipt sliding out.
 */
export default function RemindButton({ friend, amount, lines, dateLabel, className = 'rcpt-pill' }: {
  friend: string; amount: number; lines: ShareLine[]; dateLabel: string; className?: string;
}) {
  // First name only: the card and the message read better than a long full name.
  const you = (useAuthStore((s) => s.user?.name) ?? 'me').trim().split(/\s+/)[0];
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const upi = getUpiId();
  const money = `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

  const run = async () => {
    setBusy(true);
    await nextPaint(); // let the (off-screen) card render before we photograph it
    const link = upi ? `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent(you)}&am=${amount}&cu=INR&tn=${encodeURIComponent('Split bill')}` : '';
    const text = `Hi ${friend}, you owe me ${money}${link ? `. Pay here: ${link}` : '.'}`;
    try {
      const node = cardRef.current!;
      const url = await toPng(node, { pixelRatio: 2, cacheBust: true }).catch(() => toPng(node, { pixelRatio: 2, skipFonts: true }));
      const file = new File([await (await fetch(url)).blob()], `reminder-${friend}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = file.name; a.click();
        await navigator.clipboard.writeText(text).catch(() => {});
        toast.success('Card saved and the message copied — paste both into WhatsApp');
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        await navigator.clipboard.writeText(text).catch(() => {});
        toast.error('Could not make the picture — the message is copied instead');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className={className} onClick={run} disabled={busy}>
        {busy ? (
          <span className="remind-printing">
            <motion.span animate={prefersReducedMotion() ? {} : { y: [-10, 0, -10] }} transition={{ duration: 0.9, repeat: Infinity }} style={{ display: 'inline-flex' }}>
              <CartoonIcon kind="receipt" size={16} />
            </motion.span>
            Printing…
          </span>
        ) : `Remind ${friend}`}
      </button>
      {busy && createPortal(
        <div className="sharecard-stage" aria-hidden>
          <ShareCard ref={cardRef} friend={friend} you={you} amount={amount} lines={lines} date={dateLabel} hasUpi={!!upi} />
        </div>,
        document.body,
      )}
    </>
  );
}
