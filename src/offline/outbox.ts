/**
 * Offline outbox: new entries that could not be delivered are queued in
 * IndexedDB and flushed when connectivity returns.
 *
 * Semantics:
 * - Flush is single-flight and sequential.
 * - Before each send the item is RE-READ from the store: an item deleted
 *   locally mid-flush is skipped (never published), and the CURRENT record is
 *   sent, not a stale snapshot.
 * - After a successful send the item is removed only if its record still
 *   matches what was sent; if the user edited it while the request was in
 *   flight, the edit is pushed with an update call before removal.
 * - NetworkError / BUSY / BAD_RESPONSE -> stop the loop; items stay pending
 *   and are retried on the next trigger (online event, app start, manual).
 * - Other server rejections (e.g. VALIDATION) -> mark that item 'error' and
 *   continue; these never self-heal so they must not block the queue.
 * - duplicate:true from the server is a success (idempotent retry).
 */

import { trackEvent } from '../analytics';
import { get, update } from 'idb-keyval';
import { ApiError, NetworkError, saveOutreport, updateOutreport } from '../api/client';
import { canonicalSheet } from '../config';
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

/**
 * Repairs the queue on app start, before any flush:
 * - Items persisted as 'syncing' by a flush that never finished (app killed
 *   mid-request) must not stay locked forever: reset them to 'pending'.
 * - Items queued under a since-renamed sheet tab are moved to the current
 *   name, so they show up (and can be edited/removed) on that tab's screen.
 */
export async function normalizeOutbox(): Promise<void> {
  let changed = false;
  await update<QueueItem[]>(KEY, (items) =>
    (items ?? []).map((it) => {
      let next = it;
      if (next.status === 'syncing') {
        changed = true;
        next = { ...next, status: 'pending' as const };
      }
      const sheet = canonicalSheet(next.sheet);
      if (sheet !== next.sheet) {
        changed = true;
        next = { ...next, sheet };
      }
      return next;
    }),
  );
  if (changed) await notify();
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

/**
 * Edit a queued (not yet delivered) entry in place.
 * Returns false when the entry is no longer in the queue (already delivered
 * by a flush, or removed locally) — the caller must NOT report success then.
 */
export async function updateQueued(id: string, record: OutreportRecord): Promise<boolean> {
  let matched = false;
  await update<QueueItem[]>(KEY, (items) =>
    (items ?? []).map((it) => {
      if (it.id !== id) return it;
      matched = true;
      return { ...it, record, status: 'pending' as const, message: undefined };
    }),
  );
  await notify();
  return matched;
}

/** Remove a queued entry (local only — it never reached the sheet). */
export async function removeQueued(id: string): Promise<void> {
  await update<QueueItem[]>(KEY, (items) => (items ?? []).filter((it) => it.id !== id));
  await notify();
}

async function readItem(id: string): Promise<QueueItem | undefined> {
  return (await getOutbox()).find((it) => it.id === id);
}

async function setStatus(id: string, status: QueueItem['status'], message?: string): Promise<void> {
  await update<QueueItem[]>(KEY, (items) =>
    (items ?? []).map((it) => (it.id === id ? { ...it, status, message } : it)),
  );
  await notify();
}

/** Remove the item only if its record is still exactly what was delivered. */
async function removeIfUnchanged(id: string, delivered: OutreportRecord): Promise<boolean> {
  let removed = false;
  await update<QueueItem[]>(KEY, (items) =>
    (items ?? []).filter((it) => {
      if (it.id !== id) return true;
      if (JSON.stringify(it.record) === JSON.stringify(delivered)) {
        removed = true;
        return false;
      }
      return true; // record changed mid-flight: keep it for reconciliation
    }),
  );
  await notify();
  return removed;
}

let flushing: Promise<FlushResult> | null = null;

/**
 * Reported once per flush run (not per caller: runs are shared). Empty runs
 * and retryable stops are routine offline behaviour and are not reported,
 * which keeps the 60 s retry timer from emitting an event every minute.
 */
function reportFlush(res: FlushResult): void {
  if (res.delivered > 0) trackEvent('queue_synced', { delivered: res.delivered, stopped: res.stopped });
  if (res.failed > 0) trackEvent('queue_failed', { failed: res.failed, stopped: res.stopped });
}

export interface FlushResult {
  delivered: number;
  failed: number;
  stopped: boolean; // true if the loop aborted on a retryable error
}

/** Single-flight: concurrent calls share one run. */
export function flushOutbox(): Promise<FlushResult> {
  flushing ??= doFlush()
    .then((res) => {
      reportFlush(res);
      return res;
    })
    .finally(() => {
      flushing = null;
    });
  return flushing;
}

function isRetryable(err: unknown): boolean {
  return (
    err instanceof NetworkError ||
    (err instanceof ApiError && (err.code === 'BUSY' || err.code === 'BAD_RESPONSE'))
  );
}

async function doFlush(): Promise<FlushResult> {
  const result: FlushResult = { delivered: 0, failed: 0, stopped: false };
  const ids = (await getOutbox()).map((it) => it.id);

  for (const id of ids) {
    // Re-read: the item may have been edited or deleted since the snapshot.
    const item = await readItem(id);
    if (!item || item.status === 'error') continue;

    await setStatus(id, 'syncing');
    const sending = item.record;
    try {
      const { duplicate } = await saveOutreport(item.sheet, id, sending);
      if (duplicate) {
        // The id was delivered by an earlier interrupted flush — but possibly
        // with older content (a later edit re-queued this item). The server's
        // duplicate check does not compare content, so push the current
        // record to make the sheet match.
        await updateOutreport(item.sheet, id, sending);
      }
      let done = await removeIfUnchanged(id, sending);
      if (!done) {
        // Edited while the save was in flight (a plain retry would hit the
        // server's duplicate-id check and drop the edit): push the current
        // record as an update, then remove.
        const current = await readItem(id);
        if (current) {
          await updateOutreport(current.sheet, id, current.record);
          done = await removeIfUnchanged(id, current.record);
          if (!done) await setStatus(id, 'pending'); // edited again: next flush
        }
      }
      result.delivered += 1;
    } catch (err) {
      if (isRetryable(err)) {
        // Retryable (or backend-misconfigured): keep pending, stop the loop.
        await setStatus(id, 'pending');
        result.stopped = true;
        break;
      }
      // Terminal rejection (VALIDATION etc.): flag it and keep going.
      await setStatus(id, 'error', err instanceof Error ? err.message : String(err));
      result.failed += 1;
    }
  }
  return result;
}
