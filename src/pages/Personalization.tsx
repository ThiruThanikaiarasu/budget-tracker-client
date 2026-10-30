import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import useThemeStore, { THEMES } from '../store/themeStore';
import useAccountStore from '../store/accountStore';
import useTransactionStore from '../store/transactionStore';
import Amount from '../components/Amount';
import CartoonIcon from '../components/CartoonIcon';
import { CartoonHead, Sticker } from '../components/cartoon';

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getFinancialMonthPreview(startDay: number): string {
  if (startDay === 1) return 'Standard calendar month (1st to end of month)';
  const endDay = startDay - 1;
  return `${getOrdinalSuffix(startDay)} of prev month to ${getOrdinalSuffix(endDay)} of current month`;
}

// Mini "screen" swatches for the theme cards: [page, bar, input, accent].
const THEME_SWATCH: Record<string, [string, string, string, string]> = {
  cartoon: ['#FFF7EA', '#1E1B18', '#FFFFFF', '#FFC83D'],
  light: ['#FFFFFF', '#1E1B18', '#F0F0F0', '#C4C4C4'],
  'dark-olive': ['#3A3E2C', '#E4E0C4', '#4B5138', '#A5B075'],
  'cred-white': ['#F5F5F3', '#111111', '#FFFFFF', '#111111'],
  'cred-black': ['#0E0E0E', '#F2F2F2', '#1C1C1C', '#F2F2F2'],
};
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function Personalization() {
  const { user, updatePreferences } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [startDay, setStartDay] = useState(user?.financialMonthStartDay ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);

  useEffect(() => {
    if (user) setStartDay(user.financialMonthStartDay);
  }, [user]);

  const isCartoon = theme === 'cartoon';
  const hasChanges = startDay !== (user?.financialMonthStartDay ?? 1);

  const handleSave = async () => {
    setIsSaving(true);
    try { await updatePreferences({ financialMonthStartDay: startDay }); } catch {}
    setIsSaving(false);
  };

  if (isCartoon) {
    const today = new Date();
    // Day N of the current cycle, and how long the cycle is.
    const cycleStart = new Date(today.getFullYear(), today.getMonth() - (today.getDate() < startDay ? 1 : 0), startDay);
    const cycleEnd = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, startDay - 1);
    const cycleDays = Math.round((cycleEnd.getTime() - cycleStart.getTime()) / 86400000) + 1;
    const dayNo = Math.floor((new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() - cycleStart.getTime()) / 86400000) + 1;
    const fmt = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    const pct = startDay === 1 ? ((today.getDate() - 1) / Math.max(new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - 1, 1)) * 100 : ((dayNo - 1) / Math.max(cycleDays - 1, 1)) * 100;
    const exampleMonth = MONTH_NAMES[4];
    return (
      <div className="cartoon-page">
        <CartoonHead kicker="Make it yours" title="Settings" />

        <section className="cartoon-panel">
          <h2 className="cartoon-section-title flex items-center gap-3"><CartoonIcon kind="palette" size={36} /> Theme</h2>
          <div className="cartoon-themes">
            {THEMES.map((t) => {
              const [page, bar, input, accent] = THEME_SWATCH[t.id] ?? THEME_SWATCH.light;
              const on = theme === t.id;
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => setTheme(t.id)} className={`cartoon-theme ${on ? 'is-on' : ''}`}>
                  {t.id === 'cartoon' && <span className="cartoon-theme-new"><Sticker tone="earn" tilt={6}>New</Sticker></span>}
                  <span className="cartoon-theme-screen" style={{ background: page }}>
                    <i style={{ background: bar, width: '55%' }} />
                    <i style={{ background: input, width: '100%', height: 26, border: `2px solid ${bar}`, opacity: 0.9 }} />
                    <i style={{ background: accent, width: '30%' }} />
                  </span>
                  <span className="cartoon-theme-name">{t.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="cartoon-panel">
          <div>
            <h2 className="cartoon-section-title flex items-center gap-3"><CartoonIcon kind="calendar" size={36} /> When does your month start?</h2>
            <p className="cartoon-sub" style={{ color: 'var(--c-ink)', marginTop: 4 }}>Pick the day your salary lands. Budgets and analysis follow this cycle.</p>
          </div>
          <div className="cartoon-start">
            <div className="set-days">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <button key={d} type="button" aria-pressed={startDay === d} onClick={() => setStartDay(d)} className={`set-day ${startDay === d ? 'is-on' : ''}`}>{d}</button>
              ))}
            </div>
            <div className="flex flex-col gap-4 min-w-0 flex-1">
              <div className="cartoon-cycle">
                <p className="cartoon-card-title">
                  {startDay === 1 ? '1st to the end of the month' : `${getOrdinalSuffix(startDay)} to the ${getOrdinalSuffix(startDay - 1)}`}
                </p>
                <div className="cartoon-track"><span style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }} /></div>
                <div className="flex items-center justify-between gap-2 font-extrabold text-sm">
                  <span>{fmt(cycleStart)}</span>
                  <span className="cartoon-pill" style={{ background: 'var(--c-sky-tint)', padding: '1px 12px' }}>Today, day {dayNo}</span>
                  <span>{fmt(cycleEnd)}</span>
                </div>
                {startDay !== 1 && (
                  <p className="cartoon-sub">So "{exampleMonth} 2026" covers {getOrdinalSuffix(startDay)} April to {getOrdinalSuffix(startDay - 1)} May.</p>
                )}
              </div>
              <div><button onClick={handleSave} disabled={!hasChanges || isSaving} className="cartoon-btn is-primary">{isSaving ? 'Saving...' : 'Save'}</button></div>
            </div>
          </div>
        </section>

        <section className="cartoon-banner">
          <span className="cartoon-hero-tile"><CartoonIcon kind="reconcile" size={88} /></span>
          <div className="min-w-0 flex-1">
            <h2 className="cartoon-section-title">Clean up and start fresh <Sticker tone="grape" tilt={-3}>New journey</Sticker></h2>
            <p className="cartoon-sub" style={{ color: 'var(--c-ink)', marginTop: 6 }}>
              Balances drifted from real life? Type what each account really holds. We add one "Clean up" entry per account to match.
              Your history stays, and clean-ups never count as spending.
            </p>
          </div>
          <button onClick={() => setShowCleanup(true)} className="cartoon-btn">Reconcile balances</button>
        </section>

        {showCleanup && <CleanupModal onClose={() => setShowCleanup(false)} />}
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--c-bg)', minHeight: '100vh' }}>
      <div className="px-4 pt-6 pb-4" style={{ background: 'var(--c-header-bg)' }}>
        <p className="cred-serif text-lg font-semibold" style={{ color: 'var(--c-text)' }}>Settings</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>Customize your experience</p>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* ── Theme ──────────────────────────────────────────────── */}
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)' }}>
          <p className="cred-serif text-sm font-semibold mb-1" style={{ color: 'var(--c-text)' }}>Theme</p>
          <p className="text-xs mb-3" style={{ color: 'var(--c-muted)' }}>Choose your preferred colour scheme</p>
          <div className="grid grid-cols-2 gap-2">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{
                  background: theme === t.id ? 'var(--c-accent)' : 'var(--c-surface2)',
                  color: theme === t.id ? 'var(--c-accent-fg)' : 'var(--c-muted)',
                  border: theme === t.id ? 'none' : '1px solid var(--c-border)',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Financial Month ────────────────────────────────────── */}
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)' }}>
          <p className="cred-serif text-sm font-semibold mb-1" style={{ color: 'var(--c-text)' }}>Financial Month Start</p>
          <p className="text-xs mb-3" style={{ color: 'var(--c-muted)' }}>
            Set which day your budget cycle starts (typically your salary date).
          </p>

          <div className="flex justify-center">
            <div className="inline-grid grid-cols-7 gap-1">
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} className="flex h-7 w-7 items-center justify-center text-[9px] font-medium" style={{ color: 'var(--c-muted)' }}>{d}</div>
              ))}
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setStartDay(d)}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-xs font-medium transition-colors"
                  style={{
                    background: startDay === d ? 'var(--c-accent)' : 'var(--c-surface2)',
                    color: startDay === d ? 'var(--c-accent-fg)' : 'var(--c-text)',
                  }}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 rounded-lg p-3" style={{ background: 'var(--c-surface2)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--c-text)' }}>{getFinancialMonthPreview(startDay)}</p>
            {startDay !== 1 && (
              <p className="mt-1 text-xs" style={{ color: 'var(--c-muted)' }}>
                Example: "May 2026" budget covers {getOrdinalSuffix(startDay)} April to {getOrdinalSuffix(startDay - 1)} May
              </p>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="t-btn-primary px-6"
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* ── Clean up & new journey ─────────────────────────────── */}
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)' }}>
          <p className="cred-serif text-sm font-semibold mb-1" style={{ color: 'var(--c-text)' }}>Clean up &amp; new journey</p>
          <p className="text-xs mb-3" style={{ color: 'var(--c-muted)' }}>
            Balances drifted from reality? Enter each account's actual balance and we'll
            book a one-off "Clean up" adjustment to match — your history stays intact and
            these entries don't count toward spending or budgets.
          </p>
          <button onClick={() => setShowCleanup(true)} className="t-btn-outline">
            Reconcile balances
          </button>
        </div>
      </div>

      {showCleanup && <CleanupModal onClose={() => setShowCleanup(false)} />}
    </div>
  );
}

