'use client'

/**
 * UserProfileTab — Displays user profile information with edit capability.
 *
 * Sections:
 *   - Two-column info grid: display_name, email, phone, role, status, type, area/building/floor
 *   - Stats row: last_login_at, login_count, member_since
 *   - "Edit Profile" button → opens UserModal in edit mode
 */

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Pencil, User } from 'lucide-react'
import { CmxButton } from '@ui/primitives/cmx-button'
import type { TenantUser } from '@/lib/api/users'
import UserModal from './user-modal'

interface UserProfileTabProps {
  user: TenantUser
  /** Callback when profile is successfully updated */
  onUpdated: () => void
  accessToken: string
}

export function UserProfileTab({ user, onUpdated, accessToken }: UserProfileTabProps) {
  const t = useTranslations('users.detail')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const [editOpen, setEditOpen] = useState(false)

  const formatDate = (date: string | null | undefined) => {
    if (!date) return t('never') as string
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
      {/* Profile info card */}
      <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" />
            <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {t('profileTab')}
            </h3>
          </div>
          <CmxButton size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5 me-1.5" />
            {tCommon('edit')}
          </CmxButton>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
          <InfoRow label={t('displayName')} value={user.display_name ?? '—'} />
          <InfoRow label={tCommon('email')} value={user.email} />
          {user.phone && <InfoRow label={t('phone')} value={user.phone} />}
          <InfoRow
            label={t('role')}
            value={
              <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                {user.role}
              </span>
            }
          />
          <InfoRow
            label={tCommon('status')}
            value={
              <span
                className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {user.is_active ? tCommon('active') : tCommon('inactive')}
              </span>
            }
          />
          {user.first_name && (
            <InfoRow label={t('firstName')} value={user.first_name} />
          )}
          {user.last_name && (
            <InfoRow label={t('lastName')} value={user.last_name} />
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('lastLogin')} value={formatDate(user.last_login_at)} />
        <StatCard label={t('loginCount')} value={String(user.login_count)} />
        <StatCard label={t('memberSince')} value={formatDate(user.created_at)} />
      </div>

      {/* Edit modal */}
      {editOpen && (
        <UserModal
          user={user}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false)
            onUpdated()
          }}
          accessToken={accessToken}
        />
      )}
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string | React.ReactNode
  value: string | React.ReactNode
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{value}</dd>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
      <p className="text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
        {value}
      </p>
    </div>
  )
}
