'use client'

/**
 * Settings Layout Component
 *
 * Provides tabbed navigation for settings sections:
 * - General (business info, hours, locale)
 * - Branding (logo, colors, theme)
 * - Users (team management, invites)
 * - Subscription (plan, billing)
 *
 * Features:
 * - Tab navigation with active state
 * - Responsive design
 * - Bilingual support (EN/AR)
 * - RTL-aware layout
 */

import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  Settings,
  Palette,
  Users,
  CreditCard,
  Building2,
  Workflow,
  Shield,
  Navigation,
  DollarSign
} from 'lucide-react'

interface Tab {
  id: string
  label: string
  icon: React.ReactNode
  href: string
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const t = useTranslations('settings')
  const pathname = usePathname()
  const router = useRouter()

  const tabs: Tab[] = [
    {
      id: 'general',
      label: t('general'),
      icon: <Settings className="h-5 w-5" />,
      href: '/dashboard/settings/general'
    },
    {
      id: 'branding',
      label: t('branding'),
      icon: <Palette className="h-5 w-5" />,
      href: '/dashboard/settings/branding'
    },
    {
      id: 'users',
      label: t('users'),
      icon: <Users className="h-5 w-5" />,
      href: '/dashboard/settings/users'
    },
    {
      id: 'roles',
      label: t('rolesManagement', { defaultValue: 'Roles & Permissions' }),
      icon: <Shield className="h-5 w-5" />,
      href: '/dashboard/settings/roles'
    },
    {
      id: 'workflows',
      label: t('workflows'),
      icon: <Workflow className="h-5 w-5" />,
      href: '/dashboard/settings/workflows'
    },
    {
      id: 'subscription',
      label: t('subscription'),
      icon: <CreditCard className="h-5 w-5" />,
      href: '/dashboard/settings/subscription'
    },
    {
      id: 'finance',
      label: t('finance', { defaultValue: 'Finance' }),
      icon: <DollarSign className="h-5 w-5" />,
      href: '/dashboard/settings/finance'
    },
    {
      id: 'navigation',
      label: t('navigation', { defaultValue: 'Navigation' }),
      icon: <Navigation className="h-5 w-5" />,
      href: '/dashboard/settings/navigation'
    }
  ]

  const isActiveTab = (tabHref: string) => {
    return pathname === tabHref || pathname.startsWith(tabHref + '/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Building2 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('title')}
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {t('subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => {
              const active = isActiveTab(tab.href)
              return (
                <button
                  key={tab.id}
                  onClick={() => router.push(tab.href)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors
                    ${
                      active
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                  aria-current={active ? 'page' : undefined}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </div>
  )
}
