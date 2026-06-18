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

/**
 *
 */
export default function BranchSettingsPage() {
  return <BranchSettingsScreen />;
}
