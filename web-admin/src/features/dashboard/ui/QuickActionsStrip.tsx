'use client'

/**
 * Quick Actions Strip Component
 *
 * Provides quick access to frequent actions:
 * - New Order
 * - Quick Search
 * - Common shortcuts
 *
 * Features:
 * - Responsive design
 * - Bilingual support (EN/AR)
 * - RTL-aware layout
 * - Keyboard shortcuts
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Search,
  FileText,
  Users,
  Settings,
  Package,
  TrendingUp,
  Clock
} from 'lucide-react'
import { useTranslations } from 'next-intl'

interface QuickAction {
  id: string
  label: string
  icon: React.ReactNode
  href?: string
  onClick?: () => void
  shortcut?: string
  variant?: 'primary' | 'secondary' | 'outline'
}

export function QuickActionsStrip() {
  const t = useTranslations('common')
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      // Navigate to search results page or open search modal
      router.push(`/dashboard/search?q=${encodeURIComponent(searchQuery)}`)
    }
  }

  const quickActions: QuickAction[] = [
    {
      id: 'new-order',
      label: t('newOrder'),
      icon: <Plus className="h-5 w-5" />,
      href: '/dashboard/orders/new',
      shortcut: 'Ctrl+N',
      variant: 'primary'
    },
    {
      id: 'orders',
      label: t('orders'),
      icon: <FileText className="h-5 w-5" />,
      href: '/dashboard/orders',
      variant: 'outline'
    },
    {
      id: 'customers',
      label: t('customers'),
      icon: <Users className="h-5 w-5" />,
      href: '/dashboard/customers',
      variant: 'outline'
    },
    {
      id: 'reports',
      label: t('reports'),
      icon: <TrendingUp className="h-5 w-5" />,
      href: '/dashboard/reports',
      variant: 'outline'
    },
    {
      id: 'settings',
      label: t('settings'),
      icon: <Settings className="h-5 w-5" />,
      href: '/dashboard/settings',
      variant: 'outline'
    }
  ]

  const handleActionClick = (action: QuickAction) => {
    if (action.onClick) {
      action.onClick()
    } else if (action.href) {
      router.push(action.href)
    }
  }

  const getButtonStyles = (variant: QuickAction['variant']) => {
    const base = 'flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2'

    switch (variant) {
      case 'primary':
        return `${base} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 shadow-sm hover:shadow`
      case 'secondary':
        return `${base} bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500`
      case 'outline':
      default:
        return `${base} bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-gray-400 focus:ring-blue-500`
    }
  }

  return (
    <div className="bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Left: Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                className={getButtonStyles(action.variant)}
                title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
              >
                {action.icon}
                <span className="hidden sm:inline">{action.label}</span>
                {action.shortcut && (
                  <span className="hidden xl:inline text-xs text-gray-500 ml-2 px-1.5 py-0.5 bg-gray-100 rounded">
                    {action.shortcut}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right: Quick Search */}
          <form onSubmit={handleSearch} className="flex-1 lg:flex-initial lg:w-80">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('quickSearch')}
                className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
