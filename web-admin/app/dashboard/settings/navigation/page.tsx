import { NavigationManagement } from '@features/settings/ui/NavigationManagement'
import type { Metadata } from 'next'

/** Keeps browser history identifiable without coupling it to the brand suffix. */
export const metadata: Metadata = { title: 'Navigation Settings' }

/**
 *
 */
export default function NavigationSettingsPage() {
  return <NavigationManagement />
}
