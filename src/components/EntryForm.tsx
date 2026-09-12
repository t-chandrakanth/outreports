import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ApiError, NetworkError, saveOutreport, updateOutreport } from '../api/client';
import { emptyRecord, FIELD_GROUPS, FIELDS } from '../config';
import { setFormDirty } from '../pwa';
import { enqueue, updateQueued } from '../offline/outbox';

/** Field headers contain spaces/() — unusable as-is in id/aria attributes. */
const fieldId = (header: string) => 'field-' + header.replace(/\W+/g, '-');
const errorId = (header: string) => 'err-' + header.replace(/\W+/g, '-');
import type { OutreportRecord } from '../types';
import { useToast } from './Toast';

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
}

export function EntryForm({ sheet, edit, onDone }: Props) {
  const [record, setRecord] = useState<OutreportRecord>(() => edit?.record ?? emptyRecord());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setRecord(edit?.record ?? emptyRecord());
    setErrors({});
  }, [edit, sheet]);

  const dirty = useMemo(() => {
    const base = edit?.record ?? emptyRecord();
    return FIELDS.some((f) => (record[f.header] ?? '') !== (base[f.header] ?? ''));
  }, [record, edit]);

  // A service-worker update reloads the page; hold it back while typing.
  const dirtyKey = useRef(Symbol('entry-form')).current;
  useEffect(() => {
    setFormDirty(dirtyKey, dirty);
    return () => setFormDirty(dirtyKey, false);
  }, [dirty, dirtyKey]);

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
            onDone({ refresh: false });
            return;
          }
          try {
            await updateOutreport(sheet, edit.id, rec); // it synced meanwhile
            toast('success', 'Outreport updated');
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
        onDone({ refresh: true });
        return;
      }

      const id = crypto.randomUUID();
      if (!navigator.onLine) {
        await enqueue(sheet, id, rec);
        toast('info', 'Saved on this device — will sync when online');
        reset();
        onDone({ refresh: false });
        return;
      }
      try {
        await saveOutreport(sheet, id, rec);
        toast('success', 'Outreport saved');
        reset();
        onDone({ refresh: true });
      } catch (err) {
        if (
          err instanceof NetworkError ||
          (err instanceof ApiError && (err.code === 'BUSY' || err.code === 'BAD_RESPONSE'))
        ) {
          // Keep the entry safe locally; the outbox will retry.
          await enqueue(sheet, id, rec);
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
    window.scrollTo({ top: 0 });
  }

  return (
    <form onSubmit={submit} noValidate>
      {groups.map((group) => (
        <fieldset className="fieldset" key={group.name}>
          <legend className="fieldset-legend">{group.name}</legend>
          {group.fields.map((f) => (
            <div className="field" key={f.header}>
              <label className="field-label" htmlFor={fieldId(f.header)}>
                {f.label} {f.required && <span className="req" aria-hidden="true">*</span>}
              </label>
              <input
                id={fieldId(f.header)}
                className="field-input"
                type={f.inputType}
                inputMode={f.inputMode}
                maxLength={f.maxLength}
                placeholder={f.placeholder}
                autoComplete="off"
                value={record[f.header] ?? ''}
                onChange={(e) => setValue(f.header, e.target.value)}
                aria-invalid={!!errors[f.header]}
                aria-describedby={errors[f.header] ? errorId(f.header) : undefined}
              />
              {errors[f.header] && (
                <div className="field-error" id={errorId(f.header)}>{errors[f.header]}</div>
              )}
            </div>
          ))}
        </fieldset>
      ))}

      <div className="savebar">
        <div className="savebar-inner">
          {edit ? (
            <>
              <button type="button" className="btn btn-quiet" onClick={() => onDone({ refresh: false })} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-save" disabled={saving}>
                {saving ? 'Updating…' : 'Update outreport'}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-quiet" onClick={reset} disabled={saving}>
                Clear
              </button>
              <button type="submit" className="btn btn-save" disabled={saving}>
                {saving ? 'Saving…' : 'Save outreport'}
              </button>
            </>
          )}
        </div>
      </div>
    </form>
  );
}
