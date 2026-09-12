import { useEffect, type RefObject } from 'react';
import { fade, reducedMotion, slide } from './animate';
import type { NavInternals } from './NavContext';

export interface GestureEls {
  top: HTMLElement;
  under: HTMLElement;
  scrim: HTMLElement | null;
}

interface Hooks {
  showUnder: (els: GestureEls, width: number) => void;
  hideUnder: (els: GestureEls) => void;
}

const EDGE_PX = 28;
const INTENT_PX = 10;
const COMMIT_FRACTION = 0.4;
const COMMIT_VELOCITY = 0.35; // px/ms
const SETTLE_MS = 200;

/**
 * iOS-style swipe-back: a drag starting within EDGE_PX of the left edge pulls
 * the top screen with the finger; releasing past 40% width (or a fast flick)
 * commits `history.back()`, otherwise the screen springs back.
 *
 * Uses container-level pointer listeners (not an overlay strip), so plain
 * taps near the edge still reach buttons and inputs. Android 10+ gesture nav
 * consumes edge swipes at the OS level and arrives as popstate instead —
 * the two mechanisms are naturally mutually exclusive.
 */
export function useEdgeSwipeBack(
  rootRef: RefObject<HTMLDivElement | null>,
  internals: NavInternals,
  getEls: () => GestureEls | null,
  hooks: Hooks,
): void {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let tracking = false;
    let engaged = false;
    let abandoned = false;
    let pid = -1;
    let startX = 0;
    let startY = 0;
    let width = 1;
    let latestDx = 0;
    let raf = 0;
    let els: GestureEls | null = null;
    let samples: { t: number; x: number }[] = [];

    const apply = () => {
      raf = 0;
      if (!engaged || !els) return;
      const dx = latestDx;
      els.top.style.transform = `translate3d(${dx}px,0,0)`;
      els.under.style.transform = `translate3d(${-width / 4 + dx / 4}px,0,0)`;
      if (els.scrim) els.scrim.style.opacity = String(Math.max(0, 1 - dx / width));
    };

    const down = (e: PointerEvent) => {
      if (tracking || !e.isPrimary) return;
      if (internals.lockRef.current) return;
      if (internals.stackRef.current.length < 2) return;
      const rect = root.getBoundingClientRect();
      if (e.clientX - rect.left > EDGE_PX) return;
      tracking = true;
      engaged = false;
      abandoned = false;
      pid = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      width = rect.width || 1;
      latestDx = 0;
      samples = [{ t: e.timeStamp, x: e.clientX }];
    };

    const move = (e: PointerEvent) => {
      if (!tracking || e.pointerId !== pid || abandoned) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      samples.push({ t: e.timeStamp, x: e.clientX });
      while (samples.length > 2 && e.timeStamp - samples[0].t > 100) samples.shift();
      if (!engaged) {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          abandoned = true; // vertical intent: the scroll owns this touch
          return;
        }
        if (!(dx > INTENT_PX && Math.abs(dx) > 1.2 * Math.abs(dy))) return;
        els = getEls();
        if (!els) {
          abandoned = true;
          return;
        }
        engaged = true;
        internals.lockRef.current = true;
        try {
          root.setPointerCapture(pid);
        } catch {
          /* pointer already released */
        }
        document.body.classList.add('nav-gesture');
        hooks.showUnder(els, width);
      }
      latestDx = Math.min(Math.max(0, dx), width);
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const finish = (e: PointerEvent, cancelled: boolean) => {
      if (!tracking || e.pointerId !== pid) return;
      tracking = false;
      pid = -1;
      const myEls = els;
      els = null;
      if (!engaged || !myEls) return;
      engaged = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      document.body.classList.remove('nav-gesture');

      const dx = latestDx;
      let v = 0;
      if (samples.length >= 2) {
        const a = samples[0];
        const b = samples[samples.length - 1];
        if (b.t > a.t) v = (b.x - a.x) / (b.t - a.t);
      }
      const guard = internals.topGuard();
      const commit = !cancelled && (dx > COMMIT_FRACTION * width || v > COMMIT_VELOCITY);
      const dur = reducedMotion() ? 0 : SETTLE_MS;
      const fromTop = `translate3d(${dx}px,0,0)`;
      const fromUnder = `translate3d(${-width / 4 + dx / 4}px,0,0)`;
      const scrimNow = String(Math.max(0, 1 - dx / width));

      if (commit && !guard) {
        void Promise.all([
          slide(myEls.top, fromTop, `translate3d(${width}px,0,0)`, dur),
          slide(myEls.under, fromUnder, 'translate3d(0,0,0)', dur),
          myEls.scrim ? fade(myEls.scrim, scrimNow, '0', dur) : Promise.resolve(),
        ]).then(() => {
          internals.gesturePopRef.current = true;
          internals.lockRef.current = false;
          history.back();
        });
      } else {
        void Promise.all([
          slide(myEls.top, fromTop, 'translate3d(0,0,0)', dur),
          slide(myEls.under, fromUnder, `translate3d(${-width / 4}px,0,0)`, dur),
          myEls.scrim ? fade(myEls.scrim, scrimNow, '1', dur) : Promise.resolve(),
        ]).then(() => {
          hooks.hideUnder(myEls);
          myEls.top.style.transform = '';
          internals.lockRef.current = false;
          // Guarded screen: the swipe crossed the commit threshold but the
          // form has unsaved changes — spring back, then ask.
          if (commit && guard) guard();
        });
      }
    };

    const up = (e: PointerEvent) => finish(e, false);
    const cancel = (e: PointerEvent) => finish(e, true);

    root.addEventListener('pointerdown', down);
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', cancel);
    return () => {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
