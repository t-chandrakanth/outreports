import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Typography from '@mui/material/Typography';
import { trackEvent } from '../analytics';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useBackClose } from '../nav/NavContext';
import { useToast } from './Toast';

const DISMISS_KEY = 'outreports:install-dismissed';

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return true; // storage unavailable: never auto-nag
  }
}

function markDismissed(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* ignore */
  }
}

const ShareIcon = () => (
  <svg className="step-icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3v12m0-12L8 7m4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const PlusSquareIcon = () => (
  <svg className="step-icon" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const MenuIcon = () => (
  <svg className="step-icon" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="5" r="1.8" fill="currentColor" />
    <circle cx="12" cy="12" r="1.8" fill="currentColor" />
    <circle cx="12" cy="19" r="1.8" fill="currentColor" />
  </svg>
);

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InstallGuide({ open, onClose }: Props) {
  const { canPrompt, promptInstall, platform } = useInstallPrompt();
  const toast = useToast();

  function dismiss() {
    markDismissed();
    onClose();
  }

  // Hardware back closes the sheet instead of navigating.
  useBackClose(open, dismiss);

  async function install() {
    trackEvent('install_prompted', { platform });
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      trackEvent('install_accepted', { platform });
      toast('success', 'Installed — find OUTREPORTS on your home screen');
      markDismissed();
      onClose();
    }
  }

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={dismiss}
      onOpen={() => {}}
      disableSwipeToOpen
      aria-label="Install this app"
      slotProps={{
        paper: {
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxWidth: 640,
            mx: 'auto',
            px: 2.5,
            pt: 1,
            pb: 'max(16px, env(safe-area-inset-bottom))',
          },
        },
      }}
    >
      <Box
        aria-hidden="true"
        sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', my: 1 }}
      />
      <Typography variant="h6" component="h2" sx={{ mt: 1 }}>
        Keep OUTREPORTS on your phone
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 1.5 }}>
        Install it like an app — opens full screen from your home screen and
        keeps working when the network drops.
      </Typography>

        {platform === 'ios' && (
          <ol className="install-steps">
            <li>
              <ShareIcon />
              <span>In <strong>Safari</strong>, tap the <strong>Share</strong> button (bottom of the screen)</span>
            </li>
            <li>
              <PlusSquareIcon />
              <span>Scroll down and tap <strong>Add to Home Screen</strong></span>
            </li>
            <li>
              <span className="step-badge">Add</span>
              <span>Tap <strong>Add</strong> — done</span>
            </li>
          </ol>
        )}

        {platform !== 'ios' && !canPrompt && (
          <ol className="install-steps">
            <li>
              <MenuIcon />
              <span>Open the browser menu (<strong>⋮</strong> top right)</span>
            </li>
            <li>
              <PlusSquareIcon />
              <span>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong></span>
            </li>
            <li>
              <span className="step-badge">Install</span>
              <span>Confirm — done</span>
            </li>
          </ol>
        )}

      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
        <Button color="inherit" variant="outlined" size="large" onClick={dismiss} sx={{ flex: '0 0 auto' }}>
          Not now
        </Button>
        {platform !== 'ios' && canPrompt ? (
          <Button variant="contained" color="success" size="large" onClick={() => void install()} sx={{ flex: 1 }}>
            Install app
          </Button>
        ) : (
          <Button variant="contained" color="success" size="large" onClick={dismiss} sx={{ flex: 1 }}>
            Got it
          </Button>
        )}
      </Box>
    </SwipeableDrawer>
  );
}

/**
 * Decides whether the guide should auto-open on this visit:
 * mobile browser, not installed, not previously dismissed.
 */
export function useAutoInstallGuide(): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);
  const { installed, platform } = useInstallPrompt();

  useEffect(() => {
    if (installed || platform === 'desktop' || wasDismissed()) return;
    const t = setTimeout(() => setOpen(true), 2500);
    return () => clearTimeout(t);
  }, [installed, platform]);

  return [open, setOpen];
}
