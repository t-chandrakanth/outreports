// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hideSplash, SPLASH_FADE_MS, SPLASH_MIN_MS } from '../splash';

function mount(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'splash';
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '';
});
afterEach(() => vi.useRealTimers());

describe('hideSplash', () => {
  it('is a no-op when there is no #splash element', () => {
    expect(() => hideSplash()).not.toThrow();
  });

  it('holds the splash until the minimum time since page start, then fades and removes it', () => {
    const el = mount();
    vi.spyOn(performance, 'now').mockReturnValue(100);
    hideSplash();
    expect(el.classList.contains('splash--hide')).toBe(false);

    vi.advanceTimersByTime(SPLASH_MIN_MS - 100);
    expect(el.classList.contains('splash--hide')).toBe(true);
    expect(document.getElementById('splash')).not.toBeNull();

    vi.advanceTimersByTime(SPLASH_FADE_MS);
    expect(document.getElementById('splash')).toBeNull();
  });

  it('fades immediately when the page has already been up longer than the minimum', () => {
    const el = mount();
    vi.spyOn(performance, 'now').mockReturnValue(SPLASH_MIN_MS + 1);
    hideSplash();
    expect(el.classList.contains('splash--hide')).toBe(true);
  });

  it('removes the node as soon as the fade transition ends', () => {
    const el = mount();
    vi.spyOn(performance, 'now').mockReturnValue(SPLASH_MIN_MS + 1);
    hideSplash();
    el.dispatchEvent(new Event('transitionend'));
    expect(document.getElementById('splash')).toBeNull();
    // fallback timer must not throw on the already-removed node
    expect(() => vi.advanceTimersByTime(SPLASH_FADE_MS)).not.toThrow();
  });
});
