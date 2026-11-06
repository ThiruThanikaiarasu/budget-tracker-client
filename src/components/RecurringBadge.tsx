/** The recurring symbol: two arrows chasing each other. */
function Arrows({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 11a8 8 0 0 0-14.5-4.5L4 8" />
      <polyline points="4 3 4 8 9 8" />
      <path d="M4 13a8 8 0 0 0 14.5 4.5L20 16" />
      <polyline points="20 21 20 16 15 16" />
    </svg>
  );
}

/**
 * Marks a record that repeats. `overlay` pins it to the corner of the record's
 * icon (the cartoon list); otherwise it sits inline next to a name. Autopay
 * ones are green and say so.
 */
export default function RecurringBadge({ autopay, overlay }: { autopay: boolean; overlay?: boolean }) {
  const title = autopay ? 'Recurring · Autopay' : 'Recurring';
  if (overlay) {
    return (
      <span className={`rec-badge ${autopay ? 'is-auto' : ''}`} title={title} role="img" aria-label={title}>
        <Arrows size={13} />
      </span>
    );
  }
  return (
    <span
      className="ml-1 inline-flex align-middle"
      title={title}
      role="img"
      aria-label={title}
      style={{ color: autopay ? 'var(--c-income)' : 'var(--c-muted)' }}
    >
      <Arrows size={14} />
    </span>
  );
}
