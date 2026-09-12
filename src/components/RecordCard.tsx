import { useState } from 'react';
import { FIELDS, SUMMARY } from '../config';
import type { OutreportRecord, QueueStatus } from '../types';
import { buildWhatsAppText, copyOrShare } from '../utils/whatsapp';
import { useToast } from './Toast';

export interface CardEntry {
  id: string;
  record: OutreportRecord;
  /** undefined = synced to the sheet */
  queueStatus?: QueueStatus;
  queueMessage?: string;
}

interface Props {
  sheet: string;
  entry: CardEntry;
  onEdit: (entry: CardEntry) => void;
  onDelete: (entry: CardEntry) => void;
}

export function RecordCard({ sheet, entry, onEdit, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const { record } = entry;

  const cls =
    entry.queueStatus === 'error'
      ? 'card card--error'
      : entry.queueStatus
        ? 'card card--pending'
        : 'card';

  // A legacy row can arrive before the server assigned it an _ID (backfill
  // lock was contended). Without an id it cannot be edited or deleted yet.
  const noId = !entry.queueStatus && !entry.id;

  async function copy() {
    try {
      const how = await copyOrShare(buildWhatsAppText(sheet, record));
      toast('success', how === 'copied' ? 'Copied — paste into WhatsApp' : 'Shared');
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not copy');
    }
  }

  return (
    <article className={cls}>
      <button
        type="button"
        className="card-head"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="card-train">{record[SUMMARY.trainNo] || '—'}</span>
        <span className="card-loco">{record[SUMMARY.locoNo]}</span>
        {entry.queueStatus === 'error' && <span className="chip chip--error">needs fix</span>}
        {(entry.queueStatus === 'pending' || entry.queueStatus === 'syncing') && (
          <span className="chip chip--pending">
            {entry.queueStatus === 'syncing' ? 'syncing…' : 'waiting to sync'}
          </span>
        )}
        <span className="card-date">{record[SUMMARY.date]}</span>
      </button>

      {open && (
        <div className="card-body">
          {entry.queueStatus === 'error' && entry.queueMessage && (
            <div className="card-error-msg">{entry.queueMessage} — edit this entry and save again.</div>
          )}
          <dl className="detail-grid">
            {FIELDS.map((f) => {
              const value = (record[f.header] ?? '').trim();
              if (!value) return null;
              return (
                <div key={f.header} style={{ display: 'contents' }}>
                  <dt>{f.label}</dt>
                  <dd>{value}</dd>
                </div>
              );
            })}
          </dl>
          <div className="card-actions">
            <button
              type="button"
              className="btn btn-quiet btn-small"
              onClick={() => onEdit(entry)}
              disabled={entry.queueStatus === 'syncing' || noId}
              title={noId ? 'Refresh the list to enable editing' : undefined}
            >
              Edit
            </button>
            <button type="button" className="btn btn-quiet btn-small" onClick={copy}>
              Copy for WhatsApp
            </button>
            <button
              type="button"
              className="btn btn-danger btn-small"
              onClick={() => onDelete(entry)}
              disabled={entry.queueStatus === 'syncing' || noId}
              title={noId ? 'Refresh the list to enable deleting' : undefined}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
