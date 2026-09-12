import type { TFunction } from 'i18next';
import { ApiError, NetworkError } from '../api/errors';

/**
 * Codes whose server message carries specifics worth showing verbatim
 * (which field failed, what crashed). All other codes are translated.
 */
const SERVER_TEXT_CODES = new Set(['INTERNAL', 'VALIDATION']);

/**
 * The only place a caught error becomes display text.
 * `fallback` (already translated) is used for errors that are neither API
 * nor network errors; without it they read as errors.UNKNOWN.
 */
export function apiErrorMessage(err: unknown, t: TFunction, fallback?: string): string {
  if (err instanceof ApiError) {
    if (SERVER_TEXT_CODES.has(err.code) && err.message) return err.message;
    // A code newer than this client has no key: show the server's text.
    return t(`errors.${err.code}`, { defaultValue: err.message || t('errors.UNKNOWN') });
  }
  if (err instanceof NetworkError) return t('errors.NETWORK');
  return fallback ?? t('errors.UNKNOWN');
}
