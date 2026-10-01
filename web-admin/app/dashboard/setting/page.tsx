import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

/** Identifies the legacy redirect briefly before navigation reaches the canonical settings route. */
export const metadata: Metadata = { title: 'Settings' }

/**
 * Keeps legacy singular settings links working after the navigation parent rename.
 */
export default function SettingsSingularRedirectPage() {
  redirect('/dashboard/settings')
}
