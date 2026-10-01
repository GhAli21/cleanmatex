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
import type { Metadata } from 'next';

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Tenant Settings' };

/**
 *
 */
export default function TenantSettingsPage() {
  return <TenantSettingsScreen />;
}
