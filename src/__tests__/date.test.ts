import { describe, expect, it } from 'vitest';
import { formatDateTime, isSameDay, parseSheetDate } from '../utils/date';

describe('parseSheetDate', () => {
  it('parses yyyy-mm-dd', () => {
    const d = parseSheetDate('2026-09-11')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 11]);
  });
  it('parses d/m/yyyy', () => {
    const d = parseSheetDate('17/08/2026')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 17]);
  });
  it('parses d/m/yyyy with a trailing time (form stamp)', () => {
    const d = parseSheetDate('12/09/2026 14:35')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 12]);
  });
  it('parses sheets short datetime dd-mm hh:mm', () => {
    const d = parseSheetDate('08-09 21:15')!;
    expect([d.getMonth(), d.getDate()]).toEqual([8, 8]);
  });
  it('rejects junk', () => {
    expect(parseSheetDate('KZJ 28/09')).toBeNull();
    expect(parseSheetDate('')).toBeNull();
  });
});

describe('isSameDay', () => {
  it('matches across formats', () => {
    expect(isSameDay('17/08/2026', '2026-08-17')).toBe(true);
    expect(isSameDay('2026-08-17', '2026-08-17')).toBe(true);
    expect(isSameDay('18/08/2026', '2026-08-17')).toBe(false);
  });
});

describe('formatDateTime', () => {
  it('formats local dd/mm/yyyy HH:mm with zero padding', () => {
    expect(formatDateTime(new Date(2026, 8, 3, 7, 5))).toBe('03/09/2026 07:05');
    expect(formatDateTime(new Date(2026, 11, 31, 23, 59))).toBe('31/12/2026 23:59');
  });
});
