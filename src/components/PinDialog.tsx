import { useEffect, useState, type FormEvent } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import { useTranslation } from 'react-i18next';
import { useBackClose } from '../nav/NavContext';
import { rememberedPin } from '../utils/pin';

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  error?: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}

export function PinDialog({ open, title, message, confirmLabel, busy, error, onConfirm, onCancel }: Props) {
  const [pin, setPin] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    if (open) setPin(rememberedPin());
  }, [open]);

  // Hardware back closes the dialog instead of leaving the screen.
  useBackClose(open, onCancel);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pin.trim() && !busy) onConfirm(pin.trim());
  }

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      aria-labelledby="pin-dialog-title"
    >
      <form onSubmit={submit} noValidate>
        <DialogTitle id="pin-dialog-title">{title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>{message}</DialogContentText>
          <TextField
            autoFocus
            type="password"
            label={t('pin.label')}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            error={!!error}
            helperText={error || undefined}
            slotProps={{
              htmlInput: { inputMode: 'numeric', autoComplete: 'off' },
              formHelperText: error ? { role: 'alert' } : undefined,
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCancel} disabled={busy} color="inherit">
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="contained" color="error" disabled={busy || !pin.trim()}>
            {busy ? t('pin.deleting') : confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
