import { describe, expect, it } from 'vitest';
import { FIELDS, HEADER_ALIASES, LOCATIONS, SHEET_ALIASES, canonicalHeader, canonicalSheet } from '../config';

describe('LOCATIONS', () => {
  it('lists every workbook tab under its home-screen tile, in order', () => {
    expect(LOCATIONS).toEqual([
      { code: 'WADI', directions: ['SNF-WADICT UP', 'WADICT-SNF DN'] },
      { code: 'MTMI', directions: ['DKJ-MTMIVNUP UP', 'MTMI-DKJ DN', 'VNUP-MTMI'] },
      { code: 'BPQ', directions: ['BPA-BPQ UP', 'BPQ-BPA DN'] },
      { code: 'NZB', directions: ['NZB-RDM UP', 'RDM-NZB DN'] },
      { code: 'RC', directions: ['RC-WADICT DN', 'RC-CTWADI UP'] },
      { code: 'HYB', directions: ['HYB-DN'] },
      { code: 'SNF', directions: ['SNF-KZJ', 'KZJ-SNF', 'VNUP-PGDP-SNF'] },
      { code: 'BDCR', directions: ['BDCR-DKJ', 'DKJ-BDCR'] },
      { code: 'VKB-BIDR-PRLI-LTRR', directions: ['VKB-BIDR-PRLILTRR', 'PRLILTRR-BIDR-VKB'] },
    ]);
  });

  it('has unique sheet names and location codes', () => {
    const sheets = LOCATIONS.flatMap((l) => l.directions);
    expect(new Set(sheets).size).toBe(sheets.length);
    const codes = LOCATIONS.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('sheet aliases', () => {
  const current = LOCATIONS.flatMap((l) => l.directions);

  it('map every former tab name onto a current one, and no current name is an alias key', () => {
    for (const [oldName, newName] of Object.entries(SHEET_ALIASES)) {
      expect(current).toContain(newName);
      expect(current).not.toContain(oldName);
    }
  });

  it('canonicalSheet resolves old names, trims, and passes current names through', () => {
    expect(canonicalSheet('RC-DN')).toBe('RC-WADICT DN');
    expect(canonicalSheet('VKB-BIDR-PRLI-LTRR')).toBe('VKB-BIDR-PRLILTRR');
    expect(canonicalSheet(' RC-WADICT DN ')).toBe('RC-WADICT DN');
    expect(canonicalSheet('HYB-DN')).toBe('HYB-DN');
    expect(canonicalSheet('Sheet12')).toBe('Sheet12');
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

  it('are already canonical, and every header alias targets a FIELDS header', () => {
    for (const h of headers) expect(canonicalHeader(h)).toBe(h);
    for (const [alias, target] of Object.entries(HEADER_ALIASES)) {
      expect(headers).toContain(target);
      expect(headers).not.toContain(alias);
    }
  });

  it('canonicalHeader maps the short RAKE-ID spelling, trims, and keeps blanks blank', () => {
    expect(canonicalHeader('RAKE-ID')).toBe('RAKE-ID (IF-CC RAKE)');
    expect(canonicalHeader(' DATE ')).toBe('DATE');
    expect(canonicalHeader('')).toBe('');
    expect(canonicalHeader('SOMETHING NEW')).toBe('SOMETHING NEW');
  });
});
