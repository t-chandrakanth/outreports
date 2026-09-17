import { describeSheet } from '../config';

type Translate = (key: 'direction.up' | 'direction.down') => string;

/** 'Up' / 'Down' translated; any other direction label as written. */
export function directionLabel(t: Translate, label: string): string {
  if (label === 'Up') return t('direction.up');
  if (label === 'Down') return t('direction.down');
  return label;
}

/** Screen title for a tab: "WADI · Up", just the tile code when the label repeats it, or the tab name if unknown. */
export function sheetTitle(t: Translate, sheet: string): string {
  const d = describeSheet(sheet);
  if (!d) return sheet;
  if (d.label === d.code) return d.code;
  return `${d.code} · ${directionLabel(t, d.label)}`;
}
