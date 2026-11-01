import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { animate } from 'motion';
import CartoonIcon from './CartoonIcon';
import { buzz, prefersReducedMotion } from '../utils/motion';

const COINS = 10;

const makeCoins = () => Array.from({ length: COINS }, (_, i) => {
  const angle = (i / COINS) * Math.PI * 2 + Math.random() * 0.6;
  const dist = 40 + Math.random() * 50;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, spin: (Math.random() - 0.5) * 360 };
});

/**
 * "ALL SQUARE": a rubber stamp drops in (scale 2.2 → 1, slight overshoot, -8°),
 * the page shakes 3px for 120ms and coins burst out and fall. Purely decorative:
 * it never blocks a click and removes itself after 1.6s via `onDone`.
 */
export default function StampBurst({ onDone, label = 'ALL SQUARE' }: { onDone: () => void; label?: string }) {
  const reduced = prefersReducedMotion();
  // Random but fixed for this burst: direction, distance (40-90px) and a little spin.
  const [coins] = useState(makeCoins);

  useEffect(() => {
    buzz(20);
    if (!reduced) {
      // Impact shake on the page content, 3px for 120ms.
      const page = document.querySelector('main');
      if (page) animate(page, { x: [0, -3, 3, -2, 0] }, { duration: 0.12, delay: 0.18 });
    }
    const t = window.setTimeout(onDone, 1600);
    return () => window.clearTimeout(t);
  }, [onDone, reduced]);

  return (
    <div className="stamp-layer" aria-hidden>
      <div className="stamp-spot">
        {!reduced && coins.map((c, i) => (
          <motion.span
            key={i} className="stamp-coin"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4, rotate: 0 }}
            animate={{ x: c.x, y: [0, c.y - 20, c.y + 50], opacity: [0, 1, 0], scale: [0.4, 1, 0.8], rotate: c.spin }}
            transition={{ duration: 0.7, delay: 0.22, ease: 'easeOut' }}
          >
            <CartoonIcon kind="coins" size={26} />
          </motion.span>
        ))}
        <motion.div
          className="stamp"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 2.2, rotate: -8 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: [2.2, 0.9, 1], rotate: -8 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.22, ease: 'easeOut' }}
        >
          {label}
        </motion.div>
      </div>
    </div>
  );
}
