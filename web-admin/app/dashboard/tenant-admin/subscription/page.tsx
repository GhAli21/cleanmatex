import type { Metadata } from 'next'
import { TenantAdminSubscriptionScreen } from '@features/tenant-admin/ui/subscription/tenant-admin-subscription-screen'

/** Uses the billing-specific label rather than the broad tenant administration area. */
export const metadata: Metadata = { title: 'Subscription & Billing' }

/**
 * Tenant Admin — Subscription & Billing page.
 */
export default function TenantAdminSubscriptionPage() {
  return <TenantAdminSubscriptionScreen />
}
