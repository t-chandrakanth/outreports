import { useState } from 'react';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { EntryForm } from '../components/EntryForm';
import type { CardEntry } from '../components/RecordCard';
import { SavedList } from '../components/SavedList';
import { SwipeablePanels } from '../components/SwipeablePanels';
import { SyncBadge } from '../components/SyncBadge';
import { useNav } from '../nav/NavContext';
import { Screen } from './Screen';

export function SheetScreen({ sheet }: { sheet: string }) {
  const nav = useNav();
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
        borderBottom: '2px solid rgba(255,255,255,0.85)',
        '& .MuiTabs-indicator': { backgroundColor: '#fff', height: 3 },
      }}
    >
      <Tab id="tab-entry" aria-controls="panel-entry" label="New entry" sx={{ fontWeight: 600 }} />
      <Tab id="tab-saved" aria-controls="panel-saved" label="Saved" sx={{ fontWeight: 600 }} />
    </Tabs>
  );

  return (
    <Screen title={sheet} subtitle="OUTREPORT" actions={<SyncBadge />} bar={tabs} scroll={false}>
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
