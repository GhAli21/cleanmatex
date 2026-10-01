/**
 * Reusable searchable single-selection list-of-values dialog.
 *
 * Keeps lookup presentation independent from the source of its records so
 * feature modules can keep tenant-scoped data access and permission decisions
 * outside the design system.
 * @module ui/forms
 */

'use client'

import * as React from 'react'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CmxButton, CmxInput, CmxSpinner } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'

/**
 * Localized labels supplied by the consuming feature.
 *
 * Keeping text at the caller ensures the generic component never owns a
 * feature namespace or creates translation drift between applications.
 */
export interface CmxListOfValuesDialogLabels {
  title: string
  searchLabel: string
  searchPlaceholder: string
  loadingLabel: string
  emptyLabel: string
  clearLabel: string
  cancelLabel: string
  applyLabel: string
  optionsLabel: string
}

/**
 * Props for a domain-agnostic, searchable single-selection lookup dialog.
 *
 * @typeParam TOption - The feature-owned record shape represented by one row.
 */
export interface CmxListOfValuesDialogProps<TOption> {
  open: boolean
  onOpenChange: (open: boolean) => void
  options: readonly TOption[]
  selectedId: string | null
  onApply: (selectedId: string | null) => void
  getOptionId: (option: TOption) => string
  getOptionLabel: (option: TOption) => string
  getOptionDescription?: (option: TOption) => string | null | undefined
  isOptionDisabled?: (option: TOption) => boolean
  renderOption?: (option: TOption, selected: boolean) => React.ReactNode
  isLoading?: boolean
  labels: CmxListOfValuesDialogLabels
  className?: string
}

/**
 * Provides a consistent, keyboard-accessible way to choose one lookup value
 * without coupling reusable UI to POS, users, terminals, or any other domain.
 *
 * Selection is staged until Apply, so cancelling never mutates an active
 * filter merely because a user inspected a different option.
 *
 * @example
 * <CmxListOfValuesDialog
 *   open={operatorPickerOpen}
 *   onOpenChange={setOperatorPickerOpen}
 *   options={operators}
 *   selectedId={filters.userId}
 *   onApply={(userId) => setFilters((current) => ({ ...current, userId }))}
 *   getOptionId={(operator) => operator.id}
 *   getOptionLabel={(operator) => operator.displayName}
 *   labels={labels}
 * />
 */
export function CmxListOfValuesDialog<TOption>({
  open,
  ...props
}: CmxListOfValuesDialogProps<TOption>) {
  // Mounting only while open makes a reopened picker start from its applied
  // value without synchronizing draft selection through a stateful effect.
  if (!open) {
    return null
  }

  return <CmxListOfValuesDialogContent key={props.selectedId ?? '__empty'} open {...props} />
}

function CmxListOfValuesDialogContent<TOption>({
  open,
  onOpenChange,
  options,
  selectedId,
  onApply,
  getOptionId,
  getOptionLabel,
  getOptionDescription,
  isOptionDisabled,
  renderOption,
  isLoading = false,
  labels,
  className,
}: CmxListOfValuesDialogProps<TOption>) {
  const [searchTerm, setSearchTerm] = React.useState('')
  const [draftSelectedId, setDraftSelectedId] = React.useState<string | null>(selectedId)

  const normalizedSearch = searchTerm.trim().toLocaleLowerCase()
  const matchingOptions = React.useMemo(
    () => options.filter((option) => {
      if (!normalizedSearch) {
        return true
      }

      const searchableText = [
        getOptionLabel(option),
        getOptionDescription?.(option) ?? '',
      ].join(' ').toLocaleLowerCase()

      return searchableText.includes(normalizedSearch)
    }),
    [getOptionDescription, getOptionLabel, normalizedSearch, options],
  )

  const handleApply = () => {
    onApply(draftSelectedId)
    onOpenChange(false)
  }

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange} autoFocus={false}>
      <CmxDialogContent
        bodyPadding="none"
        scrollBody
        className={cn('w-[calc(100vw-2rem)] max-w-xl', className)}
      >
        <CmxDialogHeader>
          <CmxDialogTitle>{labels.title}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
          <CmxInput
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            label={labels.searchLabel}
            placeholder={labels.searchPlaceholder}
            leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
          />

          <div
            role="listbox"
            aria-label={labels.optionsLabel}
            aria-busy={isLoading}
            className="min-h-0 max-h-[45vh] overflow-y-auto rounded-[var(--cmx-radius-md,0.875rem)] border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-1"
          >
            {isLoading ? (
              <div className="flex min-h-32 items-center justify-center gap-2 p-4 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" role="status">
                <CmxSpinner size="sm" aria-hidden="true" />
                <span>{labels.loadingLabel}</span>
              </div>
            ) : matchingOptions.length === 0 ? (
              <p className="p-4 text-center text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {labels.emptyLabel}
              </p>
            ) : (
              matchingOptions.map((option) => {
                const optionId = getOptionId(option)
                const selected = draftSelectedId === optionId
                const disabled = isOptionDisabled?.(option) ?? false
                const description = getOptionDescription?.(option)

                return (
                  <CmxButton
                    key={optionId}
                    type="button"
                    variant="ghost"
                    disabled={disabled}
                    role="option"
                    aria-selected={selected}
                    onClick={() => setDraftSelectedId(optionId)}
                    className={cn(
                      'mb-1 flex h-auto min-h-11 w-full items-start justify-between gap-3 px-3 py-2.5 text-start last:mb-0',
                      selected && 'bg-[rgb(var(--cmx-secondary-bg-rgb,239_246_255))]',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      {renderOption ? renderOption(option, selected) : (
                        <span className="block min-w-0">
                          <span className="block truncate text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                            {getOptionLabel(option)}
                          </span>
                          {description ? (
                            <span className="mt-0.5 block truncate text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                              {description}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </span>
                    {selected ? (
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(var(--cmx-primary-rgb,14_165_233))]"
                        aria-hidden="true"
                      />
                    ) : null}
                  </CmxButton>
                )
              })
            )}
          </div>
        </div>

        <CmxDialogFooter className="flex-wrap justify-between gap-2">
          <CmxButton
            type="button"
            variant="ghost"
            onClick={() => setDraftSelectedId(null)}
            disabled={draftSelectedId === null || isLoading}
          >
            {labels.clearLabel}
          </CmxButton>
          <div className="flex flex-wrap justify-end gap-2">
            <CmxButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {labels.cancelLabel}
            </CmxButton>
            <CmxButton type="button" onClick={handleApply} disabled={isLoading}>
              {labels.applyLabel}
            </CmxButton>
          </div>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
