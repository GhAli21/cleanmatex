import { redirect } from 'next/navigation'

/**
 * Keeps legacy singular settings links working after the navigation parent rename.
 */
export default function SettingsSingularRedirectPage() {
  redirect('/dashboard/settings')
}
