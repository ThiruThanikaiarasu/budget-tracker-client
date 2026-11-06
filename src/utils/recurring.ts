/**
 * What a Category or CategoryItem stores when it repeats (see the server's
 * utils/recurring.ts). Plain recurring is a marker with the usual amount; only
 * autopay has a schedule and an account.
 */
export interface RecurringConfig {
  frequency: 'monthly' | 'yearly';
  amount: number;
  /** The app adds the entry itself on the due date. */
  autopay: boolean;
  /** Autopay only: first payment date; anchors the day of month. */
  startDate?: string;
  /** Autopay only: the next occurrence not yet added. */
  nextDue?: string;
  /** Autopay only: where the money is taken from. */
  accountId?: string;
}

/** What the forms send: the config without the server-managed `nextDue`. */
export type RecurringInput = Omit<RecurringConfig, 'nextDue'>;

/** `null` clears a schedule; leaving the field out keeps it. */
export const toRecurringInput = (r?: RecurringConfig): RecurringInput | null =>
  r
    ? {
        frequency: r.frequency,
        amount: r.amount,
        autopay: r.autopay,
        ...(r.autopay ? { startDate: r.startDate?.slice(0, 10), accountId: r.accountId } : {}),
      }
    : null;

/** One row of GET /recurring. */
export interface RecurringEntry {
  kind: 'item' | 'category';
  id: string;
  name: string;
  amount: number;
  accountId?: string;
  autopay: boolean;
  frequency: 'monthly' | 'yearly';
  nextDue?: string;
  due: boolean;
}

/** Saveable: an amount, plus a first date and an account when it autopays. */
export const recurringValid = (v: RecurringInput | null) =>
  v === null || (v.amount > 0 && (!v.autopay || (!!v.accountId && !!v.startDate)));

/** "↻ Monthly · ₹119 · Autopay SBI": how a recurring item reads in a list. */
export function recurringLine(r: RecurringConfig, accounts: { _id: string; name: string }[]): string {
  const account = r.autopay ? accounts.find((a) => a._id === r.accountId)?.name : undefined;
  return [
    `↻ ${r.frequency === 'yearly' ? 'Yearly' : 'Monthly'}`,
    `₹${r.amount.toLocaleString('en-IN')}`,
    r.autopay ? `Autopay${account ? ` ${account}` : ''}` : undefined,
  ].filter(Boolean).join(' · ');
}
