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
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../analytics';
import { ApiError, deleteOutreport, listOutreports } from '../api/client';
import { useOnline } from '../hooks/useOnline';
import { useOutbox } from '../hooks/useOutbox';
import { apiErrorMessage } from '../i18n/errors';
import { useBackClose } from '../nav/NavContext';
import { readListCache, writeListCache } from '../offline/listCache';
import { removeQueued } from '../offline/outbox';
import type { CachedList } from '../types';
import { isSameDay, formatTime } from '../utils/date';
import { rowToRecord } from '../utils/records';
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

export function SavedList({ sheet, refreshToken, onEdit }: Props) {
  const [data, setData] = useState<CachedList | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  // The error itself, not text: the message is resolved at render time.
  const [loadError, setLoadError] = useState<unknown>(null);
  const [search, setSearch] = useState('');
  const [day, setDay] = useState('');
  const [deleting, setDeleting] = useState<CardEntry | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [removingQueued, setRemovingQueued] = useState<CardEntry | null>(null);
  const online = useOnline();
  const outbox = useOutbox();
  const toast = useToast();
  const { t } = useTranslation();

  // Hardware back closes the local-remove confirm instead of leaving.
  useBackClose(removingQueued !== null, () => setRemovingQueued(null));

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
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
        setLoadError(err ?? new Error('load failed'));
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
      toast('success', t('saved.deleted'));
      trackEvent('outreport_deleted', { sheet });
      setDeleting(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'BAD_PIN' || err.code === 'PIN_NOT_CONFIGURED')) {
        forgetPin();
        setDeleteError(apiErrorMessage(err, t));
      } else if (err instanceof ApiError && err.code === 'NOT_FOUND') {
        toast('info', t('saved.alreadyDeleted'));
        setDeleting(null);
        await load();
      } else {
        setDeleteError(apiErrorMessage(err, t, t('saved.deleteFailed')));
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
      toast('info', t('saved.deleteNeedsConnection'));
      return;
    }
    setDeleteError('');
    setDeleting(entry);
  }

  function handleEdit(entry: CardEntry) {
    if (!entry.queueStatus && !online) {
      toast('info', t('saved.editNeedsConnection'));
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
          placeholder={t('saved.searchPlaceholder')}
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
            },
            // On the <input> itself: on the wrapper it never reached assistive tech.
            htmlInput: { 'aria-label': t('saved.searchLabel') },
          }}
        />
        <TextField
          size="small"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          sx={{ width: 155, flex: 'none' }}
          slotProps={{ htmlInput: { 'aria-label': t('saved.dateFilterLabel') } }}
        />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' }}>
        <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, pb: 'max(16px, env(safe-area-inset-bottom))' }}>
          {stale && data && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              {t('saved.staleBanner', { time: formatTime(data.fetchedAt) })}
            </Alert>
          )}

          {loading && !data && (
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              {t('saved.loading')}
            </Typography>
          )}
          {loadError !== null && !data && (
            <Typography sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
              {loadError instanceof ApiError ? apiErrorMessage(loadError, t) : t('saved.loadFailed')}
            </Typography>
          )}

          {data && (
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mb: 1 }}>
              {t('saved.count', { count: visible.length })}
              {data.total > data.rows.length
                ? t('saved.showingLatest', { shown: data.rows.length, total: data.total })
                : ''}
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
              {search || day ? t('saved.noMatch') : t('saved.empty')}
            </Typography>
          )}
        </Box>
      </Box>

      <PinDialog
        open={deleting !== null}
        title={t('saved.deleteTitle')}
        message={t('saved.deleteMessage', { train: deleting?.record['TR.NO'] || t('common.thisEntry') })}
        confirmLabel={t('common.delete')}
        busy={deleteBusy}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      <Dialog open={removingQueued !== null} onClose={() => setRemovingQueued(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('saved.removeTitle')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('saved.removeMessage', { train: removingQueued?.record['TR.NO'] || t('common.thisEntryCapital') })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setRemovingQueued(null)}>
            {t('saved.keepIt')}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              const entry = removingQueued;
              setRemovingQueued(null);
              if (entry) void removeQueued(entry.id).then(() => toast('success', t('saved.removed')));
            }}
          >
            {t('saved.remove')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
