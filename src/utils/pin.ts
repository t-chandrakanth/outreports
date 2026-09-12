/** Session-scoped memory of the delete PIN (cleared when the tab closes). */

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
