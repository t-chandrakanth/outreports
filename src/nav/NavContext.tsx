/**
 * Navigation stack with real History API integration, so that:
 * - the Android hardware/system back gesture pops one screen,
 * - the browser back button behaves identically,
 * - dialogs close on back instead of leaving the screen,
 * - a dirty edit form can intercept back with a confirm dialog.
 *
 * Invariants:
 * - Every screen push adds exactly one history entry; every open dialog adds
 *   one more. `state.oidx` is the stack index of the visible screen and
 *   `state.hidx` the absolute depth from the root entry.
 * - The ONLY code that removes screens from the React stack is the popstate
 *   handler: programmatic pops call history.go(), so hardware back, gesture
 *   back and code-driven back are a single path that cannot desync.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
import type { Route, StackEntry } from './types';

interface HistState {
  oidx: number;
  hidx: number;
  dlg?: number;
}

interface DialogRec {
  id: number;
  hidx: number;
  onClose: () => void;
  closedByHistory: boolean;
}

export interface Nav {
  stack: readonly StackEntry[];
  canGoBack: boolean;
  push(route: Route): void;
  /** Programmatic pop — bypasses back guards (e.g. after a successful save). */
  pop(count?: number): void;
  /** User-initiated back (app-bar arrow): honours back guards. */
  back(): void;
  popToRoot(): void;
}

export interface NavInternals {
  stackRef: MutableRefObject<readonly StackEntry[]>;
  /** true while a transition or gesture is running; pushes/backs are ignored */
  lockRef: MutableRefObject<boolean>;
  /** set by the edge gesture right before history.back(): pop applies with no second animation */
  gesturePopRef: MutableRefObject<boolean>;
  /** how the pending stack change should be presented */
  lastChangeRef: MutableRefObject<'push' | 'pop' | 'none'>;
  popInstantRef: MutableRefObject<boolean>;
  suppressRef: MutableRefObject<number>;
  lastHidxRef: MutableRefObject<number>;
  dialogsRef: MutableRefObject<DialogRec[]>;
  guardsRef: MutableRefObject<Map<string, () => void>>;
  topGuard(): (() => void) | null;
}

const NavContext = createContext<Nav | null>(null);
const NavInternalsContext = createContext<NavInternals | null>(null);

/** Provided by NavStack around each screen: its stack key and index. */
export const ScreenEntryContext = createContext<{ key: string; index: number } | null>(null);

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error('useNav outside NavProvider');
  return nav;
}

export function useNavInternals(): NavInternals {
  const i = useContext(NavInternalsContext);
  if (!i) throw new Error('useNavInternals outside NavProvider');
  return i;
}

function readState(): Partial<HistState> | null {
  return history.state as Partial<HistState> | null;
}

// Page-global: history is shared, so init/unwind must survive StrictMode's
// double provider mount in dev.
let historyInitialized = false;
let unwinding = false;
let nextDialogId = 1;

