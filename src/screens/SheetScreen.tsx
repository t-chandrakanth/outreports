import { useState } from 'react';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { useTranslation } from 'react-i18next';
import { EntryForm } from '../components/EntryForm';
import type { CardEntry } from '../components/RecordCard';
import { SavedList } from '../components/SavedList';
import { SwipeablePanels } from '../components/SwipeablePanels';
import { SyncBadge } from '../components/SyncBadge';
import { useNav } from '../nav/NavContext';
import { sheetTitle } from '../utils/sheetTitle';
import { Screen } from './Screen';

export function SheetScreen({ sheet }: { sheet: string }) {
  const nav = useNav();
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);
  const [refreshToken, setRefreshToken] = useState(0);

  function startEdit(entry: CardEntry) {
    // DATE is a read-only stamp: shown exactly as stored and written back unchanged.
    const record = { ...entry.record };
    nav.push({
      name: 'edit',
      sheet,
      target: { id: entry.id, record, queued: !!entry.queueStatus },
      onDone: ({ refresh }) => {
        setTab(1);
        if (refresh) setRefreshToken((t) => t + 1);
      },
    });
  }

  const tabs = (
    <Tabs
      value={tab}
      onChange={(_, v: number) => setTab(v)}
      variant="fullWidth"
      textColor="inherit"
      sx={{
        color: '#fff',
        mx: 1.5,
        mb: 1.75,
        mt: 0.25,
        minHeight: 44,
        p: '4px',
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.14)',
        border: '1px solid rgba(255,255,255,0.2)',
        '& .MuiTabs-indicator': { height: '100%', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 6px 16px -6px rgba(0,0,0,.4)', zIndex: 0 },
        '& .MuiTab-root': { minHeight: 36, borderRadius: '12px', zIndex: 1, color: 'rgba(255,255,255,.95)', fontWeight: 700, transition: 'color 160ms' },
        '& .MuiTab-root.Mui-selected': { color: '#14595F' },
      }}
    >
      <Tab id="tab-entry" aria-controls="panel-entry" label={t('sheet.tabEntry')} sx={{ fontWeight: 600 }} />
      <Tab id="tab-saved" aria-controls="panel-saved" label={t('sheet.tabSaved')} sx={{ fontWeight: 600 }} />
    </Tabs>
  );

  return (
    <Screen title={sheetTitle(t, sheet)} subtitle={t('sheet.subtitle')} actions={<SyncBadge />} bar={tabs} scroll={false}>
      <SwipeablePanels
        index={tab}
        onChange={setTab}
        getPanelProps={(i) =>
          i === 0
            ? { id: 'panel-entry', 'aria-labelledby': 'tab-entry' }
            : { id: 'panel-saved', 'aria-labelledby': 'tab-saved' }
        }
      >
        <EntryForm
          sheet={sheet}
          edit={null}
          onDone={({ refresh }) => {
            if (refresh) setRefreshToken((t) => t + 1);
          }}
        />
        <SavedList sheet={sheet} refreshToken={refreshToken} onEdit={startEdit} />
      </SwipeablePanels>
    </Screen>
  );
}
