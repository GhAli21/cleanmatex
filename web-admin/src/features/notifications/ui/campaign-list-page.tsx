'use client'

import { useState, useCallback } from 'react'
import { Plus, Send, Ban, Clock, CheckCircle, AlertCircle, Pause, XCircle } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card'
import { CmxSkeleton } from '@ui/primitives/cmx-skeleton'
import { CmxEmptyState } from '@ui/data-display/cmx-empty-state'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'
import { CmxTabsPanel } from '@ui/navigation/cmx-tabs-panel'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { useAuth } from '@/lib/auth/auth-context'
import { CampaignCreateForm } from './campaign-create-form'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CampaignStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED'
  | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'FAILED' | 'CANCELLED'

type Campaign = {
  id:             string
  name:           string
  name2:          string | null
  status:         CampaignStatus
  channel_code:   string
  scheduled_at:   string | null
  started_at:     string | null
  completed_at:   string | null
  total_targets:  number
  sent_count:     number
  failed_count:   number
  skip_count:     number
  created_at:     string
}

type PaginatedResponse = {
  success:    boolean
  data:       Campaign[]
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

type StatusFilter = 'ALL' | CampaignStatus

const STATUS_FILTERS: StatusFilter[] = [
  'ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RUNNING', 'COMPLETED', 'CANCELLED',
]

// ─────────────────────────────────────────────────────────────────────────────
// Status badge
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CampaignStatus, { color: string; Icon: typeof Send }> = {
  DRAFT:            { color: 'text-gray-500 bg-gray-100',    Icon: Clock },
  PENDING_APPROVAL: { color: 'text-amber-600 bg-amber-50',   Icon: Clock },
  APPROVED:         { color: 'text-blue-600 bg-blue-50',     Icon: CheckCircle },
  SCHEDULED:        { color: 'text-indigo-600 bg-indigo-50', Icon: Clock },
  RUNNING:          { color: 'text-emerald-600 bg-emerald-50', Icon: Send },
  COMPLETED:        { color: 'text-green-700 bg-green-100',  Icon: CheckCircle },
  PAUSED:           { color: 'text-amber-700 bg-amber-100',  Icon: Pause },
  FAILED:           { color: 'text-red-600 bg-red-50',       Icon: AlertCircle },
  CANCELLED:        { color: 'text-gray-500 bg-gray-100',    Icon: XCircle },
}

function StatusBadge({ status, t }: { status: CampaignStatus; t: (k: string) => string }) {
  const cfg = STATUS_CONFIG[status]
  const Icon = cfg.Icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {t(`campaigns.status.${status}`)}
    </span>
  )
}

const CHANNEL_LABELS: Record<string, { en: string; ar: string }> = {
  IN_APP:   { en: 'In-App',   ar: 'داخل التطبيق' },
  EMAIL:    { en: 'Email',    ar: 'البريد الإلكتروني' },
  SMS:      { en: 'SMS',      ar: 'رسائل SMS' },
  WHATSAPP: { en: 'WhatsApp', ar: 'واتساب' },
  PUSH:     { en: 'Push',     ar: 'إشعارات الدفع' },
}

// ─────────────────────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ total, sent, failed, skipped }: { total: number; sent: number; failed: number; skipped: number }) {
  if (total === 0) return <div className="h-1.5 w-full rounded-full bg-gray-100" />
  const sentPct    = Math.min(100, (sent    / total) * 100)
  const failedPct  = Math.min(100 - sentPct, (failed  / total) * 100)
  const skippedPct = Math.min(100 - sentPct - failedPct, (skipped / total) * 100)
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-100" title={`${sent}/${total} sent`}>
      <div className="absolute start-0 top-0 h-full bg-emerald-500" style={{ width: `${sentPct}%` }} />
      <div className="absolute top-0 h-full bg-red-400"     style={{ insetInlineStart: `${sentPct}%`, width: `${failedPct}%` }} />
      <div className="absolute top-0 h-full bg-gray-300"    style={{ insetInlineStart: `${sentPct + failedPct}%`, width: `${skippedPct}%` }} />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Row skeleton
// ─────────────────────────────────────────────────────────────────────────────

function CampaignRowSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <div className="flex-1 space-y-2">
        <CmxSkeleton className="h-4 w-48" />
        <CmxSkeleton className="h-3 w-32" />
      </div>
      <CmxSkeleton className="h-5 w-20 rounded-full" />
      <CmxSkeleton className="h-3 w-16" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main list page
// ─────────────────────────────────────────────────────────────────────────────

