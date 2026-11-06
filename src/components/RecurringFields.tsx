import { useEffect } from 'react';
import ThemedSelect from './ThemedSelect';
import useAccountStore from '../store/accountStore';
import { formatCurrency } from '../utils/format';
import { renderAccountIcon } from '../utils/accountIcons';
import { todayLocal } from '../utils/localDate';
import type { RecurringInput } from '../utils/recurring';

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`rf-toggle ${on ? 'is-on' : ''}`}>
      <i />
    </button>
  );
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The first date on or after today that falls on `day` (and, yearly, in
 * `month`), clamped to short months, as YYYY-MM-DD. Autopay starts there.
 */
function nextOn(day: number, frequency: 'monthly' | 'yearly', month?: number): string {
  const today = new Date(`${todayLocal()}T00:00:00`);
  for (let i = 0; i < 25; i++) {
    const y = frequency === 'yearly' ? today.getFullYear() + i : today.getFullYear() + Math.floor((today.getMonth() + i) / 12);
    const m = frequency === 'yearly' ? (month ?? today.getMonth()) : (today.getMonth() + i) % 12;
    const d = Math.min(day, new Date(y, m + 1, 0).getDate());
    const candidate = new Date(y, m, d);
    if (candidate >= today) return `${y}-${pad(m + 1)}-${pad(d)}`;
  }
  return todayLocal();
}

/**
 * "Recurring payment" block for a category or item: how often and the usual
 * amount. That's all plain recurring needs: you pay it yourself, from whichever
 * account. Autopay also asks which account and which day, since the app adds the
 * entry itself on each due date (and Records shows the AUTO PAY ribbon on it).
 */
export default function RecurringFields({
  value,
  onChange,
  nextDue,
  name,
}: {
  value: RecurringInput | null;
  onChange: (v: RecurringInput | null) => void;
  /** Shown when editing an existing autopay schedule. */
  nextDue?: string;
  /** What repeats ("Netflix"), for the header line. */
  name?: string;
}) {
  const { accounts, fetchAccounts } = useAccountStore();
  useEffect(() => { if (accounts.length === 0) fetchAccounts(); }, [accounts.length, fetchAccounts]);

  const set = (patch: Partial<RecurringInput>) => value && onChange({ ...value, ...patch });
  const turnOn = (v: boolean) => onChange(v ? { frequency: 'monthly', amount: 0, autopay: false } : null);
  // Autopay brings in its schedule (today's day, first account); switching it off drops it.
  const setAutopay = (v: boolean) =>
    value && onChange(v
      ? { ...value, autopay: true, startDate: value.startDate ?? todayLocal(), accountId: value.accountId ?? accounts[0]?._id }
      : { frequency: value.frequency, amount: value.amount, autopay: false });

  const start = value?.startDate ? new Date(`${value.startDate}T00:00:00`) : null;
  const day = start?.getDate() ?? new Date().getDate();
  const month = start?.getMonth() ?? new Date().getMonth();
  const per = value?.frequency === 'yearly' ? 'per year' : 'per month';

  return (
    <div className="rf">
      <div className="rf-head">
        <span className="rf-icon" aria-hidden>↻</span>
        <div className="min-w-0 flex-1">
          <p className="rf-title">Recurring payment</p>
          <p className="rf-sub">{name?.trim() ? `${name.trim()} repeats on a schedule` : 'Repeats every month or year'}</p>
        </div>
        <Toggle on={value !== null} onChange={turnOn} label="Recurring payment" />
      </div>

      {value && (
        <div className="rf-body">
          <div className="rf-seg">
            {(['monthly', 'yearly'] as const).map((f) => (
              <button key={f} type="button" aria-pressed={value.frequency === f}
                className={value.frequency === f ? 'is-on' : ''}
                onClick={() => set(value.autopay ? { frequency: f, startDate: nextOn(day, f, month) } : { frequency: f })}>
                {value.frequency === f && '✓ '}{f === 'monthly' ? 'Every month' : 'Every year'}
              </button>
            ))}
          </div>

          <div>
            <label className="rf-label">Usual amount</label>
            <label className="rf-amount">
              <span className="rf-rupee">₹</span>
              <input
                type="text" inputMode="decimal" placeholder="0"
                value={value.amount ? String(value.amount) : ''}
                onChange={(e) => set({ amount: parseFloat(e.target.value.replace(/[^0-9.]/g, '')) || 0 })}
                aria-label="Usual amount"
              />
              <span className="rf-per">{Number.isInteger(value.amount) ? '.00' : ''} · {per}</span>
            </label>
          </div>

          <div className="rf-autopay">
            <div className="min-w-0 flex-1">
              <p className="rf-title">Autopay</p>
              <p className="rf-sub">
                {value.autopay
                  ? <>On: shows the <span className="rf-ribbon">↻ AUTO PAY</span> ribbon in Records</>
                  : 'Off: you add it yourself, from any account'}
              </p>
            </div>
            <Toggle on={value.autopay} onChange={setAutopay} label="Autopay" />
          </div>

          {value.autopay && (
            <div className="rf-sentence">
              Paid from
              <ThemedSelect
                value={value.accountId ?? ''}
                onChange={(id) => set({ accountId: id })}
                placeholder="account"
                ariaLabel="Paid from"
                triggerClassName="rf-chip"
                options={accounts.map((a) => ({ value: a._id, label: a.name, hint: formatCurrency(a.balance), icon: renderAccountIcon(a.type, a.color, 18) }))}
              />
              on day
              <ThemedSelect
                value={String(day)}
                onChange={(d) => set({ startDate: nextOn(Number(d), value.frequency, month) })}
                ariaLabel="Day of the month"
                triggerClassName="rf-chip"
                options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
              />
              {value.frequency === 'yearly' ? (
                <>
                  of
                  <ThemedSelect
                    value={String(month)}
                    onChange={(m) => set({ startDate: nextOn(day, 'yearly', Number(m)) })}
                    ariaLabel="Month"
                    triggerClassName="rf-chip"
                    options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
                  />
                  each year
                </>
              ) : 'of each month'}
            </div>
          )}

          {value.autopay && (nextDue || value.startDate) && (
            <p className="rf-next">
              Next entry {new Date(nextDue && nextDue.slice(0, 10) >= (value.startDate ?? '') ? nextDue : `${value.startDate}T00:00:00`)
                .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
