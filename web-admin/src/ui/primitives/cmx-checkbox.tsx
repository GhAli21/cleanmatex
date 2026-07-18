/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxCheckbox - Prominent checkbox primitive with label pairing
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CMX_CHOICE_CHROME } from '@ui/foundations'

export type CmxCheckboxSize = 'sm' | 'md' | 'lg'

export interface CmxCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode
  description?: string
  error?: string
  /** Visual size. Default `md` is intentionally prominent for readability and touch targets. */
  size?: CmxCheckboxSize
}

const SIZE_STYLES: Record<
  CmxCheckboxSize,
  { box: string; icon: string; strokeWidth: number; gap: string; label: string }
> = {
  sm: {
    box: 'h-4 w-4 rounded-[0.25rem]',
    icon: 'h-2.5 w-2.5',
    strokeWidth: 2.25,
    gap: 'gap-x-2 gap-y-1',
    label: 'text-sm',
  },
  md: {
    box: 'h-5 w-5 rounded-[0.3rem]',
    icon: 'h-3.5 w-3.5',
    strokeWidth: 2.5,
    gap: 'gap-x-2.5 gap-y-1',
    label: 'text-sm',
  },
  lg: {
    box: 'h-6 w-6 rounded-[0.375rem]',
    icon: 'h-4 w-4',
    strokeWidth: 2.75,
    gap: 'gap-x-3 gap-y-1',
    label: 'text-base',
  },
}

export const CmxCheckbox = React.forwardRef<HTMLInputElement, CmxCheckboxProps>(
  (
    {
      label,
      description,
      error,
      size = 'md',
      className,
      disabled,
      id: idProp,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const id = idProp || generatedId
    const descriptionId = description ? `${id}-description` : undefined
    const errorId = error ? `${id}-error` : undefined
    const describedBy =
      [descriptionId, errorId].filter(Boolean).join(' ') || undefined
    const sizeStyle = SIZE_STYLES[size]
    const hasLabel = Boolean(label)

    const control = (
      <span className="relative inline-flex shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'peer',
            sizeStyle.box,
            CMX_CHOICE_CHROME.box,
            error && CMX_CHOICE_CHROME.error,
            className
          )}
          {...props}
        />
        {/* Checkmark */}
        <svg
          className={cn(
            'pointer-events-none absolute inset-0 m-auto stroke-white opacity-0',
            'transition-opacity duration-150',
            'peer-checked:opacity-100 peer-indeterminate:opacity-0',
            sizeStyle.icon
          )}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M3 8L6.5 11.5L13 4.5"
            strokeWidth={sizeStyle.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {/* Indeterminate dash (select-all partial state) */}
        <svg
          className={cn(
            'pointer-events-none absolute inset-0 m-auto stroke-white opacity-0',
            'transition-opacity duration-150 peer-indeterminate:opacity-100',
            sizeStyle.icon
          )}
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M3.5 8H12.5"
            strokeWidth={sizeStyle.strokeWidth}
            strokeLinecap="round"
          />
        </svg>
      </span>
    )

    if (!hasLabel) {
      return (
        <div className="inline-flex flex-col gap-1">
          {control}
          {description ? (
            <p
              id={descriptionId}
              className="text-xs leading-relaxed text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
            >
              {description}
            </p>
          ) : null}
          {error ? (
            <p
              id={errorId}
              role="alert"
              className="text-xs leading-relaxed text-[rgb(var(--cmx-destructive-rgb,220_38_38))]"
            >
              {error}
            </p>
          ) : null}
        </div>
      )
    }

    return (
      <div
        className={cn(
          'grid grid-cols-[auto_minmax(0,1fr)] items-start',
          sizeStyle.gap
        )}
      >
        {control}
        <label
          htmlFor={id}
          className={cn(
            'cursor-pointer select-none pt-0.5 font-medium leading-snug',
            sizeStyle.label,
            'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
            disabled && 'cursor-not-allowed opacity-60'
          )}
        >
          {label}
        </label>

        {description ? (
          <>
            <span aria-hidden="true" />
            <p
              id={descriptionId}
              className="text-xs leading-relaxed text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
            >
              {description}
            </p>
          </>
        ) : null}

        {error ? (
          <>
            <span aria-hidden="true" />
            <p
              id={errorId}
              role="alert"
              className="text-xs leading-relaxed text-[rgb(var(--cmx-destructive-rgb,220_38_38))]"
            >
              {error}
            </p>
          </>
        ) : null}
      </div>
    )
  }
)

CmxCheckbox.displayName = 'CmxCheckbox'
