/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxCheckboxGroup - Manages multiple checkboxes as a group
 * @module ui/forms
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CmxCheckbox } from '../primitives/cmx-checkbox'
import { CmxButton } from '../primitives/cmx-button'

export interface CmxCheckboxGroupOption {
  value: string
  label: React.ReactNode
  description?: string
  disabled?: boolean
}

export interface CmxCheckboxGroupProps {
  options: CmxCheckboxGroupOption[]
  value?: string[]
  onChange?: (value: string[]) => void
  label?: string
  description?: string
  error?: string
  required?: boolean
  showSelectAll?: boolean
  className?: string
  disabled?: boolean
  selectAllLabel?: string
  clearAllLabel?: string
  selectionSummary?: (selectedCount: number, totalCount: number) => string
  columns?: 1 | 2 | 3
}

export const CmxCheckboxGroup: React.FC<CmxCheckboxGroupProps> = ({
  options,
  value = [],
  onChange,
  label,
  description,
  error,
  required,
  showSelectAll = true,
  className,
  disabled,
  selectAllLabel = 'Select all',
  clearAllLabel = 'Clear all',
  selectionSummary,
  columns = 2,
}) => {
  const handleToggle = (optionValue: string) => {
    if (!onChange || disabled) return

    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue]

    onChange(newValue)
  }

  const handleSelectAll = () => {
    if (!onChange || disabled) return
    const enabledOptions = options.filter((opt) => !opt.disabled)
    onChange(enabledOptions.map((opt) => opt.value))
  }

  const handleDeselectAll = () => {
    if (!onChange || disabled) return
    onChange([])
  }

  const allSelected = options.every((opt) => opt.disabled || value.includes(opt.value))
  return (
    <fieldset className={cn('space-y-3', className)} disabled={disabled}>
      {(label || description || showSelectAll) && (
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0 flex-1">
            {label ? (
              <legend className="cmx-type-field-label text-[rgb(var(--cmx-text-primary-rgb,15_23_42))]">
                {label}
                {required ? (
                  <span className="ms-1 text-destructive">*</span>
                ) : null}
              </legend>
            ) : null}
            {description ? (
              <p className="cmx-type-field-helper mt-1 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {showSelectAll && options.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <CmxButton
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleSelectAll}
                disabled={disabled || allSelected}
              >
                {selectAllLabel}
              </CmxButton>
              <CmxButton
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleDeselectAll}
                disabled={disabled || value.length === 0}
              >
                {clearAllLabel}
              </CmxButton>
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-[var(--cmx-radius-lg,1.125rem)] border-2 border-foreground/35 bg-surface p-4">
        <div
          className={cn(
            'grid gap-3',
            columns === 1 && 'grid-cols-1',
            columns === 2 && 'grid-cols-1 md:grid-cols-2',
            columns === 3 && 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          )}
        >
          {options.map((option) => (
            <div
              key={option.value}
              className={cn(
                'flex min-h-[44px] cursor-pointer items-start gap-3 rounded-[var(--cmx-radius-md,0.875rem)] border-2 border-foreground/25 bg-[rgb(var(--cmx-input-bg-rgb,255_255_255))] px-3 py-3 transition hover:border-foreground/45 hover:bg-secondary',
                value.includes(option.value) &&
                  'border-primary bg-primary/6',
                (disabled || option.disabled) && 'cursor-not-allowed opacity-60'
              )}
            >
              <CmxCheckbox
                checked={value.includes(option.value)}
                onChange={() => handleToggle(option.value)}
                label={option.label}
                description={option.description}
                disabled={disabled || option.disabled}
              />
            </div>
          ))}
        </div>
      </div>

      {error ? (
        <p className="cmx-type-field-error text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {value.length > 0 && !error ? (
        <p className="cmx-type-field-helper text-muted-foreground">
          {selectionSummary
            ? selectionSummary(value.length, options.length)
            : `${value.length} of ${options.length} selected`}
        </p>
      ) : null}
    </fieldset>
  )
}

CmxCheckboxGroup.displayName = 'CmxCheckboxGroup'
