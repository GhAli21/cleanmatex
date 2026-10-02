'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CmxButton, CmxInput, CmxSelect, CmxSkeleton } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card'
import { CmxForm, CmxFormField } from '@ui/forms'
import { cmxMessage, CmxSummaryMessage } from '@ui/feedback'
import { useNotificationProviders } from '../hooks/use-notification-providers'
import { templateBindings, templateFormValues, whatsappTemplateSchema, type NotificationProviderConfig, type WhatsAppTemplateFormValues } from '../model/whatsapp-template-settings'

/** Existing notification settings own this section; no new navigation or credentials surface. */
interface WhatsAppTemplateSettingsProps {
  /** Expected session organization; provider requests reject a changed tenant. */
  tenantId: string
  /** Refreshes the parent channel settings after provider activation changes. */
  onSaved: () => void
}

/**
 * Configure one organization's approved templates through tenant-scoped provider queries.
 * @param props - Authenticated organization identity and parent refresh callback
 * @returns Template settings, a loading placeholder, or recoverable configuration error
 */
export function WhatsAppTemplateSettings({ tenantId, onSaved }: WhatsAppTemplateSettingsProps) {
  const t = useTranslations('notifications.settings.templates')
  const tc = useTranslations('common')
  const { query, mutation } = useNotificationProviders(tenantId, true)
  const providers = query.data ?? []
  const provider = providers.find((row) => row.provider_code === 'TWILIO_WHATSAPP')
  const activeProvider = providers.find((row) => row.is_active)?.provider_code

  let events: string[] = []
  let invalidConfig = false
  try { events = Object.keys(templateBindings(provider?.config ?? null)) } catch { invalidConfig = true }

  if (query.isPending) return <CmxSkeleton className="h-48 w-full rounded-lg" />
  if (query.isError || invalidConfig) return (
    <div className="space-y-3">
      <CmxSummaryMessage type="error" title={t('loadFailed')} items={[]} />
      <CmxButton type="button" variant="outline" onClick={() => void query.refetch()}>{tc('retry')}</CmxButton>
    </div>
  )

  return (
    <CmxCard>
      <CmxCardHeader>
        <h2 className="text-sm font-semibold">{t('title')}</h2>
        {/* Use the shared muted token so setup guidance follows the selected theme. */}
        <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('description')}</p>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <CmxSummaryMessage type={provider?.is_active ? 'info' : 'warning'} title={provider?.is_active ? t('twilioActive') : activeProvider ? t('otherActive', { provider: activeProvider }) : t('noProvider')} items={[]} />
        <CmxSummaryMessage type="info" title={t('channelHint')} items={[]} />
        <WhatsAppTemplateEditor
          key={`${tenantId}:${provider?.updated_at ?? 'new'}`}
          provider={provider}
          events={events}
          pending={mutation.isPending}
          onSave={async (values) => {
            try {
              await mutation.mutateAsync(values)
              cmxMessage.success(t('saved'))
              onSaved()
            } catch { cmxMessage.error(t('saveFailed')) }
          }}
        />
      </CmxCardContent>
    </CmxCard>
  )
}

/** Presentational editor also allows isolated Storybook coverage without live provider access. */
export interface WhatsAppTemplateEditorProps {
  /** Existing Twilio settings; absence means a provider must be created on save. */
  provider?: NotificationProviderConfig
  events: string[]
  pending: boolean
  onSave: (values: WhatsAppTemplateFormValues | { event: string; remove: true }) => Promise<void>
}

/**
 * Require explicit submit so SID and variable drafts survive validation and save failures.
 * @param props - Provider snapshot, configured events, save state, and save callback
 * @returns Localized template form with explicit activation and event-removal controls
 */
