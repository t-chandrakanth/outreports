import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { fade, reducedMotion, slide } from './animate';
import { ScreenEntryContext, useNav, useNavInternals } from './NavContext';
import { useEdgeSwipeBack, type GestureEls } from './EdgeSwipeBack';
import type { Route, StackEntry } from './types';

const PUSH_MS = 260;
const POP_MS = 240;

function coverEl(el: HTMLElement, scrim?: HTMLElement | null) {
  // aria-hidden on an ancestor of the focused element is an a11y violation
  // (and Chrome warns): drop focus before hiding the layer.
  if (el.contains(document.activeElement)) (document.activeElement as HTMLElement | null)?.blur?.();
  el.style.visibility = 'hidden';
  el.style.transform = '';
  el.toggleAttribute('inert', true);
  el.setAttribute('aria-hidden', 'true');
  if (scrim) scrim.style.opacity = '0';
}

function uncoverEl(el: HTMLElement, transform = '', scrim?: HTMLElement | null, scrimOpacity = '0') {
  el.style.visibility = '';
  el.style.transform = transform;
  el.toggleAttribute('inert', false);
  el.removeAttribute('aria-hidden');
  if (scrim) scrim.style.opacity = scrimOpacity;
}

type PendingAnim = { type: 'push'; key: string } | { type: 'pop'; key: string } | null;

/**
 * Renders every stack entry as a full-viewport layer. Covered screens stay
 * MOUNTED (drafts and scroll positions survive) but are hidden and inert.
 * Push/pop slide like native mobile pages; the left-edge swipe drags the top
 * screen with the finger.
 */
export function NavStack({ render }: { render: (route: Route) => ReactNode }) {
  const { stack } = useNav();
  const internals = useNavInternals();

  const layers = useRef(new Map<string, HTMLDivElement>());
  const scrims = useRef(new Map<string, HTMLDivElement>());
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingAnimRef = useRef<PendingAnim>(null);

  // renderStack lags the real stack by one animation: a popped screen stays
  // rendered (as the top layer) until its exit slide finishes.
  const [renderStack, setRenderStack] = useState<readonly StackEntry[]>(stack);
  const [prevStack, setPrevStack] = useState<readonly StackEntry[]>(stack);

  if (stack !== prevStack) {
    setPrevStack(stack);
    const change = internals.lastChangeRef.current;
    if (change === 'push' && stack.length === prevStack.length + 1) {
      pendingAnimRef.current = { type: 'push', key: stack[stack.length - 1].key };
      setRenderStack(stack);
    } else if (
      change === 'pop' &&
      stack.length === prevStack.length - 1 &&
      !internals.popInstantRef.current &&
      !reducedMotion()
    ) {
      const exiting = prevStack[prevStack.length - 1];
      pendingAnimRef.current = { type: 'pop', key: exiting.key };
      setRenderStack([...stack, exiting]);
    } else {
      pendingAnimRef.current = null;
      setRenderStack(stack);
    }
  }

  function settleAll() {
    const cur = internals.stackRef.current;
    const topKey = cur[cur.length - 1]?.key;
    for (const [key, el] of layers.current) {
      if (key === topKey) uncoverEl(el, '', scrims.current.get(key));
      else coverEl(el, scrims.current.get(key));
    }
    internals.lockRef.current = false;
  }

  useLayoutEffect(() => {
    const anim = pendingAnimRef.current;
    pendingAnimRef.current = null;
    internals.lastChangeRef.current = 'none';
    internals.popInstantRef.current = false;

    if (!anim) {
      settleAll();
      return;
    }

    if (anim.type === 'push') {
      const entering = layers.current.get(anim.key);
      const cur = internals.stackRef.current;
      const underEntry = cur[cur.length - 2];
      const under = underEntry && layers.current.get(underEntry.key);
      const scrim = underEntry ? scrims.current.get(underEntry.key) : undefined;
      if (!entering) {
        settleAll();
        return;
      }
      internals.lockRef.current = true;
      const dur = reducedMotion() ? 0 : PUSH_MS;
      const jobs = [slide(entering, 'translateX(100%)', 'translateX(0)', dur)];
      if (under) jobs.push(slide(under, 'translateX(0)', 'translateX(-25%)', dur));
      if (scrim) jobs.push(fade(scrim, '0', '1', dur));
      void Promise.all(jobs).then(settleAll);
    } else {
      const exiting = layers.current.get(anim.key);
      const cur = internals.stackRef.current;
      const topEntry = cur[cur.length - 1];
      const top = topEntry && layers.current.get(topEntry.key);
      const scrim = topEntry ? scrims.current.get(topEntry.key) : undefined;
      internals.lockRef.current = true;
      const dur = POP_MS;
      if (top) uncoverEl(top, 'translateX(-25%)', scrim, '1');
      const jobs: Promise<void>[] = [];
      if (exiting) jobs.push(slide(exiting, 'translateX(0)', 'translateX(100%)', dur));
      if (top) jobs.push(slide(top, 'translateX(-25%)', 'translateX(0)', dur));
      if (scrim) jobs.push(fade(scrim, '1', '0', dur));
      void Promise.all(jobs).then(() => {
        setRenderStack(internals.stackRef.current);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderStack]);

  const getGestureEls = (): GestureEls | null => {
    const cur = internals.stackRef.current;
    if (cur.length < 2) return null;
    const top = layers.current.get(cur[cur.length - 1].key);
    const under = layers.current.get(cur[cur.length - 2].key);
    if (!top || !under) return null;
    return { top, under, scrim: scrims.current.get(cur[cur.length - 2].key) ?? null };
  };

  useEdgeSwipeBack(rootRef, internals, getGestureEls, {
    showUnder: (els, width) => {
      els.under.style.visibility = '';
      els.under.toggleAttribute('inert', false);
      els.under.removeAttribute('aria-hidden');
      els.under.style.transform = `translate3d(${-width / 4}px,0,0)`;
      if (els.scrim) els.scrim.style.opacity = '1';
    },
    hideUnder: (els) => {
      coverEl(els.under, els.scrim);
    },
  });

  return (
    <div className="nav-root" ref={rootRef}>
      {renderStack.map((entry, i) => (
        <div
          key={entry.key}
          className="nav-layer"
          ref={(el) => {
            if (el) layers.current.set(entry.key, el);
            else layers.current.delete(entry.key);
          }}
        >
          <ScreenEntryContext.Provider value={{ key: entry.key, index: i }}>
            {render(entry.route)}
          </ScreenEntryContext.Provider>
          <div
            className="nav-scrim"
            ref={(el) => {
              if (el) scrims.current.set(entry.key, el);
              else scrims.current.delete(entry.key);
            }}
          />
        </div>
      ))}
    </div>
  );
}
