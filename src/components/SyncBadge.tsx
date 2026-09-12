import { useOnline } from '../hooks/useOnline';
import { useOutbox } from '../hooks/useOutbox';
import { flushOutbox } from '../offline/outbox';
import { useToast } from './Toast';

export function SyncBadge() {
  const online = useOnline();
  const outbox = useOutbox();
  const toast = useToast();
  const syncable = outbox.filter((it) => it.status !== 'error').length;
  const broken = outbox.length - syncable;

  if (outbox.length === 0 && online) return null;

  const label = !online
    ? outbox.length ? `Offline · ${outbox.length} waiting` : 'Offline'
    : syncable
      ? `${syncable} to sync`
      : `${broken} need${broken === 1 ? 's' : ''} fixing`;

  async function syncNow() {
    if (!online) {
      toast('info', 'Still offline — entries will sync when connection returns');
      return;
    }
    if (!syncable) {
      toast('info', 'These entries were rejected — open Saved and edit them to retry');
      return;
    }
    const res = await flushOutbox();
    if (res.delivered) toast('success', `Synced ${res.delivered} outreport${res.delivered > 1 ? 's' : ''}`);
    else if (res.stopped) toast('error', 'Could not reach Google Sheets — will retry');
    else if (res.failed) toast('error', 'Some entries need fixing — see Saved tab');
  }

  return (
    <button className="sync-badge" onClick={syncNow} title="Sync now">
      <span className={`sync-dot${online ? '' : ' sync-dot--offline'}`} />
      {label}
    </button>
  );
}
