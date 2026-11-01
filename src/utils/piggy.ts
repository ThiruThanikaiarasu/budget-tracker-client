export type PiggyMoodKind = 'chilling' | 'full' | 'cracked' | 'proud';

/** What the piggy feels, from how much of the budget is used (a finished cycle under budget is "proud"). */
export function piggyMood(spent: number, limit: number | null, cycleEnded: boolean): PiggyMoodKind {
  if (!limit) return 'chilling';
  if (spent >= limit) return 'cracked';
  if (cycleEnded) return 'proud';
  return spent / limit >= 0.5 ? 'full' : 'chilling';
}
