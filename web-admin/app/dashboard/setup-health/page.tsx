import { SETUP_HEALTH_SETUP_HEALTH_ACCESS } from '@features/setup-health/access/setup-health-access'
import { SetupHealthPageGuard } from '@features/setup-health/ui/setup-health-page-guard'
import { SetupHealthScreen } from '@features/setup-health/ui/setup-health-screen'

/** /dashboard/setup-health — read-only Setup Health (gated by setup-health-access.ts). */
export default function SetupHealthPage() {
  return (
    <SetupHealthPageGuard permissions={SETUP_HEALTH_SETUP_HEALTH_ACCESS.page.permissions ?? []}>
      <SetupHealthScreen />
    </SetupHealthPageGuard>
  )
}
