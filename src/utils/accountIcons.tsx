import type { JSX } from 'react';
import type { Account } from '../store/accountStore';

// Same emoji-per-type mapping used on the Accounts page, shared so the
// transaction form's account picker matches it.
export const ACCOUNT_TYPE_ICONS: Record<Account['type'], string> = {
  cash: '💵',
  bank_account: '🏦',
  credit_card: '💳',
  upi_wallet: '📱',
  investment: '📈',
  other: '💼',
};

const ACCOUNT_TYPE_PATHS: Record<Account['type'], string | string[]> = {
  cash: ['M3 6h18v12H3z', 'M7 9h10v6H7z', 'M3 9h2m14 0h2m-18 6h2m14 0h2'],
  bank_account: ['M3 10h18', 'M5 10v8m4-8v8m6-8v8m4-8v8', 'M3 18h18M2 21h20M12 3l10 5H2z'],
  credit_card: ['M3 5h18v14H3z', 'M3 9h18', 'M7 15h4'],
  upi_wallet: ['M7 2h10v20H7z', 'M10 5h4M11 19h2'],
  investment: ['M4 19V5', 'M4 19h16', 'M7 15l4-4 3 2 5-7'],
  other: ['M4 7h16v13H4z', 'M9 7V4h6v3', 'M4 12h16'],
};

export function renderAccountIcon(type: Account['type'], color?: string, size = 40): JSX.Element {
  return (
    <div
      className="account-icon rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: color || 'var(--c-surface2)' }}
    >
      <span className="account-icon-emoji">{ACCOUNT_TYPE_ICONS[type]}</span>
      <svg className="account-icon-svg" viewBox="0 0 24 24" width={size * 0.58} height={size * 0.58} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {Array.isArray(ACCOUNT_TYPE_PATHS[type])
          ? ACCOUNT_TYPE_PATHS[type].map((d, i) => <path key={i} d={d} />)
          : <path d={ACCOUNT_TYPE_PATHS[type]} />}
      </svg>
    </div>
  );
}
