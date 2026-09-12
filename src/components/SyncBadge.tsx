import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../hooks/useOnline';
import { useOutbox } from '../hooks/useOutbox';
import { flushOutbox } from '../offline/outbox';
import { useToast } from './Toast';

export function SyncBadge() {
  const online = useOnline();
  const outbox = useOutbox();
  const toast = useToast();
  const { t } = useTranslation();
  const syncable = outbox.filter((it) => it.status !== 'error').length;
  const broken = outbox.length - syncable;

  if (outbox.length === 0 && online) return null;

  const label = !online
    ? outbox.length
      ? t('sync.offlineWaiting', { count: outbox.length })
      : t('sync.offline')
    : syncable
      ? t('sync.toSync', { count: syncable })
      : t('sync.needFixing', { count: broken });

  async function syncNow() {
    if (!online) {
      toast('info', t('sync.stillOffline'));
      return;
    }
    if (!syncable) {
      toast('info', t('sync.rejected'));
      return;
    }
    const res = await flushOutbox();
    if (res.delivered) toast('success', t('sync.synced', { count: res.delivered }));
    else if (res.stopped) toast('error', t('sync.unreachable'));
    else if (res.failed) toast('error', t('sync.someNeedFixing'));
  }

  const dotColor = !online || (broken && !syncable) ? 'error.light' : 'warning.light';

  return (
    <Chip
      size="small"
      onClick={() => void syncNow()}
      label={label}
      title={t('sync.syncNow')}
      icon={
        <Box
          component="span"
          sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, ml: '6px !important' }}
        />
      }
      sx={{
        bgcolor: 'rgba(255,255,255,0.16)',
        color: '#fff',
        fontWeight: 600,
        '&:hover': { bgcolor: 'rgba(255,255,255,0.26)' },
      }}
    />
  );
}
