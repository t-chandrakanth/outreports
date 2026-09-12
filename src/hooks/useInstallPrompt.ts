import { useEffect, useState } from 'react';

/** Chrome's install-prompt event (not yet in TS DOM lib). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Capture at module scope: the event can fire before React mounts.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((fn) => fn());
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    promptListeners.forEach((fn) => fn());
  });
}

export type InstallPlatform = 'ios' | 'android' | 'desktop';

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's non-standard flag
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function detectPlatform(): InstallPlatform {
  const ua = navigator.userAgent;
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(ua) || iPadOS) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(deferredPrompt !== null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const sync = () => {
      setCanPrompt(deferredPrompt !== null);
      setInstalled(isStandalone());
    };
    promptListeners.add(sync);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', sync);
    return () => {
      promptListeners.delete(sync);
      mq.removeEventListener?.('change', sync);
    };
  }, []);

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferredPrompt) return 'unavailable';
    const evt = deferredPrompt;
    await evt.prompt();
    const choice = await evt.userChoice;
    if (choice.outcome === 'accepted') deferredPrompt = null;
    promptListeners.forEach((fn) => fn());
    return choice.outcome;
  }

  return { canPrompt, installed, promptInstall, platform: detectPlatform() };
}
