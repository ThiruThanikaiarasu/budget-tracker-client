import type { JSX } from 'react';
import type { Account } from '../store/accountStore';

// Same emoji-per-type mapping used on the Accounts page, shared so the
// transaction form's account picker matches it.
export const ACCOUNT_TYPE_ICONS: Record<Account['type'], string> = {
  cash: '💵',
  bank_account: '🏦',
  credit_card: '💳',
  upi_wallet: '📱',
  other: '💼',
};

export function renderAccountIcon(type: Account['type'], color?: string, size = 40): JSX.Element {
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.45, backgroundColor: color || 'var(--c-surface2)' }}
    >
      {ACCOUNT_TYPE_ICONS[type]}
    </div>
  );
}
