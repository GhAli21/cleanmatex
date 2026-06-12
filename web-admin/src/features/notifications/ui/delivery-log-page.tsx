'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import { CmxDataTable } from '@ui/data-display/cmx-datatable'
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms/cmx-select-dropdown'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'

const STATUS_OPTIONS = ['', 'QUEUED', 'PROCESSING', 'SENT', 'FAILED_TEMPORARY', 'FAILED_PERMANENT', 'SKIPPED', 'CANCELLED'] as const
const CHANNEL_OPTIONS = ['', 'IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH'] as const

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  SENT:             { bg: 'bg-green-100',  text: 'text-green-800' },
  DELIVERED:        { bg: 'bg-green-100',  text: 'text-green-800' },
  FAILED_PERMANENT: { bg: 'bg-red-100',    text: 'text-red-800' },
  FAILED_TEMPORARY: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  SKIPPED:          { bg: 'bg-gray-100',   text: 'text-gray-600' },
  QUEUED:           { bg: 'bg-blue-50',    text: 'text-blue-700' },
  PROCESSING:       { bg: 'bg-blue-100',   text: 'text-blue-800' },
  CANCELLED:        { bg: 'bg-gray-100',   text: 'text-gray-600' },
}

interface LogRow {
  id: string
  channel_code: string
  recipient_address: string | null
  event_code: string | null
  status: string
  skip_reason: string | null
  error_message: string | null
  retry_count: number
  scheduled_at: string
  sent_at: string | null
  created_at: string
}

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_BADGE[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })
}

export function DeliveryLogPage() {
  const t = useTranslations('notifications')

  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [channelFilter, setChannelFilter] = useState('')
  const [statusFilter, setStatusFilter]   = useState('')

  const fetchLog = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (channelFilter) params.set('channel_code', channelFilter)
      if (statusFilter)  params.set('status', statusFilter)
      const res = await fetch(`/api/v1/notifications/delivery-log?${params.toString()}`)
      const json = await res.json()
      if (json.success) {
        setRows(json.data)
        setTotalPages(json.pagination.totalPages)
      } else {
        setError(json.error ?? 'Error')
      }
    } catch {
      setError(t('deliveryLog.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [page, channelFilter, statusFilter, t])

  useEffect(() => { void fetchLog() }, [fetchLog])

  const columns: ColumnDef<LogRow>[] = [
    {
      accessorKey: 'event_code',
      header: t('deliveryLog.event'),
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.event_code ?? '—'}</span>,
    },
    {
      accessorKey: 'channel_code',
      header: t('deliveryLog.channel'),
      cell: ({ row }) => <span className="text-xs font-medium">{row.original.channel_code}</span>,
    },
    {
      accessorKey: 'recipient_address',
      header: t('deliveryLog.recipient'),
      cell: ({ row }) => {
        const addr = row.original.recipient_address
        if (!addr) return <span className="text-xs text-gray-400">—</span>
        return <span className="text-xs">{addr.length > 30 ? addr.slice(0, 27) + '…' : addr}</span>
      },
    },
    {
      accessorKey: 'status',
      header: t('deliveryLog.status'),
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'retry_count',
      header: t('deliveryLog.retries'),
      cell: ({ row }) => <span className="text-xs text-center block">{row.original.retry_count}</span>,
    },
    {
      accessorKey: 'created_at',
      header: t('deliveryLog.date'),
      cell: ({ row }) => <span className="text-xs whitespace-nowrap">{formatDate(row.original.created_at)}</span>,
    },
    {
      accessorKey: 'error_message',
      header: t('deliveryLog.error'),
      cell: ({ row }) => {
        const msg = row.original.error_message ?? row.original.skip_reason
        if (!msg) return <span className="text-xs text-gray-400">—</span>
        return <span className="text-xs text-red-600 line-clamp-1" title={msg}>{msg}</span>
      },
    },
  ]

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))] me-auto">
          {t('deliveryLog.title')}
        </h1>

        {/* Channel filter */}
        <CmxSelectDropdown
          value={channelFilter}
          onValueChange={(v) => { setChannelFilter(v); setPage(1) }}
        >
          <CmxSelectDropdownTrigger className="w-36 text-sm">
            {channelFilter || t('deliveryLog.allChannels')}
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {CHANNEL_OPTIONS.map((ch) => (
              <CmxSelectDropdownItem key={ch} value={ch}>
                {ch || t('deliveryLog.allChannels')}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        {/* Status filter */}
        <CmxSelectDropdown
          value={statusFilter}
          onValueChange={(v) => { setStatusFilter(v); setPage(1) }}
        >
          <CmxSelectDropdownTrigger className="w-44 text-sm">
            {statusFilter || t('deliveryLog.allStatuses')}
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {STATUS_OPTIONS.map((st) => (
              <CmxSelectDropdownItem key={st} value={st}>
                {st || t('deliveryLog.allStatuses')}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <CmxButton variant="outline" size="sm" onClick={() => void fetchLog()}>
          {t('deliveryLog.refresh')}
        </CmxButton>
      </div>

      {error && <CmxSummaryMessage type="error" title={error} items={[]} className="mb-4" />}

      <CmxDataTable
        columns={columns}
        data={rows}
        loading={loading}
        total={totalPages * 20}
        currentPage={page}
        onPageChange={setPage}
        emptyMessage={t('deliveryLog.empty')}
      />
    </div>
  )
}
