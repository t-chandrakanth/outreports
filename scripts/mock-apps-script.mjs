/**
 * Faithful mock of the Apps Script web-app transport for local e2e tests:
 * - POST/GET to /exec runs the "script", then 302-redirects to a one-time
 *   /macros/echo?token=... URL (mimicking script.googleusercontent.com).
 * - Only the redirected response carries Access-Control-Allow-Origin: *.
 * - No OPTIONS handler on /exec: a preflighted request FAILS, exactly like
 *   the real Apps Script — this catches accidental non-simple requests.
 * - Same envelope + validation semantics as apps-script/Code.gs.
 */
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = 8787;
const PIN = '1234';
const sheets = new Map(); // name -> { headers, rows: [{id, cells}] }
const HEADERS = ['DATE','TR.NO','LOCO NO','LOCO BASE AND DUE','LOAD','B.UP','BPC NO',
  'RAKE-ID (IF-CC RAKE)','ISSUED AT','ISSUED ON','BP%','VALIDITY','VALID UPTO','EX','COMMODITY',
  'COD','T/O TIME','TMR MOBILE NO'];
const ALLOWED = ['SNF-WADI UP','WADI-SNF DN','MTMI-DKJ UP','MTMI-DKJ DN','BPA-BPQ UP',
  'BPQ-BPA DN','NZB-RDM UP','RDM-NZB DN','RC-DN','HYB-DN',
  'SNF-KZJ','KZJ-SNF','BDCR-DKJ','DKJ-BDCR','VKB-BIDR-PRLI-LTRR'];
for (const s of ALLOWED) sheets.set(s, { rows: [] });
// seed one legacy-style row
sheets.get('SNF-WADI UP').rows.push({ id: crypto.randomUUID(), cells: ['08-09 21:15','KPCC','60426','KZJ 28/09','58/58/5200','','','','','','90','','','','','','',''] });

const pending = new Map(); // token -> json string

function route(req) {
  try {
    const action = String(req.action || '');
    if (action === 'ping') return { ok: true, version: 1 };
    const name = String(req.sheet || '');
    if (!ALLOWED.includes(name)) return { ok: false, error: 'BAD_SHEET', message: 'Unknown sheet: ' + name };
    const sheet = sheets.get(name);
    if (action === 'list') {
      const limit = Number(req.limit) || 500;
      const rows = [...sheet.rows].reverse().slice(0, limit);
      return { ok: true, headers: HEADERS, rows, total: sheet.rows.length };
    }
    if (action === 'save') {
      const id = String(req.id || '').trim();
      if (!id) return { ok: false, error: 'VALIDATION', message: 'Missing record id' };
      const mobile = String(req.record?.['TMR MOBILE NO'] || '').trim();
      if (mobile && !/^[0-9]{10}$/.test(mobile)) return { ok: false, error: 'VALIDATION', message: 'TMR MOBILE NO must be 10 digits' };
      if (sheet.rows.some((r) => r.id === id)) return { ok: true, id, duplicate: true };
      sheet.rows.push({ id, cells: HEADERS.map((h) => String(req.record?.[h] ?? '')) });
      return { ok: true, id };
    }
    if (action === 'update') {
      const row = sheet.rows.find((r) => r.id === req.id);
      if (!row) return { ok: false, error: 'NOT_FOUND', message: 'Record not found' };
      row.cells = HEADERS.map((h, i) => (req.record && h in req.record ? String(req.record[h]) : row.cells[i]));
      return { ok: true, id: req.id };
    }
    if (action === 'delete') {
      if (String(req.pin) !== PIN) return { ok: false, error: 'BAD_PIN', message: 'Incorrect PIN' };
      const idx = sheet.rows.findIndex((r) => r.id === req.id);
      if (idx === -1) return { ok: false, error: 'NOT_FOUND', message: 'Record not found' };
      sheet.rows.splice(idx, 1);
      return { ok: true, id: req.id };
    }
    return { ok: false, error: 'UNKNOWN_ACTION', message: String(action) };
  } catch (err) {
    return { ok: false, error: 'INTERNAL', message: String(err) };
  }
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === '/echo') {
    const body = pending.get(url.searchParams.get('token')) ?? '{"ok":false,"error":"INTERNAL","message":"expired token"}';
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
    return;
  }
  if (url.pathname === '/exec') {
    if (req.method === 'OPTIONS') { // real Apps Script has no doOptions
      res.writeHead(405); res.end(); return;
    }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let parsed;
      if (req.method === 'POST') {
        try { parsed = JSON.parse(raw); }
        catch { parsed = null; }
        parsed = parsed ?? { action: '__badjson__' };
        if (parsed.action === '__badjson__') parsed = null;
      } else {
        parsed = Object.fromEntries(url.searchParams);
      }
      const out = parsed ? route(parsed) : { ok: false, error: 'BAD_JSON', message: 'Request body must be JSON' };
      const token = crypto.randomUUID();
      pending.set(token, JSON.stringify(out));
      setTimeout(() => pending.delete(token), 30_000);
      // Real Apps Script sends ACAO:* on the 302 itself as well — the fetch
      // spec runs a CORS check on every hop of the redirect chain.
      res.writeHead(302, {
        Location: `http://localhost:${PORT}/echo?token=${token}`,
        'Access-Control-Allow-Origin': '*',
      });
      res.end();
    });
    return;
  }
  res.writeHead(404); res.end();
}).listen(PORT, () => console.log(`mock apps script on :${PORT} (delete PIN ${PIN})`));
