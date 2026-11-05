/**
 * Finance Settings Page
 *
 * Tax rates are tax profiles, edited in Tax Setup (`/dashboard/settings/tax`).
 * The single tax-rate setting this page used to edit (`TENANT_VAT_RATE`) was
 * retired in Line-Level P6-03, so the page points there instead.
 */

import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { CmxButton } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardFooter, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { SETTINGS_SETTINGS_FINANCE_ACCESS } from '@features/settings/access/settings-access'

/** Explains where tax rates moved and links to Tax Setup. */
export default async function FinanceSettingsPage() {
  const t = await getTranslations('settings.financeTaxMoved')
  const tTax = await getTranslations('taxSetup')

  return (
    <RequireAnyPermission permissions={SETTINGS_SETTINGS_FINANCE_ACCESS.page.permissions ?? []}>
      <div className="max-w-4xl">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{tTax('title')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <p className="text-sm text-muted-foreground">{t('description')}</p>
          </CmxCardContent>
          <CmxCardFooter>
            <CmxButton asChild>
              <Link href="/dashboard/settings/tax">{t('action')}</Link>
            </CmxButton>
          </CmxCardFooter>
        </CmxCard>
      </div>
    </RequireAnyPermission>
  )
}
