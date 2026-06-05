/**
 * Tenant Settings Page
 *
 * Dedicated page for tenant-level configuration:
 * - Finance & Pricing modes (tax_pricing_mode, extra_price_pricing_mode)
 * - Full catalog of tenant-scoped configurable settings
 *
 * Route: /dashboard/settings/tenant
 */

import { TenantSettingsScreen } from '@features/settings/ui/tenant-settings-screen';

export default function TenantSettingsPage() {
  return <TenantSettingsScreen />;
}
