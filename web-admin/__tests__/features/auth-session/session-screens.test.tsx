import '@testing-library/jest-dom';
import * as React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Behavior of the self-service session/password UI: the current device cannot be signed out, revoking
 * asks for confirmation, and the change-password form blocks bad input before calling the API.
 */

const mockPermissions = new Set<string>();
const mockRevoke = jest.fn();
const mockChangePassword = jest.fn();
const mockSignOut = jest.fn();
const mockSendLink = jest.fn();
const mockPolicy = {
  current: { requireCurrent: true, freshSigninMin: 15, historyCount: 5, breachCheck: true, canEmailLink: true, maskedEmail: 'm***@example.com', mustChange: false },
};
const mockMessage = { error: jest.fn(), success: jest.fn(), warning: jest.fn(), info: jest.fn() };

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (ns: string) => {
    const t = (key: string) => `${ns}.${key}`;
    t.has = () => false;
    return t;
  },
}));
// The primitives barrel pulls in the tenant-currency context (and with it the Supabase browser client).
jest.mock('@lib/context/tenant-currency-context', () => ({ useTenantCurrency: () => ({}) }));
// ChangePasswordCard signs the user out through the auth context (pulls the Supabase browser client otherwise).
jest.mock('@/lib/auth/auth-context', () => ({ useAuth: () => ({ signOut: (...a: unknown[]) => mockSignOut(...a) }) }));
jest.mock('@/lib/hooks/use-has-permission', () => ({ useHasPermission: (r: string, a: string) => mockPermissions.has(`${r}:${a}`) }));
jest.mock('@ui/feedback', () => ({
  // Lazy wrappers: the factory runs at import time, before the const below is initialized.
  cmxMessage: {
    error: (...a: unknown[]) => mockMessage.error(...a),
    success: (...a: unknown[]) => mockMessage.success(...a),
    warning: (...a: unknown[]) => mockMessage.warning(...a),
    info: (...a: unknown[]) => mockMessage.info(...a),
  },
  // Minimal stand-in: renders a confirm button only while open.
  CmxConfirmDialog: ({ open, onConfirm, onCancel, title }: { open: boolean; onConfirm: () => void; onCancel: () => void; title: string }) =>
    open ? (
      <div role="dialog">
        <span>{title}</span>
        <button onClick={() => void onConfirm()}>confirm</button>
        <button onClick={onCancel}>cancel</button>
      </div>
    ) : null,
}));
jest.mock('@features/auth-session/api/sessions-api', () => {
  const actual = jest.requireActual('@features/auth-session/api/sessions-api');
  return {
    ...actual,
    fetchMySessions: jest.fn().mockResolvedValue([
      { id: 'current', status: 'ACTIVE', deviceLabel: 'Chrome on Windows', isCurrent: true, isRememberMe: false, loginIp: '1.1.1.1', lastIp: '1.1.1.1', createdAt: '2026-10-08T10:00:00Z', lastActivityAt: '2026-10-08T10:30:00Z', expiresAt: '2026-10-09T00:00:00Z', endReasonCode: null, endedAt: null },
      { id: 'other', status: 'ACTIVE', deviceLabel: 'Safari on iPhone', isCurrent: false, isRememberMe: true, loginIp: '2.2.2.2', lastIp: '2.2.2.2', createdAt: '2026-10-07T10:00:00Z', lastActivityAt: '2026-10-08T09:00:00Z', expiresAt: '2026-10-09T00:00:00Z', endReasonCode: null, endedAt: null },
    ]),
    revokeMySession: (...a: unknown[]) => mockRevoke(...a),
    revokeMyOtherSessions: jest.fn(),
  };
});
jest.mock('@features/auth-session/api/password-api', () => {
  const actual = jest.requireActual('@features/auth-session/api/password-api');
  return {
    ...actual,
    changePassword: (...a: unknown[]) => mockChangePassword(...a),
    fetchPasswordPolicy: async () => mockPolicy.current,
    sendMyPasswordLink: (...a: unknown[]) => mockSendLink(...a),
  };
});

import { MySessionsCard } from '@features/auth-session/ui/my-sessions-card';
import { ChangePasswordCard } from '@features/auth-session/ui/change-password-card';
import { PasswordApiError } from '@features/auth-session/api/password-api';

function mount(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockPermissions.clear();
  mockPolicy.current = { requireCurrent: true, freshSigninMin: 15, historyCount: 5, breachCheck: true, canEmailLink: true, maskedEmail: 'm***@example.com', mustChange: false };
});

describe('MySessionsCard', () => {
  it('lists devices, badges the current one and offers sign-out only for the others', async () => {
    mount(<MySessionsCard />);
    expect(await screen.findByText('Chrome on Windows')).toBeInTheDocument();
    expect(screen.getByText('authSession.sessions.thisDevice')).toBeInTheDocument();
    // one per-device button for "other" + the bulk "sign out others" button
    expect(screen.getAllByRole('button', { name: /signOut/ })).toHaveLength(2);
  });

  it('asks for confirmation before revoking and revokes the registry row id', async () => {
    mockRevoke.mockResolvedValue(undefined);
    mount(<MySessionsCard />);
    await screen.findByText('Safari on iPhone');
    fireEvent.click(screen.getByRole('button', { name: 'authSession.sessions.signOutDevice' }));
    expect(mockRevoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('confirm'));
    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith('other'));
    await waitFor(() => expect(mockMessage.success).toHaveBeenCalled());
  });
});

