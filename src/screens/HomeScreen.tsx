import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import { useTranslation } from 'react-i18next';
import { LOCATIONS, type Location } from '../config';
import { useNav } from '../nav/NavContext';
import { SyncBadge } from '../components/SyncBadge';
import { Screen } from './Screen';

interface Props {
  showInstallHint: boolean;
  onInstall: () => void;
}

/** Codes longer than this get a full-width card so the label never wraps. */
const WIDE_CODE_LENGTH = 8;

export function HomeScreen({ showInstallHint, onInstall }: Props) {
  const nav = useNav();
  const { t } = useTranslation();

  /** Sheet name under the code; omitted when it would only repeat the code. */
  function caption(loc: Location): string | null {
    if (loc.directions.length > 1) return t('home.directions', { count: loc.directions.length });
    return loc.directions[0] === loc.code ? null : loc.directions[0];
  }

  function pick(loc: Location) {
    if (loc.directions.length === 1) nav.push({ name: 'sheet', sheet: loc.directions[0] });
    else nav.push({ name: 'direction', location: loc });
  }

  return (
    <Screen logo title="SCR Out Reports" subtitle={t('app.subtitle')} actions={<SyncBadge />}>
      <Typography variant="subtitle2" component="p" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {t('home.selectLocation')}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
        {LOCATIONS.map((loc) => (
          <ButtonBase
            key={loc.code}
            onClick={() => pick(loc)}
            focusRipple
            sx={{
              borderRadius: 2,
              textAlign: 'left',
              display: 'block',
              // Long corridor codes (e.g. VKB-BIDR-PRLI-LTRR) do not fit a half-width card on a phone.
              gridColumn: loc.code.length > WIDE_CODE_LENGTH ? '1 / -1' : 'auto',
            }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2,
                borderLeft: '4px solid',
                borderLeftColor: 'primary.main',
                minHeight: 84,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <Typography variant="h6" component="span" sx={{ lineHeight: 1.2 }}>
                {loc.code}
              </Typography>
              {caption(loc) && (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {caption(loc)}
                </Typography>
              )}
            </Paper>
          </ButtonBase>
        ))}
      </Box>
      {showInstallHint && (
        <Button fullWidth startIcon={<InstallMobileIcon />} onClick={onInstall} sx={{ mt: 3 }}>
          {t('home.install')}
        </Button>
      )}
    </Screen>
  );
}
