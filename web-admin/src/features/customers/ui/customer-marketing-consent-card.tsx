'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxCheckbox, CmxSkeleton } from '@ui/primitives'
import { CmxCard, CmxCardHeader, CmxCardContent } from '@ui/primitives/cmx-card'
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback'
import { useHasPermission } from '@lib/hooks/usePermissions'
import type { MarketingConsentChannel } from '@/lib/constants/notification-campaigns'
import { useCustomerMarketingConsent } from '../hooks/use-customer-marketing-consent'
import type { CustomerMarketingConsent } from '../api/customer-marketing-consent-api'

interface CustomerMarketingConsentCardProps {
  tenantId: string
  customerId: string
}

/**
 * Whether the customer agreed to receive campaigns on each channel. Editing needs customers:update.
 * @param props - Organization and customer being viewed
 * @returns The consent editor, a loading placeholder, or an error with retry
 */
export function CustomerMarketingConsentCard({ tenantId, customerId }: CustomerMarketingConsentCardProps) {
  const t = useTranslations('customers.marketingConsent')
  const tc = useTranslations('common')
  const canEdit = useHasPermission('customers', 'update')
  const { query, mutation } = useCustomerMarketingConsent(tenantId, customerId)
  if (query.isPending) return <CmxSkeleton className="h-40 rounded-lg" />
  if (query.isError || !query.data) return <div className="space-y-3">
    <CmxSummaryMessage type="error" title={t('loadFailed')} items={[]} />
    <CmxButton type="button" variant="outline" onClick={() => void query.refetch()}>{tc('retry')}</CmxButton>
  </div>
  return <CustomerMarketingConsentEditor
    key={query.data.channels.map((c) => `${c.channel}:${c.agreed}`).join('|')}
    consent={query.data}
    canEdit={canEdit}
    pending={mutation.isPending}
    onSave={async (changes) => {
      try {
        await mutation.mutateAsync(changes)
        cmxMessage.success(t('saved'))
      } catch { cmxMessage.error(t('saveFailed')) }
    }}
  />
}

/** Auth-free props so stories and tests can show every state. */
export interface CustomerMarketingConsentEditorProps {
  consent: CustomerMarketingConsent
  canEdit: boolean
  pending: boolean
  onSave: (changes: { channel: MarketingConsentChannel; agreed: boolean }[]) => Promise<void>
}

/**
 * One checkbox per channel and an explicit Save that sends only the changed channels.
 * @param props - Saved consent, edit permission, busy state and save callback
 * @returns The localized editor
 */
export function CustomerMarketingConsentEditor({ consent, canEdit, pending, onSave }: CustomerMarketingConsentEditorProps) {
  const t = useTranslations('customers.marketingConsent')
  const tc = useTranslations('common')
  const saved = Object.fromEntries(consent.channels.map((c) => [c.channel, c.agreed])) as Record<MarketingConsentChannel, boolean>
  const [draft, setDraft] = useState(saved)
  const changes = consent.channels.filter((c) => draft[c.channel] !== c.agreed).map((c) => ({ channel: c.channel, agreed: draft[c.channel] }))
  const hasAddress = (channel: MarketingConsentChannel) => channel === 'EMAIL' ? consent.hasEmail : consent.hasPhone

  return <CmxCard>
    <CmxCardHeader><h2 className="text-base font-semibold">{t('title')}</h2></CmxCardHeader>
    <CmxCardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('description')}</p>
      <div className="space-y-3">
        {consent.channels.map((c) => (
          <div key={c.channel} className="space-y-1">
            <CmxCheckbox
              checked={draft[c.channel]}
              label={t(`channels.${c.channel}`)}
              disabled={!canEdit || pending}
              onChange={(event) => setDraft((d) => ({ ...d, [c.channel]: event.target.checked }))}
            />
            {draft[c.channel] && !hasAddress(c.channel) && (
              <p className="ps-7 text-xs text-warning-text">{t(c.channel === 'EMAIL' ? 'noEmail' : 'noPhone')}</p>
            )}
          </div>
        ))}
      </div>
      <CmxSummaryMessage type="info" title={t('whatsappSeparate')} items={[]} />
      {!canEdit && <CmxSummaryMessage type="info" title={t('readOnly')} items={[]} />}
      {canEdit && <div className="flex flex-wrap gap-3">
        <CmxButton type="button" loading={pending} disabled={changes.length === 0} onClick={() => void onSave(changes)}>{tc('save')}</CmxButton>
        <CmxButton type="button" variant="outline" disabled={pending || changes.length === 0} onClick={() => setDraft(saved)}>{tc('cancel')}</CmxButton>
      </div>}
    </CmxCardContent>
  </CmxCard>
}
