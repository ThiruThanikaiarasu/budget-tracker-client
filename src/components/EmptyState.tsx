/** Faded emoji + muted message, shown when a list has nothing to display. */
export default function EmptyState({ icon, message, compact }: {
  icon: string;
  message: string;
  /** Smaller padding/icon for use inside modals. */
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 ${compact ? 'py-6' : 'py-16'}`}>
      <span className={`${compact ? 'text-3xl' : 'text-4xl'} opacity-30`}>{icon}</span>
      <p className="text-sm text-center" style={{ color: 'var(--c-muted)' }}>{message}</p>
    </div>
  );
}
