/**
 * Catalog › Speed Pricing route shell. Server-rendered so the page contract's
 * `pricing:read` requirement is enforced before the client screen loads data.
 */
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { PRICING_PERMISSIONS } from '@/lib/constants/permissions/pricing-perm';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { SpeedPricingScreen } from '@features/catalog/ui/speed-pricing-screen';

/** Enforces the route contract before rendering the rules. */
export default async function SpeedPricingPage() {
  const t = await getTranslations('catalog.access');

  // Tenant resolved server-side from the authenticated session.
  await getAuthContext();
  const canView = await hasPermissionServer(PRICING_PERMISSIONS.READ);

  if (!canView) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-sm text-danger-text">{t('forbiddenTitle')}</div>
      </div>
    );
  }

  return <SpeedPricingScreen />;
}
