/** Tunable thresholds for the amount reactions (multiples of the usual spend in that category). */
export const REACTION = {
  calmBelow: 0.5,   // under half the usual: a calm tomato
  ouchAbove: 2,     // over twice the usual: a startled wallet
  sweatAbove: 5,    // over five times: sweat drops and the amount shakes once
  minSamples: 5,    // need this many earlier records to know what "usual" is
  window: 30,       // the median is taken over the latest this-many records
} as const;

export type Reaction = 'calm' | 'ouch' | 'sweat';

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** How a spend compares with the usual (median) for its category; null = unremarkable. */
export function reactionFor(amount: number, usual: number[]): Reaction | null {
  if (usual.length < REACTION.minSamples) return null;
  const ratio = amount / median(usual.slice(0, REACTION.window));
  if (ratio > REACTION.sweatAbove) return 'sweat';
  if (ratio > REACTION.ouchAbove) return 'ouch';
  if (ratio < REACTION.calmBelow) return 'calm';
  return null;
}
