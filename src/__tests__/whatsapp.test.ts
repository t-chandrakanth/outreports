import { describe, expect, it } from 'vitest';
import { buildWhatsAppText } from '../utils/whatsapp';

describe('buildWhatsAppText', () => {
  it('includes filled fields, omits blanks, labels correctly', () => {
    const text = buildWhatsAppText('RC-DN', {
      'DATE': '2026-09-11',
      'TR.NO': 'KPCC',
      'LOCO NO': '',
      'BP%': '98.30%',
    });
    expect(text).toContain('*OUTREPORT — RC-DN*');
    expect(text).toContain('*DATE:* 2026-09-11');
    expect(text).toContain('*TRAIN NO:* KPCC');
    expect(text).toContain('*BP %:* 98.30%');
    expect(text).not.toContain('LOCO');
  });
});
