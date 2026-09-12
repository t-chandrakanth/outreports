import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import { trackEvent } from '../analytics';
import { ApiError, deleteOutreport, listOutreports } from '../api/client';
import { useOnline } from '../hooks/useOnline';
import { useOutbox } from '../hooks/useOutbox';
import { useBackClose } from '../nav/NavContext';
import { readListCache, writeListCache } from '../offline/listCache';
import { removeQueued } from '../offline/outbox';
import type { CachedList, ListRow, OutreportRecord } from '../types';
import { isSameDay, formatTime } from '../utils/date';
import { forgetPin, rememberPin } from '../utils/pin';
import { PinDialog } from './PinDialog';
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
  const [removingQueued, setRemovingQueued] = useState<CardEntry | null>(null);
  const online = useOnline();
  const outbox = useOutbox();
  const toast = useToast();

  // Hardware back closes the local-remove confirm instead of leaving.
  useBackClose(removingQueued !== null, () => setRemovingQueued(null));

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
      trackEvent('outreport_deleted', { sheet });
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
      setRemovingQueued(entry);
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
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 'none', width: '100%', maxWidth: 640, mx: 'auto', px: 2, pt: 2, pb: 1, display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          type="search"
          placeholder="Search train, loco, BPC…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ flex: 1 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              'aria-label': 'Search saved outreports',
            },
          }}
        />
        <TextField
          size="small"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          sx={{ width: 155, flex: 'none' }}
          slotProps={{ htmlInput: { 'aria-label': 'Filter by date' } }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' }}>
        <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pb: 'max(16px, env(safe-area-inset-bottom))' }}>
          {stale && data && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Offline — showing list as of {formatTime(data.fetchedAt)}
            </Alert>
          )}

          {loading && !data && (
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              Loading saved outreports…
            </Typography>
          )}
          {loadError && !data && (
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>{loadError}</Typography>
          )}

          {data && (
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 1 }}>
              {visible.length} outreport{visible.length === 1 ? '' : 's'}
              {data.total > data.rows.length ? ` · showing latest ${data.rows.length} of ${data.total}` : ''}
            </Typography>
          )}

          {visible.map((entry, idx) => (
            <RecordCard
              key={entry.id || `noid-${idx}`}
              sheet={sheet}
              entry={entry}
              onEdit={handleEdit}
              onDelete={requestDelete}
            />
          ))}

          {!loading && data && visible.length === 0 && (
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              {search || day ? 'No outreports match the filter.' : 'No outreports saved yet — add one in New entry.'}
            </Typography>
          )}
        </Box>
      </Box>

      <PinDialog
        open={deleting !== null}
        title="Delete outreport"
        message={`Deleting ${deleting?.record['TR.NO'] || 'this entry'} removes it from the shared sheet for everyone. Enter the PIN to confirm.`}
        confirmLabel="Delete"
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <Dialog open={removingQueued !== null} onClose={() => setRemovingQueued(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Remove unsent entry?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {removingQueued?.record['TR.NO'] || 'This entry'} has not been sent to the shared sheet yet.
            Removing it deletes it from this device only.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRemovingQueued(null)}>
            Keep it
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const entry = removingQueued;
              setRemovingQueued(null);
              if (entry) void removeQueued(entry.id).then(() => toast('success', 'Entry removed'));
            }}
          >
            Remove
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
