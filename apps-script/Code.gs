/**
 * SCR TMR'S OUTREPORTS — Backend API + legacy UI support
 * =======================================================
 * PASTE THIS ENTIRE FILE over the contents of Code.gs in the Apps Script editor.
 *
 * One-time setup after pasting:
 *   1. Set LEGACY_HTML_FILE below to the name of your HTML file
 *      (see the left sidebar of the editor, e.g. "Index" for Index.html).
 *   2. Project Settings (gear icon) -> Script Properties -> Add:
 *        Property: DELETE_PIN    Value: <your chosen PIN>
 *   3. Deploy -> Manage deployments -> select the Web app -> pencil (Edit)
 *      -> Version: New version -> Deploy.   (NEVER "New deployment" — that
 *      would create a different URL.)
 *   4. Confirm: Execute as: Me / Who has access: Anyone (plain "Anyone").
 *   5. Test: open  <EXEC_URL>?action=ping  -> {"ok":true,"version":3}
 */

// ============ CONFIG ============

// Keep the deployed web app bound to the intended workbook even if this code
// is moved into a standalone Apps Script project.
var SPREADSHEET_ID = '17d6RUscO9Jc4E53L1tP5D3b6VFRjlRkOull1FOFVz3M';

var LEGACY_HTML_FILE = 'Index'; // <-- name of your HTML file WITHOUT .html

// Tab names exactly as they appear in the workbook (one tab per direction).
// "Sheet12" is a hand-made archive of old rows and is deliberately not listed.
var ALLOWED_SHEETS = [
  'SNF-WADICT UP', 'WADICT-SNF DN',
  'DKJ-MTMIVNUP UP', 'MTMI-DKJ DN', 'VNUP-MTMI',
  'BPA-BPQ UP', 'BPQ-BPA DN',
  'NZB-RDM UP', 'RDM-NZB DN',
  'RC-WADICT DN', 'RC-CTWADI UP',
  'HYB-DN',
  'SNF-KZJ', 'KZJ-SNF', 'VNUP-PGDP-SNF',
  'BDCR-DKJ', 'DKJ-BDCR',
  'VKB-BIDR-PRLILTRR', 'PRLILTRR-BIDR-VKB'
];

// Former tab names -> current tab names. Installed app builds and entries
// queued offline before a rename still send the old name; keep this in sync
// with SHEET_ALIASES in src/config.ts.
var SHEET_ALIASES = {
  'SNF-WADI UP':        'SNF-WADICT UP',
  'WADI-SNF DN':        'WADICT-SNF DN',
  'MTMI-DKJ UP':        'DKJ-MTMIVNUP UP',
  'RC-DN':              'RC-WADICT DN',
  'VKB-BIDR-PRLI-LTRR': 'VKB-BIDR-PRLILTRR'
};

// Header row written into a listed tab that is still completely empty (a
// freshly created tab). Must match the other tabs and src/config.ts FIELDS.
var HEADER_TEMPLATE = [
  'DATE', 'TR.NO', 'LOCO NO', 'LOCO BASE AND DUE', 'LOAD', 'B.UP', 'BPC NO',
  'RAKE-ID (IF-CC RAKE)', 'ISSUED AT', 'ISSUED ON', 'BP%', 'VALIDITY', 'VALID UPTO',
  'EX', 'COMMODITY', 'COD', 'T/O TIME', 'TMR MOBILE NO'
];

// Column headers that are spelled differently on some tabs -> the canonical
// HEADER_TEMPLATE name (the record key the app uses). Keep in sync with
// HEADER_ALIASES in src/config.ts.
var HEADER_ALIASES = {
  'RAKE-ID': 'RAKE-ID (IF-CC RAKE)'
};

var ID_HEADER = '_ID';
var API_VERSION = 3;
var DEFAULT_LIMIT = 500;

// ============ ENTRY POINTS ============

