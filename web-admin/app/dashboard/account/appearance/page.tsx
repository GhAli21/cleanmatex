/**
 * Account appearance route shell (UI Design System PR-07).
 *
 * Self-service for every signed-in user (no RBAC permission): density and text size,
 * saved on the person's own user record. The session is validated before rendering.
 */
import { getAuthContext } from '@/lib/auth/server-auth';
import { AccountAppearanceScreen } from '@features/auth-session/ui/account-appearance-screen';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Appearance' };

/** Renders the appearance screen for the signed-in user. */
export default async function AccountAppearanceRoutePage() {
  await getAuthContext();
  return <AccountAppearanceScreen />;
}
