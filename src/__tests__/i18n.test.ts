// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../analytics', () => ({ trackEvent: vi.fn() }));

import { trackEvent } from '../analytics';
import { ApiError, NetworkError } from '../api/errors';
import { FIELDS } from '../config';
import i18n, { currentLanguage, detectLanguage, setLanguage } from '../i18n';
import { apiErrorMessage } from '../i18n/errors';
import { fieldErrorText, fieldLabel, fieldPlaceholder, validateField } from '../i18n/fields';
import { en } from '../i18n/locales/en';
import type { ApiErrorCode } from '../types';
import { buildWhatsAppText } from '../utils/whatsapp';

const t = i18n.t;
const field = (header: string) => FIELDS.find((f) => f.header === header)!;

beforeEach(async () => {
  vi.mocked(trackEvent).mockReset();
  await setLanguage('en');
  vi.mocked(trackEvent).mockReset();
});

describe('detectLanguage', () => {
  it('prefers a valid stored choice, ignores invalid ones, defaults to English', () => {
    expect(detectLanguage('en', ['fr-FR'])).toBe('en');
    expect(detectLanguage('xx', [])).toBe('en');
    expect(detectLanguage(null, ['fr-FR', 'de'])).toBe('en');
    expect(detectLanguage('hi', ['te-IN'])).toBe('hi');
  });
});

describe('detectLanguage from the browser', () => {
  it('picks the first supported browser language by its base tag', () => {
    expect(detectLanguage(null, ['te-IN'])).toBe('te');
    expect(detectLanguage(null, ['fr-FR', 'HI-in', 'te'])).toBe('hi');
  });
});

describe('switching to Telugu and Hindi', () => {
  it('persists, sets <html lang>, reports the change and translates', async () => {
    await setLanguage('te');
    expect(localStorage.getItem('outreports:lang')).toBe('te');
    expect(document.documentElement.lang).toBe('te');
    expect(trackEvent).toHaveBeenCalledWith('language_changed', { from: 'en', to: 'te' });
    expect(t('saved.count', { count: 2 })).toBe('2 అవుట్‌రిపోర్ట్‌లు');
    expect(apiErrorMessage(new ApiError('BAD_PIN', 'Incorrect PIN'), t)).toBe('తప్పు PIN');

    await setLanguage('hi');
    expect(currentLanguage()).toBe('hi');
    expect(trackEvent).toHaveBeenLastCalledWith('language_changed', { from: 'te', to: 'hi' });
    expect(t('home.directions', { count: 2 })).toBe('2 दिशाएँ');
    expect(fieldErrorText(field('TR.NO'), 'required', t)).toBe('ट्रेन नंबर आवश्यक है');
  });

  it('keeps the WhatsApp share text in English', async () => {
    await setLanguage('hi');
    const text = buildWhatsAppText('RC-DN', { 'TR.NO': 'KPCC' });
    expect(text).toContain('*TRAIN NO:* KPCC');
  });
});

describe('setLanguage', () => {
  it('persists the choice and sets the document language', async () => {
    await setLanguage('en');
    expect(localStorage.getItem('outreports:lang')).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(currentLanguage()).toBe('en');
  });

  it('does not report a change to the current language', async () => {
    await setLanguage('en');
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('English strings', () => {
  it('resolves plurals and interpolation', () => {
    expect(t('saved.count', { count: 1 })).toBe('1 outreport');
    expect(t('saved.count', { count: 3 })).toBe('3 outreports');
    expect(t('sync.needFixing', { count: 1 })).toBe('1 needs fixing');
    expect(t('home.directions', { count: 2 })).toBe('2 directions');
  });
});

describe('apiErrorMessage', () => {
  // Record<ApiErrorCode, …> makes tsc fail when a new code lacks a translation.
  const allCodes: Record<ApiErrorCode, true> = {
    BAD_JSON: true, UNKNOWN_ACTION: true, BAD_SHEET: true, VALIDATION: true, NOT_FOUND: true,
    BAD_PIN: true, PIN_NOT_CONFIGURED: true, BUSY: true, INTERNAL: true, BAD_RESPONSE: true,
  };

  it('has a translation for every API error code', () => {
    for (const code of Object.keys(allCodes)) expect(en.errors).toHaveProperty(code);
  });

  it('translates known codes and keeps server text where it carries specifics', () => {
    expect(apiErrorMessage(new ApiError('BAD_PIN', 'server words'), t)).toBe('Incorrect PIN');
    expect(apiErrorMessage(new ApiError('VALIDATION', 'Missing record id'), t)).toBe('Missing record id');
    expect(apiErrorMessage(new ApiError('INTERNAL', 'boom'), t)).toBe('boom');
  });

  it('falls back to server text for codes this client does not know', () => {
    expect(apiErrorMessage(new ApiError('NEW_CODE' as ApiErrorCode, 'Newer server says no'), t)).toBe(
      'Newer server says no',
    );
  });

  it('maps network and unknown errors', () => {
    expect(apiErrorMessage(new NetworkError('Failed to fetch'), t)).toBe(en.errors.NETWORK);
    expect(apiErrorMessage(new Error('idb exploded'), t, 'Could not save')).toBe('Could not save');
    expect(apiErrorMessage('weird', t)).toBe(en.errors.UNKNOWN);
  });
});

describe('field helpers', () => {
  it('labels, placeholders and validation messages come from the dictionary', () => {
    const mobile = field('TMR MOBILE NO');
    const train = field('TR.NO');
    expect(fieldLabel(train, t)).toBe('Train No');
    expect(fieldPlaceholder(train, t)).toBe('e.g. KPCC');
    expect(fieldPlaceholder(mobile, t)).toBe('10 digit mobile no');
    expect(fieldPlaceholder(field('ISSUED AT'), t)).toBeUndefined();

    expect(validateField(train, '')).toBe('required');
    expect(validateField(mobile, '12345')).toBe('pattern');
    expect(validateField(mobile, '')).toBeUndefined();
    expect(validateField(mobile, '9876543210')).toBeUndefined();

    expect(fieldErrorText(train, 'required', t)).toBe('Train No is required');
    expect(fieldErrorText(mobile, 'pattern', t)).toBe('Must be a 10 digit mobile number');
    expect(fieldErrorText(mobile, undefined, t)).toBeUndefined();
  });
});
