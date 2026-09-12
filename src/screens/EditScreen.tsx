import { useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { EntryForm, type EditTarget } from '../components/EntryForm';
import { useBackClose, useBackGuard, useNav } from '../nav/NavContext';
import { Screen } from './Screen';

interface Props {
  sheet: string;
  target: EditTarget;
  onDone: (r: { refresh: boolean }) => void;
}

export function EditScreen({ sheet, target, onDone }: Props) {
  const nav = useNav();
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Hardware back / edge swipe with unsaved changes: ask before discarding.
  useBackGuard(dirty, () => setConfirmOpen(true));
  useBackClose(confirmOpen, () => setConfirmOpen(false));

  function finish(r: { refresh: boolean }) {
    onDone(r);
    nav.pop();
  }

  return (
    <Screen title="Edit outreport" subtitle={sheet} scroll={false}>
      <EntryForm
        sheet={sheet}
        edit={target}
        onDone={finish}
        onCancel={() => nav.pop()}
        onDirtyChange={setDirty}
      />
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Discard changes?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This outreport has unsaved changes. Going back will lose them.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} autoFocus>
            Keep editing
          </Button>
          <Button
            color="error"
            onClick={() => {
              // One traversal for both entries (the confirm dialog's and the
              // screen's) — two queued history.go calls can race in Safari.
              nav.pop(2);
            }}
          >
            Discard
          </Button>
        </DialogActions>
      </Dialog>
    </Screen>
  );
}
