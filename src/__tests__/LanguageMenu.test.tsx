// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('../analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../nav/NavContext', () => ({ useBackClose: vi.fn() }));

import { LanguageMenu } from '../components/LanguageMenu';
import { LANGUAGES, setLanguage } from '../i18n';

beforeEach(async () => {
  await setLanguage('en');
});
afterEach(cleanup);

describe('LanguageMenu', () => {
  it('lists every language in its own script and marks the current one', () => {
    render(<LanguageMenu />);
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }));
    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(LANGUAGES.map((l) => l.name));
    const current = items.find((i) => i.getAttribute('aria-current') === 'true');
    expect(current?.getAttribute('lang')).toBe('en');
  });
});
