/**
 * User Preferences Settings Page
 * Route: /dashboard/settings/preferences
 */

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { UserPreferencesScreen } from '@features/settings/ui/user-preferences-screen'

/** Localized browser title for User Preferences. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings.advancedSettings')
  return { title: t('preferencesTitle') }
}

/** Thin Server Component shell for user preferences. */
export default function UserPreferencesPage() {
  return <UserPreferencesScreen />
}
