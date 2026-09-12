import type { TFunction } from 'i18next';
import type { FieldDef } from '../config';

export type FieldErrorKind = 'required' | 'pattern';

export function fieldLabel(f: FieldDef, t: TFunction): string {
  return t(`fields.${f.key}`);
}

export function fieldPlaceholder(f: FieldDef, t: TFunction): string | undefined {
  if (!f.placeholder) return undefined;
  return 'example' in f.placeholder
    ? t('form.example', { value: f.placeholder.example })
    : t(`form.${f.placeholder.hint}`);
}

/** Validates one trimmed value; returns the error kind or undefined. */
export function validateField(f: FieldDef, value: string): FieldErrorKind | undefined {
  if (f.required && !value) return 'required';
  if (value && f.pattern && !f.pattern.test(value)) return 'pattern';
  return undefined;
}

/** Error text is resolved at render time so it follows a language switch. */
export function fieldErrorText(f: FieldDef, kind: FieldErrorKind | undefined, t: TFunction): string | undefined {
  if (kind === 'required') return t('form.required', { label: fieldLabel(f, t) });
  if (kind === 'pattern') return f.patternKey ? t(`form.${f.patternKey}`) : t('form.invalid');
  return undefined;
}
