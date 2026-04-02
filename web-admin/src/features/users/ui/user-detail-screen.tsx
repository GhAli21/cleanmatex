'use client'

/**
 * UserDetailScreen — Master user detail page.
 *
 * Fetches user from platform-api, then renders three tabs:
 *   "Profile"             → <UserProfileTab>
 *   "Roles & Permissions" → <UserRolesTab>
 *   "Activity"            → <UserActivityTab>
 *
 * Used by app/dashboard/users/[userId]/page.tsx as a 2-line wrapper.
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { fetchUser } from '@/lib/api/users'
import type { TenantUser } from '@/lib/api/users'
import { UserProfileTab } from './user-profile-tab'
import { UserRolesTab } from './rbac/user-roles-tab'
import { UserActivityTab } from './user-activity-tab'

type TabKey = 'profile' | 'roles' | 'activity'

export function UserDetailScreen() {
  const params = useParams()
  const userId = params?.userId as string
  const router = useRouter()
  const t = useTranslations('users.detail')
  const tCommon = useTranslations('common')

  const { currentTenant, session } = useAuth()
  const tenantId = currentTenant?.tenant_id ?? ''
  const accessToken = session?.access_token ?? ''

  const [user, setUser] = useState<TenantUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabKey>('profile')

  const loadUser = useCallback(async () => {
    if (!userId || !tenantId || !accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchUser(tenantId, userId, accessToken)
      setUser(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [userId, tenantId, accessToken, t])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  // ─── Loading skeleton ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-12 w-12 rounded-full border-2 border-[rgb(var(--cmx-primary-rgb,14_165_233))] border-t-transparent" />
      </div>
    )
  }

  // ─── Error state ────────────────────────────────────────────────────────
  if (error && !user) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/dashboard/users')}
          className="inline-flex items-center text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
        >
          <ArrowLeft className="h-4 w-4 me-1" />
          {t('backToUsers')}
        </button>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  // ─── Not found ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/dashboard/users')}
          className="inline-flex items-center text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
        >
          <ArrowLeft className="h-4 w-4 me-1" />
          {t('backToUsers')}
        </button>
        <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-8 text-center">
          <p className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('userNotFound')}
          </p>
        </div>
      </div>
    )
  }

  const initials = (user.display_name || user.email).charAt(0).toUpperCase()

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/dashboard/users')}
        className="inline-flex items-center text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
      >
        <ArrowLeft className="h-4 w-4 me-1" />
        {t('backToUsers')}
      </button>

      {/* User header */}
      <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-background-rgb,255_255_255))] p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-700 font-bold text-2xl">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))] truncate">
              {user.display_name || user.email}
            </h1>
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {user.email}
            </p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                {user.role}
              </span>
              <span
                className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {user.is_active ? tCommon('active') : tCommon('inactive')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]">
        <nav className="-mb-px flex space-x-8 rtl:space-x-reverse">
          {(
            [
              { key: 'profile', label: t('profileTab') },
              { key: 'roles', label: t('rolesPermissionsTab') },
              { key: 'activity', label: t('activityTab') },
            ] as { key: TabKey; label: string }[]
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === key
                  ? 'border-[rgb(var(--cmx-primary-rgb,14_165_233))] text-[rgb(var(--cmx-primary-rgb,14_165_233))]'
                  : 'border-transparent text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))] hover:border-[rgb(var(--cmx-border-rgb,226_232_240))]'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab panels */}
      {activeTab === 'profile' && (
        <UserProfileTab user={user} onUpdated={loadUser} accessToken={accessToken} />
      )}
      {activeTab === 'roles' && (
        <UserRolesTab userId={userId} userName={user.display_name ?? user.email} />
      )}
      {activeTab === 'activity' && (
        <UserActivityTab userId={userId} tenantId={tenantId} />
      )}
    </div>
  )
}
