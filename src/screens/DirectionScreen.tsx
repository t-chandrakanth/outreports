import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useTranslation } from 'react-i18next';
import type { Location } from '../config';
import { useNav } from '../nav/NavContext';
import { directionLabel } from '../utils/sheetTitle';
import { Screen } from './Screen';

export function DirectionScreen({ location }: { location: Location }) {
  const nav = useNav();
  const { t } = useTranslation();
  return (
    <Screen title={location.code} subtitle={t('direction.subtitle')}>
      <Typography variant="subtitle2" component="p" sx={{ color: 'text.secondary', mb: 1.5 }}>
        {t('direction.prompt')}
      </Typography>
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <List disablePadding>
          {location.directions.map(({ label, sheet }, i) => (
            <ListItemButton
              key={sheet}
              divider={i < location.directions.length - 1}
              sx={{ py: 2 }}
              onClick={() => nav.push({ name: 'sheet', sheet })}
            >
              <ListItemText primary={directionLabel(t, label)} slotProps={{ primary: { fontWeight: 600 } }} />
              <ChevronRightIcon sx={{ color: 'text.secondary' }} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </Screen>
  );
}
