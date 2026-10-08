/**
 * Account security route shell (User Session Lifecycle, Phase 4).
 *
 * Self-service for every signed-in user (no RBAC permission): change password and manage own devices.
 * The session is validated before rendering; the APIs resolve identity from the session only.
 */
import { getAuthContext } from '@/lib/auth/server-auth';
import { AccountSecurityScreen } from '@features/auth-session/ui/account-security-screen';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Account security' };

/** Renders the account security screen for the signed-in user. */
export default async function AccountSecurityRoutePage() {
  await getAuthContext();
  return <AccountSecurityScreen />;
}
