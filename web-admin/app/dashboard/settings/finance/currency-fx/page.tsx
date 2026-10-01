/**
 * Currencies & FX route shell (Tenant_Currency_FX plan 01, stage 5C).
 *
 * The route stays server-rendered so the page contract's `currencies:view`
 * requirement is enforced before the client tabs begin loading data.
 */
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { CurrencyFxScreen } from '@features/fx/ui/currency-fx-screen';
import type { Metadata } from 'next';

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Currencies & FX' };

export default async function CurrencyFxRoutePage() {
  const tCommon = await getTranslations('common');

  await getAuthContext();
  const canView = await hasPermissionServer('currencies:view');

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {tCommon('error')}
        </div>
      </div>
    );
  }

  return <CurrencyFxScreen />;
}
