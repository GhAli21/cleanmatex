'use client'

/**
 * UserActivityTab — Two sections:
 *   1. Effective Permissions — grouped by resource prefix, badge list per group
 *   2. Audit Log — last 20 entries from sys_audit_log filtered by user_id + tenant_org_id
 */

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Check, Activity } from 'lucide-react'
import { useEffectivePermissions } from '@/lib/hooks/use-user-role-assignments'
import { useAuth } from '@/lib/auth/auth-context'
import { supabase } from '@/lib/supabase/client'

interface UserActivityTabProps {
  userId: string
  tenantId: string
}

interface AuditEntry {
  id: string
  action: string
  entity_type: string | null
  created_at: string
  ip_address: string | null
}

// Color categories for permission prefixes
const CATEGORY_COLORS: Record<string, string> = {
  orders: 'bg-blue-100 text-blue-700',
  customers: 'bg-purple-100 text-purple-700',
  inventory: 'bg-orange-100 text-orange-700',
  users: 'bg-pink-100 text-pink-700',
  settings: 'bg-gray-100 text-gray-700',
  reports: 'bg-green-100 text-green-700',
  workflow: 'bg-yellow-100 text-yellow-700',
  branches: 'bg-indigo-100 text-indigo-700',
  billing: 'bg-red-100 text-red-700',
}

function getPermColor(resource: string): string {
  return CATEGORY_COLORS[resource] ?? 'bg-slate-100 text-slate-700'
}

export function UserActivityTab({ userId, tenantId }: UserActivityTabProps) {
  const t = useTranslations('users.detail')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { session } = useAuth()

  const { permissions, loading: permsLoading } = useEffectivePermissions(userId)

  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [auditLoading, setAuditLoading] = useState(false)

  // Fetch audit log from Supabase — sys_audit_log filtered by user_id + tenant_org_id
  useEffect(() => {
    if (!userId || !tenantId) return
    setAuditLoading(true)
    supabase
      .from('sys_audit_log')
      .select('id, action, entity_type, created_at, ip_address')
      .eq('user_id', userId)
      .eq('tenant_org_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (!error && data) setAuditLog(data as AuditEntry[])
      })
      .finally(() => setAuditLoading(false))
  }, [userId, tenantId])

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
          <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
            {t('effectivePermissions')} ({permissions.length})
          </h3>
          <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] border border-[rgb(var(--cmx-border-rgb,226_232_240))] rounded px-2 py-0.5">
            {t('computedFromRoles')}
          </span>
        </div>

        {permsLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-[rgb(var(--cmx-primary-rgb,14_165_233))] border-t-transparent" />
          </div>
        ) : permissions.length === 0 ? (
          <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-8 text-center">
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
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
                  className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] overflow-hidden"
                >
                  <div className="bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] px-3 py-1.5 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
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

      {/* Section 2: Audit Log */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" />
          <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
            {t('activityTab')} (last 20)
          </h3>
        </div>

        {auditLoading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin h-6 w-6 rounded-full border-2 border-[rgb(var(--cmx-primary-rgb,14_165_233))] border-t-transparent" />
          </div>
        ) : auditLog.length === 0 ? (
          <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-8 text-center">
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {tCommon('loading')}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] overflow-hidden">
            <table className="min-w-full divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
              <thead className="bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]">
                <tr>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                    Entity
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                    IP
                  </th>
                  <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]">
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] px-1.5 py-0.5 rounded text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {entry.entity_type ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {entry.ip_address ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {formatDate(entry.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
