'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { getPageAccessContractByPath } from '@features/access/page-access-registry'

const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  ar: 'Accounts Receivable',
  b2b: 'B2B',
  coa: 'Chart of Accounts',
  erp: 'ERP',
  fx: 'FX',
  gl: 'General Ledger',
  jhtestui: 'UI Test Lab',
  qa: 'Quality Assurance',
}

/**
 * Builds a safe, readable fallback when a route has not yet been added to the access-contract registry.
 *
 * @param pathname Active dashboard pathname supplied by Next navigation.
 * @returns A concise screen label without the product suffix.
 */
function getFallbackTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean).slice(1)

  if (segments.length === 0) {
    return 'Dashboard'
  }

  const readableSegments = segments
    .filter((segment) => !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/iu.test(segment) && !/^\d+$/u.test(segment))
    .map((segment) => SEGMENT_LABELS[segment] ?? segment.replace(/[-_]/gu, ' ').replace(/\b\w/gu, (letter) => letter.toUpperCase()))

  return readableSegments.at(-1) ?? 'Dashboard'
}

/**
 * Keeps browser-tab titles aligned with the route access contract after client-side navigation.
 *
 * Server metadata remains the primary source for server routes; this bridge covers existing client pages
 * without forcing a risky rewrite of their interactive boundaries solely for document metadata.
 */
export function DashboardBrowserTitle() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) {
      return
    }

    const title = getPageAccessContractByPath(pathname)?.label ?? getFallbackTitle(pathname)
    document.title = `${title} — CleanMateX`
  }, [pathname])

  return null
}
