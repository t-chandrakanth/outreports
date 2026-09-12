import { useEffect } from 'react';
import { InstallGuide, useAutoInstallGuide } from './components/InstallGuide';
import { ToastProvider } from './components/Toast';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { NavProvider } from './nav/NavContext';
import { NavStack } from './nav/NavStack';
import type { Route } from './nav/types';
import { flushOutbox } from './offline/outbox';
import { DirectionScreen } from './screens/DirectionScreen';
import { EditScreen } from './screens/EditScreen';
import { HomeScreen } from './screens/HomeScreen';
import { SheetScreen } from './screens/SheetScreen';

export default function App() {
  const [installOpen, setInstallOpen] = useAutoInstallGuide();
  const { installed } = useInstallPrompt();

  // Flush the offline outbox whenever connectivity returns, plus a slow
  // periodic retry: 'online' does not fire when a flush failed while the
  // browser stayed nominally online (e.g. Apps Script hiccup).
  useEffect(() => {
    const flush = () => void flushOutbox();
    window.addEventListener('online', flush);
    const timer = setInterval(() => {
      if (navigator.onLine) flush();
    }, 60_000);
    return () => {
      window.removeEventListener('online', flush);
      clearInterval(timer);
    };
  }, []);

  function renderRoute(route: Route) {
    switch (route.name) {
      case 'home':
        return <HomeScreen showInstallHint={!installed} onInstall={() => setInstallOpen(true)} />;
      case 'direction':
        return <DirectionScreen location={route.location} />;
      case 'sheet':
        return <SheetScreen sheet={route.sheet} />;
      case 'edit':
        return <EditScreen sheet={route.sheet} target={route.target} onDone={route.onDone} />;
    }
  }

  return (
    <ToastProvider>
      <NavProvider initial={{ name: 'home' }}>
        <NavStack render={renderRoute} />
        <InstallGuide open={installOpen} onClose={() => setInstallOpen(false)} />
      </NavProvider>
    </ToastProvider>
  );
}
