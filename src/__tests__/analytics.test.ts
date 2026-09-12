// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@vercel/analytics', () => ({ inject: vi.fn(), track: vi.fn() }));
vi.mock('@vercel/speed-insights', () => ({ injectSpeedInsights: vi.fn() }));

import { inject, track } from '@vercel/analytics';
import { injectSpeedInsights } from '@vercel/speed-insights';
import { errorPayload, initAnalytics, trackEvent } from '../analytics';

const mockTrack = vi.mocked(track);

afterEach(() => {
  vi.unstubAllEnvs();
  mockTrack.mockReset();
});

describe('analytics wrapper', () => {
  it('is a no-op outside production builds', () => {
    trackEvent('outreport_deleted', { sheet: 'RC-DN' });
    initAnalytics();
    expect(mockTrack).not.toHaveBeenCalled();
    expect(inject).not.toHaveBeenCalled();
    expect(injectSpeedInsights).not.toHaveBeenCalled();
  });

  it('forwards events in production', () => {
    vi.stubEnv('PROD', true);
    trackEvent('outreport_deleted', { sheet: 'RC-DN' });
    expect(mockTrack).toHaveBeenCalledWith('outreport_deleted', { sheet: 'RC-DN' });
  });

  it('never throws when the underlying tracker throws', () => {
    vi.stubEnv('PROD', true);
    mockTrack.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => trackEvent('queue_synced', { delivered: 1 })).not.toThrow();
  });

  it('injects scripts once and reports uncaught errors without user data', () => {
    vi.stubEnv('PROD', true);
    initAnalytics();
    initAnalytics();
    expect(inject).toHaveBeenCalledTimes(1);
    expect(injectSpeedInsights).toHaveBeenCalledTimes(1);

    window.dispatchEvent(
      new ErrorEvent('error', { error: new TypeError('bad mobile 9876543210'), message: 'x' }),
    );
    expect(mockTrack).toHaveBeenCalledWith('client_error', {
      name: 'TypeError',
      message: 'bad mobile #',
      source: 'error',
    });
  });
});

describe('errorPayload', () => {
  it('handles non-Error rejection reasons and truncates long messages', () => {
    expect(errorPayload('boom', undefined, 'unhandledrejection')).toEqual({
      name: 'string',
      message: 'boom',
      source: 'unhandledrejection',
    });
    const long = errorPayload(new Error('a'.repeat(500)), undefined, 'error');
    expect(String(long.message)).toHaveLength(200);
  });
});
