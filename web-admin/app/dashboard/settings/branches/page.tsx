/**
 * Branch Settings Page
 *
 * Dedicated page for branch-level configuration:
 * - Branch selector
 * - Per-branch Finance & Pricing mode overrides (tax_pricing_mode, extra_price_pricing_mode)
 * - Full catalog of branch-scoped configurable settings
 *
 * Route: /dashboard/settings/branches
 */

import { BranchSettingsScreen } from '@features/settings/ui/branch-settings-screen';
import type { Metadata } from 'next';

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Branch Settings' };

/**
 *
 */
export default function BranchSettingsPage() {
  return <BranchSettingsScreen />;
}
