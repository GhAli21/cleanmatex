/**
 * Cash-control settings route shell (POS Session & Cash Drawer Hardening, W0-5).
 *
 * The route stays server-rendered so the page contract's `cash_control:view`
 * requirement is enforced before the client form begins loading data.
 */
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { CashControlSettingsScreen } from '@features/cash-drawers/ui/cash-control-settings-screen';

/**
 *
 */
export default async function CashControlSettingsRoutePage() {
  const tCommon = await getTranslations('common');

  await getAuthContext();
  const canView = await hasPermissionServer('cash_control:view');

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    );
  }

  return <CashControlSettingsScreen />;
}