function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return jsonOut(safeRoute(e.parameter)); // JSON API mode
  }
  // Legacy mode: serve the original web app UI unchanged.
  return HtmlService.createHtmlOutputFromFile(LEGACY_HTML_FILE)
    .setTitle("SCR TMR'S OUTREPORTS")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut({ ok: false, error: 'BAD_JSON', message: 'Request body must be JSON' });
  }
  return jsonOut(safeRoute(req));
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeRoute(req) {
  try {
    return route(req);
  } catch (err) {
    return { ok: false, error: 'INTERNAL', message: String(err && err.message ? err.message : err) };
  }
}

/** Opens the shared OUT REPORTS workbook configured above. */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/** Returns an approved tab from the shared workbook. */
function getSheet(sheetName) {
  sheetName = resolveSheetName(sheetName);
  if (ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    throw new Error('Unknown sheet: ' + sheetName);
  }
  var sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet tab not found: ' + sheetName);
  }
  return sheet;
}

// ============ ROUTER ============

function route(req) {
  var action = String(req.action || '');

  if (action === 'ping') {
    return { ok: true, version: API_VERSION };
  }

  var sheetName = resolveSheetName(req.sheet);
  if (ALLOWED_SHEETS.indexOf(sheetName) === -1) {
    return { ok: false, error: 'BAD_SHEET', message: 'Unknown sheet: ' + sheetName };
  }
  var sheet;
  try {
    sheet = getSheet(sheetName);
  } catch (err) {
    return { ok: false, error: 'BAD_SHEET', message: String(err.message || err) };
  }

  switch (action) {
    case 'list':
      return apiList(sheet, Number(req.limit) || DEFAULT_LIMIT);
    case 'save':
      return withLock(function () { return apiSave(sheet, req.id, req.record); });
    case 'update':
      return withLock(function () { return apiUpdate(sheet, req.id, req.record); });
    case 'delete':
      if (!checkPin(req.pin)) return pinError();
      return withLock(function () { return apiDelete(sheet, req.id); });
    default:
      return { ok: false, error: 'UNKNOWN_ACTION', message: 'Unknown action: ' + action };
  }
}

function withLock(fn) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch (e) {
    return { ok: false, error: 'BUSY', message: 'Sheet is busy, please retry' };
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function checkPin(pin) {
  var expected = PropertiesService.getScriptProperties().getProperty('DELETE_PIN');
  return !!expected && String(pin) === expected;
}

function pinError() {
  var configured = PropertiesService.getScriptProperties().getProperty('DELETE_PIN');
  return configured
    ? { ok: false, error: 'BAD_PIN', message: 'Incorrect PIN' }
    : { ok: false, error: 'PIN_NOT_CONFIGURED', message: 'Set DELETE_PIN in Script Properties' };
}

// ============ HELPERS ============

/** Old or current tab name (any surrounding whitespace) -> current tab name. */
function resolveSheetName(name) {
  var n = String(name || '').trim();
  return SHEET_ALIASES.hasOwnProperty(n) ? SHEET_ALIASES[n] : n;
}

/** Raw header cell -> canonical header name ('' for a blank cell). */
function canonicalHeader(raw) {
  var h = String(raw == null ? '' : raw).trim();
  return HEADER_ALIASES.hasOwnProperty(h) ? HEADER_ALIASES[h] : h;
}

/** Returns 1-based column index of _ID, creating the header if missing. */
function ensureIdColumn(sheet) {
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    // Brand-new tab with nothing in it: seed the standard header row so the
    // first save works without anyone having to type the headers by hand.
    if (sheet.getLastRow() !== 0) throw new Error('Sheet has no header row');
    if (sheet.getMaxColumns() < HEADER_TEMPLATE.length) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), HEADER_TEMPLATE.length - sheet.getMaxColumns());
    }
    var headerRange = sheet.getRange(1, 1, 1, HEADER_TEMPLATE.length);
    headerRange.setNumberFormat('@');
    headerRange.setValues([HEADER_TEMPLATE]);
    lastCol = HEADER_TEMPLATE.length;
  }
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (canonicalHeader(headers[i]) === ID_HEADER) return i + 1;
  }
  // Grow the grid if the sheet has no spare column to hold _ID.
  if (sheet.getMaxColumns() <= lastCol) {
    sheet.insertColumnAfter(lastCol);
  }
  sheet.getRange(1, lastCol + 1).setValue(ID_HEADER);
  return lastCol + 1;
}

