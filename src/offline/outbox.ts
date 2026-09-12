/**
 * Offline outbox: new entries that could not be delivered are queued in
 * IndexedDB and flushed when connectivity returns.
 *
 * Semantics (see plan):
 * - Flush is single-flight and sequential.
 * - NetworkError / BUSY / BAD_RESPONSE -> stop the loop; items stay pending
 *   and are retried on the next trigger (online event, app start, manual).
 * - Other server rejections (e.g. VALIDATION) -> mark that item 'error' and
 *   continue; these never self-heal so they must not block the queue.
 * - duplicate:true from the server is a success (idempotent retry).
 */

import { get, update } from 'idb-keyval';
import { ApiError, NetworkError, saveOutreport } from '../api/client';
import type { OutreportRecord, QueueItem } from '../types';

const KEY = 'outbox:v1';

type Listener = (items: QueueItem[]) => void;
const listeners = new Set<Listener>();

export function subscribeOutbox(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function notify(): Promise<void> {
  const items = await getOutbox();
  listeners.forEach((fn) => fn(items));
}

export async function getOutbox(): Promise<QueueItem[]> {
  return (await get<QueueItem[]>(KEY)) ?? [];
}

export async function enqueue(sheet: string, id: string, record: OutreportRecord): Promise<void> {
  await update<QueueItem[]>(KEY, (items) => [
    ...(items ?? []),
    { id, sheet, record, createdAt: Date.now(), status: 'pending' },
  ]);
  // Best effort: ask the browser not to evict our queue (important on iOS).
  try {
    void navigator.storage?.persist?.();
  } catch {
    /* unsupported */
  }
  await notify();
}

/** Edit a queued (not yet delivered) entry in place. */
export async function updateQueued(id: string, record: OutreportRecord): Promise<void> {
  await update<QueueItem[]>(KEY, (items) =>
    (items ?? []).map((it) =>
      it.id === id ? { ...it, record, status: 'pending' as const, message: undefined } : it,
    ),
  );
  await notify();
}

/** Remove a queued entry (local only — it never reached the sheet). */
export async function removeQueued(id: string): Promise<void> {
  await update<QueueItem[]>(KEY, (items) => (items ?? []).filter((it) => it.id !== id));
  await notify();
}

async function setStatus(id: string, status: QueueItem['status'], message?: string): Promise<void> {
  await update<QueueItem[]>(KEY, (items) =>
    (items ?? []).map((it) => (it.id === id ? { ...it, status, message } : it)),
  );
  await notify();
}

let flushing: Promise<FlushResult> | null = null;

export interface FlushResult {
  delivered: number;
  failed: number;
  stopped: boolean; // true if the loop aborted on a retryable error
}

/** Single-flight: concurrent calls share one run. */
export function flushOutbox(): Promise<FlushResult> {
  flushing ??= doFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function doFlush(): Promise<FlushResult> {
  const result: FlushResult = { delivered: 0, failed: 0, stopped: false };
  const items = await getOutbox();

  for (const item of items) {
    if (item.status === 'error') continue; // needs user attention; skip
    await setStatus(item.id, 'syncing');
    try {
      await saveOutreport(item.sheet, item.id, item.record);
      await removeQueued(item.id);
      result.delivered += 1;
    } catch (err) {
      if (err instanceof NetworkError || (err instanceof ApiError && (err.code === 'BUSY' || err.code === 'BAD_RESPONSE'))) {
        // Retryable (or backend-misconfigured): keep pending, stop the loop.
        await setStatus(item.id, 'pending');
        result.stopped = true;
        break;
      }
      // Terminal rejection (VALIDATION etc.): flag it and keep going.
      await setStatus(item.id, 'error', err instanceof Error ? err.message : String(err));
      result.failed += 1;
    }
  }
  return result;
}
