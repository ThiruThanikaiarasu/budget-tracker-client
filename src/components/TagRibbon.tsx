import type { TagRef } from '../store/transactionStore';
import { monthShort } from '../utils/tagMonth';
import { tagVars } from '../utils/tagColor';

/** "# Rent · Nov" with the tag's colour bar on the left. `long` spells out the year. */
export default function TagRibbon({ tag, long, className = '' }: { tag: TagRef; long?: boolean; className?: string }) {
  const month = long ? monthShort(tag.month) : monthShort(tag.month).split(' ')[0];
  return (
    <span className={`tag-ribbon ${className}`} style={tagVars(tag.name)}>
      <i>#</i> {tag.name} · {month}
    </span>
  );
}
