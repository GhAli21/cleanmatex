'use client'

/**
 * Add New User Page
 *
 * Full-page Create User screen matching platform-web design.
 * Route: /dashboard/users/new
 */

import { withAdminRole } from '@/lib/auth/with-role'
import CreateUserScreen from '@features/users/ui/create-user-screen'

function CreateUserPage() {
  return <CreateUserScreen />
}

export default withAdminRole(CreateUserPage)
