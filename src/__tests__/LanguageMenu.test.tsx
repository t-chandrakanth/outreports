// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../nav/NavContext', () => ({ useBackClose: vi.fn() }));

import { trackEvent } from '../analytics';
import { LanguageMenu } from '../components/LanguageMenu';
import { LANGUAGES, setLanguage } from '../i18n';

beforeEach(async () => {
  await setLanguage('en');
  vi.mocked(trackEvent).mockReset();
});
afterEach(cleanup);

describe('LanguageMenu', () => {
  it('shows a visible caption under the icon', () => {
    render(<LanguageMenu />);
    expect(screen.getByRole('button', { name: 'Change language' }).textContent).toBe('Language');
  });

  it('lists every language in its own script and marks the current one', () => {
    render(<LanguageMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(LANGUAGES.map((l) => l.name));
    const current = items.find((i) => i.getAttribute('aria-current') === 'true');
    expect(current?.getAttribute('lang')).toBe('en');
  });

  it('switches language from the menu and re-renders in that language', async () => {
    render(<LanguageMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'తెలుగు' }));
    });
    expect(await screen.findByRole('button', { name: 'భాష మార్చు' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('te');
    expect(trackEvent).toHaveBeenCalledWith('language_changed', { from: 'en', to: 'te' });
  });

  it('does nothing when the current language is chosen again', async () => {
    render(<LanguageMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'English' }));
    });
    expect(trackEvent).not.toHaveBeenCalled();
  });
});
