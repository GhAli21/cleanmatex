import type { Metadata } from 'next'
import { UserDetailScreen } from '@/src/features/users/ui/user-detail-screen'

/** Uses a stable label because the rendered user name is loaded by the client screen. */
export const metadata: Metadata = { title: 'User Details' }

/**
 *
 */
export default function Page() { return <UserDetailScreen /> }
