import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { flushOutbox, normalizeOutbox } from './offline/outbox';
import { initPWA } from './pwa';
import './styles/global.css';

initPWA();

// Items left as 'syncing' by an interrupted flush must be unlocked even when
// starting offline; then push anything queued as soon as the app opens.
void normalizeOutbox().then(() => {
  if (navigator.onLine) void flushOutbox();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
