import { createTheme } from '@mui/material/styles';

/**
 * SCR OUTREPORTS Material theme.
 * Palette carries the railway-signal semantics of the original design:
 * navy station name-board, signal green for save/deliver, amber for
 * pending, red for errors. System font stack — no webfont download, the
 * app must render identically offline.
 */
export const SYSTEM_FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, sans-serif';

export const theme = createTheme({
  palette: {
    primary: { main: '#002f5f', dark: '#00234a', light: '#0b5fa5' },
    secondary: { main: '#0b5fa5' },
    success: { main: '#0e7a3d', dark: '#0a5f2f', contrastText: '#ffffff' },
    warning: { main: '#9a6a00' },
    error: { main: '#b3261e' },
    background: { default: '#f2f4f7', paper: '#ffffff' },
    text: { primary: '#16202b', secondary: '#4a5867' },
    divider: '#d5dce4',
  },
  typography: {
    fontFamily: SYSTEM_FONT,
    button: { textTransform: 'none', fontWeight: 600 },
    h6: { fontWeight: 700, letterSpacing: '0.02em' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        sizeLarge: { minHeight: 52, fontSize: '1.05rem' },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', fullWidth: true, size: 'medium' },
    },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid #d5dce4' },
      },
    },
  },
});
