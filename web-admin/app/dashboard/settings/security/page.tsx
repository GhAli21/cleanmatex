/**
 * Security & Sessions settings route shell (User Session Lifecycle, Phase 1).
 *
 * Server-rendered so the page contract's `auth_config:read` requirement is enforced before the client
 * screen loads any data. Editing is additionally gated by `auth_config:update` + plan flag
 * session_timeout_control (screen + API).
 */
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { AUTH_CONFIG_PERMISSIONS } from '@/lib/constants/permissions/auth-config-perm';
import { SecuritySettingsScreen } from '@features/auth-session/ui/security-settings-screen';
import type { Metadata } from 'next';

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Security & Sessions' };

/** Enforces the route contract before rendering the security settings. */
export default async function SecuritySettingsRoutePage() {
  const tCommon = await getTranslations('common');

  await getAuthContext();
  const canView = await hasPermissionServer(AUTH_CONFIG_PERMISSIONS.READ);

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    );
  }

  return <SecuritySettingsScreen />;
}
