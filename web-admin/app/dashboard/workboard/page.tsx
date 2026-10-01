import type { Metadata } from 'next'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { WORKBOARD_ACCESS } from '@features/workboard/access/workboard-access'
import { WorkboardScreen } from '@features/workboard/ui/workboard-screen'

/** Keeps browser history and assistive technology labels aligned with this operational queue. */
export const metadata: Metadata = { title: 'Workboard' }

/** Renders the supervisor Workboard behind its dedicated read permission. */
export default function WorkboardPage() {
  return <RequireAnyPermission permissions={WORKBOARD_ACCESS.page.permissions ?? []}><WorkboardScreen /></RequireAnyPermission>
}
