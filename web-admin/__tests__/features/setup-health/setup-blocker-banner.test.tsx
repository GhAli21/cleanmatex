import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

/**
 * Setup blocker banner: renders only for failing banner blockers (the summary
 * already filters them), never offers dismiss, and links to the screen only
 * for users who may open it.
 */

let mockSummary: unknown = undefined;

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));
jest.mock('@lib/context/tenant-currency-context', () => ({ useTenantCurrency: () => ({}) }));
jest.mock('@features/setup-health/hooks/use-setup-health', () => ({
  useSetupHealthSummary: () => ({ data: mockSummary }),
}));

import { SetupBlockerBanner } from '@features/setup-health/ui/setup-blocker-banner';

const blocker = { checkCode: 'TAX_SETUP_NOT_CONFIRMED', name: 'Tax setup is not confirmed', name2: 'ع', showsBanner: true, severity: 'BLOCKER', status: 'FAIL' };
const summary = (over: Record<string, unknown>) => ({ blockers: 1, warnings: 0, infos: 0, errors: 0, bannerItems: [blocker], canView: true, ...over });

describe('SetupBlockerBanner', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('renders nothing while loading or when no banner blocker fails', () => {
    mockSummary = undefined;
    const { container, rerender } = render(<SetupBlockerBanner />);
    expect(container).toBeEmptyDOMElement();
    mockSummary = summary({ bannerItems: [], warnings: 3 });
    rerender(<SetupBlockerBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the failing blocker with no dismiss button and a link for viewers', () => {
    mockSummary = summary({});
    render(<SetupBlockerBanner />);
    expect(screen.getByText('Tax setup is not confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'setupHealth.banner.viewAll' })).toHaveAttribute('href', '/dashboard/setup-health');
  });

  it('hides the link for users without setup_health:view', () => {
    mockSummary = summary({ canView: false });
    render(<SetupBlockerBanner />);
    expect(screen.getByText('Tax setup is not confirmed')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('collapses only for the current browser session without dismissing the blocker', () => {
    mockSummary = summary({});
    const { unmount } = render(<SetupBlockerBanner />);
    const toggle = screen.getByRole('button', { name: 'setupHealth.banner.title' });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Tax setup is not confirmed')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('cmx.setup-health.banner.collapsed')).toBe('true');

    unmount();
    render(<SetupBlockerBanner />);
    expect(screen.getByRole('button', { name: 'setupHealth.banner.title' })).toHaveAttribute('aria-expanded', 'false');
  });
});
