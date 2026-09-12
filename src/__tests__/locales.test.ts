import { describe, expect, it } from 'vitest';
import { en } from '../i18n/locales/en';
import { hi } from '../i18n/locales/hi';
import { te } from '../i18n/locales/te';

type Tree = { [key: string]: string | Tree };

/** Flattens nested dictionaries to dotted key -> string. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out.set(key, v);
    else for (const [ck, cv] of flatten(v, key)) out.set(ck, cv);
  }
  return out;
}

/** Interpolation variables and <b> tags a translation must keep. */
const tokens = (s: string) => [...s.matchAll(/\{\{\s*(\w+)\s*\}\}|<\/?b>/g)].map((m) => m[0]).sort();

const english = flatten(en);

describe.each([
  ['te', te],
  ['hi', hi],
])('%s dictionary', (_code, dict) => {
  const translated = flatten(dict as Tree);

  it('has exactly the English keys', () => {
    expect([...translated.keys()].sort()).toEqual([...english.keys()].sort());
  });

  it('has no empty strings', () => {
    for (const [key, value] of translated) expect(value.trim(), key).not.toBe('');
  });

  it('keeps every interpolation variable and bold tag', () => {
    for (const [key, value] of english) expect(tokens(translated.get(key) ?? ''), key).toEqual(tokens(value));
  });
});
