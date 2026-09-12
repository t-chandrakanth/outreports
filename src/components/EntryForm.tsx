import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { trackEvent } from '../analytics';
import { ApiError, NetworkError, saveOutreport, updateOutreport } from '../api/client';
import { emptyRecord, FIELD_GROUPS, FIELDS } from '../config';
import { setFormDirty } from '../pwa';
import { enqueue, updateQueued } from '../offline/outbox';
import type { OutreportRecord } from '../types';
import { useToast } from './Toast';

/** Field headers contain spaces/() — unusable as-is in id/aria attributes. */
const fieldId = (header: string) => 'field-' + header.replace(/\W+/g, '-');

export interface EditTarget {
  id: string;
  record: OutreportRecord;
  /** true when the entry lives only in the offline outbox */
  queued: boolean;
}

interface Props {
  sheet: string;
  edit: EditTarget | null;
  onDone: (opts: { refresh: boolean }) => void;
  /** edit mode: dedicated cancel action (back without saving) */
  onCancel?: () => void;
  /** reports unsaved-changes state (drives the back guard) */
  onDirtyChange?: (dirty: boolean) => void;
}

export function EntryForm({ sheet, edit, onDone, onCancel, onDirtyChange }: Props) {
  const [record, setRecord] = useState<OutreportRecord>(() => edit?.record ?? emptyRecord());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  useEffect(() => {
    setRecord(edit?.record ?? emptyRecord());
    setErrors({});
  }, [edit, sheet]);

  const dirty = useMemo(() => {
    const base = edit?.record ?? emptyRecord();
    // Read-only fields are auto-stamped (minute resolution) and would drift
    // against a freshly built baseline; they never count as user edits.
    return FIELDS.some((f) => !f.readOnly && (record[f.header] ?? '') !== (base[f.header] ?? ''));
  }, [record, edit]);

  // A service-worker update reloads the page; hold it back while typing.
  const dirtyKey = useRef(Symbol('entry-form')).current;
  useEffect(() => {
    setFormDirty(dirtyKey, dirty);
    return () => setFormDirty(dirtyKey, false);
  }, [dirty, dirtyKey]);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);

  const groups = useMemo(
    () => FIELD_GROUPS.map((g) => ({ name: g, fields: FIELDS.filter((f) => f.group === g) })),
    [],
  );

  function setValue(header: string, value: string) {
    setRecord((r) => ({ ...r, [header]: value }));
    if (errors[header]) setErrors((e) => ({ ...e, [header]: '' }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    for (const f of FIELDS) {
      const value = (record[f.header] ?? '').trim();
      if (f.required && !value) next[f.header] = `${f.label} is required`;
      else if (value && f.pattern && !f.pattern.test(value)) next[f.header] = f.patternMessage ?? 'Invalid value';
    }
    setErrors(next);
    const firstBad = FIELDS.find((f) => next[f.header]);
    if (firstBad) document.getElementById(fieldId(firstBad.header))?.focus();
    return Object.keys(next).length === 0;
  }

  function trimmed(): OutreportRecord {
    const out: OutreportRecord = {};
    for (const f of FIELDS) out[f.header] = (record[f.header] ?? '').trim();
    return out;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    const rec = trimmed();

    try {
      if (edit) {
        if (edit.queued) {
          // The entry may have left the outbox while this form was open
          // (a flush delivered it, or it was removed locally) — a blind
          // queue update would silently discard the edit.
          const stillQueued = await updateQueued(edit.id, rec);
          if (stillQueued) {
            toast('success', 'Entry updated — will sync when online');
            trackEvent('outreport_updated', { sheet, queued: true });
            onDone({ refresh: false });
            return;
          }
          try {
            await updateOutreport(sheet, edit.id, rec); // it synced meanwhile
            toast('success', 'Outreport updated');
            trackEvent('outreport_updated', { sheet, queued: false });
            onDone({ refresh: true });
          } catch (err) {
            if (err instanceof ApiError && err.code === 'NOT_FOUND') {
              toast('error', 'This entry no longer exists — it was removed');
              onDone({ refresh: true });
            } else {
              throw err;
            }
          }
          return;
        }
        await updateOutreport(sheet, edit.id, rec);
        toast('success', 'Outreport updated');
        trackEvent('outreport_updated', { sheet, queued: false });
        onDone({ refresh: true });
        return;
      }

      const id = crypto.randomUUID();
      if (!navigator.onLine) {
        await enqueue(sheet, id, rec);
        toast('info', 'Saved on this device — will sync when online');
        trackEvent('outreport_saved', { sheet, mode: 'queued' });
        reset();
        onDone({ refresh: false });
        return;
      }
      try {
        await saveOutreport(sheet, id, rec);
        toast('success', 'Outreport saved');
        trackEvent('outreport_saved', { sheet, mode: 'online' });
        reset();
        onDone({ refresh: true });
      } catch (err) {
        if (
          err instanceof NetworkError ||
          (err instanceof ApiError && (err.code === 'BUSY' || err.code === 'BAD_RESPONSE'))
        ) {
          // Keep the entry safe locally; the outbox will retry.
          await enqueue(sheet, id, rec);
          trackEvent('outreport_saved', { sheet, mode: 'queued' });
          toast(
            'info',
            err instanceof ApiError && err.code === 'BAD_RESPONSE'
              ? 'Saved on this device — the Google Apps Script backend is not set up yet'
              : 'No connection to Google Sheets — saved on this device, will sync',
          );
          reset();
          onDone({ refresh: false });
        } else {
          throw err;
        }
      }
    } catch (err) {
      toast('error', err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setRecord(emptyRecord());
    setErrors({});
    scrollRef.current?.scrollTo({ top: 0 });
  }

  return (
    <Box
      component="form"
      onSubmit={submit}
      noValidate
      sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
    >
      <Box ref={scrollRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' }}>
        <Box sx={{ maxWidth: 640, mx: 'auto', px: 2, py: 2.5 }}>
          {groups.map((group) => (
            <Box component="fieldset" key={group.name} sx={{ border: 0, m: 0, mb: 3.5, p: 0, minWidth: 0 }}>
              <Typography
                component="legend"
                variant="subtitle2"
                sx={{
                  color: 'primary.main',
                  fontWeight: 700,
                  mb: 2,
                  pb: 0.5,
                  px: 0,
                  width: '100%',
                  borderBottom: '2px solid',
                  borderColor: 'divider',
                }}
              >
                {group.name}
              </Typography>
              <Stack spacing={2.25}>
                {group.fields.map((f) => (
                  <TextField
                    key={f.header}
                    id={fieldId(f.header)}
                    label={f.label}
                    required={f.required}
                    type={f.inputType}
                    placeholder={f.placeholder}
                    value={record[f.header] ?? ''}
                    onChange={(e) => setValue(f.header, e.target.value)}
                    error={!!errors[f.header]}
                    helperText={errors[f.header] || undefined}
                    slotProps={{
                      htmlInput: {
                        inputMode: f.inputMode,
                        maxLength: f.maxLength,
                        autoComplete: 'off',
                      },
                      input: f.readOnly ? { readOnly: true } : undefined,
                      formHelperText: errors[f.header] ? { role: 'alert' } : undefined,
                    }}
                  />
                ))}
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>
      <Paper
        square
        elevation={8}
        sx={{ flex: 'none', borderTop: '1px solid', borderColor: 'divider' }}
      >
        <Box
          sx={{
            maxWidth: 640,
            mx: 'auto',
            display: 'flex',
            gap: 1.5,
            p: 1.5,
            pb: 'max(12px, env(safe-area-inset-bottom))',
          }}
        >
          {edit ? (
            <>
              <Button
                size="large"
                variant="outlined"
                color="inherit"
                onClick={onCancel ?? (() => onDone({ refresh: false }))}
                disabled={saving}
                sx={{ flex: '0 0 auto' }}
              >
                Cancel
              </Button>
              <Button type="submit" size="large" variant="contained" color="success" disabled={saving} sx={{ flex: 1 }}>
                {saving ? 'Updating…' : 'Update outreport'}
              </Button>
            </>
          ) : (
            <>
              <Button
                size="large"
                variant="outlined"
                color="inherit"
                onClick={reset}
                disabled={saving}
                sx={{ flex: '0 0 auto' }}
              >
                Clear
              </Button>
              <Button type="submit" size="large" variant="contained" color="success" disabled={saving} sx={{ flex: 1 }}>
                {saving ? 'Saving…' : 'Save outreport'}
              </Button>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
