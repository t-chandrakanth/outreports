import { createTheme, type Shadows } from '@mui/material/styles';

/**
 * SCR OUTREPORTS Material theme, dressed in Chakra UI's default tokens with
 * Teal as the brand colour. MUI stays the component library; only colours,
 * radii and shadows follow Chakra.
 *
 * Semantic colours use Chakra's 600 shades rather than 500: white button text
 * on green/red/orange 500 fails WCAG AA (3.3–4.2:1); the 600 shades pass.
 *
 * `cssVariables: true` makes MUI emit --mui-palette-* on :root, which
 * global.css and nav.css read — this file is the only colour definition.
 */
export const chakra = {
  teal: { 50: '#E6FFFA', 400: '#38B2AC', 500: '#319795', 600: '#2C7A7B', 700: '#285E61' },
  gray: { 50: '#F7FAFC', 200: '#E2E8F0', 300: '#CBD5E0', 600: '#4A5568', 800: '#1A202C' },
  green: { 600: '#2F855A', 700: '#276749' },
  orange: { 300: '#F6AD55', 600: '#C05621' },
  red: { 300: '#FC8181', 600: '#C53030' },
} as const;

/**
 * Apple devices resolve -apple-system first and render San Francisco.
 * Everything else gets self-hosted Inter (src/fonts, precached offline).
 * Telugu and Devanagari are not in Inter and fall through to the device's
 * script fonts.
 */
export const APP_FONT =
  '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", Roboto, "Noto Sans Telugu", "Noto Sans Devanagari", "Noto Sans", system-ui, sans-serif';

const chakraShadow = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
};

/** MUI elevation 0–24 mapped onto Chakra's shadow scale. */
const shadows = [
  'none',
  chakraShadow.sm,
  chakraShadow.base,
  ...Array(2).fill(chakraShadow.md),
  ...Array(4).fill(chakraShadow.lg),
  ...Array(8).fill(chakraShadow.xl),
  ...Array(8).fill(chakraShadow['2xl']),
] as Shadows;

export const theme = createTheme({
  cssVariables: true,
  palette: {
    primary: { main: chakra.teal[600], dark: chakra.teal[700], light: chakra.teal[500] },
    secondary: { main: chakra.teal[400] },
    success: { main: chakra.green[600], dark: chakra.green[700], contrastText: '#ffffff' },
    warning: { main: chakra.orange[600], light: chakra.orange[300] },
    error: { main: chakra.red[600], light: chakra.red[300] },
    background: { default: '#F2F7F8', paper: '#ffffff' },
    text: { primary: chakra.gray[800], secondary: chakra.gray[600] },
    divider: chakra.gray[200],
  },
  typography: {
    fontFamily: APP_FONT,
    button: { textTransform: 'none', fontWeight: 600 },
    h6: { fontWeight: 700 },
  },
  shape: { borderRadius: 14 },
  shadows,
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 14, fontWeight: 700, letterSpacing: '0.01em', transition: 'transform 120ms, box-shadow 160ms, filter 160ms', '&:active': { transform: 'scale(0.97)' } },
        sizeLarge: { minHeight: 54, fontSize: '1.05rem' },
        containedPrimary: { backgroundImage: 'linear-gradient(135deg, #2C7A7B, #1F6F8B)', boxShadow: '0 10px 20px -10px rgba(31,111,139,.9)' },
        containedSuccess: { backgroundImage: 'linear-gradient(135deg, #2F9E6B, #1F7A52)', boxShadow: '0 12px 22px -10px rgba(31,122,82,.9)' },
        outlinedInherit: { borderColor: chakra.gray[300], backgroundColor: '#fff' },
      },
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', fullWidth: true, size: 'medium' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: '#fff',
          transition: 'box-shadow 160ms',
          '&.Mui-focused': { boxShadow: '0 0 0 4px rgba(44,122,123,.18)' },
          '&.Mui-readOnly': { backgroundColor: '#EEF4F5' },
        },
        notchedOutline: { borderColor: chakra.gray[300], borderWidth: 1.5 },
      },
    },
    MuiChip: { styleOverrides: { root: { fontWeight: 700 } } },
    MuiAppBar: { defaultProps: { elevation: 0 } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid #DDE8EA', borderRadius: 18, boxShadow: '0 1px 2px rgba(16,42,48,.05), 0 10px 24px -14px rgba(16,42,48,.28)' },
      },
    },
  },
});
