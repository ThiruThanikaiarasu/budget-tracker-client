/**
 * Key used to detect duplicate names: case-insensitive and whitespace-blind,
 * so "Potato" == "potato " and "White Channa" == "whitechanna". Mirrors the
 * server's utils/normalizeName.ts.
 */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}
