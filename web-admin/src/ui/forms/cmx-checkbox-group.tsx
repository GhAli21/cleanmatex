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
  const someSelected = value.length > 0 && !allSelected

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header */}
      {(label || description || showSelectAll) && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            {label && (
              <label className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                {label}
                {required && <span className="ml-1 text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">*</span>}
              </label>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {description}
              </p>
            )}
          </div>

          {/* Select All / Deselect All buttons */}
          {showSelectAll && options.length > 0 && (
            <div className="flex gap-2">
              <CmxButton
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleSelectAll}
                disabled={disabled || allSelected}
              >
                Select All
              </CmxButton>
              <CmxButton
                type="button"
                variant="ghost"
                size="xs"
                onClick={handleDeselectAll}
                disabled={disabled || value.length === 0}
              >
                Deselect All
              </CmxButton>
            </div>
          )}
        </div>
      )}

      {/* Checkbox list */}
      <div className="space-y-3 rounded-lg border-2 border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4 bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))]">
        {options.map((option) => (
          <div key={option.value} className="pb-3 last:pb-0 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))] last:border-b-0">
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

      {/* Error message */}
      {error && (
        <p className="text-xs text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">
          {error}
        </p>
      )}

      {/* Selection count */}
      {value.length > 0 && !error && (
        <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {value.length} of {options.length} selected
        </p>
      )}
    </div>
  )
}

CmxCheckboxGroup.displayName = 'CmxCheckboxGroup'
