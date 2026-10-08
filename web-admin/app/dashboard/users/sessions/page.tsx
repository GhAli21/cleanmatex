/**
 * Active sessions route shell (User Session Lifecycle, Phase 4).
 *
 * Server-rendered so the page contract's `user_sessions:read` requirement is enforced before the client
 * screen loads any data. Sign-out actions are additionally gated by `user_sessions:revoke` (screen + API).
 */
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { USER_SESSIONS_PERMISSIONS } from '@/lib/constants/permissions/user-sessions-perm';
import { TenantSessionsScreen } from '@features/auth-session/ui/tenant-sessions-screen';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Active sessions' };

/** Enforces the route contract before rendering the tenant sessions list. */
export default async function TenantSessionsRoutePage() {
  const tCommon = await getTranslations('common');

  await getAuthContext();
  const canView = await hasPermissionServer(USER_SESSIONS_PERMISSIONS.READ);

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    );
  }

  return <TenantSessionsScreen />;
}
