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
          className="h-6 w-6 text-gray-400"
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
      bgColor: 'bg-blue-500',
      lightBg: 'bg-blue-50',
    },
    {
      id: 'active',
      label: tSettings('activeUsers'),
      value: stats.active,
      icon: (
        <svg
          className="h-6 w-6 text-green-400"
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
      bgColor: 'bg-green-500',
      lightBg: 'bg-green-50',
      subtext: stats.inactive > 0 ? `${stats.inactive} ${tCommon('inactive')}` : null,
    },
    {
      id: 'admins',
      label: t('administrators'),
      value: stats.admins,
      icon: (
        <svg
          className="h-6 w-6 text-purple-400"
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
      bgColor: 'bg-purple-500',
      lightBg: 'bg-purple-50',
      subtext: `${t('operatorsCount', { count: stats.operators })}, ${t('viewersCount', { count: stats.viewers })}`,
    },
    {
      id: 'recent',
      label: t('recentLogins'),
      value: stats.recentLogins,
      icon: (
        <svg
          className="h-6 w-6 text-indigo-400"
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
      bgColor: 'bg-indigo-500',
      lightBg: 'bg-indigo-50',
      subtext: t('last7Days'),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className="relative bg-white pt-5 px-4 pb-4 sm:pt-6 sm:px-6 shadow rounded-lg overflow-hidden"
        >
          <dt>
            <div className={`absolute ${card.lightBg} rounded-md p-3`}>
              {card.icon}
            </div>
            <p className="ml-16 rtl:ml-0 rtl:mr-16 text-sm font-medium text-gray-500 truncate">
              {card.label}
            </p>
          </dt>
          <dd className="ml-16 rtl:ml-0 rtl:mr-16 pb-2 flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">{card.value}</p>
            {card.subtext && (
              <p className="ml-2 flex items-baseline text-xs text-gray-500">
                {card.subtext}
              </p>
            )}
          </dd>

          {/* Optional progress bar for active vs total */}
          {card.id === 'active' && stats.total > 0 && (
            <div className="mt-1 ml-16 rtl:ml-0 rtl:mr-16">
              <div className="w-full bg-gray-200 rounded-full h-1.5">
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
