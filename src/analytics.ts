/**
 * Vercel Web Analytics + Speed Insights, behind a wrapper that can never
 * break the app: every call is a no-op outside production builds and swallows
 * its own failures (offline, ad-blocker, script not loaded).
 *
 * Privacy invariant: event properties carry sheet names, counts and flags
 * only — never record contents, train/loco/mobile numbers, PINs or ids.
 */
import { inject, track } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';

export type EventName =
  | 'outreport_saved'
  | 'outreport_updated'
  | 'outreport_deleted'
  | 'queue_synced'
  | 'queue_failed'
  | 'language_changed'
  | 'install_prompted'
  | 'install_accepted'
  | 'client_error';

export type EventProps = Record<string, string | number | boolean>;

const MAX_MESSAGE = 200;
let started = false;

function enabled(): boolean {
  return import.meta.env.PROD === true;
}

export function trackEvent(name: EventName, props?: EventProps): void {
  if (!enabled()) return;
  try {
    track(name, props);
  } catch {
    /* analytics must never affect saving, syncing or navigation */
  }
}

/**
 * Error details safe to send: name + truncated message, with long digit runs
 * (mobile numbers, BPC numbers) masked in case a message echoes user input.
 */
export function errorPayload(
  err: unknown,
  fallbackMessage: string | undefined,
  source: 'error' | 'unhandledrejection',
): EventProps {
  const name = err instanceof Error ? err.name : typeof err;
  const raw = err instanceof Error ? err.message : (fallbackMessage ?? String(err));
  const message = raw.replace(/\d{6,}/g, '#').slice(0, MAX_MESSAGE);
  return { name: name.slice(0, 60), message, source };
}

export function initAnalytics(): void {
  if (!enabled() || started) return;
  started = true;
  try {
    inject({ mode: 'production' });
    injectSpeedInsights();
  } catch {
    /* ignore */
  }
  window.addEventListener('error', (e) => {
    if (!e.error && !e.message) return; // resource load errors carry neither
    trackEvent('client_error', errorPayload(e.error, e.message, 'error'));
  });
  window.addEventListener('unhandledrejection', (e) => {
    trackEvent('client_error', errorPayload(e.reason, undefined, 'unhandledrejection'));
  });
}
