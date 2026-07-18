/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxSwitch - Prominent toggle with optional label pairing
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CmxSwitchSize = 'sm' | 'md' | 'lg'

export interface CmxSwitchProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  /**
   * Soft-disable: keeps the control focusable/clickable so the parent can show
   * a permission or lock message. Visual not-allowed; does not set native `disabled`.
   */
  ariaDisabled?: boolean
  label?: React.ReactNode
  description?: string
  error?: string
  /** Visual size. Default `md` is intentionally prominent. */
  size?: CmxSwitchSize
  className?: string
}

const SIZE_STYLES: Record<
  CmxSwitchSize,
  { track: string; thumb: string; thumbOn: string; gap: string; label: string }
> = {
  sm: {
    track: 'h-5 w-9',
    thumb: 'h-4 w-4',
    thumbOn: 'translate-x-4 rtl:translate-x-[-1rem]',
    gap: 'gap-x-2 gap-y-1',
    label: 'text-sm',
  },
  md: {
    track: 'h-6 w-11',
    thumb: 'h-5 w-5',
    thumbOn: 'translate-x-5 rtl:translate-x-[-1.25rem]',
    gap: 'gap-x-2.5 gap-y-1',
    label: 'text-sm',
  },
  lg: {
    track: 'h-7 w-14',
    thumb: 'h-6 w-6',
    thumbOn: 'translate-x-7 rtl:translate-x-[-1.75rem]',
    gap: 'gap-x-3 gap-y-1',
    label: 'text-base',
  },
}

export const CmxSwitch = React.forwardRef<HTMLButtonElement, CmxSwitchProps>(
  (
    {
      className,
      checked,
      onCheckedChange,
      disabled,
      ariaDisabled = false,
      id: idProp,
      name,
      label,
      description,
      error,
      size = 'md',
      'aria-describedby': ariaDescribedByProp,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const id = idProp || generatedId
    const softLocked = ariaDisabled && !disabled
    const sizeStyle = SIZE_STYLES[size]
    const descriptionId = description ? `${id}-description` : undefined
    const errorId = error ? `${id}-error` : undefined
    const describedBy =
      [ariaDescribedByProp, descriptionId, errorId].filter(Boolean).join(' ') ||
      undefined
    const hasLabel = Boolean(label)

    const control = (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-disabled={softLocked ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        data-state={checked ? 'checked' : 'unchecked'}
        disabled={disabled}
        ref={ref}
        id={id}
        name={name}
        className={cn(
          'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 transition-colors',
          sizeStyle.track,
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.35)]',
          'focus-visible:ring-offset-[rgb(var(--cmx-background-rgb,255_255_255))]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          softLocked && 'cursor-not-allowed opacity-60',
          checked
            ? 'border-[rgb(var(--cmx-primary-rgb,14_165_233))] bg-[rgb(var(--cmx-primary-rgb,14_165_233))]'
            : 'border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.7)] bg-[rgb(var(--cmx-muted-rgb,241_245_249))] hover:border-[rgb(var(--cmx-foreground-rgb,15_23_42)/0.9)]',
          error &&
            !checked &&
            'border-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
          className
        )}
        onClick={() => {
          if (disabled) return
          if (onCheckedChange) {
            onCheckedChange(!checked)
          }
        }}
        {...props}
      >
        <span
          className={cn(
            'pointer-events-none block rounded-full bg-white shadow-md ring-0 transition-transform',
            sizeStyle.thumb,
            checked ? sizeStyle.thumbOn : 'translate-x-0'
          )}
        />
      </button>
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
            (disabled || softLocked) && 'cursor-not-allowed opacity-60'
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

CmxSwitch.displayName = 'CmxSwitch'
