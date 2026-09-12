import { useContext, type ReactNode } from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ScreenEntryContext, useNav } from '../nav/NavContext';

interface Props {
  title: string;
  subtitle?: string;
  /** right side of the app bar */
  actions?: ReactNode;
  /** rendered inside the app bar, below the toolbar (e.g. Tabs) */
  bar?: ReactNode;
  /**
   * true (default): children go in a scrollable centered main column.
   * false: children own the remaining height (forms/lists with their own
   * scroll areas and footers).
   */
  scroll?: boolean;
  children: ReactNode;
}

/**
 * Mobile page scaffold: station name-board app bar (back arrow on every
 * pushed screen) over a flex column body.
 */
export function Screen({ title, subtitle, actions, bar, scroll = true, children }: Props) {
  const nav = useNav();
  const entry = useContext(ScreenEntryContext);
  const showBack = (entry?.index ?? 0) > 0;

  return (
    <>
      <AppBar position="static" sx={{ pt: 'env(safe-area-inset-top)', flex: 'none' }}>
        <Box
          sx={{
            maxWidth: 640,
            mx: 'auto',
            width: '100%',
            borderTop: '2px solid rgba(255,255,255,0.85)',
            borderBottom: bar ? 'none' : '2px solid rgba(255,255,255,0.85)',
          }}
        >
          <Toolbar sx={{ minHeight: 60, px: 1.5, gap: 0.5 }}>
            {showBack && (
              <IconButton edge="start" color="inherit" aria-label="Back" onClick={() => nav.back()}>
                <ArrowBackIcon />
              </IconButton>
            )}
            <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center', px: 0.5 }}>
              <Typography variant="h6" noWrap component="h1" sx={{ fontSize: '1.1rem', lineHeight: 1.25 }}>
                {title}
              </Typography>
              {subtitle && (
                <Typography
                  variant="caption"
                  noWrap
                  component="p"
                  sx={{ color: 'rgba(255,255,255,0.95)', letterSpacing: '0.14em', fontSize: '0.7rem' }}
                >
                  {subtitle}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: showBack ? 40 : 0, justifyContent: 'flex-end' }}>
              {actions}
            </Box>
          </Toolbar>
          {bar}
        </Box>
      </AppBar>
      {scroll ? (
        <Box component="main" sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehaviorY: 'contain' }}>
          <Box sx={{ maxWidth: 640, mx: 'auto', p: 2, pb: 'max(16px, env(safe-area-inset-bottom))' }}>{children}</Box>
        </Box>
      ) : (
        <Box component="main" sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {children}
        </Box>
      )}
    </>
  );
}
