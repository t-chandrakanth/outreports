/**
 * Single source of truth for sheet names and field definitions.
 * The `header` strings MUST match the Google Sheet column headers exactly —
 * they are the record keys sent to the Apps Script API.
 * Labels, group names and messages are translation keys (src/i18n/locales).
 */

import type { Dictionary } from './i18n/locales/en';
import { formatDateTime } from './utils/date';

export interface Location {
  code: string;
  directions: string[]; // sheet names
}

export const LOCATIONS: Location[] = [
  { code: 'WADI', directions: ['SNF-WADI/CT UP', 'WADI/CT-SNF DN'] },
  { code: 'MTMI', directions: ['DKJ-MTMI/VNUP UP', 'MTMI-DKJ DN', 'VNUP-MTMI'] },
  { code: 'BPQ', directions: ['BPA-BPQ UP', 'BPQ-BPA DN'] },
  { code: 'NZB', directions: ['NZB-RDM UP', 'RDM-NZB DN'] },
  { code: 'RC', directions: ['RC-CT/WADI UP', 'RC-WADI/CT DN'] },
  { code: 'HYB', directions: ['HYB-DN'] },
  { code: 'SNF', directions: ['SNF-KZJ', 'KZJ-SNF', 'VNUP-PGDP-SNF'] },
  { code: 'BDCR', directions: ['BDCR-DKJ', 'DKJ-BDCR'] },
  { code: 'VKB-BIDR-PRLI-LTRR', directions: ['VKB-BIDR-PRLI/LTRR', 'PRLI/LTRR-BIDR-VKB'] },
];

/**
 * Former tab names -> current tab names. Entries queued offline (and older
 * installed builds) may still carry the old name. Keep in sync with
 * SHEET_ALIASES in apps-script/Code.gs and scripts/mock-apps-script.mjs.
 */
export const SHEET_ALIASES: Readonly<Record<string, string>> = {
  'SNF-WADI UP': 'SNF-WADI/CT UP',
  'WADI-SNF DN': 'WADI/CT-SNF DN',
  'MTMI-DKJ UP': 'DKJ-MTMI/VNUP UP',
  'RC-DN': 'RC-WADI/CT DN',
  'VKB-BIDR-PRLI-LTRR': 'VKB-BIDR-PRLI/LTRR',
};

/** Old or current tab name -> current tab name (trimmed). */
export function canonicalSheet(name: string): string {
  const n = String(name ?? '').trim();
  return Object.prototype.hasOwnProperty.call(SHEET_ALIASES, n) ? SHEET_ALIASES[n] : n;
}

/**
 * Column headers spelled differently on some tabs -> the FIELDS header (the
 * record key). Keep in sync with HEADER_ALIASES in apps-script/Code.gs.
 */
export const HEADER_ALIASES: Readonly<Record<string, string>> = {
  'RAKE-ID': 'RAKE-ID (IF-CC RAKE)',
};

/** Raw header (server or cached) -> canonical record key; '' stays ''. */
export function canonicalHeader(raw: string): string {
  const h = String(raw ?? '').trim();
  return Object.prototype.hasOwnProperty.call(HEADER_ALIASES, h) ? HEADER_ALIASES[h] : h;
}

export type FieldGroup = keyof Dictionary['groups'];
export type FieldKey = keyof Dictionary['fields'];

export interface FieldDef {
  /** Exact sheet column header (record key). */
  header: string;
  /** Translation key under `fields` for the label. */
  key: FieldKey;
  group: FieldGroup;
  inputType: 'text' | 'tel';
  /** Shown and submitted but not editable (auto-filled). */
  readOnly?: boolean;
  inputMode?: 'numeric' | 'decimal';
  required?: boolean;
  pattern?: RegExp;
  /** Translation key under `form` shown when `pattern` fails. */
  patternKey?: 'mobileInvalid';
  maxLength?: number;
  /** A sample value (data, not translated) or a translated hint key under `form`. */
  placeholder?: { example: string } | { hint: 'mobileHint' };
}

export const FIELDS: FieldDef[] = [
  { header: 'DATE', key: 'date', group: 'trainLoco', inputType: 'text', required: true, readOnly: true },
  { header: 'TR.NO', key: 'trainNo', group: 'trainLoco', inputType: 'text', required: true, placeholder: { example: 'KPCC' } },
  { header: 'LOCO NO', key: 'locoNo', group: 'trainLoco', inputType: 'text', placeholder: { example: '60426 or 42681+31474' } },
  { header: 'LOCO BASE AND DUE', key: 'locoBase', group: 'trainLoco', inputType: 'text', placeholder: { example: 'KZJ 28/09' } },
  { header: 'LOAD', key: 'load', group: 'loadBpc', inputType: 'text', placeholder: { example: '58/58/5200' } },
  { header: 'B.UP', key: 'breakUp', group: 'loadBpc', inputType: 'text', placeholder: { example: '57BOXNL+01 BVZI' } },
  { header: 'BPC NO', key: 'bpcNo', group: 'loadBpc', inputType: 'text', inputMode: 'numeric' },
  { header: 'RAKE-ID (IF-CC RAKE)', key: 'rakeId', group: 'loadBpc', inputType: 'text' },
  { header: 'BP%', key: 'bpPercent', group: 'loadBpc', inputType: 'text', inputMode: 'decimal', placeholder: { example: '98.30%' } },
  { header: 'VALIDITY', key: 'validity', group: 'loadBpc', inputType: 'text', placeholder: { example: '10000 Kms / 35+05 Days' } },
  { header: 'VALID UPTO', key: 'validUpto', group: 'loadBpc', inputType: 'text', placeholder: { example: '20/09/2026' } },
  { header: 'ISSUED AT', key: 'issuedAt', group: 'loadBpc', inputType: 'text' },
  { header: 'ISSUED ON', key: 'issuedOn', group: 'loadBpc', inputType: 'text' },
  { header: 'EX', key: 'ex', group: 'loadBpc', inputType: 'text', placeholder: { example: 'PCCT to CCCT' } },
  { header: 'COMMODITY', key: 'commodity', group: 'loadBpc', inputType: 'text', placeholder: { example: 'Clinker' } },
  { header: 'COD', key: 'cod', group: 'loadBpc', inputType: 'text' },
  { header: 'T/O TIME', key: 'dep', group: 'loadBpc', inputType: 'text' },
  {
    header: 'TMR MOBILE NO', key: 'mobile', group: 'contact', inputType: 'tel',
    inputMode: 'numeric', maxLength: 10,
    pattern: /^[0-9]{10}$/, patternKey: 'mobileInvalid',
    placeholder: { hint: 'mobileHint' },
  },
];

export const FIELD_GROUPS: FieldGroup[] = ['trainLoco', 'loadBpc', 'contact'];

/** Headers used for card summaries. */
export const SUMMARY = {
  date: 'DATE',
  trainNo: 'TR.NO',
  locoNo: 'LOCO NO',
} as const;

export function emptyRecord(): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const f of FIELDS) rec[f.header] = '';
  rec['DATE'] = nowStamp();
  return rec;
}

/** Current local date-time in the stored DATE format (dd/mm/yyyy HH:mm). */
export function nowStamp(): string {
  return formatDateTime(new Date());
}
