import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import CartoonIcon from './CartoonIcon';
import type { PiggyMoodKind } from '../utils/piggy';

/**
 * The budget piggy. Moods swap with a squash and a crossfade (never a hard cut):
 * chilling bobs, getting-full puffs up and sweats, cracked shakes once with a
 * crack drawing in and a bandage, proud twinkles. Honours "reduce motion".
 */
export default function PiggyMood({ mood, size = 96 }: { mood: PiggyMoodKind; size?: number }) {
  const reduced = !!useReducedMotion();
  const body = {
    chilling: reduced ? {} : { y: [0, -3, 0] },
    full: { scale: 1.08 },
    cracked: reduced ? {} : { x: [0, -4, 4, -3, 0] },
    proud: {},
  }[mood];
  const loop = mood === 'chilling' && !reduced
    ? { y: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const } }
    : { duration: 0.45 };

  return (
    <div className="piggy" style={{ width: size, height: size, position: 'relative' }} title={`Piggy is ${mood}`}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={mood}
          initial={{ opacity: 0, scaleY: 0.88, scaleX: 1.08 }}
          animate={{ opacity: 1, scaleY: 1, scaleX: 1, ...body }}
          exit={{ opacity: 0 }}
          transition={loop}
          style={{ position: 'absolute', inset: 0 }}
        >
          <CartoonIcon kind="budgets" size={size} />
          <svg viewBox="0 0 100 100" width={size} height={size} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden>
            {mood === 'full' && (
              <motion.path
                d="M78 26 q5 8 0 11 q-5 -3 0 -11z" fill="#6EC1F5" stroke="#1E1B18" strokeWidth="2.5"
                animate={reduced ? {} : { y: [0, 26], opacity: [0, 1, 0] }}
                transition={{ duration: 1, repeat: Infinity, repeatDelay: 2 }}
              />
            )}
            {mood === 'cracked' && (
              <>
                <motion.path
                  d="M34 22 L42 36 L33 46 L44 58" fill="none" stroke="#1E1B18" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.3, delay: 0.1 }}
                />
                <motion.rect
                  x="52" y="58" width="22" height="9" rx="3" fill="#FFE3A8" stroke="#1E1B18" strokeWidth="2.5" transform="rotate(-18 63 62)"
                  initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}
                />
              </>
            )}
            {mood === 'proud' && [[20, 24, 0], [82, 18, 0.5], [74, 56, 1]].map(([x, y, d], i) => (
              <motion.path
                key={i}
                d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2}Z`}
                fill="#FFC83D" stroke="#1E1B18" strokeWidth="2"
                animate={reduced ? {} : { scale: [0.6, 1.2, 0.6], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: d as number }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            ))}
          </svg>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
