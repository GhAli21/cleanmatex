/**
 * CmxPagination - Pagination controls for data tables
 * @module ui/navigation
 */

'use client'

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { CmxButton } from '../primitives/cmx-button'
import { CmxSelect } from '../primitives/cmx-select'

interface CmxPaginationProps {
  currentPage: number
  totalPages: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  pageSizeOptions?: number[]
  showPageSizeSelector?: boolean
  showInfo?: boolean
}

export function CmxPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  showPageSizeSelector = true,
  showInfo = true,
}: CmxPaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1
  const endItem = Math.min(currentPage * pageSize, totalItems)

  const getVisiblePages = () => {
    const delta = 2
    const range = []
    const rangeWithDots = []

    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i)
    }

    if (currentPage - delta > 2) {
      rangeWithDots.push(1, '...')
    } else {
      rangeWithDots.push(1)
    }

    rangeWithDots.push(...range)

    if (currentPage + delta < totalPages - 1) {
      rangeWithDots.push('...', totalPages)
    } else if (totalPages > 1) {
      rangeWithDots.push(totalPages)
    }

    return rangeWithDots
  }

  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-between gap-4 px-2 py-3">
      {/* Page size selector */}
      {showPageSizeSelector && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            Rows per page:
          </span>
          <CmxSelect
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(Number(value))}
            className="w-16"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size.toString()}>
                {size}
              </option>
            ))}
          </CmxSelect>
        </div>
      )}

      {/* Page info */}
      {showInfo && (
        <div className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
          {totalItems > 0 ? (
            <>
              {startItem}-{endItem} of {totalItems}
            </>
          ) : (
            'No items'
          )}
        </div>
      )}

      {/* Page navigation */}
      <div className="flex items-center gap-1">
        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
        >
          <ChevronsLeft className="h-4 w-4" />
        </CmxButton>

        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </CmxButton>

        <div className="flex items-center gap-1">
          {getVisiblePages().map((page, index) => (
            <div key={index}>
              {page === '...' ? (
                <span className="px-2 py-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
                  ...
                </span>
              ) : (
                <CmxButton
                  variant={page === currentPage ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onPageChange(page as number)}
                  className="h-8 w-8 p-0"
                >
                  {page}
                </CmxButton>
              )}
            </div>
          ))}
        </div>

        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </CmxButton>

        <CmxButton
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronsRight className="h-4 w-4" />
        </CmxButton>
      </div>
    </div>
  )
}