/**
 * Transport layer for the Google Apps Script JSON API.
 *
 * Apps Script CORS rules (do not "fix" these):
 * - POST body must be sent with Content-Type text/plain so the request stays
 *   a CORS "simple request" (Apps Script cannot answer OPTIONS preflights).
 * - Never attach custom headers; the PIN travels inside the JSON body.
 * - Apps Script replies 302 -> script.googleusercontent.com which serves the
 *   JSON with Access-Control-Allow-Origin:*; fetch follows it automatically.
 * - HTTP status is always 200. Crashes/misdeployments return HTML, so parse
 *   defensively and surface BAD_RESPONSE distinctly.
 */

import type { ApiErrorCode, ListResponse, OutreportRecord } from '../types';
import { ApiError, NetworkError } from './errors';

// Error classes live in ./errors so UI code can use them without loading the
// transport (which refuses to load without VITE_APPS_SCRIPT_URL).
export { ApiError, NetworkError };

const BASE_URL = import.meta.env.VITE_APPS_SCRIPT_URL;
const TIMEOUT_MS = 30_000; // Apps Script cold starts take 1-3s; be generous

// A build without the backend URL would otherwise fetch "undefined?..." from
// the app's own origin, get index.html back via the SPA rewrite, and queue
// every entry forever while blaming connectivity. Fail loudly instead.
// (vite.config.ts also refuses to produce such a build.)
if (!/^https?:\/\//.test(BASE_URL ?? '')) {
  throw new Error(
    'This build is missing VITE_APPS_SCRIPT_URL — redeploy with the Apps Script /exec URL set.',
  );
}

interface Envelope {
  ok: boolean;
  error?: ApiErrorCode;
  message?: string;
  [key: string]: unknown;
}

async function request(input: string, init?: RequestInit): Promise<Envelope> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let text: string;
  try {
    // The timer must stay armed through res.text(): on flaky mobile links a
    // response can stall mid-body after headers arrive, and an unbounded read
    // would hang the single-flight outbox flush forever.
    const res = await fetch(input, { ...init, signal: controller.signal });
    text = await res.text();
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
  let body: Envelope;
  try {
    body = JSON.parse(text);
  } catch {
    // HTML login page or Apps Script error page: backend is misdeployed or
    // not yet updated with the API code. Not retryable by the queue.
    throw new ApiError(
      'BAD_RESPONSE',
      'The Google Apps Script backend did not return data. Check its deployment (access must be "Anyone") and that the new Code.gs is deployed.',
    );
  }
  if (!body.ok) {
    throw new ApiError(body.error ?? 'INTERNAL', body.message ?? 'Unknown server error');
  }
  return body;
}

function apiGet(params: Record<string, string>): Promise<Envelope> {
  const qs = new URLSearchParams(params).toString();
  return request(`${BASE_URL}?${qs}`, { method: 'GET' });
}

function apiPost(payload: Record<string, unknown>): Promise<Envelope> {
  return request(BASE_URL, {
    method: 'POST',
    // text/plain keeps this a simple request -> no preflight.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
}

// ---- Public API ----

export async function ping(): Promise<{ version: number }> {
  const body = await apiGet({ action: 'ping' });
  return { version: Number(body.version) };
}

export async function listOutreports(sheet: string, limit = 500): Promise<ListResponse> {
  const body = await apiGet({ action: 'list', sheet, limit: String(limit) });
  return body as unknown as ListResponse;
}

export async function saveOutreport(
  sheet: string,
  id: string,
  record: OutreportRecord,
): Promise<{ duplicate?: boolean }> {
  const body = await apiPost({ action: 'save', sheet, id, record });
  return { duplicate: body.duplicate === true };
}

export async function updateOutreport(
  sheet: string,
  id: string,
  record: OutreportRecord,
): Promise<void> {
  await apiPost({ action: 'update', sheet, id, record });
}

export async function deleteOutreport(sheet: string, id: string, pin: string): Promise<void> {
  await apiPost({ action: 'delete', sheet, id, pin });
}
