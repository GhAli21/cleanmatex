'use client'

/**
 * CmxCodeSearchInput - search box that knows our codes (HFC P3b, T3.8 / T3.9 fast path).
 *
 * On Enter: a full order number, line code, piece code or staff QR is sent as an exact code
 * (`{ mode: 'code', kind, code }`), so the screen can open it at once; anything else is plain text search
 * (`{ mode: 'text', text }`). Digits typed on an Arabic keyboard work (normalised like scans).
 */
import * as React from 'react'
import { Search } from 'lucide-react'
import { classifyCode, normalizeScanInput, type CodeKind } from '@/lib/validations/code-format-schemas'
import { CmxInput } from '../primitives/cmx-input'

export type CodeSearchSubmit =
  | { mode: 'code'; kind: Exclude<CodeKind, 'UNKNOWN'>; code: string }
  | { mode: 'text'; text: string }

/** Pure helper: how a search value should be handled. Empty text gives `{ mode: 'text', text: '' }`. */
export function toCodeSearch(raw: string): CodeSearchSubmit {
  const normalized = normalizeScanInput(raw)
  const kind = classifyCode(normalized)
  if (kind === 'UNKNOWN') return { mode: 'text', text: normalized }
  return { mode: 'code', kind, code: kind === 'CMX' ? normalized : normalized.toUpperCase() }
}

export interface CmxCodeSearchInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: (search: CodeSearchSubmit) => void
  label?: string
  placeholder?: string
  /** Accessible name when there is no visible label. */
  'aria-label'?: string
  disabled?: boolean
  className?: string
  id?: string
}

export function CmxCodeSearchInput({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
  'aria-label': ariaLabel,
  disabled,
  className,
  id,
}: CmxCodeSearchInputProps) {
  return (
    <CmxInput
      id={id}
      type="search"
      label={label}
      aria-label={label ? undefined : ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onSubmit(toCodeSearch(value))
        }
      }}
      placeholder={placeholder}
      disabled={disabled}
      autoComplete="off"
      spellCheck={false}
      enterKeyHint="search"
      leftIcon={<Search className="h-4 w-4" aria-hidden="true" />}
      className={className}
    />
  )
}