export function CampaignListPage() {
  const locale     = useLocale()
  const t          = useTranslations('notifications')
  const qc         = useQueryClient()
  const { currentTenant } = useAuth()
  const tenantId   = currentTenant?.tenant_id ?? ''

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [page, setPage]                 = useState(1)
  const [createOpen, setCreateOpen]     = useState(false)
  const [error, setError]               = useState<string | null>(null)

  const queryKey = ['campaigns', tenantId, statusFilter, page]

  const { data, isLoading } = useQuery<PaginatedResponse>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (statusFilter !== 'ALL') params.set('status', statusFilter)
      const res = await fetch(`/api/v1/notifications/campaigns?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      return res.json()
    },
    enabled: Boolean(tenantId),
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/notifications/campaigns/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to cancel')
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', tenantId] }),
    onError:   (err: Error) => setError(err.message),
  })

  const handleCreated = useCallback(() => {
    setCreateOpen(false)
    qc.invalidateQueries({ queryKey: ['campaigns', tenantId] })
  }, [qc, tenantId])

  const campaigns    = data?.data ?? []
  const pagination   = data?.pagination
  const totalPages   = pagination?.totalPages ?? 1

  const tabs = STATUS_FILTERS.map(s => ({
    id:    s,
    label: s === 'ALL' ? t('campaigns.filter.all') : t(`campaigns.status.${s}`),
  }))

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('campaigns.title')}</h1>
        <CmxButton
          size="sm"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="me-1 h-4 w-4" />
          {t('campaigns.create')}
        </CmxButton>
      </div>

      {error && (
        <CmxSummaryMessage type="error" title={error} onDismiss={() => setError(null)} />
      )}

      {/* Status filter tabs */}
      <CmxTabsPanel
        tabs={tabs}
        activeTab={statusFilter}
        onTabChange={v => { setStatusFilter(v as StatusFilter); setPage(1) }}
      />

      {/* Campaign list */}
      <CmxCard>
        <CmxCardContent className="p-0">
          {isLoading && (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => <CampaignRowSkeleton key={i} />)}
            </div>
          )}

          {!isLoading && campaigns.length === 0 && (
            <CmxEmptyState
              title={t('campaigns.empty')}
              description={t('campaigns.emptyDesc')}
            />
          )}

          {!isLoading && campaigns.length > 0 && (
            <div className="divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
              {campaigns.map(c => {
                const channelLabel = locale === 'ar'
                  ? CHANNEL_LABELS[c.channel_code]?.ar
                  : CHANNEL_LABELS[c.channel_code]?.en
                const displayName = locale === 'ar' && c.name2 ? c.name2 : c.name

                return (
                  <div key={c.id} className="flex items-center gap-4 px-4 py-3">
                    {/* Name + meta */}
                    <div className="min-w-0 flex-1">
                      <a
                        href={`/dashboard/marketing/campaigns/${c.id}`}
                        className="font-medium text-[rgb(var(--cmx-foreground-rgb))] hover:underline"
                      >
                        {displayName}
                      </a>
                      <p className="mt-0.5 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                        {channelLabel}
                        {c.total_targets > 0 && (
                          <> · {c.sent_count}/{c.total_targets} {t('campaigns.sent')}</>
                        )}
                      </p>
                      {c.total_targets > 0 && (
                        <div className="mt-1.5 max-w-xs">
                          <ProgressBar
                            total={c.total_targets}
                            sent={c.sent_count}
                            failed={c.failed_count}
                            skipped={c.skip_count}
                          />
                        </div>
                      )}
                    </div>

                    {/* Status */}
                    <StatusBadge status={c.status} t={t} />

                    {/* Actions */}
                    <div className="flex shrink-0 gap-1">
                      {!['COMPLETED', 'FAILED', 'CANCELLED'].includes(c.status) && (
                        <CmxButton
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelMutation.mutate(c.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </CmxButton>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CmxCardContent>
      </CmxCard>

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <CmxButton
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
          >
            {t('center.prevPage')}
          </CmxButton>
          <span className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {page} / {totalPages}
          </span>
          <CmxButton
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
          >
            {t('center.nextPage')}
          </CmxButton>
        </div>
      )}

      {/* Create campaign dialog */}
      <CmxDialog open={createOpen} onOpenChange={setCreateOpen}>
        <CmxDialogContent className="max-w-lg">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('campaigns.createTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          <CampaignCreateForm onSuccess={handleCreated} onCancel={() => setCreateOpen(false)} />
        </CmxDialogContent>
      </CmxDialog>
    </div>
  )
}
