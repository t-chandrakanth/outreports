/**
 * In-app splash screen. index.html paints a full-screen #splash overlay
 * (the splash photo) before any bundle loads; App calls hideSplash() after
 * its first render to fade it out and drop it from the DOM.
 */

/** Shortest time the splash stays on screen, measured from navigation start. */
export const SPLASH_MIN_MS = 600;
/** Matches the CSS transition on #splash.splash--hide in index.html (+ margin). */
export const SPLASH_FADE_MS = 400;

export function hideSplash(): void {
  const el = document.getElementById('splash');
  if (!el) return;

  const remove = () => el.remove();
  const fade = () => {
    el.classList.add('splash--hide');
    el.addEventListener('transitionend', remove, { once: true });
    setTimeout(remove, SPLASH_FADE_MS); // reduced-motion disables the transition
  };

  const wait = SPLASH_MIN_MS - performance.now();
  if (wait > 0) setTimeout(fade, wait);
  else fade();
}
