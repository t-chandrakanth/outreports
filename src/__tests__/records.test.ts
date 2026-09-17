import { describe, expect, it } from 'vitest';
import { rowToRecord } from '../utils/records';

describe('rowToRecord', () => {
  it('keys cells by canonical header, drops blank header columns, keeps alignment', () => {
    const rec = rowToRecord(['DATE', 'RAKE-ID', '', 'TR.NO'], { id: 'x', cells: ['d', 'r', 'junk', 't'] });
    expect(rec).toEqual({ DATE: 'd', 'RAKE-ID (IF-CC RAKE)': 'r', 'TR.NO': 't' });
  });

  it('fills missing trailing cells with an empty string', () => {
    const rec = rowToRecord(['DATE', 'TR.NO', 'LOCO NO'], { id: 'x', cells: ['d'] });
    expect(rec).toEqual({ DATE: 'd', 'TR.NO': '', 'LOCO NO': '' });
  });
});
