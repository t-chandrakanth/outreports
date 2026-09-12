import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '../analytics';
import { ApiError, NetworkError, saveOutreport, updateOutreport } from '../api/client';
import { emptyRecord, FIELD_GROUPS, FIELDS } from '../config';
import { apiErrorMessage } from '../i18n/errors';
import { fieldErrorText, fieldLabel, fieldPlaceholder, validateField, type FieldErrorKind } from '../i18n/fields';
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
  // Error kinds, not text: messages are resolved at render time so they follow a language switch.
  const [errors, setErrors] = useState<Partial<Record<string, FieldErrorKind>>>({});
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const { t } = useTranslation();

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
    if (errors[header]) setErrors((e) => ({ ...e, [header]: undefined }));
  }

  function validate(): boolean {
    const next: Record<string, FieldErrorKind> = {};
    for (const f of FIELDS) {
      const kind = validateField(f, (record[f.header] ?? '').trim());
      if (kind) next[f.header] = kind;
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
            toast('success', t('form.queuedUpdated'));
            trackEvent('outreport_updated', { sheet, queued: true });
            onDone({ refresh: false });
            return;
          }
          try {
            await updateOutreport(sheet, edit.id, rec); // it synced meanwhile
            toast('success', t('form.updated'));
            trackEvent('outreport_updated', { sheet, queued: false });
            onDone({ refresh: true });
          } catch (err) {
            if (err instanceof ApiError && err.code === 'NOT_FOUND') {
              toast('error', t('form.noLongerExists'));
              onDone({ refresh: true });
            } else {
              throw err;
            }
          }
          return;
        }
        await updateOutreport(sheet, edit.id, rec);
        toast('success', t('form.updated'));
        trackEvent('outreport_updated', { sheet, queued: false });
        onDone({ refresh: true });
        return;
      }

      const id = crypto.randomUUID();
      if (!navigator.onLine) {
        await enqueue(sheet, id, rec);
        toast('info', t('form.queuedSaved'));
        trackEvent('outreport_saved', { sheet, mode: 'queued' });
        reset();
        onDone({ refresh: false });
        return;
      }
      try {
        await saveOutreport(sheet, id, rec);
        toast('success', t('form.saved'));
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
              ? t('form.backendNotSetUp')
              : t('form.noConnectionQueued'),
          );
          reset();
          onDone({ refresh: false });
        } else {
          throw err;
        }
      }
    } catch (err) {
      toast('error', apiErrorMessage(err, t, t('form.saveFailed')));
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
                {t(`groups.${group.name}`)}
              </Typography>
              <Stack spacing={2.25}>
                {group.fields.map((f) => (
                  <TextField
                    key={f.header}
                    id={fieldId(f.header)}
                    label={fieldLabel(f, t)}
                    required={f.required}
                    type={f.inputType}
                    placeholder={fieldPlaceholder(f, t)}
                    value={record[f.header] ?? ''}
                    onChange={(e) => setValue(f.header, e.target.value)}
                    error={!!errors[f.header]}
                    helperText={fieldErrorText(f, errors[f.header], t)}
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
                {t('common.cancel')}
              </Button>
              <Button type="submit" size="large" variant="contained" color="success" disabled={saving} sx={{ flex: 1 }}>
                {saving ? t('form.updating') : t('form.update')}
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
                {t('form.clear')}
              </Button>
              <Button type="submit" size="large" variant="contained" color="success" disabled={saving} sx={{ flex: 1 }}>
                {saving ? t('form.saving') : t('form.save')}
              </Button>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
