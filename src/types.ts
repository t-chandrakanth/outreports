/** A record keyed by the exact sheet column headers. */
export type OutreportRecord = Record<string, string>;

export interface ListRow {
  id: string;
  cells: string[];
}

export interface ListResponse {
  ok: true;
  headers: string[];
  rows: ListRow[];
  total: number;
}

export type ApiErrorCode =
  | 'BAD_JSON'
  | 'UNKNOWN_ACTION'
  | 'BAD_SHEET'
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'BAD_PIN'
  | 'PIN_NOT_CONFIGURED'
  | 'BUSY'
  | 'INTERNAL'
  | 'BAD_RESPONSE'; // client-side: response was not valid JSON (misdeployed backend)

export type QueueStatus = 'pending' | 'syncing' | 'error';

export interface QueueItem {
  id: string;
  sheet: string;
  record: OutreportRecord;
  createdAt: number;
  status: QueueStatus;
  message?: string;
}

export interface CachedList {
  fetchedAt: number;
  headers: string[];
  rows: ListRow[];
  total: number;
}