describe('ChangePasswordCard', () => {
  const fill = (current: string, next: string, confirm: string) => {
    fireEvent.change(document.getElementById('change-password-current') as HTMLInputElement, { target: { value: current } });
    fireEvent.change(document.getElementById('change-password-new') as HTMLInputElement, { target: { value: next } });
    fireEvent.change(document.getElementById('change-password-confirm') as HTMLInputElement, { target: { value: confirm } });
    fireEvent.click(screen.getByRole('button', { name: 'authSession.password.submitChange' }));
  };

  it('does not call the API for a missing current password, a weak password or a mismatch', async () => {
    mount(<ChangePasswordCard />);
    fill('', 'Str0ngPassw', 'Str0ngPassw');
    fill('Old1password', 'weak', 'weak');
    fill('Old1password', 'Str0ngPassw', 'Different1x');
    await waitFor(() => expect(screen.getByText('authSession.password.errors.mismatch')).toBeInTheDocument());
    expect(mockChangePassword).not.toHaveBeenCalled();
  });

  it('shows a wrong current password inline (not as a toast)', async () => {
    mockChangePassword.mockRejectedValue(new PasswordApiError('bad', 'WRONG_PASSWORD', 400));
    mount(<ChangePasswordCard />);
    fill('Wrong1password', 'Str0ngPassw', 'Str0ngPassw');
    expect(await screen.findByText('authSession.password.errors.wrongPassword')).toBeInTheDocument();
    expect(mockMessage.error).not.toHaveBeenCalled();
  });

  it('on success clears the form and asks whether to sign out now or later', async () => {
    mockChangePassword.mockResolvedValue(2);
    mount(<ChangePasswordCard />);
    fill('Old1password', 'Str0ngPassw', 'Str0ngPassw');
    expect(await screen.findByText('authSession.password.changedDialog.title')).toBeInTheDocument();
    expect((document.getElementById('change-password-current') as HTMLInputElement).value).toBe('');
    expect(mockChangePassword.mock.calls[0][0]).toEqual({ currentPassword: 'Old1password', newPassword: 'Str0ngPassw' });
  });

  it('"Later" keeps the session; "Sign out now" signs out', async () => {
    mockChangePassword.mockResolvedValue(0);
    mount(<ChangePasswordCard />);
    fill('Old1password', 'Str0ngPassw', 'Str0ngPassw');
    fireEvent.click(await screen.findByRole('button', { name: 'authSession.password.changedDialog.later' }));
    expect(mockSignOut).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('authSession.password.changedDialog.title')).not.toBeInTheDocument());

    fill('Old1password', 'Str0ngPassw', 'Str0ngPassw');
    fireEvent.click(await screen.findByRole('button', { name: 'authSession.password.changedDialog.signOutNow' }));
    expect(mockSignOut).toHaveBeenCalledWith('user');
  });

  it('shows only the two new-password fields when the policy does not require the current password', async () => {
    mockPolicy.current = { ...mockPolicy.current, requireCurrent: false };
    mockChangePassword.mockResolvedValue(1);
    mount(<ChangePasswordCard />);
    await waitFor(() => expect(document.getElementById('change-password-current')).toBeNull());

    fireEvent.change(document.getElementById('change-password-new') as HTMLInputElement, { target: { value: 'Str0ngPassw' } });
    fireEvent.change(document.getElementById('change-password-confirm') as HTMLInputElement, { target: { value: 'Str0ngPassw' } });
    fireEvent.click(screen.getByRole('button', { name: 'authSession.password.submitChange' }));
    await waitFor(() => expect(mockChangePassword).toHaveBeenCalled());
    expect(mockChangePassword.mock.calls[0][0]).toEqual({ currentPassword: undefined, newPassword: 'Str0ngPassw' });
  });

  it('offers the emailed link / sign-in again when the sign-in is too old for the two-field form', async () => {
    mockPolicy.current = { ...mockPolicy.current, requireCurrent: false };
    mockChangePassword.mockRejectedValue(new PasswordApiError('old', 'REAUTH_REQUIRED', 403));
    mount(<ChangePasswordCard />);
    await waitFor(() => expect(document.getElementById('change-password-current')).toBeNull());
    fireEvent.change(document.getElementById('change-password-new') as HTMLInputElement, { target: { value: 'Str0ngPassw' } });
    fireEvent.change(document.getElementById('change-password-confirm') as HTMLInputElement, { target: { value: 'Str0ngPassw' } });
    fireEvent.click(screen.getByRole('button', { name: 'authSession.password.submitChange' }));

    expect(await screen.findByText('authSession.password.errors.reauth')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'authSession.password.reauthSignIn' }));
    expect(mockSignOut).toHaveBeenCalledWith('user');
  });

  it('sends the emailed link and confirms with the masked address; hides the option without a real email', async () => {
    mockSendLink.mockResolvedValue(undefined);
    const first = mount(<ChangePasswordCard />);
    const button = await screen.findByRole('button', { name: 'authSession.password.link.send' });
    fireEvent.click(button);
    await waitFor(() => expect(mockMessage.success).toHaveBeenCalledWith('authSession.password.link.sent'));
    first.unmount();

    mockPolicy.current = { ...mockPolicy.current, canEmailLink: false, maskedEmail: null };
    mount(<ChangePasswordCard />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'authSession.password.submitChange' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'authSession.password.link.send' })).not.toBeInTheDocument();
  });
});
