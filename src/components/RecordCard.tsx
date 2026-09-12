import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CardActionArea from '@mui/material/CardActionArea';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
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

  const accent =
    entry.queueStatus === 'error' ? 'error.main' : entry.queueStatus ? 'warning.main' : 'transparent';

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
    <Card component="article" sx={{ mb: 1.5, borderRadius: 2, borderLeft: '4px solid', borderLeftColor: accent }}>
      <CardActionArea onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {record[SUMMARY.trainNo] || '—'}
              {record[SUMMARY.locoNo] && (
                <Typography component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 1 }}>
                  {record[SUMMARY.locoNo]}
                </Typography>
              )}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
              {record[SUMMARY.date]}
            </Typography>
          </Box>
          {entry.queueStatus === 'error' && <Chip label="needs fix" color="error" size="small" />}
          {(entry.queueStatus === 'pending' || entry.queueStatus === 'syncing') && (
            <Chip
              label={entry.queueStatus === 'syncing' ? 'syncing…' : 'waiting to sync'}
              color="warning"
              size="small"
              variant="outlined"
            />
          )}
          <ExpandMoreIcon
            sx={{
              color: 'text.secondary',
              transition: 'transform 180ms',
              transform: open ? 'rotate(180deg)' : 'none',
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          />
        </Box>
      </CardActionArea>

      <Collapse in={open} unmountOnExit>
        <Divider />
        <Box sx={{ px: 2, py: 1.5 }}>
          {entry.queueStatus === 'error' && entry.queueMessage && (
            <Alert severity="error" sx={{ mb: 1.5 }}>
              {entry.queueMessage} — edit this entry and save again.
            </Alert>
          )}
          <Box component="dl" className="detail-grid">
            {FIELDS.map((f) => {
              const value = (record[f.header] ?? '').trim();
              if (!value) return null;
              return (
                <Box key={f.header} sx={{ display: 'contents' }}>
                  <dt>{f.label}</dt>
                  <dd>{value}</dd>
                </Box>
              );
            })}
          </Box>
        </Box>
        <CardActions sx={{ px: 1.5, pb: 1.5, pt: 0, gap: 0.5, flexWrap: 'wrap' }}>
          <Button
            size="small"
            startIcon={<EditOutlinedIcon />}
            onClick={() => onEdit(entry)}
            disabled={entry.queueStatus === 'syncing' || noId}
            title={noId ? 'Refresh the list to enable editing' : undefined}
          >
            Edit
          </Button>
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={copy}>
            WhatsApp
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => onDelete(entry)}
            disabled={entry.queueStatus === 'syncing' || noId}
            title={noId ? 'Refresh the list to enable deleting' : undefined}
          >
            Delete
          </Button>
        </CardActions>
      </Collapse>
    </Card>
  );
}
