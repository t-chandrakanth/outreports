import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { flushOutbox } from './offline/outbox';
import './styles/global.css';

registerSW({ immediate: true });

// Push any entries queued while offline as soon as the app opens.
if (navigator.onLine) void flushOutbox();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
