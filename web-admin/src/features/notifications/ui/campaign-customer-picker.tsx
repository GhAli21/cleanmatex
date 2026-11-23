'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X } from 'lucide-react'
import { CmxButton } from '@ui/primitives'
import { CmxListOfValuesDialog } from '@ui/forms'
import { useCustomerSearch } from '@/lib/hooks/use-customer-search'
import type { CustomerSearchItem } from '@/lib/api/customers'

/** A customer chosen for a campaign: the org customer id and the name shown on its chip. */
export interface CampaignCustomer {
  id: string
  label: string
}

interface CampaignCustomerPickerProps {
  value: CampaignCustomer[]
  onChange: (next: CampaignCustomer[]) => void
  error?: string
}

const customerLabel = (c: CustomerSearchItem): string =>
  c.displayName?.trim() || [c.firstName, c.lastName].filter(Boolean).join(' ').trim() || c.phone || c.email || c.id

/**
 * Builds a campaign's customer list one search at a time with the shared list-of-values dialog.
 * Only customers of the current organization are offered; the worker drops anything else again.
 * @param props - Chosen customers, change callback and validation error
 * @returns Chips of the chosen customers and an "Add customer" action
 */
export function CampaignCustomerPicker({ value, onChange, error }: CampaignCustomerPickerProps) {
  const t = useTranslations('notifications.campaigns.form')
  const tc = useTranslations('common')
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const { customers, isFetching } = useCustomerSearch({ search, limit: 20 })
  const chosen = new Set(value.map((c) => c.id))
  const options = customers.filter((c) => c.belongsToCurrentTenant !== false && c.source !== 'other_tenant' && c.source !== 'sys_global')

  return (
    <div className="space-y-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t('chosenCustomersList')}>
          {value.map((c) => (
            <li key={c.id} className="flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-sm">
              <span>{c.label}</span>
              <CmxButton
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label={t('removeCustomer', { name: c.label })}
                onClick={() => onChange(value.filter((x) => x.id !== c.id))}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </CmxButton>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('noCustomersChosen')}</p>
      )}
      <CmxButton type="button" variant="outline" onClick={() => setOpen(true)}>
        {t('addCustomer')}
      </CmxButton>
      {error && <p className="text-xs text-danger-text" role="alert">{error}</p>}

      <CmxListOfValuesDialog<CustomerSearchItem>
        open={open}
        onOpenChange={(next) => { setOpen(next); if (!next) setSearch('') }}
        options={options}
        selectedId={null}
        isLoading={isFetching}
        onSearchChange={setSearch}
        isOptionDisabled={(c) => chosen.has(c.id)}
        getOptionId={(c) => c.id}
        getOptionLabel={customerLabel}
        getOptionDescription={(c) => [c.phone, c.email].filter(Boolean).join(' · ') || null}
        onApply={(id) => {
          const picked = id ? options.find((c) => c.id === id) : undefined
          if (picked && !chosen.has(picked.id)) onChange([...value, { id: picked.id, label: customerLabel(picked) }])
        }}
        labels={{
          title: t('addCustomer'),
          searchLabel: t('customerSearch'),
          searchPlaceholder: t('customerSearchPlaceholder'),
          loadingLabel: tc('loading'),
          emptyLabel: t('customerSearchEmpty'),
          clearLabel: tc('clear'),
          cancelLabel: tc('cancel'),
          applyLabel: t('addCustomer'),
          optionsLabel: t('customerSearchResults'),
        }}
      />
    </div>
  )
}
