import { FIELDS } from '../config';
import { en } from '../i18n/locales/en';
import type { OutreportRecord } from '../types';

/**
 * Build a labeled, WhatsApp-friendly text block for one outreport.
 * Blank fields are omitted. Always English, whatever the UI language: the
 * text lands in a shared team channel.
 */
export function buildWhatsAppText(sheetName: string, record: OutreportRecord): string {
  const lines: string[] = [`*OUTREPORT — ${sheetName}*`];
  for (const f of FIELDS) {
    const value = (record[f.header] ?? '').trim();
    if (!value) continue;
    lines.push(`*${en.fields[f.key].toUpperCase()}:* ${value}`);
  }
  return lines.join('\n');
}

/** Copy text to the clipboard; falls back to the share sheet on mobile. */
export async function copyOrShare(text: string): Promise<'copied' | 'shared'> {
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    if (navigator.share) {
      await navigator.share({ text });
      return 'shared';
    }
    throw new Error('Could not copy — clipboard unavailable');
  }
}
