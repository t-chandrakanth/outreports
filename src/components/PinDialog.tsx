import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';

interface Props {
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  error?: string;
  onConfirm: (pin: string) => void;
  onCancel: () => void;
}

const PIN_KEY = 'outreports:pin';

export function rememberedPin(): string {
  try {
    return sessionStorage.getItem(PIN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function rememberPin(pin: string): void {
  try {
    sessionStorage.setItem(PIN_KEY, pin);
  } catch {
    /* private mode */
  }
}

export function forgetPin(): void {
  try {
    sessionStorage.removeItem(PIN_KEY);
  } catch {
    /* ignore */
  }
}

export function PinDialog({ title, message, confirmLabel, busy, error, onConfirm, onCancel }: Props) {
  const [pin, setPin] = useState(rememberedPin());
  const dialogRef = useRef<HTMLFormElement>(null);

  // Modal behavior: restore focus to the opener on close, close on Escape,
  // and keep Tab cycling inside the dialog.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => opener?.focus?.();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    if (e.key === 'Escape' && !busy) {
      e.preventDefault();
      onCancel();
      return;
    }
    if (e.key !== 'Tab') return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
      'input, button:not([disabled])',
    );
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pin.trim()) onConfirm(pin.trim());
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <form className="dialog" onSubmit={submit} onKeyDown={onKeyDown} ref={dialogRef}>
        <h2>{title}</h2>
        <p>{message}</p>
        <input
          className="field-input"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          aria-invalid={!!error}
          autoFocus
        />
        {error && <div className="field-error" role="alert">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-danger" disabled={busy || !pin.trim()}>
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
