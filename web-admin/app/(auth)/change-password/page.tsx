import { ForcedPasswordChangeScreen } from '@features/auth-session/ui/forced-password-change-screen'

/**
 * Forced password change — reachable only while the account carries an administrator-set temporary password
 * (the proxy redirects everything else here, and sends everyone else away from here).
 */
export default function ChangePasswordPage() {
  return <ForcedPasswordChangeScreen />
}
