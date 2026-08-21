import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { WORKBOARD_ACCESS } from '@features/workboard/access/workboard-access'
import { WorkboardScreen } from '@features/workboard/ui/workboard-screen'

/** Renders the supervisor Workboard behind its dedicated read permission. */
export default function WorkboardPage() {
  return <RequireAnyPermission permissions={WORKBOARD_ACCESS.page.permissions ?? []}><WorkboardScreen /></RequireAnyPermission>
}
