import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_CAMPAIGNS_ACCESS } from '@features/marketing/access/marketing-access'
import { CampaignListPage } from '@features/notifications/ui/campaign-list-page'
import type { Metadata } from 'next'

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Campaigns' }

/** Renders the campaign list after its route-level permission gate. */
export default function CampaignsPage() {
  return (
    <RequireAnyPermission permissions={MARKETING_MARKETING_CAMPAIGNS_ACCESS.page.permissions ?? []}>
      <CampaignListPage />
    </RequireAnyPermission>
  )
}