export function NavProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const [stack, setStack] = useState<StackEntry[]>(() => [
    { key: crypto.randomUUID(), route: initial },
  ]);
  const stackRef = useRef<readonly StackEntry[]>(stack);
  stackRef.current = stack;

  const lockRef = useRef(false);
  const gesturePopRef = useRef(false);
  const lastChangeRef = useRef<'push' | 'pop' | 'none'>('none');
  const popInstantRef = useRef(false);
  const suppressRef = useRef(0);
  const bypassRef = useRef(false);
  const lastHidxRef = useRef(0);
  const dialogsRef = useRef<DialogRec[]>([]);
  const guardsRef = useRef(new Map<string, () => void>());

  const topGuard = useCallback((): (() => void) | null => {
    const top = stackRef.current[stackRef.current.length - 1];
    return (top && guardsRef.current.get(top.key)) ?? null;
  }, []);

  useEffect(() => {
    if (!historyInitialized) {
      historyInitialized = true;
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      const s = readState();
      const hidx = s?.hidx ?? 0;
      if (hidx > 0) {
        // Refreshed mid-stack: screen state is gone, so render the root and
        // unwind the ghost entries so the next back exits the app cleanly.
        unwinding = true;
        history.go(-hidx);
      } else {
        history.replaceState({ oidx: 0, hidx: 0 } satisfies HistState, '');
      }
    }

    const onPop = () => {
      const s = readState();
      const oidx = s?.oidx ?? 0;
      const hidx = s?.hidx ?? 0;

      if (unwinding) {
        if (hidx <= 0) {
          unwinding = false;
          history.replaceState({ oidx: 0, hidx: 0 } satisfies HistState, '');
          lastHidxRef.current = 0;
        } else {
          history.go(-hidx);
        }
        return;
      }

      const prevHidx = lastHidxRef.current;
      lastHidxRef.current = hidx;

      if (suppressRef.current > 0) {
        suppressRef.current -= 1;
        return;
      }

      // Dialogs whose history entries were just popped close now.
      for (const d of [...dialogsRef.current]) {
        if (d.hidx > hidx) {
          d.closedByHistory = true;
          dialogsRef.current = dialogsRef.current.filter((x) => x !== d);
          d.onClose();
        }
      }

      const top = stackRef.current.length - 1;
      if (oidx < top) {
        const bypass = bypassRef.current;
        bypassRef.current = false;
        const guard = bypass ? null : topGuard();
        if (guard) {
          // Restore the guarded screen's entry (its forward entry must still
          // exist — we just came from it), then ask the user what to do.
          suppressRef.current += 1;
          history.go(prevHidx - hidx);
          window.setTimeout(guard, 60);
          return;
        }
        const count = top - oidx;
        popInstantRef.current = count > 1 || gesturePopRef.current || lockRef.current;
        gesturePopRef.current = false;
        lastChangeRef.current = 'pop';
        setStack((prev) => prev.slice(0, Math.max(1, prev.length - count)));
      } else if (oidx > top || hidx > prevHidx) {
        // Forward button: stack navigation has no forward — snap back.
        suppressRef.current += 1;
        history.go(-(hidx - prevHidx));
      }
    };

    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const push = useCallback((route: Route) => {
    if (lockRef.current) return;
    const hidx = lastHidxRef.current + 1;
    const oidx = stackRef.current.length;
    history.pushState({ oidx, hidx } satisfies HistState, '');
    lastHidxRef.current = hidx;
    lastChangeRef.current = 'push';
    setStack((prev) => [...prev, { key: crypto.randomUUID(), route }]);
  }, []);

  const pop = useCallback((count = 1) => {
    const n = Math.min(count, stackRef.current.length - 1);
    if (n <= 0) return;
    bypassRef.current = true;
    history.go(-n);
  }, []);

  const back = useCallback(() => {
    if (lockRef.current) return;
    if (stackRef.current.length < 2) return;
    history.back();
  }, []);

  const popToRoot = useCallback(() => {
    pop(stackRef.current.length - 1);
  }, [pop]);

  const nav = useMemo<Nav>(
    () => ({ stack, canGoBack: stack.length > 1, push, pop, back, popToRoot }),
    [stack, push, pop, back, popToRoot],
  );

  const internals = useMemo<NavInternals>(
    () => ({
      stackRef,
      lockRef,
      gesturePopRef,
      lastChangeRef,
      popInstantRef,
      suppressRef,
      lastHidxRef,
      dialogsRef,
      guardsRef,
      topGuard,
    }),
    [topGuard],
  );

  return (
    <NavContext.Provider value={nav}>
      <NavInternalsContext.Provider value={internals}>{children}</NavInternalsContext.Provider>
    </NavContext.Provider>
  );
}

/**
 * Close a dialog/bottom-sheet with the back button instead of navigating.
 * While `open`, one extra history entry backs the dialog; hardware back pops
 * it and fires `onClose`. A programmatic close consumes the entry silently.
 */
export function useBackClose(open: boolean, onClose: () => void): void {
  const internals = useNavInternals();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = nextDialogId++;
    const hidx = internals.lastHidxRef.current + 1;
    const oidx = readState()?.oidx ?? 0;
    history.pushState({ oidx, hidx, dlg: id } satisfies HistState, '');
    internals.lastHidxRef.current = hidx;
    const rec: DialogRec = {
      id,
      hidx,
      onClose: () => onCloseRef.current(),
      closedByHistory: false,
    };
    internals.dialogsRef.current.push(rec);
    return () => {
      internals.dialogsRef.current = internals.dialogsRef.current.filter((x) => x !== rec);
      if (!rec.closedByHistory && readState()?.dlg === id) {
        internals.suppressRef.current += 1;
        history.back();
      }
    };
  }, [open, internals]);
}

/**
 * Intercept user-initiated back (hardware button, edge swipe, app-bar arrow)
 * on the screen this hook is used in. While `active`, back does not pop;
 * `onBlocked` fires instead (open a confirm dialog there). Programmatic
 * `nav.pop()` bypasses the guard.
 */
export function useBackGuard(active: boolean, onBlocked: () => void): void {
  const internals = useNavInternals();
  const entry = useContext(ScreenEntryContext);
  const cbRef = useRef(onBlocked);
  cbRef.current = onBlocked;

  useEffect(() => {
    if (!active || !entry) return;
    const map = internals.guardsRef.current;
    map.set(entry.key, () => cbRef.current());
    return () => {
      map.delete(entry.key);
    };
  }, [active, entry, internals]);
}
