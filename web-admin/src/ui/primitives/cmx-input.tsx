/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxInput - Text input primitive with optional label, error, helpText, and icons
 * Replaces compat Input with a single API; supports full-width and accessibility.
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cmxFieldChrome } from '@ui/foundations'
import { CmxButton } from './cmx-button'

const inputBaseClasses = cn(
  'flex h-10 w-full rounded-[var(--cmx-radius-md,0.375rem)] px-3 py-1 text-sm outline-none ring-0',
  'placeholder:text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]'
)

export interface CmxInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Optional label shown above the input */
  label?: string
  /** Error message shown below the input; also applies error styling */
  error?: string
  /** Helper text shown below the input when there is no error */
  helpText?: string
  /** Icon or element rendered to the left of the input */
  leftIcon?: React.ReactNode
  /** Icon or element rendered to the right of the input */
  rightIcon?: React.ReactNode
  /** Clickable control inside the field end. Unlike `rightIcon`, it receives pointer events. */
  trailing?: React.ReactNode
  /**
   * When `type` is `password`, show this field's reveal control.
   * The eye is part of the field, not a separate miniature button.
   */
  passwordToggle?: boolean
  /** Controlled reveal. Omit both this and `onPasswordVisibleChange` to keep the toggle inside the field. */
  passwordVisible?: boolean
  onPasswordVisibleChange?: (visible: boolean) => void
  /** Keep the value visible and do not let the eye hide it. */
  passwordRevealLocked?: boolean
  showPasswordLabel?: string
  hidePasswordLabel?: string
  /** When true (default), input container uses w-full */
  fullWidth?: boolean
}

export const CmxInput = React.forwardRef<HTMLInputElement, CmxInputProps>(
  (
    {
      label,
      error,
      helpText,
      leftIcon,
      rightIcon,
      trailing,
      passwordToggle = false,
      passwordVisible,
      onPasswordVisibleChange,
      passwordRevealLocked = false,
      showPasswordLabel,
      hidePasswordLabel,
      fullWidth = true,
      className = '',
      id: idProp,
      disabled,
      type,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = idProp ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : generatedId)
    const hasError = !!error || ariaInvalid === true || ariaInvalid === 'true'
    const showPasswordToggle = type === 'password' && passwordToggle
    const [uncontrolledVisible, setUncontrolledVisible] = React.useState(false)
    const revealed = passwordRevealLocked || (passwordVisible ?? uncontrolledVisible)
    const resolvedType = showPasswordToggle && revealed ? 'text' : type

    const togglePassword = () => {
      if (passwordRevealLocked || disabled) return
      const next = !revealed
      onPasswordVisibleChange?.(next)
      if (passwordVisible === undefined) setUncontrolledVisible(next)
    }

    const inputClassName = cn(
      inputBaseClasses,
      cmxFieldChrome({ error: hasError }),
      leftIcon && 'pl-10',
      rightIcon && !trailing && !showPasswordToggle && 'pr-10',
      trailing && !showPasswordToggle && 'pe-10',
      showPasswordToggle && 'pe-12',
      className
    )

    return (
      <div className={fullWidth ? 'w-full' : undefined}>
        {label && (
          <label
            htmlFor={inputId}
            className="mb-1 block text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
          >
            {label}
            {props.required && (
              <span className="ml-1 text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">*</span>
            )}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={inputClassName}
            aria-describedby={
              error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
            }
            {...props}
            type={resolvedType}
            disabled={disabled}
            aria-invalid={hasError}
          />

          {showPasswordToggle ? (
            <div className="absolute inset-y-0 end-0 flex w-12 items-center justify-center">
              <CmxButton
                type="button"
                variant="ghost"
                size="sm"
                className="!h-9 !w-9 !border-0 !px-0 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
                disabled={disabled || passwordRevealLocked}
                aria-pressed={revealed}
                aria-label={revealed ? hidePasswordLabel : showPasswordLabel}
                onClick={togglePassword}
              >
                {revealed ? (
                  <EyeOff className="h-6 w-6" aria-hidden />
                ) : (
                  <Eye className="h-6 w-6" aria-hidden />
                )}
              </CmxButton>
            </div>
          ) : trailing ? (
            <div className="absolute inset-y-0 end-0 flex items-center pe-1">{trailing}</div>
          ) : rightIcon ? (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {rightIcon}
            </div>
          ) : null}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            className="mt-1 text-sm text-[rgb(var(--cmx-destructive-rgb,220_38_38))]"
          >
            {error}
          </p>
        )}

        {helpText && !error && (
          <p
            id={`${inputId}-help`}
            className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
          >
            {helpText}
          </p>
        )}
      </div>
    )
  }
)

CmxInput.displayName = 'CmxInput'
