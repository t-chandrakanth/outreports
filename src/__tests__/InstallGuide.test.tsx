// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('../analytics', () => ({ trackEvent: vi.fn() }));
vi.mock('../nav/NavContext', () => ({ useBackClose: vi.fn() }));
vi.mock('../components/Toast', () => ({ useToast: () => vi.fn() }));
vi.mock('../hooks/useInstallPrompt', () => ({ useInstallPrompt: vi.fn() }));

import { InstallGuide } from '../components/InstallGuide';
import { useInstallPrompt, type InstallPlatform } from '../hooks/useInstallPrompt';
import { setLanguage } from '../i18n';

function mockPrompt(platform: InstallPlatform, canPrompt: boolean) {
  vi.mocked(useInstallPrompt).mockReturnValue({
    platform,
    canPrompt,
    installed: false,
    promptInstall: vi.fn(async () => 'dismissed' as const),
  });
}

beforeEach(async () => {
  await setLanguage('en');
});
afterEach(cleanup);

describe('InstallGuide', () => {
  it('shows the browser-menu steps alongside the native Install button on Android', () => {
    mockPrompt('android', true);
    render(<InstallGuide open onClose={() => {}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/Open the browser menu/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Install app' })).toBeTruthy();
  });

  it('shows the browser-menu steps when no native prompt is available', () => {
    mockPrompt('android', false);
    render(<InstallGuide open onClose={() => {}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Got it' })).toBeTruthy();
  });

  it('shows the Safari Share steps on iOS', () => {
    mockPrompt('ios', false);
    render(<InstallGuide open onClose={() => {}} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText(/Scroll down and tap/)).toBeTruthy();
    expect(screen.queryByText(/Open the browser menu/)).toBeNull();
  });
});
