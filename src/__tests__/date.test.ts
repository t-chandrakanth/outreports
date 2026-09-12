import { describe, expect, it } from 'vitest';
import { isSameDay, parseSheetDate } from '../utils/date';

describe('parseSheetDate', () => {
  it('parses yyyy-mm-dd', () => {
    const d = parseSheetDate('2026-09-11')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 11]);
  });
  it('parses d/m/yyyy', () => {
    const d = parseSheetDate('17/08/2026')!;
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 7, 17]);
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
