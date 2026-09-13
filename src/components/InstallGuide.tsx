import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import Typography from '@mui/material/Typography';
import { Trans, useTranslation } from 'react-i18next';
import { trackEvent } from '../analytics';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { useBackClose } from '../nav/NavContext';
import { useToast } from './Toast';

const DISMISS_KEY = 'outreports:install-dismissed';

/** <b>…</b> in install.* strings renders as <strong>. */
const BOLD = { b: <strong /> };

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
  const { t } = useTranslation();

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
      toast('success', t('install.installed'));
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
      aria-label={t('install.sheetLabel')}
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
        {t('install.title')}
      </Typography>
      <Typography sx={{ color: 'text.secondary', mt: 0.5, mb: 1.5 }}>
        {t('install.body')}
      </Typography>

        {platform === 'ios' && (
          <ol className="install-steps">
            <li>
              <ShareIcon />
              <span><Trans i18nKey="install.iosShare" components={BOLD} /></span>
            </li>
            <li>
              <PlusSquareIcon />
              <span><Trans i18nKey="install.iosAdd" components={BOLD} /></span>
            </li>
            <li>
              <span className="step-badge">{t('install.iosConfirmBadge')}</span>
              <span><Trans i18nKey="install.iosConfirm" components={BOLD} /></span>
            </li>
          </ol>
        )}

        {/* Shown even when the native prompt is available: people dismiss or miss that prompt. */}
        {platform !== 'ios' && (
          <ol className="install-steps">
            <li>
              <MenuIcon />
              <span><Trans i18nKey="install.menuOpen" components={BOLD} /></span>
            </li>
            <li>
              <PlusSquareIcon />
              <span><Trans i18nKey="install.menuAdd" components={BOLD} /></span>
            </li>
            <li>
              <span className="step-badge">{t('install.menuConfirmBadge')}</span>
              <span>{t('install.menuConfirm')}</span>
            </li>
          </ol>
        )}

      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
        <Button color="inherit" variant="outlined" size="large" onClick={dismiss} sx={{ flex: '0 0 auto' }}>
          {t('install.notNow')}
        </Button>
        {platform !== 'ios' && canPrompt ? (
          <Button variant="contained" color="success" size="large" onClick={() => void install()} sx={{ flex: 1 }}>
            {t('install.installApp')}
          </Button>
        ) : (
          <Button variant="contained" color="success" size="large" onClick={dismiss} sx={{ flex: 1 }}>
            {t('install.gotIt')}
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
