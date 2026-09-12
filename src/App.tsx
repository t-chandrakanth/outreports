import { useEffect, useState } from 'react';
import { DirectionPicker } from './components/DirectionPicker';
import { LocationPicker } from './components/LocationPicker';
import { EntryForm, type EditTarget } from './components/EntryForm';
import { InstallGuide, useAutoInstallGuide } from './components/InstallGuide';
import { SavedList } from './components/SavedList';
import { SyncBadge } from './components/SyncBadge';
import { ToastProvider } from './components/Toast';
import type { CardEntry } from './components/RecordCard';
import type { Location } from './config';
import { flushOutbox } from './offline/outbox';
import { useInstallPrompt } from './hooks/useInstallPrompt';
import { parseSheetDate } from './utils/date';

type Tab = 'entry' | 'saved';

export default function App() {
  const [location, setLocation] = useState<Location | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('entry');
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [installOpen, setInstallOpen] = useAutoInstallGuide();
  const { installed } = useInstallPrompt();

  // Flush the offline outbox whenever connectivity returns, plus a slow
  // periodic retry: 'online' does not fire when a flush failed while the
  // browser stayed nominally online (e.g. Apps Script hiccup).
  useEffect(() => {
    const flush = () => void flushOutbox();
    window.addEventListener('online', flush);
    const timer = setInterval(() => {
      if (navigator.onLine) flush();
    }, 60_000);
    return () => {
      window.removeEventListener('online', flush);
      clearInterval(timer);
    };
  }, []);

  function pickLocation(loc: Location) {
    setLocation(loc);
    if (loc.directions.length === 1) {
      setSheet(loc.directions[0]);
      setTab('entry');
    }
  }

  function goBack() {
    setEdit(null);
    if (sheet) {
      setSheet(null);
      // For single-direction stations there is no direction screen to return to.
      if (location && location.directions.length === 1) setLocation(null);
    } else {
      setLocation(null);
    }
  }

  function startEdit(entry: CardEntry) {
    const record = { ...entry.record };
    // Sheet DATE cells arrive as display text (d/m/yyyy, "dd-mm hh:mm"…);
    // <input type="date"> only accepts yyyy-mm-dd and silently renders
    // anything else as blank. Normalize so the edit form shows the date.
    const parsed = parseSheetDate(record['DATE'] ?? '');
    if (parsed) {
      const mm = String(parsed.getMonth() + 1).padStart(2, '0');
      const dd = String(parsed.getDate()).padStart(2, '0');
      record['DATE'] = `${parsed.getFullYear()}-${mm}-${dd}`;
    } else if (record['DATE']) {
      record['DATE'] = ''; // unparseable: force an explicit re-pick
    }
    setEdit({ id: entry.id, record, queued: !!entry.queueStatus });
    setTab('entry');
    window.scrollTo({ top: 0 });
  }

  function entryDone({ refresh }: { refresh: boolean }) {
    if (edit) {
      setEdit(null);
      setTab('saved');
    }
    if (refresh) setRefreshToken((t) => t + 1);
  }

  return (
    <ToastProvider>
      <header className="board">
        <div className="board-inner">
          {(location || sheet) && (
            <button className="board-back" onClick={goBack} aria-label="Back">
              ‹ Back
            </button>
          )}
          <div style={{ minWidth: 0, flex: 1, textAlign: 'center' }}>
            <h1 className="board-title">{sheet ?? "SCR TMR'S OUTREPORTS"}</h1>
            <p className="board-sub">{sheet ? 'OUTREPORT' : 'SOUTH CENTRAL RAILWAY'}</p>
          </div>
          <SyncBadge />
        </div>
      </header>

      <main className="container">
        {!location && !sheet && (
          <>
            <LocationPicker onPick={pickLocation} />
            {!installed && (
              <button
                type="button"
                className="install-hint"
                onClick={() => setInstallOpen(true)}
              >
                Install this app on your phone
              </button>
            )}
          </>
        )}
        {location && !sheet && (
          <DirectionPicker location={location} onPick={(s) => { setSheet(s); setTab('entry'); }} />
        )}
        {sheet && (
          <>
            <div className="tabs" role="tablist" aria-label="Outreport sections">
              <button
                id="tab-entry"
                className="tab"
                role="tab"
                aria-selected={tab === 'entry'}
                aria-controls="panel-entry"
                onClick={() => setTab('entry')}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') setTab('saved');
                }}
              >
                {edit ? 'Edit entry' : 'New entry'}
              </button>
              <button
                id="tab-saved"
                className="tab"
                role="tab"
                aria-selected={tab === 'saved'}
                aria-controls="panel-saved"
                onClick={() => setTab('saved')}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') setTab('entry');
                }}
              >
                Saved
              </button>
            </div>
            <div id="panel-entry" role="tabpanel" aria-labelledby="tab-entry" hidden={tab !== 'entry'}>
              {/* The create form stays mounted while an edit is open so an
                  in-progress draft is not destroyed by tapping Edit. */}
              <div hidden={edit !== null}>
                <EntryForm sheet={sheet} edit={null} onDone={entryDone} />
              </div>
              {edit && <EntryForm sheet={sheet} edit={edit} onDone={entryDone} />}
            </div>
            <div id="panel-saved" role="tabpanel" aria-labelledby="tab-saved" hidden={tab !== 'saved'}>
              <SavedList sheet={sheet} refreshToken={refreshToken} onEdit={startEdit} />
            </div>
          </>
        )}
      </main>

      <InstallGuide open={installOpen} onClose={() => setInstallOpen(false)} />
    </ToastProvider>
  );
}
