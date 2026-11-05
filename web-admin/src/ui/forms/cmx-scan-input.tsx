'use client'

/**
 * CmxScanInput - one field for scanners and typing (HFC P3b, T3.7).
 *
 * A scanner types the code and Enter; staff can also type and press Enter or the button. The value goes through
 * `normalizeScanInput` (Arabic-Indic digits, AIM prefix, control characters, spaces), the same rules the server
 * uses. The field clears and keeps focus after each scan, so the next scan works without a click. The same value
 * inside `dedupeMs` is reported once (scanners often send twice). A polite live region reads the last result.
 * Text is passed in by the caller (EN/AR from the feature's messages). Codes show left to right in RTL too.
 */
import * as React from 'react'
import { ScanLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeScanInput, SCAN_RAW_MAX_LENGTH } from '@/lib/validations/code-format-schemas'
import { CmxButton } from '../primitives/cmx-button'
import { CmxInput } from '../primitives/cmx-input'

export type CmxScanStatusTone = 'success' | 'error' | 'info'

export interface CmxScanStatus {
  tone: CmxScanStatusTone
  message: string
}

export interface CmxScanInputProps {
  /** Called with the normalised value. May return a promise; the field shows busy until it settles. */
  onScan: (value: string) => void | Promise<unknown>
  /** Visible label (also the accessible name). */
  label: string
  placeholder?: string
  /** Short help below the field. */
  hint?: string
  /** Text of the submit button; the button is hidden when omitted. */
  submitLabel?: string
  /** Shown when Enter is pressed on an empty field. */
  emptyMessage?: string
  /** Last result, read by screen readers. */
  status?: CmxScanStatus | null
  disabled?: boolean
  /** Shows the button as busy and ignores new scans. */
  busy?: boolean
  autoFocus?: boolean
  /** Clear the field after each scan (default true). */
  clearOnScan?: boolean
  /** Same value again inside this time is ignored, in ms (default 800; 0 turns it off). */
  dedupeMs?: number
  className?: string
  id?: string
  'data-testid'?: string
}

const STATUS_CLASS: Record<CmxScanStatusTone, string> = {
  success: 'text-[rgb(var(--cmx-success-rgb,22_163_74))]',
  error: 'text-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
  info: 'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
}

export const CmxScanInput = React.forwardRef<HTMLInputElement, CmxScanInputProps>(function CmxScanInput(
  {
    onScan,
    label,
    placeholder,
    hint,
    submitLabel,
    emptyMessage,
    status,
    disabled = false,
    busy = false,
    autoFocus = false,
    clearOnScan = true,
    dedupeMs = 800,
    className,
    id,
    'data-testid': testId,
  },
  forwardedRef,
) {
  const innerRef = React.useRef<HTMLInputElement | null>(null)
  const [value, setValue] = React.useState('')
  const [emptyHit, setEmptyHit] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const last = React.useRef<{ value: string; at: number }>({ value: '', at: -Infinity })
  const generatedId = React.useId()
  const inputId = id ?? `cmx-scan-${generatedId}`
  const statusId = `${inputId}-status`
  const isBusy = busy || pending

  const setRefs = React.useCallback(
    (el: HTMLInputElement | null) => {
      innerRef.current = el
      if (typeof forwardedRef === 'function') forwardedRef(el)
      else if (forwardedRef) forwardedRef.current = el
    },
    [forwardedRef],
  )

  const submit = React.useCallback(async () => {
    if (disabled || isBusy) return
    const normalized = normalizeScanInput(value)
    if (!normalized) {
      setEmptyHit(true)
      return
    }
    setEmptyHit(false)
    const now = Date.now()
    if (dedupeMs > 0 && normalized === last.current.value && now - last.current.at < dedupeMs) {
      if (clearOnScan) setValue('')
      return
    }
    last.current = { value: normalized, at: now }
    if (clearOnScan) setValue('')
    try {
      const result = onScan(normalized)
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        setPending(true)
        await result
      }
    } catch {
      // The caller shows its own error through `status`.
    } finally {
      setPending(false)
      innerRef.current?.focus()
    }
  }, [clearOnScan, dedupeMs, disabled, isBusy, onScan, value])

  const shownStatus: CmxScanStatus | null =
    emptyHit && emptyMessage ? { tone: 'error', message: emptyMessage } : (status ?? null)

  return (
    <div className={cn('w-full space-y-2', className)} data-testid={testId}>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <CmxInput
            ref={setRefs}
            id={inputId}
            label={label}
            value={value}
            onChange={(e) => {
              setEmptyHit(false)
              setValue(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submit()
              }
            }}
            placeholder={placeholder}
            helpText={hint}
            disabled={disabled}
            autoFocus={autoFocus}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="go"
            maxLength={SCAN_RAW_MAX_LENGTH}
            dir="ltr"
            aria-describedby={statusId}
            aria-invalid={shownStatus?.tone === 'error' ? true : undefined}
            leftIcon={<ScanLine className="h-4 w-4" aria-hidden="true" />}
            className="min-h-11 font-mono"
          />
        </div>
        {submitLabel ? (
          <CmxButton
            type="button"
            onClick={() => void submit()}
            disabled={disabled || isBusy}
            loading={isBusy}
            className={cn('min-h-11 min-w-11', hint ? 'mb-6' : undefined)}
          >
            {submitLabel}
          </CmxButton>
        ) : null}
      </div>
      <p id={statusId} role="status" aria-live="polite" className={cn('min-h-5 text-sm', shownStatus && STATUS_CLASS[shownStatus.tone])}>
        {shownStatus?.message ?? ''}
      </p>
    </div>
  )
})
