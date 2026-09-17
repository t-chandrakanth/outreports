import { canonicalHeader } from '../config';
import type { ListRow, OutreportRecord } from '../types';

/**
 * Zip a list response's headers with one row's cells into a record keyed by
 * the canonical FIELDS headers. Alias-aware so lists cached by an older build
 * (raw 'RAKE-ID', stray blank header cells) still render into the same keys.
 */
export function rowToRecord(headers: string[], row: ListRow): OutreportRecord {
  const rec: OutreportRecord = {};
  headers.forEach((h, i) => {
    const key = canonicalHeader(h);
    if (key === '') return;
    rec[key] = row.cells[i] ?? '';
  });
  return rec;
}
