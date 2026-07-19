import type { CSSProperties } from 'react';
import { formatCurrency } from '../utils/format';

/**
 * CRED-style amount: bold whole number with a dimmed, lighter fractional part
 * (e.g. ₹1,353·57 where the ".57" is muted). The `.cred-dec` styling only
 * de-emphasises the decimals; callers own the sign/prefix and font size.
 */
export default function Amount({
  value,
  prefix = '',
  className,
  style,
  decClassName = 'cred-dec',
}: {
  value: number;
  prefix?: string;
  className?: string;
  style?: CSSProperties;
  decClassName?: string;
}) {
  const formatted = formatCurrency(value);
  const dot = formatted.lastIndexOf('.');
  if (dot === -1) {
    return <span className={className} style={style}>{prefix}{formatted}</span>;
  }
  return (
    <span className={className} style={style}>
      {prefix}
      {formatted.slice(0, dot)}
      <span className={decClassName}>{formatted.slice(dot)}</span>
    </span>
  );
}
