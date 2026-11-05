'use client'

/**
 * CmxCodeChip - shows an order number, line code, piece code or tag the same way everywhere (HFC P3b, T3.8).
 *
 * Codes are Latin text, so they sit in `<bdi dir="ltr">` and read left to right inside Arabic text too.
 * Monospace makes 0/O and 1/I easy to tell apart. Click copies the code (toast `common.copied`).
 * The copy button is at least 44px tall on touch screens.
 */
import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMessage } from '@ui/feedback'

export type CmxCodeChipKind = 'order' | 'item' | 'piece' | 'tag'

export interface CmxCodeChipProps {
  /** The code to show and copy. Nothing renders when empty. */
  code: string | null | undefined
  kind?: CmxCodeChipKind
  /** Short text before the code, e.g. "Tag". */
  label?: string
  /** Show the copy control (default true). */
  copyable?: boolean
  size?: 'sm' | 'md'
  /** Accessible name of the copy button; defaults to "<label or code>" + copy hint from common. */
  copyLabel?: string
  className?: string
}

const KIND_CLASS: Record<CmxCodeChipKind, string> = {
  order: 'border-[rgb(var(--cmx-primary-rgb,37_99_235)/0.35)] bg-[rgb(var(--cmx-primary-rgb,37_99_235)/0.06)]',
  item: 'border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,241_245_249))]',
  piece: 'border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,241_245_249))]',
  tag: 'border-dashed border-[rgb(var(--cmx-warning-rgb,217_119_6)/0.6)] bg-[rgb(var(--cmx-warning-rgb,217_119_6)/0.06)]',
}

export function CmxCodeChip({
  code,
  kind = 'order',
  label,
  copyable = true,
  size = 'sm',
  copyLabel,
  className,
}: CmxCodeChipProps) {
  const t = useTranslations('common')
  const { showSuccess } = useMessage()
  const [copied, setCopied] = React.useState(false)
  const value = code?.trim() ?? ''

  React.useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  if (!value) return null

  const onCopy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      showSuccess(t('copied'))
    } catch {
      // Clipboard can be blocked; the code is still visible to read.
    }
  }

  const body = (
    <>
      {label ? <span className="font-sans text-[0.85em] opacity-70">{label}</span> : null}
      <bdi dir="ltr" className="font-mono tracking-tight">
        {value}
      </bdi>
    </>
  )

  const chipClass = cn(
    'inline-flex max-w-full items-center gap-1.5 rounded-md border align-middle',
    size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm',
    KIND_CLASS[kind],
    className,
  )

  if (!copyable) {
    return (
      <span className={chipClass} data-code-kind={kind}>
        {body}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(chipClass, 'cursor-pointer hover:opacity-90 pointer-coarse:min-h-11 focus-visible:outline-2')}
      aria-label={copyLabel ?? `${label ? `${label} ` : ''}${value}`}
      title={value}
      data-code-kind={kind}
    >
      {body}
      <span aria-hidden="true" className="shrink-0 opacity-60">
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </span>
    </button>
  )
}
