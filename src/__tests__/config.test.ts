import { describe, expect, it } from 'vitest';
import { FIELDS, LOCATIONS } from '../config';

describe('LOCATIONS', () => {
  it('ends with SNF and BDCR, each with its two sheet tabs', () => {
    const codes = LOCATIONS.map((l) => l.code);
    expect(codes.slice(-2)).toEqual(['SNF', 'BDCR']);
    expect(LOCATIONS.find((l) => l.code === 'SNF')?.directions).toEqual(['SNF-KZJ', 'KZJ-SNF']);
    expect(LOCATIONS.find((l) => l.code === 'BDCR')?.directions).toEqual(['BDCR-DKJ', 'DKJ-BDCR']);
  });

  it('keeps the existing six locations first', () => {
    expect(LOCATIONS.slice(0, 6).map((l) => l.code)).toEqual(['WADI', 'MTMI', 'BPQ', 'NZB', 'RC', 'HYB']);
  });

  it('has unique sheet names and location codes', () => {
    const sheets = LOCATIONS.flatMap((l) => l.directions);
    expect(new Set(sheets).size).toBe(sheets.length);
    const codes = LOCATIONS.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('FIELDS headers', () => {
  const headers = FIELDS.map((f) => f.header);

  it('match the spreadsheet column headers for issued/turn-out fields', () => {
    expect(headers).toContain('ISSUED AT');
    expect(headers).toContain('ISSUED ON');
    expect(headers).toContain('T/O TIME');
    expect(headers).not.toContain('I.AT');
    expect(headers).not.toContain('I.ON');
    expect(headers).not.toContain('DEP');
  });

  it('are unique', () => {
    expect(new Set(headers).size).toBe(headers.length);
  });
});
