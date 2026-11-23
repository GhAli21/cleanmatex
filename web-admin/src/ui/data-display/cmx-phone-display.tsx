'use client'

/**
 * CmxPhoneDisplay - Canonical phone number renderer for tables, cards, and detail screens.
 *
 * Formats E.164 values cleanly (e.g. "+968 9666 2624") inside `<bdi dir="ltr">` so the
 * leading "+" never flips in Arabic RTL. Supports optional copy, tel: link, and WhatsApp link.
 *
 * @module ui/data-display
 */

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Check, Copy, MessageCircle, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMessage } from '@ui/feedback'
import {
  formatPhoneForDisplay,
  getPhoneCountry,
  toWhatsAppDigits,
  type CountryCode,
} from '@/lib/phone/phone-utils'
import { CmxCountryFlag } from './cmx-country-flag'

export interface CmxPhoneDisplayProps {
  /** Stored E.164 phone number (e.g. "+96896662624"). */
  value: string | null | undefined
  /** Optional fallback ISO country if displaying legacy national-only digits. */
  defaultCountry?: CountryCode
  /** Text rendered when value is empty (defaults to "—"). */
  fallback?: React.ReactNode
  /** Render the country SVG flag beside the phone number (default false). */
  showFlag?: boolean
  /** Render a copy-to-clipboard button (default false). */
  copyable?: boolean
  /** Render the phone number as a clickable `tel:` link (default false). */
  telLink?: boolean
  /** Render a subtle WhatsApp deep-link icon button (default false). */
  whatsappLink?: boolean
  className?: string
}

export function CmxPhoneDisplay({
  value,
  defaultCountry,
  fallback = '—',
  showFlag = false,
  copyable = false,
  telLink = false,
  whatsappLink = false,
  className,
}: CmxPhoneDisplayProps) {
  const tCommon = useTranslations('common')
  const { showSuccess } = useMessage()
  const [copied, setCopied] = React.useState(false)

  const raw = (value ?? '').trim()
  const formatted = React.useMemo(
    () => formatPhoneForDisplay(raw, defaultCountry),
    [raw, defaultCountry],
  )
  const resolvedCountry = React.useMemo(
    () => (showFlag ? getPhoneCountry(raw, defaultCountry) : undefined),
    [showFlag, raw, defaultCountry],
  )

  React.useEffect(() => {
    if (!copied) return undefined
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  if (!raw) {
    return <span className={cn('text-muted-foreground', className)}>{fallback}</span>
  }

  const handleCopy = async (event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(raw)
      setCopied(true)
      showSuccess(tCommon('copied'))
    } catch {
      // Clipboard may be blocked in restricted contexts; phone remains readable.
    }
  }

  const waDigits = whatsappLink ? toWhatsAppDigits(raw) : ''

  return (
    <span className={cn('inline-flex items-center gap-1.5 align-middle', className)}>
      {showFlag && resolvedCountry ? <CmxCountryFlag iso={resolvedCountry} /> : null}
      {telLink ? (
        <a
          href={`tel:${raw}`}
          className="inline-flex items-center gap-1 text-primary-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          aria-label={tCommon('phone.callPhone', { phone: formatted })}
          onClick={(e) => e.stopPropagation()}
        >
          <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <bdi dir="ltr" className="inline-block tabular-nums">
            {formatted}
          </bdi>
        </a>
      ) : (
        <bdi dir="ltr" className="inline-block tabular-nums">
          {formatted}
        </bdi>
      )}

      {copyable ? (
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={tCommon('phone.copyPhone', { phone: formatted })}
          title={tCommon('phone.copyPhone', { phone: formatted })}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-success-text" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
      ) : null}

      {whatsappLink && waDigits ? (
        <a
          href={`https://wa.me/${waDigits}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-success-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={tCommon('phone.whatsappPhone', { phone: formatted })}
          title={tCommon('phone.whatsappPhone', { phone: formatted })}
          onClick={(e) => e.stopPropagation()}
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}
    </span>
  )
}
