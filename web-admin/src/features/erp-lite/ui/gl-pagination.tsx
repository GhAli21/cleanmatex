'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { formatErpLiteNumber } from '@features/erp-lite/lib/display-format'
import { CmxButton } from '@ui/primitives'

interface GlPaginationProps {
  page: number
  pageSize: number
  total: number
}

const PAGE_SIZES = [25, 50, 100] as const

/**
 * URL-driven pagination bar for the GL Inquiry screen.
 * @param root0
 * @param root0.page
 * @param root0.pageSize
 * @param root0.total
 */
export function GlPagination({ page, pageSize, total }: GlPaginationProps) {
  const tCommon = useTranslations('common')
  const t = useTranslations('erpLite.reports')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const navigate = (nextPage: number, nextSize?: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(nextPage))
    if (nextSize) params.set('pageSize', String(nextSize))
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-surface px-4 py-3">
      {/* Row count & page size selector */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span>
          {formatErpLiteNumber(from, locale)}–{formatErpLiteNumber(to, locale)} {tCommon('of')} {formatErpLiteNumber(total, locale)}
        </span>
        <span className="text-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">|</span>
        <span>{t('gl.pagination.rowsPerPage')}:</span>
        {PAGE_SIZES.map((size) => (
          <button
            key={size}
            onClick={() => navigate(1, size)}
            disabled={isPending}
            className={`h-6 rounded px-2 text-xs transition ${
              size === pageSize
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            }`}
          >
            {size}
          </button>
        ))}
      </div>

      {/* Page navigator */}
      <div className="flex items-center gap-1">
        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => navigate(1)}
          disabled={page <= 1 || isPending}
          aria-label={t('gl.pagination.first')}
          className="h-8 w-8 p-0"
        >
          <ChevronsLeft className="h-4 w-4 rtl:rotate-180" />
        </CmxButton>
        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => navigate(page - 1)}
          disabled={page <= 1 || isPending}
          aria-label={t('gl.pagination.prev')}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </CmxButton>

        <span className="min-w-[80px] text-center text-sm text-foreground">
          {formatErpLiteNumber(page, locale)} / {formatErpLiteNumber(totalPages, locale)}
        </span>

        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => navigate(page + 1)}
          disabled={page >= totalPages || isPending}
          aria-label={t('gl.pagination.next')}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </CmxButton>
        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => navigate(totalPages)}
          disabled={page >= totalPages || isPending}
          aria-label={t('gl.pagination.last')}
          className="h-8 w-8 p-0"
        >
          <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
        </CmxButton>
      </div>
    </div>
  )
}
