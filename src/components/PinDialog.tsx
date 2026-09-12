import { useState, type FormEvent } from 'react';

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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (pin.trim()) onConfirm(pin.trim());
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <form className="dialog" onSubmit={submit}>
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
        {error && <div className="field-error">{error}</div>}
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
