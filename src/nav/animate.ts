/** Shared transition primitives for stack navigation and gestures. */

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export function reducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function run(el: HTMLElement, prop: 'transform' | 'opacity', from: string, to: string, dur: number): Promise<void> {
  return new Promise((resolve) => {
    el.style.transition = 'none';
    el.style[prop] = from;
    void el.offsetWidth; // flush styles so the transition starts from `from`
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      el.style.transition = '';
      el.removeEventListener('transitionend', onEnd);
      resolve();
    };
    const onEnd = (e: TransitionEvent) => {
      if (e.target === el && e.propertyName === prop) finish();
    };
    if (dur <= 0) {
      el.style[prop] = to;
      el.style.transition = '';
      resolve();
      return;
    }
    el.style.transition = `${prop} ${dur}ms ${EASE}`;
    el.addEventListener('transitionend', onEnd);
    el.style[prop] = to;
    // transitionend is unreliable (hidden tab, zero-distance moves): hard stop.
    setTimeout(finish, dur + 140);
  });
}

export function slide(el: HTMLElement, from: string, to: string, dur: number): Promise<void> {
  return run(el, 'transform', from, to, dur);
}

export function fade(el: HTMLElement, from: string, to: string, dur: number): Promise<void> {
  return run(el, 'opacity', from, to, dur);
}
