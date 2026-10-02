'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxCheckbox, CmxSkeleton } from '@ui/primitives'
import { CmxCard, CmxCardHeader, CmxCardContent } from '@ui/primitives/cmx-card'
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback'
import { useHasPermission } from '@lib/hooks/usePermissions'
import { useCustomerNotificationConsent } from '../hooks/use-customer-notification-consent'
import type { CustomerNotificationConsent } from '../api/customer-notification-api'

/** Consent belongs alongside existing customer service preferences, independent of staff preferences. */
interface CustomerWhatsAppConsentCardProps {
  /** Expected authenticated organization; requests reject stale organization selection. */
  tenantId: string
  customerId: string
}

/**
 * Expose tenant-scoped customer consent with editing limited to customer-update permission.
 * @param props - Authenticated organization and the customer currently being inspected
 * @returns Consent editor, loading placeholder, or recoverable loading error
 */
export function CustomerWhatsAppConsentCard({ tenantId, customerId }: CustomerWhatsAppConsentCardProps) {
  const t = useTranslations('customers.whatsappConsent')
  const tc = useTranslations('common')
  const canEdit = useHasPermission('customers', 'update')
  const { query, mutation } = useCustomerNotificationConsent(tenantId, customerId)
  if (query.isPending) return <CmxSkeleton className="h-36 rounded-lg" />
  if (query.isError || !query.data) return <div className="space-y-3">
    <CmxSummaryMessage type="error" title={t('loadFailed')} items={[]} />
    <CmxButton type="button" variant="outline" onClick={() => void query.refetch()}>{tc('retry')}</CmxButton>
  </div>
  return <CustomerWhatsAppConsentEditor
    key={`${tenantId}:${customerId}:${query.data.updatedAt}:${query.data.optedIn}`}
    consent={query.data}
    canEdit={canEdit}
    pending={mutation.isPending}
    onSave={async (optedIn) => {
      try {
        await mutation.mutateAsync(optedIn)
        cmxMessage.success(t('saved'))
      } catch { cmxMessage.error(t('saveFailed')) }
    }}
  />
}

/** Auth-free props permit explicit state, permission, and RTL coverage in stories. */
export interface CustomerWhatsAppConsentEditorProps {
  consent: CustomerNotificationConsent
  canEdit: boolean
  pending: boolean
  onSave: (optedIn: boolean) => Promise<void>
}

/**
 * Require explicit Save to persist consent while allowing revocation without a valid phone.
 * @param props - Consent snapshot, edit permission, pending state, and explicit save callback
 * @returns Localized opt-in editor with phone validation and consent guidance
 */
export function CustomerWhatsAppConsentEditor({ consent, canEdit, pending, onSave }: CustomerWhatsAppConsentEditorProps) {
  const t = useTranslations('customers.whatsappConsent')
  const tc = useTranslations('common')
  const [optedIn, setOptedIn] = useState(consent.optedIn)
  const phoneValid = /^\+[1-9]\d{9,14}$/.test((consent.phone ?? '').replace(/[\s\-()]/g, ''))
  const enabling = optedIn && !consent.optedIn
  const disabled = !canEdit || pending

  return <CmxCard>
    <CmxCardHeader><h2 className="text-base font-semibold">{t('title')}</h2></CmxCardHeader>
    <CmxCardContent className="space-y-4">
      {/* Shared muted guidance follows the tenant UI theme without fixed text colors. */}
      <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('description')}</p>
      <CmxCheckbox
        checked={optedIn}
        label={t('optIn')}
        disabled={disabled || (!consent.optedIn && !phoneValid)}
        onChange={(event) => setOptedIn(event.target.checked)}
      />
      <p className="text-sm">{t('phone')}: <bdi dir="ltr">{consent.phone || t('noPhone')}</bdi></p>
      {!phoneValid && <CmxSummaryMessage type="warning" title={t('phoneRequired')} items={[]} />}
      {!canEdit && <CmxSummaryMessage type="info" title={t('readOnly')} items={[]} />}
      <CmxSummaryMessage type="info" title={t('consentHint')} items={[]} />
      {canEdit && <div className="flex flex-wrap gap-3">
        <CmxButton type="button" loading={pending} disabled={optedIn === consent.optedIn || (enabling && !phoneValid)} onClick={() => void onSave(optedIn)}>{tc('save')}</CmxButton>
        <CmxButton type="button" variant="outline" disabled={pending || optedIn === consent.optedIn} onClick={() => setOptedIn(consent.optedIn)}>{tc('cancel')}</CmxButton>
      </div>}
    </CmxCardContent>
  </CmxCard>
}
