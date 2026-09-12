/**
 * Single source of truth for sheet names and field definitions.
 * The `header` strings MUST match the Google Sheet column headers exactly —
 * they are the record keys sent to the Apps Script API.
 */

export interface Location {
  code: string;
  directions: string[]; // sheet names
}

export const LOCATIONS: Location[] = [
  { code: 'WADI', directions: ['SNF-WADI UP', 'WADI-SNF DN'] },
  { code: 'MTMI', directions: ['MTMI-DKJ UP', 'MTMI-DKJ DN'] },
  { code: 'BPQ', directions: ['BPA-BPQ UP', 'BPQ-BPA DN'] },
  { code: 'NZB', directions: ['NZB-RDM UP', 'RDM-NZB DN'] },
  { code: 'RC', directions: ['RC-DN'] },
  { code: 'HYB', directions: ['HYB-DN'] },
];

import { formatDateTime } from './utils/date';

export type FieldGroup = 'Train & Loco' | 'Load & BPC' | 'Contact';

export interface FieldDef {
  /** Exact sheet column header (record key). */
  header: string;
  /** Label shown in the UI. */
  label: string;
  group: FieldGroup;
  inputType: 'text' | 'tel';
  /** Shown and submitted but not editable (auto-filled). */
  readOnly?: boolean;
  inputMode?: 'numeric' | 'decimal';
  required?: boolean;
  pattern?: RegExp;
  patternMessage?: string;
  maxLength?: number;
  placeholder?: string;
}

export const FIELDS: FieldDef[] = [
  { header: 'DATE', label: 'Date', group: 'Train & Loco', inputType: 'text', required: true, readOnly: true },
  { header: 'TR.NO', label: 'Train No', group: 'Train & Loco', inputType: 'text', required: true, placeholder: 'e.g. KPCC' },
  { header: 'LOCO NO', label: 'Loco No', group: 'Train & Loco', inputType: 'text', placeholder: 'e.g. 60426 or 42681+31474' },
  { header: 'LOCO BASE AND DUE', label: 'Loco Base & Due', group: 'Train & Loco', inputType: 'text', placeholder: 'e.g. KZJ 28/09' },
  { header: 'LOAD', label: 'Load', group: 'Load & BPC', inputType: 'text', placeholder: 'e.g. 58/58/5200' },
  { header: 'B.UP', label: 'Break UP', group: 'Load & BPC', inputType: 'text', placeholder: 'e.g. 57BOXNL+01 BVZI' },
  { header: 'BPC NO', label: 'BPC No', group: 'Load & BPC', inputType: 'text', inputMode: 'numeric' },
  { header: 'RAKE-ID (IF-CC RAKE)', label: 'Rake ID (if CC rake)', group: 'Load & BPC', inputType: 'text' },
  { header: 'BP%', label: 'BP %', group: 'Load & BPC', inputType: 'text', inputMode: 'decimal', placeholder: 'e.g. 98.30%' },
  { header: 'VALIDITY', label: 'Validity', group: 'Load & BPC', inputType: 'text', placeholder: 'e.g. 10000 Kms / 35+05 Days' },
  { header: 'VALID UPTO', label: 'Valid Upto', group: 'Load & BPC', inputType: 'text', placeholder: 'e.g. 20/09/2026' },
  { header: 'I.AT', label: 'BPC Issued At', group: 'Load & BPC', inputType: 'text' },
  { header: 'I.ON', label: 'BPC Issued On', group: 'Load & BPC', inputType: 'text' },
  { header: 'EX', label: 'EX', group: 'Load & BPC', inputType: 'text', placeholder: 'e.g. PCCT to CCCT' },
  { header: 'COMMODITY', label: 'Commodity', group: 'Load & BPC', inputType: 'text', placeholder: 'e.g. Clinker' },
  { header: 'COD', label: 'COD', group: 'Load & BPC', inputType: 'text' },
  { header: 'DEP', label: 'Taken Over Time', group: 'Load & BPC', inputType: 'text' },
  {
    header: 'TMR MOBILE NO', label: 'TMR Mobile No', group: 'Contact', inputType: 'tel',
    inputMode: 'numeric', maxLength: 10,
    pattern: /^[0-9]{10}$/, patternMessage: 'Must be a 10 digit mobile number',
    placeholder: '10 digit mobile no',
  },
];

export const FIELD_GROUPS: FieldGroup[] = ['Train & Loco', 'Load & BPC', 'Contact'];

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
