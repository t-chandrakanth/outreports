/**
 * Last-good copy of each sheet's list response so the Saved tab still renders
 * offline. Workbox deliberately does NOT cache the API (redirected one-time
 * googleusercontent URLs are not cacheable at the HTTP layer) — this app-level
 * cache is keyed by logical sheet name instead.
 */

import { get, set } from 'idb-keyval';
import type { CachedList, ListResponse } from '../types';

const key = (sheet: string) => `cache:list:${sheet}`;

export async function readListCache(sheet: string): Promise<CachedList | undefined> {
  return get<CachedList>(key(sheet));
}

export async function writeListCache(sheet: string, res: ListResponse): Promise<void> {
  const cached: CachedList = {
    fetchedAt: Date.now(),
    headers: res.headers,
    rows: res.rows,
    total: res.total,
  };
  await set(key(sheet), cached);
}
