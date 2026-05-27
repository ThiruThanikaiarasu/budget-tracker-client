import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import useThemeStore, { THEMES } from '../store/themeStore';

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
        <p className="text-lg font-bold" style={{ color: 'var(--c-text)' }}>Settings</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--c-muted)' }}>Customize your experience</p>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* ── Theme ──────────────────────────────────────────────── */}
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)' }}>
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--c-text)' }}>Theme</p>
          <p className="text-xs mb-3" style={{ color: 'var(--c-muted)' }}>Choose your preferred colour scheme</p>
          <div className="flex gap-2">
            {THEMES.map(t => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
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
          <p className="text-sm font-bold mb-1" style={{ color: 'var(--c-text)' }}>Financial Month Start</p>
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

          <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(201,167,47,0.10)' }}>
            <p className="text-sm" style={{ color: 'var(--c-accent)' }}>{getFinancialMonthPreview(startDay)}</p>
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
      </div>
    </div>
  );
}

export default Personalization;
