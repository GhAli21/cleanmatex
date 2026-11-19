'use client'

/**
 * User Stats Cards Component
 *
 * Displays user statistics in card format
 */

import { useTranslations } from 'next-intl'
import type { UserStats } from '@/lib/api/users'

interface UserStatsCardsProps {
  stats: UserStats
}

/**
 *
 * @param root0
 * @param root0.stats
 */
export default function UserStatsCards({ stats }: UserStatsCardsProps) {
  const t = useTranslations('users.stats')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')

  const cards = [
    {
      id: 'total',
      label: t('totalUsers'),
      value: stats.total,
      icon: (
        <svg
          className="h-6 w-6 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ),
      color: 'blue',
      bgColor: 'bg-primary',
      lightBg: 'bg-info-bg',
    },
    {
      id: 'active',
      label: tSettings('activeUsers'),
      value: stats.active,
      icon: (
        <svg
          className="h-6 w-6 text-success-text"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: 'green',
      bgColor: 'bg-success',
      lightBg: 'bg-success-bg',
      subtext: stats.inactive > 0 ? `${stats.inactive} ${tCommon('inactive')}` : null,
    },
    {
      id: 'admins',
      label: t('administrators'),
      value: stats.admins,
      icon: (
        <svg
          className="h-6 w-6 text-primary-text"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ),
      color: 'purple',
      bgColor: 'bg-primary',
      lightBg: 'bg-info-bg',
      subtext: `${t('operatorsCount', { count: stats.operators })}, ${t('viewersCount', { count: stats.viewers })}`,
    },
    {
      id: 'recent',
      label: t('recentLogins'),
      value: stats.recentLogins,
      icon: (
        <svg
          className="h-6 w-6 text-primary-text"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      color: 'indigo',
      bgColor: 'bg-primary',
      lightBg: 'bg-info-bg',
      subtext: t('last7Days'),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className="relative bg-card pt-5 px-4 pb-4 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden"
        >
          <dt>
            <div className={`absolute ${card.lightBg} rounded-md p-3`}>
              {card.icon}
            </div>
            <p className="ms-16 text-sm font-medium text-muted-foreground truncate">
              {card.label}
            </p>
          </dt>
          <dd className="ms-16 pb-2 flex items-baseline">
            <p className="text-2xl font-semibold text-foreground">{card.value}</p>
            {card.subtext && (
              <p className="ms-2 flex items-baseline text-xs text-muted-foreground">
                {card.subtext}
              </p>
            )}
          </dd>

          {/* Optional progress bar for active vs total */}
          {card.id === 'active' && stats.total > 0 && (
            <div className="mt-1 ms-16">
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className={`${card.bgColor} h-1.5 rounded-full`}
                  style={{ width: `${(stats.active / stats.total) * 100}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