/** Returns 1-based row number for the record with the given id, or 0. */
function findRowById(sheet, idCol, id) {
  if (!id) return 0;
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var finder = sheet.getRange(2, idCol, lastRow - 1, 1)
    .createTextFinder(String(id))
    .matchEntireCell(true);
  var cell = finder.findNext();
  return cell ? cell.getRow() : 0;
}

// Server-side validation stays permissive (parity with the legacy app and
// with existing sheet data): only the mobile number format is enforced.
// The PWA client additionally requires DATE and TRAIN NO before submitting.
function validateRecord(record) {
  if (!record || typeof record !== 'object') {
    return 'Missing record';
  }
  var mobile = String(record['TMR MOBILE NO'] || '').trim();
  if (mobile !== '' && !/^[0-9]{10}$/.test(mobile)) {
    return 'TMR MOBILE NO must be 10 digits';
  }
  return '';
}

// ============ API ACTIONS ============

function apiSave(sheet, id, record) {
  id = String(id || '').trim();
  if (!id) return { ok: false, error: 'VALIDATION', message: 'Missing record id' };

  var problem = validateRecord(record);
  if (problem) return { ok: false, error: 'VALIDATION', message: problem };

  var idCol = ensureIdColumn(sheet);

  // Idempotency: if this id already exists the earlier save succeeded.
  if (findRowById(sheet, idCol, id)) {
    return { ok: true, id: id, duplicate: true };
  }

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var row = headers.map(function (h) {
    var header = canonicalHeader(h);
    if (header === ID_HEADER) return id;
    if (header === '') return '';
    return record.hasOwnProperty(header) ? String(record[header]) : '';
  });
  // Write as plain text (format '@'), NOT appendRow: typed-input coercion
  // would re-parse dates ("2026-09-12" -> Date cell with the column's legacy
  // display format, corrupting the round-trip) and treat leading '='/'+' as
  // formulas.
  var rowNum = sheet.getLastRow() + 1;
  if (sheet.getMaxRows() < rowNum) sheet.insertRowAfter(sheet.getMaxRows());
  var range = sheet.getRange(rowNum, 1, 1, lastCol);
  range.setNumberFormat('@');
  range.setValues([row]);
  return { ok: true, id: id };
}

function apiUpdate(sheet, id, record) {
  id = String(id || '').trim();
  if (!id) return { ok: false, error: 'VALIDATION', message: 'Missing record id' };

  var problem = validateRecord(record);
  if (problem) return { ok: false, error: 'VALIDATION', message: problem };

  var idCol = ensureIdColumn(sheet);
  var rowNum = findRowById(sheet, idCol, id);
  if (!rowNum) return { ok: false, error: 'NOT_FOUND', message: 'Record not found (it may have been deleted)' };

  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  // Only touch the columns the client actually sent: rewriting the whole row
  // would flatten formulas/typed values in any legacy column, and coercion
  // would corrupt them further. Cells are written as plain text.
  for (var i = 0; i < headers.length; i++) {
    var header = canonicalHeader(headers[i]);
    if (header === ID_HEADER || header === '') continue;
    if (!record.hasOwnProperty(header)) continue;
    var cell = sheet.getRange(rowNum, i + 1);
    cell.setNumberFormat('@');
    cell.setValue(String(record[header]));
  }
  return { ok: true, id: id };
}

function apiDelete(sheet, id) {
  id = String(id || '').trim();
  if (!id) return { ok: false, error: 'VALIDATION', message: 'Missing record id' };

  var idCol = ensureIdColumn(sheet);
  var rowNum = findRowById(sheet, idCol, id);
  if (!rowNum) return { ok: false, error: 'NOT_FOUND', message: 'Record not found (it may already be deleted)' };

  sheet.deleteRow(rowNum);
  return { ok: true, id: id };
}

