import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { MARKETING_MARKETING_CAMPAIGNS_ACCESS } from '@features/marketing/access/marketing-access'
import { CampaignListPage } from '@features/notifications/ui/campaign-list-page'

/**
 *
 */
export default function CampaignsPage() {
  return (
    <RequireAnyPermission permissions={MARKETING_MARKETING_CAMPAIGNS_ACCESS.page.permissions ?? []}>
      <CampaignListPage />
    </RequireAnyPermission>
  )
}
