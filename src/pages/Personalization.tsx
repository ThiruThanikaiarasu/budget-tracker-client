import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';

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
  const [startDay, setStartDay] = useState(user?.financialMonthStartDay ?? 1);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) setStartDay(user.financialMonthStartDay);
  }, [user]);

  const hasChanges = startDay !== (user?.financialMonthStartDay ?? 1);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences({ financialMonthStartDay: startDay });
    } catch {
      // handled by store
    }
    setIsSaving(false);
  };

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Personalization</h1>
        <p className="mt-1 text-sm text-gray-500">Customize how your finances are tracked</p>
      </div>

      <div className="mt-6 max-w-lg rounded-lg bg-white p-6 shadow">
        <h2 className="text-base font-semibold text-gray-900">Financial Month</h2>
        <p className="mt-1 text-sm text-gray-500">
          Set which day of the month your budget cycle starts. This is typically your salary date.
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Pick your start day</label>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setStartDay(d)}
                className={`flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  startDay === d
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 rounded-md bg-blue-50 p-3">
          <p className="text-sm text-blue-700">{getFinancialMonthPreview(startDay)}</p>
          {startDay !== 1 && (
            <p className="mt-1 text-xs text-blue-600">
              Example: "May 2026" budget covers {getOrdinalSuffix(startDay)} April to{' '}
              {getOrdinalSuffix(startDay - 1)} May
            </p>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Personalization;
