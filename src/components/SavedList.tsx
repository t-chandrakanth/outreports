import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, deleteOutreport, listOutreports } from '../api/client';
import { useOnline } from '../hooks/useOnline';
import { useOutbox } from '../hooks/useOutbox';
import { readListCache, writeListCache } from '../offline/listCache';
import { removeQueued } from '../offline/outbox';
import type { CachedList, ListRow, OutreportRecord } from '../types';
import { isSameDay, formatTime } from '../utils/date';
import { forgetPin, PinDialog, rememberPin } from './PinDialog';
import { RecordCard, type CardEntry } from './RecordCard';
import { useToast } from './Toast';

interface Props {
  sheet: string;
  /** bump to refetch (e.g. after an online save) */
  refreshToken: number;
  onEdit: (entry: CardEntry) => void;
}

function rowToRecord(headers: string[], row: ListRow): OutreportRecord {
  const rec: OutreportRecord = {};
  headers.forEach((h, i) => {
    rec[h] = row.cells[i] ?? '';
  });
  return rec;
}

export function SavedList({ sheet, refreshToken, onEdit }: Props) {
  const [data, setData] = useState<CachedList | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [day, setDay] = useState('');
  const [deleting, setDeleting] = useState<CardEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const online = useOnline();
  const outbox = useOutbox();
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await listOutreports(sheet);
      const fresh: CachedList = {
        fetchedAt: Date.now(),
        headers: res.headers,
        rows: res.rows,
        total: res.total,
      };
      setData(fresh);
      setStale(false);
      await writeListCache(sheet, res);
    } catch (err) {
      const cached = await readListCache(sheet);
      if (cached) {
        setData(cached);
        setStale(true);
      } else {
        setLoadError(
          err instanceof ApiError
            ? err.message
            : 'Could not load saved outreports — check your connection.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, [sheet]);

  useEffect(() => {
    void load();
  }, [load, refreshToken]);

  // When a queued entry for this sheet leaves the outbox (delivered by a
  // flush, or removed locally), refetch so the row doesn't vanish from view.
  const prevQueuedIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const ids = new Set(outbox.filter((it) => it.sheet === sheet).map((it) => it.id));
    const prev = prevQueuedIds.current;
    prevQueuedIds.current = ids;
    for (const id of prev) {
      if (!ids.has(id)) {
        void load();
        return;
      }
    }
  }, [outbox, sheet, load]);

  // Queued entries for this sheet appear on top, newest first.
  const queuedEntries: CardEntry[] = useMemo(
    () =>
      outbox
        .filter((it) => it.sheet === sheet)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((it) => ({
          id: it.id,
          record: it.record,
          queueStatus: it.status,
          queueMessage: it.message,
        })),
    [outbox, sheet],
  );

  const syncedEntries: CardEntry[] = useMemo(() => {
    if (!data) return [];
    const queuedIds = new Set(queuedEntries.map((q) => q.id));
    return data.rows
      .filter((r) => !queuedIds.has(r.id))
      .map((r) => ({ id: r.id, record: rowToRecord(data.headers, r) }));
  }, [data, queuedEntries]);

  const visible = useMemo(() => {
    const all = [...queuedEntries, ...syncedEntries];
    const q = search.trim().toLowerCase();
    return all.filter((e) => {
      if (day && !isSameDay(e.record['DATE'] ?? '', day)) return false;
      if (!q) return true;
      return Object.values(e.record).some((v) => v.toLowerCase().includes(q));
    });
  }, [queuedEntries, syncedEntries, search, day]);

  async function confirmDelete(pin: string) {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await deleteOutreport(sheet, deleting.id, pin);
      rememberPin(pin);
      toast('success', 'Outreport deleted');
      setDeleting(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'BAD_PIN' || err.code === 'PIN_NOT_CONFIGURED')) {
        forgetPin();
        setDeleteError(err.message);
      } else if (err instanceof ApiError && err.code === 'NOT_FOUND') {
        toast('info', 'Already deleted by someone else');
        setDeleting(null);
        await load();
      } else {
        setDeleteError(err instanceof Error ? err.message : 'Could not delete');
      }
    } finally {
      setDeleteBusy(false);
    }
  }

  function requestDelete(entry: CardEntry) {
    if (entry.queueStatus) {
      // Local-only entry: never reached the shared sheet, no PIN needed.
      if (window.confirm('Remove this unsent entry from this device?')) {
        void removeQueued(entry.id).then(() => toast('success', 'Entry removed'));
      }
      return;
    }
    if (!online) {
      toast('info', 'Deleting needs a connection');
      return;
    }
    setDeleteError('');
    setDeleting(entry);
  }

  function handleEdit(entry: CardEntry) {
    if (!entry.queueStatus && !online) {
      toast('info', 'Editing a synced outreport needs a connection');
      return;
    }
    onEdit(entry);
  }

  return (
    <>
      <div className="list-tools">
        <input
          className="field-input list-tools-search"
          type="search"
          placeholder="Search train, loco, BPC…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search saved outreports"
        />
        <input
          className="field-input list-tools-date"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          aria-label="Filter by date"
        />
      </div>

      {stale && data && (
        <div className="stale-banner">
          Offline — showing list as of {formatTime(data.fetchedAt)}
        </div>
      )}

      {loading && !data && <div className="empty">Loading saved outreports…</div>}
      {loadError && !data && <div className="empty">{loadError}</div>}

      {data && (
        <p className="list-meta">
          {visible.length} outreport{visible.length === 1 ? '' : 's'}
          {data.total > data.rows.length ? ` · showing latest ${data.rows.length} of ${data.total}` : ''}
        </p>
      )}

      {visible.map((entry) => (
        <RecordCard
          key={entry.id}
          sheet={sheet}
          entry={entry}
          onEdit={handleEdit}
          onDelete={requestDelete}
        />
      ))}

      {!loading && data && visible.length === 0 && (
        <div className="empty">
          {search || day ? 'No outreports match the filter.' : 'No outreports saved yet — add one in New entry.'}
        </div>
      )}

      {deleting && (
        <PinDialog
          title="Delete outreport"
          message={`Deleting ${deleting.record['TR.NO'] || 'this entry'} removes it from the shared sheet for everyone. Enter the PIN to confirm.`}
          confirmLabel="Delete"
          busy={deleteBusy}
          error={deleteError}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
