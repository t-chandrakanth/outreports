import { Children, useEffect, useRef, type ReactNode } from 'react';
import { reducedMotion } from '../nav/animate';

interface Props {
  index: number;
  onChange: (index: number) => void;
  /** ids for aria wiring: panel i is labelled by tab i */
  getPanelProps?: (i: number) => { id?: string; 'aria-labelledby'?: string };
  children: ReactNode;
}

const EDGE_RESERVED_PX = 34; // left edge belongs to swipe-back
const INTENT_PX = 10;
const COMMIT_FRACTION = 0.3;
const COMMIT_VELOCITY = 0.35; // px/ms
const SETTLE_MS = 250;
const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

/**
 * Horizontally swipeable tab panels. All panels stay mounted (form drafts
 * survive tab switches); the inactive one is hidden and inert once settled.
 * Vertical scrolling inside a panel stays native (touch-action: pan-y on the
 * container); only a clearly horizontal drag moves the pager.
 */
export function SwipeablePanels({ index, onChange, getPanelProps, children }: Props) {
  const kids = Children.toArray(children);
  const count = kids.length;
  const rowRef = useRef<HTMLDivElement>(null);
  const panelEls = useRef<(HTMLDivElement | null)[]>([]);
  const indexRef = useRef(index);
  indexRef.current = index;
  const draggingRef = useRef(false);

  function goTo(row: HTMLDivElement, i: number, animate: boolean) {
    row.style.transition = animate && !reducedMotion() ? `transform ${SETTLE_MS}ms ${EASE}` : 'none';
    row.style.transform = `translate3d(${(-i * 100) / count}%,0,0)`;
  }

  function revealAll() {
    panelEls.current.forEach((p) => {
      if (!p) return;
      p.style.visibility = '';
      p.toggleAttribute('inert', false);
      p.removeAttribute('aria-hidden');
    });
  }

  function settleVisibility(active: number) {
    panelEls.current.forEach((p, i) => {
      if (!p) return;
      const on = i === active;
      if (!on && p.contains(document.activeElement)) (document.activeElement as HTMLElement | null)?.blur?.();
      p.style.visibility = on ? '' : 'hidden';
      p.toggleAttribute('inert', !on);
      if (on) p.removeAttribute('aria-hidden');
      else p.setAttribute('aria-hidden', 'true');
    });
  }

  // Position the row and (after the slide settles) hide the inactive panel.
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    revealAll();
    goTo(row, index, true);
    const t = setTimeout(() => {
      if (!draggingRef.current) settleVisibility(indexRef.current);
    }, SETTLE_MS + 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    let tracking = false;
    let engaged = false;
    let abandoned = false;
    let pid = -1;
    let startX = 0;
    let startY = 0;
    let width = 1;
    let latestDx = 0;
    let raf = 0;
    let samples: { t: number; x: number }[] = [];

    const base = () => (-indexRef.current * width);

    const apply = () => {
      raf = 0;
      if (!engaged) return;
      let dx = latestDx;
      // rubber-band past the ends
      const i = indexRef.current;
      if ((i === 0 && dx > 0) || (i === count - 1 && dx < 0)) dx *= 0.3;
      row.style.transform = `translate3d(${base() + dx}px,0,0)`;
    };

    const down = (e: PointerEvent) => {
      if (tracking || !e.isPrimary || count < 2) return;
      if (e.clientX <= EDGE_RESERVED_PX) return; // edge = swipe-back territory
      tracking = true;
      engaged = false;
      abandoned = false;
      pid = e.pointerId;
      startX = e.clientX;
      startY = e.clientY;
      width = row.parentElement?.getBoundingClientRect().width || 1;
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
          abandoned = true;
          return;
        }
        if (!(Math.abs(dx) > INTENT_PX && Math.abs(dx) > 1.2 * Math.abs(dy))) return;
        engaged = true;
        draggingRef.current = true;
        try {
          row.setPointerCapture(pid);
        } catch {
          /* released */
        }
        document.body.classList.add('nav-gesture');
        revealAll();
        row.style.transition = 'none';
      }
      latestDx = dx;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    const finish = (e: PointerEvent, cancelled: boolean) => {
      if (!tracking || e.pointerId !== pid) return;
      tracking = false;
      pid = -1;
      if (!engaged) return;
      engaged = false;
      draggingRef.current = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
      document.body.classList.remove('nav-gesture');
      let v = 0;
      if (samples.length >= 2) {
        const a = samples[0];
        const b = samples[samples.length - 1];
        if (b.t > a.t) v = (b.x - a.x) / (b.t - a.t);
      }
      const dx = latestDx;
      let target = indexRef.current;
      if (!cancelled) {
        if (dx < -COMMIT_FRACTION * width || v < -COMMIT_VELOCITY) target += 1;
        else if (dx > COMMIT_FRACTION * width || v > COMMIT_VELOCITY) target -= 1;
      }
      target = Math.max(0, Math.min(count - 1, target));
      if (target !== indexRef.current) {
        onChange(target); // the index effect animates and settles visibility
      } else {
        goTo(row, target, true);
        setTimeout(() => {
          if (!draggingRef.current) settleVisibility(indexRef.current);
        }, SETTLE_MS + 60);
      }
    };

    const up = (e: PointerEvent) => finish(e, false);
    const cancel = (e: PointerEvent) => finish(e, true);

    row.addEventListener('pointerdown', down);
    row.addEventListener('pointermove', move);
    row.addEventListener('pointerup', up);
    row.addEventListener('pointercancel', cancel);
    return () => {
      row.removeEventListener('pointerdown', down);
      row.removeEventListener('pointermove', move);
      row.removeEventListener('pointerup', up);
      row.removeEventListener('pointercancel', cancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, onChange]);

  return (
    <div className="panels">
      <div className="panels-row" ref={rowRef} style={{ width: `${count * 100}%` }}>
        {kids.map((kid, i) => (
          <div
            key={i}
            className="panel"
            role="tabpanel"
            {...(getPanelProps ? getPanelProps(i) : {})}
            style={{ flex: `0 0 ${100 / count}%` }}
            ref={(el) => {
              panelEls.current[i] = el;
            }}
          >
            {kid}
          </div>
        ))}
      </div>
    </div>
  );
}
