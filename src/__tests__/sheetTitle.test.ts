import { describe, expect, it } from 'vitest';
import { directionLabel, sheetTitle } from '../utils/sheetTitle';

const t = (key: 'direction.up' | 'direction.down') => (key === 'direction.up' ? 'UP*' : 'DOWN*');

describe('directionLabel', () => {
  it('translates Up/Down and passes other labels through', () => {
    expect(directionLabel(t, 'Up')).toBe('UP*');
    expect(directionLabel(t, 'Down')).toBe('DOWN*');
    expect(directionLabel(t, 'VNUP-MTMI')).toBe('VNUP-MTMI');
  });
});

describe('sheetTitle', () => {
  it('shows tile and direction instead of the tab name', () => {
    expect(sheetTitle(t, 'SNF-WADI/CT UP')).toBe('WADI · UP*');
    expect(sheetTitle(t, 'PRLI/LTRR-BIDR-VKB')).toBe('BIDR · DOWN*');
    expect(sheetTitle(t, 'VNUP-MTMI')).toBe('MTMI · VNUP-MTMI');
  });
  it('collapses a tile whose only tab is itself, and falls back to the tab name', () => {
    expect(sheetTitle(t, 'VNUP-PGDP-SNF')).toBe('VNUP-PGDP-SNF');
    expect(sheetTitle(t, 'Sheet12')).toBe('Sheet12');
  });
});
