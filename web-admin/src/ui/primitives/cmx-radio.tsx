/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxRadio - Prominent radio control with label pairing
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CmxRadioSize = 'sm' | 'md' | 'lg'

export interface CmxRadioProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: React.ReactNode
  description?: string
  error?: string
  /** Visual size. Default `md` is intentionally prominent. */
  size?: CmxRadioSize
}

const SIZE_STYLES: Record<
  CmxRadioSize,
  { box: string; dot: string; gap: string; label: string }
> = {
  sm: {
    box: 'h-4 w-4',
    dot: 'h-1.5 w-1.5',
    gap: 'gap-x-2 gap-y-1',
    label: 'text-sm',
  },
  md: {
    box: 'h-5 w-5',
    dot: 'h-2 w-2',
    gap: 'gap-x-2.5 gap-y-1',
    label: 'text-sm',
  },
  lg: {
    box: 'h-6 w-6',
    dot: 'h-2.5 w-2.5',
    gap: 'gap-x-3 gap-y-1',
    label: 'text-base',
  },
}

export const CmxRadio = React.forwardRef<HTMLInputElement, CmxRadioProps>(
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
          type="radio"
          id={id}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(
            'peer shrink-0 cursor-pointer appearance-none rounded-full',
            sizeStyle.box,
            'border-2 border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.7)]',
            'bg-[rgb(var(--cmx-surface-rgb,255_255_255))]',
            'shadow-[inset_0_0_0_1px_rgb(var(--cmx-foreground-rgb,15_23_42)/0.04)]',
            'transition-[background-color,border-color,box-shadow] duration-150',
            'hover:border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.9)]',
            'checked:border-[rgb(var(--cmx-primary-rgb,14_165_233))]',
            'checked:bg-[rgb(var(--cmx-surface-rgb,255_255_255))]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.35)]',
            'focus-visible:ring-offset-[rgb(var(--cmx-background-rgb,255_255_255))]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            error &&
              'border-[rgb(var(--cmx-destructive-rgb,220_38_38))] focus-visible:ring-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.35)]',
            className
          )}
          {...props}
        />
        <span
          className={cn(
            'pointer-events-none absolute inset-0 m-auto rounded-full opacity-0 transition-opacity duration-150',
            'bg-[rgb(var(--cmx-primary-rgb,14_165_233))] peer-checked:opacity-100',
            sizeStyle.dot
          )}
          aria-hidden="true"
        />
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

CmxRadio.displayName = 'CmxRadio'