function apiList(sheet, limit) {
  var idCol = ensureIdColumn(sheet);

  // Backfill _ID for legacy rows (created by the old UI or typed straight
  // into the sheet) so they can be edited/deleted. All bounds are recomputed
  // INSIDE the lock — concurrent deletes shift rows, and a stale range would
  // write a UUID past the end of the data.
  var probeLastRow = sheet.getLastRow();
  if (probeLastRow >= 2) {
    var probe = sheet.getRange(2, idCol, probeLastRow - 1, 1).getValues();
    var needsBackfill = probe.some(function (r) { return String(r[0]).trim() === ''; });
    if (needsBackfill) {
      var lock = LockService.getScriptLock();
      if (lock.tryLock(500)) {
        try {
          var lockedLastRow = sheet.getLastRow();
          if (lockedLastRow >= 2) {
            var idRange = sheet.getRange(2, idCol, lockedLastRow - 1, 1);
            var idValues = idRange.getValues();
            for (var i = 0; i < idValues.length; i++) {
              if (String(idValues[i][0]).trim() === '') {
                idValues[i][0] = Utilities.getUuid();
              }
            }
            idRange.setNumberFormat('@');
            idRange.setValues(idValues);
          }
        } finally {
          lock.releaseLock();
        }
      }
      // Lock contended: serve the list anyway; rows without an id are
      // rendered read-only by the client until a later list backfills them.
    }
  }

  // ONE snapshot for headers, cells and ids: separate reads can tear when a
  // concurrent delete shifts rows, mispairing ids with the wrong records.
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var all = sheet.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  var headerRow = all[0];

  var headers = [];
  var dataColIdx = []; // 0-based indexes of non-_ID columns
  // Headers go out canonicalised (aliases resolved, blank cells dropped) so
  // the client can key records by the same names on every tab.
  for (var c = 0; c < headerRow.length; c++) {
    var h = canonicalHeader(headerRow[c]);
    if (h === ID_HEADER || h === '') continue;
    headers.push(h);
    dataColIdx.push(c);
  }

  var rows = [];
  var total = Math.max(0, lastRow - 1);
  var start = Math.max(1, lastRow - limit); // index into `all` (row 0 = headers)
  // newest first: walk from the bottom of the sheet upwards
  for (var r = lastRow - 1; r >= start; r--) {
    rows.push({
      id: String(all[r][idCol - 1]),
      cells: dataColIdx.map(function (ci) { return all[r][ci]; })
    });
  }

  return { ok: true, headers: headers, rows: rows, total: total };
}

// ============ LEGACY FUNCTIONS (keep the OLD web app UI working) ============
// The original Index.html calls these via google.script.run.

function saveRecord(sheetName, record) {
  var sheet = getSheet(sheetName);
  var result = withLock(function () {
    return apiSave(sheet, Utilities.getUuid(), record);
  });
  if (!result.ok) throw new Error(result.message);
  return true;
}

function getSheetData(sheetName) {
  var sheet = getSheet(sheetName);

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  var headerRow = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];

  var headers = [];
  var dataColIdx = [];
  for (var c = 0; c < headerRow.length; c++) {
    if (String(headerRow[c]).trim() === ID_HEADER) continue; // hide _ID from old UI
    headers.push(headerRow[c]);
    dataColIdx.push(c);
  }

  var data = [];
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    data = values.map(function (row) {
      return dataColIdx.map(function (ci) { return row[ci]; });
    });
  }
  return { headers: headers, data: data };
}

function deleteRecord(sheetName, rowNumber) {
  var sheet = getSheet(sheetName);
  var result = withLock(function () {
    var n = Number(rowNumber);
    if (!n || n < 2 || n > sheet.getLastRow()) throw new Error('Invalid row: ' + rowNumber);
    sheet.deleteRow(n);
    return { ok: true };
  });
  if (!result.ok) throw new Error(result.message);
  return true;
}
