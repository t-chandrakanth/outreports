import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { initAnalytics } from './analytics';
import './i18n'; // initialises translations before the first render
import { flushOutbox, normalizeOutbox } from './offline/outbox';
import { initPWA } from './pwa';
import { theme } from './theme';
import './styles/global.css';
import './styles/nav.css';

initAnalytics();
initPWA();

// Items left as 'syncing' by an interrupted flush must be unlocked even when
// starting offline; then push anything queued as soon as the app opens.
void normalizeOutbox().then(() => {
  if (navigator.onLine) void flushOutbox();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
);
