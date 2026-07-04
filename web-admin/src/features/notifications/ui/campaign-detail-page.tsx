'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Send, Ban, FlaskConical, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card'
import { CmxAuditInfoCard } from '@ui/data-display'
import { CmxSkeleton } from '@ui/primitives/cmx-skeleton'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type CampaignStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SCHEDULED'
  | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'FAILED' | 'CANCELLED'

type Campaign = {
  id:              string
  name:            string
  name2:           string | null
  description:     string | null
  description2:    string | null
  status:          CampaignStatus
  channel_code:    string
  template_code:   string | null
  scheduled_at:    string | null
  started_at:      string | null
  completed_at:    string | null
  cancelled_at:    string | null
  total_targets:   number
  sent_count:      number
  failed_count:    number
  skip_count:      number
  approved_by:     string | null
  approved_at:     string | null
  approval_notes:  string | null
  stats_breakdown: Record<string, number>
  failed_sample:   Array<{
    id:               string
    recipient_address: string | null
    status:           string
    skip_reason:      string | null
    processed_at:     string | null
  }>
  created_at:      string
}

type DetailResponse = { success: boolean; data: Campaign }

const TERMINAL_STATES = new Set(['COMPLETED', 'FAILED', 'CANCELLED'])

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, color = '' }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-card-rgb,255_255_255))] p-4 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{label}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

interface Props { id: string }

/**
 *
 * @param root0
 * @param root0.id
 */
