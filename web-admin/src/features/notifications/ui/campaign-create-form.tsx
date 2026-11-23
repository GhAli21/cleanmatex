'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CmxButton, CmxInput, CmxTextarea, Label } from '@ui/primitives'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'
import { CmxRadioGroup, CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms'
import {
  CAMPAIGN_AUDIENCE,
  CAMPAIGN_CHANNELS_BY_AUDIENCE,
  CAMPAIGN_CUSTOMER_CHANNELS_LIVE,
  type CampaignAudience,
} from '@/lib/constants/notification-campaigns'
import { CampaignCustomerPicker, type CampaignCustomer } from './campaign-customer-picker'

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────────────────────

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const

/** Channels offered per audience. Customer WhatsApp waits for template choice (STEP5_PLAN 4c). */
const FORM_CHANNELS: Record<CampaignAudience, readonly (typeof CHANNELS)[number][]> = {
  STAFF: CAMPAIGN_CHANNELS_BY_AUDIENCE.STAFF,
  CUSTOMERS: CAMPAIGN_CUSTOMER_CHANNELS_LIVE,
}

const schema = z.object({
  name:            z.string().min(1, 'Required').max(500),
  name2:           z.string().max(500).optional(),
  description:     z.string().optional(),
  channel_code:    z.enum(CHANNELS),
  target_user_ids: z.string().optional(),
  scheduled_at:    z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onSuccess: () => void
  onCancel:  () => void
}

/**
 *
 * @param root0
 * @param root0.onSuccess
 * @param root0.onCancel
 */
export function CampaignCreateForm({ onSuccess, onCancel }: Props) {
  const t = useTranslations('notifications')
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [audience, setAudience] = useState<CampaignAudience>(CAMPAIGN_AUDIENCE.STAFF)
  const [allConsented, setAllConsented] = useState(true)
  const [customers, setCustomers] = useState<CampaignCustomer[]>([])
  const [recipientsError, setRecipientsError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { channel_code: 'IN_APP' },
  })

  const channelCode = useWatch({ control, name: 'channel_code' }) ?? 'IN_APP'

  const changeAudience = (next: CampaignAudience) => {
    setAudience(next)
    setRecipientsError(null)
    // Keep the channel only when the new audience allows it.
    if (!FORM_CHANNELS[next].includes(channelCode)) setValue('channel_code', FORM_CHANNELS[next][0])
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    setRecipientsError(null)

    let targetSegment: Record<string, unknown>
    if (audience === CAMPAIGN_AUDIENCE.STAFF) {
      // The user IDs textarea: one per line or comma-separated.
      const userIds = (values.target_user_ids ?? '')
        .split(/[\n,]+/)
        .map(s => s.trim())
        .filter(Boolean)
      if (userIds.length === 0) { setRecipientsError(t('campaigns.form.targetUserIdsRequired')); return }
      targetSegment = { user_ids: userIds }
    } else if (allConsented) {
      targetSegment = { all_consented: true }
    } else {
      if (customers.length === 0) { setRecipientsError(t('campaigns.form.customersRequired')); return }
      targetSegment = { customer_ids: customers.map(c => c.id) }
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/v1/notifications/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           values.name,
          name2:          values.name2 || undefined,
          description:    values.description || undefined,
          audience_code:  audience,
          channel_code:   values.channel_code,
          target_segment: targetSegment,
          scheduled_at:   values.scheduled_at || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed to create campaign')

      onSuccess()
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
      {serverError && (
        <CmxSummaryMessage type="error" title={serverError} items={[]} onDismiss={() => setServerError(null)} />
      )}

      {/* Name EN */}
      <div className="space-y-1">
        <Label className="block">
          {t('campaigns.form.name')}
        </Label>
        <CmxInput
          {...register('name')}
          placeholder={t('campaigns.form.namePlaceholder')}
          error={errors.name?.message}
        />
      </div>

      {/* Name AR */}
      <div className="space-y-1">
        <Label className="block">
          {t('campaigns.form.nameAr')}
          <span className="ms-1 text-xs text-muted-foreground">({t('campaigns.form.optional')})</span>
        </Label>
        <CmxInput
          {...register('name2')}
          dir="rtl"
          placeholder={t('campaigns.form.nameArPlaceholder')}
        />
      </div>

      {/* Audience */}
      <CmxRadioGroup
        label={t('campaigns.form.audience')}
        value={audience}
        onChange={v => changeAudience(v as CampaignAudience)}
        columns={2}
        options={[
          { value: CAMPAIGN_AUDIENCE.STAFF, label: t('campaigns.form.audienceStaff'), description: t('campaigns.form.audienceStaffHint') },
          { value: CAMPAIGN_AUDIENCE.CUSTOMERS, label: t('campaigns.form.audienceCustomers'), description: t('campaigns.form.audienceCustomersHint') },
        ]}
      />

      {/* Channel */}
      <div className="space-y-1">
        <Label className="block">
          {t('campaigns.form.channel')}
        </Label>
        <CmxSelectDropdown
          value={channelCode}
          onValueChange={v => setValue('channel_code', v as typeof channelCode)}
        >
          <CmxSelectDropdownTrigger className="w-full">{channelCode}</CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {FORM_CHANNELS[audience].map(ch => (
              <CmxSelectDropdownItem key={ch} value={ch}>
                {ch}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>
        {errors.channel_code && (
          <p className="text-xs text-danger-text">{errors.channel_code.message}</p>
        )}
        {audience === CAMPAIGN_AUDIENCE.CUSTOMERS && (
          <p className="text-xs text-muted-foreground">{t('campaigns.form.whatsappLater')}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label className="block">
          {t('campaigns.form.description')}
          <span className="ms-1 text-xs text-muted-foreground">({t('campaigns.form.optional')})</span>
        </Label>
        <CmxTextarea
          {...register('description')}
          rows={2}
          placeholder={t('campaigns.form.descriptionPlaceholder')}
        />
      </div>

      {/* Recipients */}
      {audience === CAMPAIGN_AUDIENCE.STAFF ? (
        <div className="space-y-1">
          <Label className="block">
            {t('campaigns.form.targetUserIds')}
          </Label>
          <CmxTextarea
            {...register('target_user_ids')}
            rows={4}
            className="font-mono text-xs"
            placeholder={t('campaigns.form.targetUserIdsPlaceholder')}
            aria-invalid={Boolean(recipientsError)}
          />
          {recipientsError && (
            <p className="text-xs text-danger-text" role="alert">{recipientsError}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t('campaigns.form.targetUserIdsHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <CmxRadioGroup
            label={t('campaigns.form.customerRecipients')}
            value={allConsented ? 'ALL' : 'CHOSEN'}
            onChange={v => { setAllConsented(v === 'ALL'); setRecipientsError(null) }}
            options={[
              { value: 'ALL', label: t('campaigns.form.allConsented'), description: t('campaigns.form.allConsentedHint') },
              { value: 'CHOSEN', label: t('campaigns.form.chosenCustomers'), description: t('campaigns.form.chosenCustomersHint') },
            ]}
          />
          {!allConsented && (
            <CampaignCustomerPicker
              value={customers}
              onChange={next => { setCustomers(next); setRecipientsError(null) }}
              error={recipientsError ?? undefined}
            />
          )}
        </div>
      )}

      {/* Scheduled at (optional) */}
      <div className="space-y-1">
        <Label className="block">
          {t('campaigns.form.scheduledAt')}
          <span className="ms-1 text-xs text-muted-foreground">({t('campaigns.form.optional')})</span>
        </Label>
        <CmxInput
          {...register('scheduled_at')}
          type="datetime-local"
        />
        <p className="text-xs text-muted-foreground">
          {t('campaigns.form.scheduledAtHint')}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <CmxButton type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          {t('campaigns.form.cancel')}
        </CmxButton>
        <CmxButton type="submit" disabled={isSubmitting}>
          {isSubmitting ? t('campaigns.form.saving') : t('campaigns.form.saveDraft')}
        </CmxButton>
      </div>
    </form>
  )
}
