/**
 * Sheet display values arrive as text and in mixed formats
 * (yyyy-mm-dd from the form's date input, d/m/yyyy or "dd-mm hh:mm" styles
 * from Google Sheets formatting). Parse defensively for the date filter.
 */

/** Parse a display value to a local Date at midnight, or null. */
export function parseSheetDate(value: string): Date | null {
  const v = value.trim();
  if (!v) return null;

  // yyyy-mm-dd
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(v);
  if (m) return mk(Number(m[1]), Number(m[2]), Number(m[3]));

  // d/m/yyyy or d-m-yyyy
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(v);
  if (m) return mk(Number(m[3]), Number(m[2]), Number(m[1]));

  // dd-mm hh:mm (Sheets short datetime, year omitted -> assume current year)
  m = /^(\d{1,2})-(\d{1,2})\s+\d{1,2}:\d{2}/.exec(v);
  if (m) return mk(new Date().getFullYear(), Number(m[2]), Number(m[1]));

  return null;
}

function mk(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return new Date(y, mo - 1, d);
}

/** True when `value` falls on the calendar day given by an <input type=date> string. */
export function isSameDay(value: string, isoDay: string): boolean {
  const parsed = parseSheetDate(value);
  if (!parsed) return false;
  const [y, m, d] = isoDay.split('-').map(Number);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