export function WhatsAppTemplateEditor({ provider, events, pending, onSave }: WhatsAppTemplateEditorProps) {
  const t = useTranslations('notifications.settings.templates')
  const tc = useTranslations('common')
  const [selectedEvent, setSelectedEvent] = useState('order.created')
  const form = useForm<WhatsAppTemplateFormValues>({
    resolver: zodResolver(whatsappTemplateSchema({ event: t('invalidEvent'), sid: t('invalidSid'), slot: t('invalidSlot'), source: t('invalidSource'), duplicate: t('duplicateSlot') })),
    defaultValues: templateFormValues(selectedEvent, provider?.config ?? null),
  })
  const mappings = useFieldArray({ control: form.control, name: 'mappings' })

  const selectEvent = async (event: string) => {
    if (form.formState.isDirty && !await cmxMessage.confirm({ title: t('discardTitle'), description: t('discardDescription') })) return
    setSelectedEvent(event)
    form.reset(templateFormValues(event, provider?.config ?? null))
  }

  return (
    <div className="space-y-4">
      {events.length > 0 && <div className="flex flex-wrap gap-2" aria-label={t('configuredEvents')}>
        {events.map((event) => <CmxButton type="button" key={event} variant={selectedEvent === event ? 'secondary' : 'outline'} disabled={pending} onClick={() => void selectEvent(event)}>{event}</CmxButton>)}
      </div>}
      <CmxButton type="button" variant="outline" disabled={pending} onClick={() => void selectEvent('')}>{t('addTemplate')}</CmxButton>
      <CmxForm<WhatsAppTemplateFormValues> form={form} onSubmit={onSave} isPending={pending} isDirty={form.formState.isDirty} showErrorSummary errorSummaryTitle={t('validationSummary')}>
        <CmxFormField name="event" label={t('event')} description={t('eventHint')} required>
          {({ invalid, describedBy, ...field }) => <CmxInput {...field} disabled={pending} dir="ltr" aria-invalid={invalid} aria-describedby={describedBy} />}
        </CmxFormField>
        <CmxFormField name="contentSid" label={t('sid')} description={t('sidHint')} required>
          {({ invalid, describedBy, ...field }) => <CmxInput {...field} disabled={pending} dir="ltr" autoComplete="off" placeholder="HX…" aria-invalid={invalid} aria-describedby={describedBy} />}
        </CmxFormField>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t('variables')}</h3>
          {/* Shared muted guidance remains readable across Cmx themes. */}
          <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('variablesHint')}</p>
          {mappings.fields.length === 0 && <p className="text-sm">{t('noVariables')}</p>}
          {/* Theme-token borders group each substitution without hardcoded theme colors. */}
          {mappings.fields.map((row, index) => <div key={row.id} className="space-y-3 rounded-lg border border-[rgb(var(--cmx-border-rgb))] p-3">
            <CmxFormField name={`mappings.${index}.slot`} label={t('variableName')} required>
              {({ invalid, describedBy, ...field }) => <CmxInput {...field} disabled={pending} dir="ltr" aria-invalid={invalid} aria-describedby={describedBy} />}
            </CmxFormField>
            <div className="grid gap-3 sm:grid-cols-2">
              <CmxFormField name={`mappings.${index}.kind`} label={t('valueType')}>
                {({ invalid, describedBy, ...field }) => <CmxSelect {...field} disabled={pending} aria-invalid={invalid} aria-describedby={describedBy} options={[{ value: 'variable', label: t('eventValue') }, { value: 'literal', label: t('fixedValue') }]} />}
              </CmxFormField>
              <CmxFormField name={`mappings.${index}.source`} label={t('valueSource')} description={t('sourceHint')} required>
                {({ invalid, describedBy, ...field }) => <CmxInput {...field} disabled={pending} aria-invalid={invalid} aria-describedby={describedBy} />}
              </CmxFormField>
            </div>
            <CmxButton type="button" size="sm" variant="outline" disabled={pending} onClick={() => mappings.remove(index)}>{t('removeVariable')}</CmxButton>
          </div>)}
          <CmxButton type="button" variant="outline" disabled={pending} onClick={() => mappings.append({ slot: '', kind: 'variable', source: '' })}>{t('addVariable')}</CmxButton>
        </div>
        <CmxSummaryMessage type="warning" title={t('liveHint')} items={[]} />
        <div className="flex flex-wrap gap-3">
          <CmxButton type="submit" loading={pending}>{provider?.is_active ? tc('save') : t('saveActivate')}</CmxButton>
          <CmxButton type="button" variant="outline" disabled={pending} onClick={() => void selectEvent('order.created')}>{tc('cancel')}</CmxButton>
          {provider?.is_active && events.includes(selectedEvent) && <CmxButton type="button" variant="destructive" disabled={pending} onClick={async () => {
            if (await cmxMessage.confirm({ title: t('removeTitle'), description: t('removeDescription', { event: selectedEvent }) })) await onSave({ event: selectedEvent, remove: true })
          }}>{t('removeTemplate')}</CmxButton>}
        </div>
      </CmxForm>
    </div>
  )
}
