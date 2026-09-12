import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Location } from '../config';
import { useNav } from '../nav/NavContext';
import { Screen } from './Screen';

export function DirectionScreen({ location }: { location: Location }) {
  const nav = useNav();
  return (
    <Screen title={location.code} subtitle="SELECT DIRECTION">
      <Typography variant="subtitle2" component="p" sx={{ color: 'text.secondary', mb: 1.5 }}>
        Which outreport?
      </Typography>
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <List disablePadding>
          {location.directions.map((sheet, i) => (
            <ListItemButton
              key={sheet}
              divider={i < location.directions.length - 1}
              sx={{ py: 2 }}
              onClick={() => nav.push({ name: 'sheet', sheet })}
            >
              <ListItemText primary={sheet} slotProps={{ primary: { fontWeight: 600 } }} />
              <ChevronRightIcon sx={{ color: 'text.secondary' }} />
            </ListItemButton>
          ))}
        </List>
      </Paper>
    </Screen>
  );
}
