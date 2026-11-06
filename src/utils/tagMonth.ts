/** "2026-11" -> "Nov 2026" (or "November 2026" when `long`). */
export function monthShort(key: string, long = false): string {
  return new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', {
    month: long ? 'long' : 'short',
    year: 'numeric',
  });
}
