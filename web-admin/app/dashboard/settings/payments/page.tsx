/**
 * Payment settings route shell.
 *
 * The route stays server-rendered so the page contract's `payment_config:view`
 * requirement is enforced before the client admin tabs begin loading data.
 */
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { PaymentSettingsPage } from '@features/payment-config/ui/payment-settings-page';
import type { Metadata } from 'next';

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Payment Settings' };

/** Enforces the route contract before rendering the payment administration surface. */
export default async function PaymentSettingsRoutePage() {
  const tCommon = await getTranslations('common');

  await getAuthContext();
  const canView = await hasPermissionServer('payment_config:view');

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    );
  }

  return <PaymentSettingsPage />;
}
