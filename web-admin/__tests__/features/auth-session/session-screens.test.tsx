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
  return { ...actual, changePassword: (...a: unknown[]) => mockChangePassword(...a) };
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

  it('confirms success and clears the form', async () => {
    mockChangePassword.mockResolvedValue(2);
    mount(<ChangePasswordCard />);
    fill('Old1password', 'Str0ngPassw', 'Str0ngPassw');
    await waitFor(() => expect(mockMessage.success).toHaveBeenCalled());
    expect((document.getElementById('change-password-current') as HTMLInputElement).value).toBe('');
  });
});