export function CampaignDetailPage({ id }: Props) {
  const locale  = useLocale()
  const t       = useTranslations('notifications')
  const qc      = useQueryClient()

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const { data, isLoading, error: fetchError } = useQuery<DetailResponse>({
    queryKey: ['campaign', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/notifications/campaigns/${id}`)
      if (!res.ok) throw new Error('Failed to load campaign')
      return res.json()
    },
    enabled: Boolean(id),
  })

  const campaign = data?.data

  const transitionMutation = useMutation({
    mutationFn: async (status: string) => {
      const res = await fetch(`/api/v1/notifications/campaigns/${id}/status`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
    },
    onSuccess: (_, newStatus) => {
      setFeedback({ type: 'success', msg: t('campaigns.detail.transitioned', { status: newStatus }) })
      qc.invalidateQueries({ queryKey: ['campaign', id] })
      qc.invalidateQueries({ queryKey: ['campaigns'] })
    },
    onError: (err: Error) => setFeedback({ type: 'error', msg: err.message }),
  })

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/v1/notifications/campaigns/${id}/test`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Failed')
    },
    onSuccess: () => setFeedback({ type: 'success', msg: t('campaigns.detail.testSent') }),
    onError:   (err: Error) => setFeedback({ type: 'error', msg: err.message }),
  })

  const formatDate = useCallback((iso: string | null) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleString(locale === 'ar' ? 'ar' : 'en')
  }, [locale])

  // ── Skeleton ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <CmxSkeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <CmxSkeleton key={i} className="h-20 rounded-lg" />)}
        </div>
        <CmxSkeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (fetchError || !campaign) {
    return (
      <CmxSummaryMessage type="error" title={t('campaigns.detail.loadFailed')} items={[]} />
    )
  }

  const displayName        = locale === 'ar' && campaign.name2 ? campaign.name2 : campaign.name
  const displayDescription = locale === 'ar' && campaign.description2 ? campaign.description2 : campaign.description
  const isTerminal         = TERMINAL_STATES.has(campaign.status)
  const isMutable          = !isTerminal

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/dashboard/marketing/campaigns"
            className="mb-1 inline-flex items-center gap-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
            {t('campaigns.title')}
          </Link>
          <h1 className="text-xl font-semibold">{displayName}</h1>
          {displayDescription && (
            <p className="mt-0.5 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {displayDescription}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Test send */}
          {['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(campaign.status) && (
            <CmxButton
              variant="outline"
              size="sm"
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
            >
              {testMutation.isPending
                ? <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />
                : <FlaskConical className="me-1 h-3.5 w-3.5" />
              }
              {t('campaigns.detail.sendTest')}
            </CmxButton>
          )}

          {/* Submit for approval */}
          {campaign.status === 'DRAFT' && (
            <CmxButton
              size="sm"
              onClick={() => transitionMutation.mutate('PENDING_APPROVAL')}
              disabled={transitionMutation.isPending}
            >
              <Send className="me-1 h-3.5 w-3.5" />
              {t('campaigns.detail.submitApproval')}
            </CmxButton>
          )}

          {/* Approve */}
          {campaign.status === 'PENDING_APPROVAL' && (
            <CmxButton
              size="sm"
              onClick={() => transitionMutation.mutate('APPROVED')}
              disabled={transitionMutation.isPending}
            >
              <CheckCircle className="me-1 h-3.5 w-3.5" />
              {t('campaigns.detail.approve')}
            </CmxButton>
          )}

          {/* Launch immediately */}
          {campaign.status === 'APPROVED' && (
            <CmxButton
              size="sm"
              onClick={() => transitionMutation.mutate('RUNNING')}
              disabled={transitionMutation.isPending}
            >
              <Send className="me-1 h-3.5 w-3.5" />
              {t('campaigns.detail.launch')}
            </CmxButton>
          )}

          {/* Cancel */}
          {isMutable && (
            <CmxButton
              variant="destructive"
              size="sm"
              onClick={() => transitionMutation.mutate('CANCELLED')}
              disabled={transitionMutation.isPending}
            >
              <Ban className="me-1 h-3.5 w-3.5" />
              {t('campaigns.detail.cancel')}
            </CmxButton>
          )}
        </div>
      </div>

      {feedback && (
        <CmxSummaryMessage
          type={feedback.type}
          title={feedback.msg}
          items={[]}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('campaigns.detail.total')}   value={campaign.total_targets} />
        <StatCard label={t('campaigns.detail.sent')}    value={campaign.sent_count}    color="text-emerald-600" />
        <StatCard label={t('campaigns.detail.skipped')} value={campaign.skip_count}    color="text-amber-600" />
        <StatCard label={t('campaigns.detail.failed')}  value={campaign.failed_count}  color="text-red-600" />
      </div>

      {/* Details card */}
      <CmxCard>
        <CmxCardHeader className="pb-2">
          <h2 className="text-sm font-medium">{t('campaigns.detail.details')}</h2>
        </CmxCardHeader>
        <CmxCardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('campaigns.detail.status')}</dt>
              <dd className="mt-0.5 font-medium">{t(`campaigns.status.${campaign.status}`)}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('campaigns.detail.channel')}</dt>
              <dd className="mt-0.5 font-medium">{campaign.channel_code}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('campaigns.detail.scheduledAt')}</dt>
              <dd className="mt-0.5">{formatDate(campaign.scheduled_at)}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('campaigns.detail.startedAt')}</dt>
              <dd className="mt-0.5">{formatDate(campaign.started_at)}</dd>
            </div>
            <div>
              <dt className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('campaigns.detail.completedAt')}</dt>
              <dd className="mt-0.5">{formatDate(campaign.completed_at)}</dd>
            </div>
          </dl>
        </CmxCardContent>
      </CmxCard>

      <CmxAuditInfoCard createdAt={campaign.created_at} />

      {/* Failed / Skipped sample */}
      {campaign.failed_sample && campaign.failed_sample.length > 0 && (
        <CmxCard>
          <CmxCardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <h2 className="text-sm font-medium">{t('campaigns.detail.failedSample')}</h2>
            </div>
          </CmxCardHeader>
          <CmxCardContent className="p-0">
            <div className="divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
              {campaign.failed_sample.map(row => (
                <div key={row.id} className="flex items-start gap-3 px-4 py-2 text-sm">
                  <code className="flex-1 truncate font-mono text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {row.recipient_address ?? row.id}
                  </code>
                  <span className="shrink-0 text-xs text-red-600">{row.status}</span>
                  {row.skip_reason && (
                    <span className="shrink-0 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {row.skip_reason}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CmxCardContent>
        </CmxCard>
      )}
    </div>
  )
}
