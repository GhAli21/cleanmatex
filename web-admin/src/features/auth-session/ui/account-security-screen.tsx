'use client'

/**
 * AccountSecurityScreen — "Account security" (/dashboard/account/security).
 *
 * Self-service for any signed-in user: change password and manage own signed-in devices.
 * Identity and tenant are resolved server-side; nothing here takes a user or tenant id.
 */

import { useTranslations } from 'next-intl'
import { ChangePasswordCard } from './change-password-card'
import { MySessionsCard } from './my-sessions-card'

/** Account security screen. */
export function AccountSecurityScreen() {
  const t = useTranslations('authSession.account')

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <MySessionsCard />
      <ChangePasswordCard />
    </div>
  )
}
