/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxRadioGroup - Single-select radio options with prominent CmxRadio controls
 * @module ui/forms
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CmxRadio } from '../primitives/cmx-radio'

export interface CmxRadioGroupOption {
  value: string
  label: React.ReactNode
  description?: string
  disabled?: boolean
}

export interface CmxRadioGroupProps {
  options: CmxRadioGroupOption[]
  value?: string
  onChange?: (value: string) => void
  name?: string
  label?: string
  description?: string
  error?: string
  required?: boolean
  className?: string
  disabled?: boolean
  columns?: 1 | 2 | 3
}

export const CmxRadioGroup: React.FC<CmxRadioGroupProps> = ({
  options,
  value,
  onChange,
  name: nameProp,
  label,
  description,
  error,
  required,
  className,
  disabled,
  columns = 1,
}) => {
  const generatedName = React.useId()
  const name = nameProp || generatedName

  return (
    <fieldset className={cn('space-y-3', className)} disabled={disabled}>
      {(label || description) && (
        <div className="min-w-0">
          {label ? (
            <legend className="cmx-type-field-label text-[rgb(var(--cmx-text-primary-rgb,15_23_42))]">
              {label}
              {required ? (
                <span className="ml-1 text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">
                  *
                </span>
              ) : null}
            </legend>
          ) : null}
          {description ? (
            <p className="cmx-type-field-helper mt-1 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {description}
            </p>
          ) : null}
        </div>
      )}

      <div
        className={cn(
          'grid gap-3 rounded-[var(--cmx-radius-lg,1.125rem)] border-2 border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.35)] bg-[rgb(var(--cmx-surface-rgb,255_255_255))] p-4',
          columns === 1 && 'grid-cols-1',
          columns === 2 && 'grid-cols-1 md:grid-cols-2',
          columns === 3 && 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
        )}
      >
        {options.map((option) => (
          <div
            key={option.value}
            className={cn(
              'flex min-h-[44px] items-start rounded-[var(--cmx-radius-md,0.875rem)] border-2 border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.25)] bg-[rgb(var(--cmx-input-bg-rgb,255_255_255))] px-3 py-3 transition',
              'hover:border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.45)] hover:bg-[rgb(var(--cmx-secondary-bg-rgb,239_246_255))]',
              value === option.value &&
                'border-[rgb(var(--cmx-primary-rgb,14_165_233))] bg-[rgb(var(--cmx-primary-rgb,14_165_233)/0.06)]',
              (disabled || option.disabled) && 'cursor-not-allowed opacity-60'
            )}
          >
            <CmxRadio
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange?.(option.value)}
              label={option.label}
              description={option.description}
              disabled={disabled || option.disabled}
            />
          </div>
        ))}
      </div>

      {error ? (
        <p
          className="cmx-type-field-error text-[rgb(var(--cmx-destructive-rgb,220_38_38))]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

CmxRadioGroup.displayName = 'CmxRadioGroup'
