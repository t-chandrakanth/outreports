import { describe, expect, it } from 'vitest';
import { FIELDS, HEADER_ALIASES, LOCATIONS, SHEET_ALIASES, canonicalHeader, canonicalSheet, describeSheet } from '../config';

describe('LOCATIONS', () => {
  it('lists every workbook tab under its home-screen tile, in order', () => {
    expect(LOCATIONS.map((l) => [l.code, l.directions.map((d) => `${d.label}=${d.sheet}`)])).toEqual([
      ['WADI', ['Up=SNF-WADI/CT UP', 'Down=WADI/CT-SNF DN']],
      ['MTMI', ['Up=DKJ-MTMI/VNUP UP', 'Down=MTMI-DKJ DN', 'VNUP-MTMI=VNUP-MTMI']],
      ['BPQ', ['Up=BPA-BPQ UP', 'Down=BPQ-BPA DN']],
      ['NZB', ['Up=NZB-RDM UP', 'Down=RDM-NZB DN']],
      ['SNF', ['Up=SNF-KZJ', 'Down=KZJ-SNF']],
      ['BDCR', ['Up=BDCR-DKJ', 'Down=DKJ-BDCR']],
      ['BIDR', ['Up=VKB-BIDR-PRLI/LTRR', 'Down=PRLI/LTRR-BIDR-VKB']],
      ['RC', ['Up=RC-CT/WADI UP', 'Down=RC-WADI/CT DN']],
      ['HYB', ['Down=HYB-DN']],
      ['VNUP-PGDP-SNF', ['VNUP-PGDP-SNF=VNUP-PGDP-SNF']],
    ]);
  });

  it('labels every direction Up/Down unless the tab is a corridor of its own', () => {
    for (const loc of LOCATIONS) {
      const labels = loc.directions.map((d) => d.label);
      expect(new Set(labels).size).toBe(labels.length);
      for (const d of loc.directions) expect(['Up', 'Down', d.sheet]).toContain(d.label);
    }
  });

  it('describeSheet finds the tile and label for a tab, null otherwise', () => {
    expect(describeSheet('PRLI/LTRR-BIDR-VKB')).toEqual({ code: 'BIDR', label: 'Down' });
    expect(describeSheet('VNUP-PGDP-SNF')).toEqual({ code: 'VNUP-PGDP-SNF', label: 'VNUP-PGDP-SNF' });
    expect(describeSheet('Sheet12')).toBeNull();
  });

  it('has unique sheet names and location codes', () => {
    const sheets = LOCATIONS.flatMap((l) => l.directions.map((d) => d.sheet));
    expect(new Set(sheets).size).toBe(sheets.length);
    const codes = LOCATIONS.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('sheet aliases', () => {
  const current = LOCATIONS.flatMap((l) => l.directions.map((d) => d.sheet));

  it('map every former tab name onto a current one, and no current name is an alias key', () => {
    for (const [oldName, newName] of Object.entries(SHEET_ALIASES)) {
      expect(current).toContain(newName);
      expect(current).not.toContain(oldName);
    }
  });

  it('canonicalSheet resolves old names, trims, and passes current names through', () => {
    expect(canonicalSheet('RC-DN')).toBe('RC-WADI/CT DN');
    expect(canonicalSheet('VKB-BIDR-PRLI-LTRR')).toBe('VKB-BIDR-PRLI/LTRR');
    expect(canonicalSheet(' RC-WADI/CT DN ')).toBe('RC-WADI/CT DN');
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
