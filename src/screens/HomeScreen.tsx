import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import { LOCATIONS, type Location } from '../config';
import { useNav } from '../nav/NavContext';
import { directionLabel } from '../utils/sheetTitle';
import { SyncBadge } from '../components/SyncBadge';
import { Screen } from './Screen';

interface Props {
  showInstallHint: boolean;
  onInstall: () => void;
}

/** Codes longer than this get a full-width card so the label never wraps. */
const WIDE_CODE_LENGTH = 8;

/** Accent gradient per tile (decorative only). */
const HUES: [string, string][] = [
  ['#1B7F86', '#2563EB'], ['#7C3AED', '#DB2777'], ['#EA580C', '#DC2626'], ['#059669', '#0D9488'], ['#2563EB', '#7C3AED'],
  ['#D97706', '#EA580C'], ['#0891B2', '#2563EB'], ['#DB2777', '#9333EA'], ['#16A34A', '#0891B2'], ['#4F46E5', '#0EA5E9'],
];

export function HomeScreen({ showInstallHint, onInstall }: Props) {
  const nav = useNav();
  const { t } = useTranslation();

  /** Direction label under the code; omitted when it would only repeat the code. */
  function caption(loc: Location): string | null {
    if (loc.directions.length > 1) return t('home.directions', { count: loc.directions.length });
    const only = loc.directions[0];
    return only.label === loc.code ? null : directionLabel(t, only.label);
  }

  function pick(loc: Location) {
    if (loc.directions.length === 1) nav.push({ name: 'sheet', sheet: loc.directions[0].sheet });
    else nav.push({ name: 'direction', location: loc });
  }

  return (
    <Screen logo title="SCR Out Reports" subtitle={t('app.subtitle')} actions={<SyncBadge />}>
      <Typography variant="overline" component="p" sx={{ color: 'text.secondary', fontWeight: 800, letterSpacing: '0.14em', mb: 1 }}>
        {t('home.selectLocation')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
        {LOCATIONS.map((loc, i) => {
          const [c1, c2] = HUES[i % HUES.length];
          return (
            <ButtonBase
              key={loc.code}
              onClick={() => pick(loc)}
              focusRipple
              sx={{
                borderRadius: '20px',
                textAlign: 'left',
                display: 'block',
                // Long codes (e.g. VNUP-PGDP-SNF) do not fit a half-width card on a phone.
                gridColumn: loc.code.length > WIDE_CODE_LENGTH ? '1 / -1' : 'auto',
                animation: 'tileIn 420ms both',
                animationDelay: `${Math.min(i, 10) * 40}ms`,
                transition: 'transform 140ms',
                '&:active': { transform: 'scale(0.97)' },
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  position: 'relative',
                  overflow: 'hidden',
                  p: 1.75,
                  borderRadius: '20px',
                  minHeight: 104,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 1.25,
                  boxShadow: '0 1px 2px rgba(16,42,48,.05), 0 12px 26px -16px rgba(16,42,48,.35)',
                  '&::after': {
                    content: '""', position: 'absolute', right: -28, bottom: -28, width: 100, height: 100, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${c1}, ${c2})`, opacity: 0.12,
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box
                    sx={{
                      width: 38, height: 38, borderRadius: '12px', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 15,
                      background: `linear-gradient(135deg, ${c1}, ${c2})`, boxShadow: `0 8px 16px -8px ${c1}`,
                    }}
                  >
                    {loc.code.slice(0, 2)}
                  </Box>
                  <ChevronRightIcon sx={{ color: 'text.disabled' }} />
                </Box>
                <Box>
                  <Typography variant="h6" component="span" sx={{ lineHeight: 1.15, fontWeight: 800, display: 'block' }}>
                    {loc.code}
                  </Typography>
                  {caption(loc) && (
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                      {caption(loc)}
                    </Typography>
                  )}
                </Box>
              </Paper>
            </ButtonBase>
          );
        })}
      </Box>
      {showInstallHint && (
        <Button fullWidth startIcon={<InstallMobileIcon />} onClick={onInstall} sx={{ mt: 3 }}>
          {t('home.install')}
        </Button>
      )}
    </Screen>
  );
}
