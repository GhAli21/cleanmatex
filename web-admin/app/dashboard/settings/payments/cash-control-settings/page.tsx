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
import { CashDenominationControlCard } from '@features/cash-drawers/ui/cash-denomination-control-card';
import type { Metadata } from 'next';

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Cash Control Settings' };

/** Enforces the route contract before rendering cash-control configuration. */
export default async function CashControlSettingsRoutePage() {
  const tCommon = await getTranslations('common');

  await getAuthContext();
  const canView = await hasPermissionServer('cash_control:view');

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-sm text-danger-text">
          {tCommon('error')}
        </div>
      </div>
    );
  }

  return (
    <>
      <CashControlSettingsScreen />
      <CashDenominationControlCard />
    </>
  );
}
