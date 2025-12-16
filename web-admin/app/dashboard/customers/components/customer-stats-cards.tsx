/**
 * PRD-003: Customer Statistics Cards
 * Displays customer metrics in card format
 */

'use client'

import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import type { CustomerStatistics } from '@/lib/types/customer'

interface CustomerStatsCardsProps {
  stats: CustomerStatistics
}

export default function CustomerStatsCards({ stats }: CustomerStatsCardsProps) {
  const t = useTranslations('customers')
  const isRTL = useRTL()
  
  const cards = [
    {
      title: t('totalCustomers'),
      value: stats.total.toLocaleString(),
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      ),
      bgColor: 'bg-blue-500',
    },
    {
      title: t('fullProfiles'),
      value: stats.byType.full.toLocaleString(),
      subtitle: `${((stats.byType.full / stats.total) * 100).toFixed(1)}% ${t('ofTotal')}`,
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
          />
        </svg>
      ),
      bgColor: 'bg-green-500',
    },
    {
      title: t('stubProfiles'),
      value: stats.byType.stub.toLocaleString(),
      subtitle: `${((stats.byType.stub / stats.total) * 100).toFixed(1)}% ${t('ofTotal')}`,
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
      bgColor: 'bg-yellow-500',
    },
    {
      title: t('newThisMonth'),
      value: stats.newThisMonth.toLocaleString(),
      subtitle: t('recentlyAdded'),
      icon: (
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
          />
        </svg>
      ),
      bgColor: 'bg-purple-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">
                {card.value}
              </p>
              {card.subtitle && (
                <p className="mt-1 text-xs text-gray-500">{card.subtitle}</p>
              )}
            </div>
            <div className={`p-3 rounded-lg ${card.bgColor} text-white`}>
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
