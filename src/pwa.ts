/**
 * Service-worker update flow. registerType 'prompt' hands control here:
 * updates apply immediately (silent reload) UNLESS someone is mid-entry —
 * then the new version waits for the next launch instead of wiping the form.
 */
import { registerSW } from 'virtual:pwa-register';

const dirtyForms = new Set<symbol>();
let pendingUpdate: (() => void) | null = null;

export function setFormDirty(key: symbol, value: boolean): void {
  if (value) dirtyForms.add(key);
  else dirtyForms.delete(key);
  if (dirtyForms.size === 0 && pendingUpdate) {
    const run = pendingUpdate;
    pendingUpdate = null;
    run();
  }
}

export function initPWA(): void {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      const apply = () => void updateSW(true); // reloads the page
      if (dirtyForms.size > 0) {
        pendingUpdate = apply; // applied when the form is saved/cleared
      } else {
        apply();
      }
    },
  });
}