// ── Clean up & new journey modal ─────────────────────────────────────
function CleanupModal({ onClose }: { onClose: () => void }) {
  const { accounts, fetchAccounts } = useAccountStore();
  const cleanupAccounts = useTransactionStore((s) => s.cleanupAccounts);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (accounts.length === 0) fetchAccounts();
  }, [accounts.length, fetchAccounts]);

  const active = accounts.filter((a) => a.isActive);

  // Accounts the user actually re-stated with a different balance.
  const changed = active
    .map((a) => ({ account: a, raw: values[a._id] }))
    .filter(({ raw }) => raw !== undefined && raw !== '' && !Number.isNaN(parseFloat(raw)))
    .map(({ account, raw }) => ({ accountId: account._id, newBalance: parseFloat(raw), account }))
    .filter(({ newBalance, account }) => Math.abs(newBalance - account.balance) >= 0.005);

  const handleSave = async () => {
    if (changed.length === 0) { onClose(); return; }
    setSubmitting(true);
    try {
      await cleanupAccounts(changed.map(({ accountId, newBalance }) => ({ accountId, newBalance })));
      onClose();
    } catch {
      // handled by store
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="cartoon-modal w-full max-w-md rounded-xl p-5" style={{ background: 'var(--c-surface)', maxHeight: '85vh', overflowY: 'auto' }}>
        <p className="cred-serif text-base font-semibold" style={{ color: 'var(--c-text)' }}>Clean up &amp; new journey</p>
        <p className="text-xs mt-1" style={{ color: 'var(--c-muted)' }}>
          Enter the real balance for any account that's off. Leave the rest blank.
        </p>

        <div className="mt-4 space-y-3">
          {active.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--c-muted)' }}>No active accounts.</p>
          ) : (
            active.map((a) => (
              <div key={a._id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--c-text)' }}>{a.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--c-muted)' }}>now <Amount value={a.balance} /></p>
                </div>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
                  placeholder={String(a.balance)}
                  value={values[a._id] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [a._id]: e.target.value }))}
                  onWheel={(e) => e.currentTarget.blur()}
                  className="t-input w-32 text-right"
                />
              </div>
            ))
          )}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--c-muted)' }}>
            {changed.length > 0 ? `${changed.length} to adjust` : 'No changes yet'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="t-btn-ghost">Cancel</button>
            <button onClick={handleSave} disabled={submitting || changed.length === 0} className="t-btn-primary px-5">
              {submitting ? 'Cleaning...' : 'Clean up'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Personalization;
