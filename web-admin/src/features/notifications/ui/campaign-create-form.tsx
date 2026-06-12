'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms'

// ─────────────────────────────────────────────────────────────────────────────
// Validation schema
// ─────────────────────────────────────────────────────────────────────────────

const CHANNELS = ['IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const

const schema = z.object({
  name:           z.string().min(1, 'Required').max(500),
  name2:          z.string().max(500).optional(),
  description:    z.string().optional(),
  channel_code:   z.enum(CHANNELS),
  target_user_ids: z.string().min(1, 'At least one user ID is required'),
  scheduled_at:   z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onSuccess: () => void
  onCancel:  () => void
}

export function CampaignCreateForm({ onSuccess, onCancel }: Props) {
  const t = useTranslations('notifications')
  const [serverError, setServerError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { channel_code: 'IN_APP' },
  })

  const channelCode = watch('channel_code')

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    setIsSubmitting(true)

    // Parse the user IDs textarea (one per line or comma-separated)
    const rawIds = values.target_user_ids
    const userIds = rawIds
      .split(/[\n,]+/)
      .map(s => s.trim())
      .filter(Boolean)

    try {
      const res = await fetch('/api/v1/notifications/campaigns', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           values.name,
          name2:          values.name2 || undefined,
          description:    values.description || undefined,
          channel_code:   values.channel_code,
          target_segment: { user_ids: userIds },
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
        <CmxSummaryMessage type="error" title={serverError} onDismiss={() => setServerError(null)} />
      )}

      {/* Name EN */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          {t('campaigns.form.name')}
        </label>
        <input
          {...register('name')}
          className="w-full rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb))]"
          placeholder={t('campaigns.form.namePlaceholder')}
        />
        {errors.name && (
          <p className="text-xs text-red-600">{errors.name.message}</p>
        )}
      </div>

      {/* Name AR */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          {t('campaigns.form.nameAr')}
          <span className="ms-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">({t('campaigns.form.optional')})</span>
        </label>
        <input
          {...register('name2')}
          dir="rtl"
          className="w-full rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb))]"
          placeholder={t('campaigns.form.nameArPlaceholder')}
        />
      </div>

      {/* Channel */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          {t('campaigns.form.channel')}
        </label>
        <CmxSelectDropdown
          value={channelCode}
          onValueChange={v => setValue('channel_code', v as typeof channelCode)}
        >
          <CmxSelectDropdownTrigger className="w-full" />
          <CmxSelectDropdownContent>
            {CHANNELS.map(ch => (
              <CmxSelectDropdownItem key={ch} value={ch}>
                {ch}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>
        {errors.channel_code && (
          <p className="text-xs text-red-600">{errors.channel_code.message}</p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          {t('campaigns.form.description')}
          <span className="ms-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">({t('campaigns.form.optional')})</span>
        </label>
        <textarea
          {...register('description')}
          rows={2}
          className="w-full rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb))]"
          placeholder={t('campaigns.form.descriptionPlaceholder')}
        />
      </div>

      {/* Target user IDs */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          {t('campaigns.form.targetUserIds')}
        </label>
        <textarea
          {...register('target_user_ids')}
          rows={4}
          className="w-full rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-background px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb))]"
          placeholder={t('campaigns.form.targetUserIdsPlaceholder')}
        />
        <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {t('campaigns.form.targetUserIdsHint')}
        </p>
        {errors.target_user_ids && (
          <p className="text-xs text-red-600">{errors.target_user_ids.message}</p>
        )}
      </div>

      {/* Scheduled at (optional) */}
      <div className="space-y-1">
        <label className="block text-sm font-medium">
          {t('campaigns.form.scheduledAt')}
          <span className="ms-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">({t('campaigns.form.optional')})</span>
        </label>
        <input
          {...register('scheduled_at')}
          type="datetime-local"
          className="w-full rounded-md border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb))]"
        />
        <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
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
