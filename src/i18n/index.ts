/**
 * i18next setup. Resources are bundled (no HTTP backend) so every language
 * works offline. Import this module once, before the first render.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { trackEvent } from '../analytics';
import { en } from './locales/en';
import { hi } from './locales/hi';
import { te } from './locales/te';

/** Menu order. Each name is written in its own script. */
export const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'hi', name: 'हिन्दी' },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

const STORAGE_KEY = 'outreports:lang';

function isSupported(code: string | null | undefined): code is LanguageCode {
  return LANGUAGES.some((l) => l.code === code);
}

/** Stored choice wins; then the first supported browser language; then English. */
export function detectLanguage(stored: string | null, browserLanguages: readonly string[]): LanguageCode {
  if (isSupported(stored)) return stored;
  for (const tag of browserLanguages) {
    const base = tag.toLowerCase().split('-')[0];
    if (isSupported(base)) return base;
  }
  return 'en';
}

function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null; // storage blocked: still switchable for the session
  }
}

function browserLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

function applyDocumentLang(code: LanguageCode): void {
  if (typeof document !== 'undefined') document.documentElement.lang = code;
}

export function currentLanguage(): LanguageCode {
  const lng = i18n.resolvedLanguage ?? i18n.language;
  return isSupported(lng) ? lng : 'en';
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  const from = currentLanguage();
  await i18n.changeLanguage(code);
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  applyDocumentLang(code);
  if (from !== code) trackEvent('language_changed', { from, to: code });
}

const initial = detectLanguage(readStored(), browserLanguages());

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    te: { translation: te },
    hi: { translation: hi },
  },
  lng: initial,
  fallbackLng: 'en',
  supportedLngs: LANGUAGES.map((l) => l.code),
  interpolation: { escapeValue: false }, // React escapes
  initAsync: false, // bundled resources: ready before the first render
});
applyDocumentLang(initial);

export default i18n;
