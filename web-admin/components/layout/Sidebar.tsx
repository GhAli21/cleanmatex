'use client'

/**
 * Sidebar Navigation Component
 *
 * Features:
 * - Role-based menu filtering
 * - Feature flag integration
 * - Responsive (collapsible on mobile)
 * - Keyboard navigation support
 * - Active route highlighting
 */

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useRTL } from '@/lib/hooks/useRTL'
import { useNavigation } from '@/lib/hooks/use-navigation'
import {
  isPathActive,
  type NavigationSection,
  type UserRole,
  NAVIGATION_SECTIONS,
} from '@/config/navigation'
import {
  getCachedFeatureFlags,
  setCachedFeatureFlags,
} from '@/lib/cache/permission-cache-client'

export default function Sidebar() {
  const pathname = usePathname()
  const { currentTenant, user } = useAuth()
  const isRTL = useRTL()
  const t = useTranslations('layout.sidebar')
  const tNav = useTranslations('navigation')
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})

  // Fetch navigation from API (with caching and fallback)
  const { navigation, isLoading: navigationLoading } = useNavigation()

  // Get user role from current tenant (no default role)
  const userRole = currentTenant?.user_role?.toLowerCase() as UserRole | undefined

  // Fetch feature flags from tenant with caching
  useEffect(() => {
    async function loadFeatureFlags() {
      if (!currentTenant) {
        setFeatureFlags({})
        return
      }

      try {
        // Check cache first
        const cached = getCachedFeatureFlags(currentTenant.tenant_id)
        if (cached) {
          setFeatureFlags(cached)
        }

        // Fetch fresh data from API
        // TEMPORARILY DISABLED
        // const response = await fetch('/api/feature-flags')
        // if (response.ok) {
        //   const flags = await response.json()
        //   setFeatureFlags(flags)
        //   // Cache the result
        //   setCachedFeatureFlags(currentTenant.tenant_id, flags)
        // } else if (!cached) {
        //   // If API fails and no cache, use safe defaults
        //   console.warn('Failed to fetch feature flags, using defaults')
        //   setFeatureFlags({})
        // }
      } catch (error) {
        console.error('Error loading feature flags:', error)
        // If error and no cache, use empty object (all features disabled)
        if (!getCachedFeatureFlags(currentTenant.tenant_id)) {
          setFeatureFlags({})
        }
      }
    }
    loadFeatureFlags()
  }, [currentTenant])

  // Helper function to get translated navigation label
  const getNavLabel = (key: string, fallback: string): string => {
    const translationKeyMap: Record<string, string> = {
      'home': 'dashboard',
      //'orders': 'orders',
      //'orders_list': 'allOrders',
      //'orders_new': 'newOrder',
      //'orders_preparation': 'preparation',
      //'orders_processing': 'processing',
      //'orders_assembly': 'assembly',
      //'orders_qa': 'qualityCheck',
      //'orders_ready': 'ready',
      'assembly': 'assembly',
      'drivers': 'driversAndRoutes',
      'drivers_list': 'allDrivers',
      'drivers_routes': 'routes',
      'customers': 'customers',
      'catalog': 'catalog',
      'catalog_services': 'services',
      'catalog_pricing': 'pricing',
      'catalog_addons': 'addons',
      'billing': 'invoicesAndPayments',
      'billing_invoices': 'invoices',
      'billing_payments': 'payments',
      'billing_cashup': 'cashUp',
      'reports': 'reportsAndAnalytics',
      'inventory': 'inventoryAndMachines',
      'inventory_stock': 'stock',
      'inventory_machines': 'machines',
      'settings': 'settings',
      'settings_general': 'general',
      'settings_users': 'teamMembers',
      'settings_roles': 'rolesAndPermissions',
      'settings_workflow_roles': 'workflowRoles',
      'settings_branding': 'branding',
      'settings_subscription': 'subscription',
      'help': 'help',
      'jhtestui': 'jwtTest',
    }
    
    const translationKey = translationKeyMap[key]
    if (translationKey) {
      try {
        return tNav(translationKey)
      } catch {
        return fallback
      }
    }
    return fallback
  }

  // Navigation is already filtered by API, but we can apply additional client-side filtering if needed
  // For now, use navigation directly from API (it's already filtered by permissions)
  const filteredNavigation = useMemo(() => {
    // Only hide by feature flag when we have explicit flag data (key present and false).
    // When feature flags are not loaded (e.g. API disabled), show all API-returned sections.
    const isFeatureEnabled = (flag: string | undefined) => {
      if (!flag) return true
      if (!(flag in featureFlags)) return true // no data = show
      return featureFlags[flag] === true
    }
    return navigation
      .filter((section) => isFeatureEnabled(section.featureFlag))
      .map((section) => {
        // Filter children by feature flags without mutating the original
        if (section.children) {
          const filteredChildren = section.children.filter((child) =>
            isFeatureEnabled(child.featureFlag)
          )
          // Return new section object with filtered children
          return {
            ...section,
            children: filteredChildren,
          }
        }
        // Return section as-is if no children
        return section
      })
  }, [navigation, featureFlags])

  // Toggle section expansion
  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  // Auto-expand active section without causing infinite updates
  useEffect(() => {
    const keysToExpand = new Set<string>()
    filteredNavigation.forEach((section) => {
      if (section.children) {
        const hasActiveChild = section.children.some((child) =>
          isPathActive(pathname, child.path)
        )
        if (hasActiveChild) keysToExpand.add(section.key)
      }
    })

    // Only update state if it actually changes
    const isDifferent =
      keysToExpand.size !== expandedSections.size ||
      [...keysToExpand].some((k) => !expandedSections.has(k))
    if (isDifferent) {
      setExpandedSections(keysToExpand)
    }
    // Note: expandedSections is intentionally omitted from dependencies to prevent infinite loop
    // We only read it for comparison, not to trigger re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, filteredNavigation])

  // Close mobile menu on navigation
  useEffect(() => {
    setIsMobileOpen(false)
  }, [pathname])

  // Prevent scroll when mobile menu is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileOpen])

  return (
    <>
      {/* Mobile Menu Button - RTL aware */}
      <div className={`lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-2"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label="Toggle menu"
          >
            {isMobileOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
          <span className={`${isRTL ? 'mr-3' : 'ml-3'} text-lg font-semibold text-gray-900`}>
            CleanMateX
          </span>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - RTL aware positioning */}
      <aside
        className={`
          fixed top-0 bottom-0 z-40 w-64 bg-white border-gray-200
          transition-transform duration-300 ease-in-out
          flex flex-col
          ${isRTL ? 'right-0 border-l' : 'left-0 border-r'}
          lg:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
        `}
        style={{
          ...(isRTL ? { left: 'auto', right: 0 } : { right: 'auto', left: 0 }),
        }}
      >
        {/* Logo - RTL aware */}
        <div className={`h-16 flex items-center px-6 border-b border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link href="/dashboard" className={`flex items-center ${isRTL ? 'flex-row-reverse space-x-reverse' : 'space-x-2'}`}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <span className="text-xl font-bold text-gray-900">CleanMateX</span>
          </Link>
        </div>

        {/* Tenant Info */}
        {currentTenant && (
          <div className="px-4 py-3 bg-blue-50 border-b border-gray-200">
            <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">
              {t('currentTenant')}
            </div>
            <div className="mt-1 text-sm font-semibold text-gray-900 line-clamp-1 break-words">
              {currentTenant.tenant_name}
            </div>
            <div className="mt-0.5 text-xs text-gray-600">
              {t('role')}: {currentTenant.user_role}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto min-h-0 px-3 py-4">
          {navigationLoading ? (
            <div className="px-3 py-4">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-1">
              {filteredNavigation.map((section) => (
              <li key={section.key}>
                {section.children && section.children.length > 0 ? (
                  // Section with children (collapsible)
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleSection(section.key)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md
                        transition-colors duration-150
                        ${
                          isPathActive(pathname, section.path)
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }
                      `}
                    >
                      <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                        {typeof section.icon === 'function' ? (
                          <section.icon className={`h-5 w-5 ${isRTL ? 'ml-3' : 'mr-3'} flex-shrink-0`} />
                        ) : (
                          <span className={`h-5 w-5 ${isRTL ? 'ml-3' : 'mr-3'} flex-shrink-0`}>📁</span>
                        )}
                        <span>{getNavLabel(section.key, section.label)}</span>
                      </div>
                      {expandedSections.has(section.key) ? (
                        <ChevronDown className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                      ) : (
                        <ChevronRight className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
                      )}
                    </button>

                    {/* Children - RTL aware indentation */}
                    {expandedSections.has(section.key) && (
                      <ul className={`mt-1 ${isRTL ? 'mr-9' : 'ml-9'} space-y-1`}>
                        {section.children.map((child) => (
                          <li key={child.key}>
                            <Link
                              href={child.path}
                              className={`
                                block px-3 py-2 text-sm rounded-md
                                transition-colors duration-150
                                ${
                                  pathname === child.path
                                    ? 'bg-blue-50 text-blue-700 font-medium'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                }
                              `}
                            >
                              {getNavLabel(child.key, child.label)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : (
                  // Simple link
                  <Link
                    href={section.path}
                    className={`
                      flex items-center px-3 py-2 text-sm font-medium rounded-md
                      transition-colors duration-150
                      ${
                        isPathActive(pathname, section.path)
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }
                    `}
                    >
                    {typeof section.icon === 'function' ? (
                      <section.icon className={`h-5 w-5 ${isRTL ? 'ml-3' : 'mr-3'} flex-shrink-0`} />
                    ) : (
                      <span className={`h-5 w-5 ${isRTL ? 'ml-3' : 'mr-3'} flex-shrink-0`}>📁</span>
                    )}
                    <span>{getNavLabel(section.key, section.label)}</span>
                    {section.badge && (
                      <span className={`${isRTL ? 'mr-auto' : 'ml-auto'} inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800`}>
                        {section.badge}
                      </span>
                    )}
                  </Link>
                )}
              </li>
              ))}
            </ul>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="text-xs text-gray-500 text-center">
            CleanMateX v1.0
          </div>
        </div>
      </aside>
    </>
  )
}
