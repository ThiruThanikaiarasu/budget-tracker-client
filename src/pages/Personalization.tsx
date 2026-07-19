import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import useThemeStore, { THEMES } from '../store/themeStore';
import useAccountStore from '../store/accountStore';
import useTransactionStore from '../store/transactionStore';
import Amount from '../components/Amount';

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

function Personalization() {
  const { user, updatePreferences } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const [startDay, setStartDay] = useState(user?.financialMonthStartDay ?? 1);
  const [isSaving, setIsSaving] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);

  useEffect(() => {
    if (user) setStartDay(user.financialMonthStartDay);
  }, [user]);

  const hasChanges = startDay !== (user?.financialMonthStartDay ?? 1);

  const handleSave = async () => {
    setIsSaving(true);
    try { await updatePreferences({ financialMonthStartDay: startDay }); } catch {}
    setIsSaving(false);
  };

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
      <div className="w-full max-w-md rounded-xl p-5" style={{ background: 'var(--c-surface)', maxHeight: '85vh', overflowY: 'auto' }}>
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
