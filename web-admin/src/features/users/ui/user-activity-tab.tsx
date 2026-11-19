'use client'

/**
 * UserActivityTab — Two sections:
 *   1. Effective Permissions — grouped by resource prefix, badge list per group
 *   2. Audit Log — last 20 entries via GET /api/users/[userId]/activity (audit:read, tenant-scoped)
 */

import { useEffect, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Check, Activity } from 'lucide-react'
import { useEffectivePermissions } from '@/lib/hooks/use-user-role-assignments'

interface UserActivityTabProps {
  userId: string
  tenantId: string
}

interface AuditEntry {
  id: string
  action: string
  action_label?: string
  action_label2?: string | null
  outcome?: string
  entity_type: string | null
  created_at: string
  ip_address: string | null
}

// Color categories for permission prefixes
const CATEGORY_COLORS: Record<string, string> = {
  orders: 'bg-info-bg text-info-text',
  customers: 'bg-info-bg text-info-text',
  inventory: 'bg-warning-bg text-warning-text',
  users: 'bg-info-bg text-info-text',
  settings: 'bg-muted text-foreground',
  reports: 'bg-success-bg text-success-text',
  workflow: 'bg-warning-bg text-warning-text',
  branches: 'bg-info-bg text-info-text',
  billing: 'bg-danger-bg text-danger-text',
}

function getPermColor(resource: string): string {
  return CATEGORY_COLORS[resource] ?? 'bg-muted text-foreground'
}

interface UserAuditLogTableProps {
  userId: string
  tenantId: string
  formatDate: (date: string) => string
}

type AuditLoad = { state: 'loading' } | { state: 'error' } | { state: 'ready'; rows: AuditEntry[] }

function UserAuditLogTable({ userId, tenantId, formatDate }: UserAuditLogTableProps) {
  const t = useTranslations('users.detail')
  const locale = useLocale()
  const [load, setLoad] = useState<AuditLoad>({ state: 'loading' })

  useEffect(() => {
    let cancelled = false
    // The auth audit trail is service-role only; the API route enforces audit:read + tenant membership.
    fetch(`/api/users/${encodeURIComponent(userId)}/activity`, { credentials: 'same-origin' })
      .then(async (res): Promise<AuditLoad> => {
        if (!res.ok) return { state: 'error' }
        const body = (await res.json()) as { data?: AuditEntry[] }
        return { state: 'ready', rows: body.data ?? [] }
      })
      .catch((): AuditLoad => ({ state: 'error' }))
      .then((result) => {
        if (!cancelled) setLoad(result)
      })
    return () => {
      cancelled = true
    }
  }, [userId, tenantId])

  if (load.state === 'loading') {
    return (
      <div className="flex items-center justify-center h-24" aria-busy="true">
        <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (load.state === 'error') {
    return (
      <div className="rounded-lg border border-danger-border bg-danger-bg p-4 text-sm text-danger-text" role="alert">
        {t('activityLoadFailed')}
      </div>
    )
  }

  if (load.rows.length === 0) {
    return (
      <div className="rounded-lg border border-border p-8 text-center">
        <p className="text-sm text-muted-foreground">{t('activityEmpty')}</p>
      </div>
    )
  }

  const headerClass =
    'px-4 py-2.5 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider'

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-secondary">
          <tr>
            <th className={headerClass}>{t('activityColumns.event')}</th>
            <th className={headerClass}>{t('activityColumns.device')}</th>
            <th className={headerClass}>{t('activityColumns.ip')}</th>
            <th className={headerClass}>{t('activityColumns.date')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {load.rows.map((entry) => {
            const label = (locale === 'ar' && entry.action_label2) || entry.action_label || entry.action
            const flagged = entry.outcome && entry.outcome !== 'SUCCESS' ? entry.outcome : null
            return (
              <tr key={entry.id} className="hover:bg-secondary">
                <td className="px-4 py-3 text-sm text-foreground">
                  <span>{label}</span>
                  {entry.action && entry.action !== label ? (
                    <span className="ms-2 text-xs text-muted-foreground">{entry.action}</span>
                  ) : null}
                  {flagged ? (
                    <span className="ms-2 rounded bg-danger-bg px-1.5 py-0.5 text-xs text-danger-text">{t(`activityOutcome.${flagged}`)}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {entry.entity_type ?? '—'}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                  {entry.ip_address ?? '—'}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDate(entry.created_at)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/**
 *
 * @param root0
 * @param root0.userId
 * @param root0.tenantId
 */
export function UserActivityTab({ userId, tenantId }: UserActivityTabProps) {
  const t = useTranslations('users.detail')
  const locale = useLocale()

  const { permissions, loading: permsLoading } = useEffectivePermissions(userId)

  // Group permissions by resource prefix (before the colon)
  const grouped = permissions.reduce<Record<string, string[]>>((acc, perm) => {
    const [resource] = perm.split(':')
    const key = resource ?? 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(perm)
    return acc
  }, {})

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Effective Permissions */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            {t('effectivePermissions')} ({permissions.length})
          </h3>
          <span className="text-xs text-muted-foreground bg-secondary border border-border rounded px-2 py-0.5">
            {t('computedFromRoles')}
          </span>
        </div>

        {permsLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : permissions.length === 0 ? (
          <div className="rounded-lg border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {t('noEffectivePermissions')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([resource, perms]) => (
                <div
                  key={resource}
                  className="rounded-lg border border-border overflow-hidden"
                >
                  <div className="bg-secondary px-3 py-1.5 border-b border-border">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      {resource}
                    </h4>
                  </div>
                  <div className="p-3 flex flex-wrap gap-1.5">
                    {perms.sort().map((perm) => (
                      <span
                        key={perm}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium ${getPermColor(resource)}`}
                      >
                        <Check className="h-3 w-3" />
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Section 2: Audit Log — keyed child remounts on user/tenant so fetch has no sync setState in effect */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">
            {t('activityRecent', { count: 20 })}
          </h3>
        </div>

        {userId && tenantId ? (
          <UserAuditLogTable
            key={`${userId}-${tenantId}`}
            userId={userId}
            tenantId={tenantId}
            formatDate={formatDate}
          />
        ) : null}
      </div>
    </div>
  )
}
