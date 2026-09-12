import { useEffect, useState } from 'react';
import { DirectionPicker } from './components/DirectionPicker';
import { LocationPicker } from './components/LocationPicker';
import { EntryForm, type EditTarget } from './components/EntryForm';
import { SavedList } from './components/SavedList';
import { SyncBadge } from './components/SyncBadge';
import { ToastProvider } from './components/Toast';
import type { CardEntry } from './components/RecordCard';
import type { Location } from './config';
import { flushOutbox } from './offline/outbox';

type Tab = 'entry' | 'saved';

export default function App() {
  const [location, setLocation] = useState<Location | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('entry');
  const [edit, setEdit] = useState<EditTarget | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Flush the offline outbox whenever connectivity returns.
  useEffect(() => {
    const flush = () => void flushOutbox();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
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
    setEdit({ id: entry.id, record: { ...entry.record }, queued: !!entry.queueStatus });
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
        {!location && !sheet && <LocationPicker onPick={pickLocation} />}
        {location && !sheet && (
          <DirectionPicker location={location} onPick={(s) => { setSheet(s); setTab('entry'); }} />
        )}
        {sheet && (
          <>
            <div className="tabs" role="tablist" aria-label="Outreport sections">
              <button
                className="tab"
                role="tab"
                aria-selected={tab === 'entry'}
                onClick={() => setTab('entry')}
              >
                {edit ? 'Edit entry' : 'New entry'}
              </button>
              <button
                className="tab"
                role="tab"
                aria-selected={tab === 'saved'}
                onClick={() => setTab('saved')}
              >
                Saved
              </button>
            </div>
            <div hidden={tab !== 'entry'}>
              <EntryForm sheet={sheet} edit={edit} onDone={entryDone} />
            </div>
            <div hidden={tab !== 'saved'}>
              <SavedList sheet={sheet} refreshToken={refreshToken} onEdit={startEdit} />
            </div>
          </>
        )}
      </main>
    </ToastProvider>
  );
}
