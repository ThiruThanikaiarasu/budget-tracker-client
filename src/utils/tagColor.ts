import type { CSSProperties } from 'react';

/** A tag's colours: the rail/ribbon colour and a pale tint for backgrounds. */
export interface TagColor { rail: string; tint: string }

const PALETTE: TagColor[] = [
  { rail: '#E0862B', tint: '#FCEEDC' }, // orange
  { rail: '#3E9B5A', tint: '#E4F4E8' }, // green
  { rail: '#3F7FD1', tint: '#E5EEFB' }, // blue
  { rail: '#8B6FD6', tint: '#EFEAFC' }, // purple (Rent lands here, as in the design)
  { rail: '#D6538A', tint: '#FBE5EE' }, // pink
  { rail: '#23998F', tint: '#DFF3F1' }, // teal
];

/**
 * Colour from the lowercase name, so "Rent" is the same colour in Oct, Nov and
 * Dec (each month is its own group, but they read as one family).
 */
export function tagColor(name: string): TagColor {
  let h = 0;
  for (const ch of name.trim().toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

/** CSS variables for a tag-coloured element: --tag and --tag-tint. */
export const tagVars = (name: string) => {
  const c = tagColor(name);
  return { '--tag': c.rail, '--tag-tint': c.tint } as CSSProperties;
};
