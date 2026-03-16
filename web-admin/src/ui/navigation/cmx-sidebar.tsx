'use client'

/**
 * CmxSidebar - Sidebar navigation component
 * Role-based menu filtering, responsive, collapsible on desktop, keyboard navigation
 * @module ui/navigation
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { ChevronDown, ChevronRight, Menu, X, PanelLeftClose, PanelLeft } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useRTL } from '@/lib/hooks/useRTL'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { useSidebar } from '@/lib/context/sidebar-context'
import {
  isPathActive,
  type NavigationSection,
  type UserRole,
} from '@/config/navigation'
import {
  getCachedFeatureFlags,
  setCachedFeatureFlags,
} from '@/lib/cache/permission-cache-client'
import { getIcon } from '@/lib/utils/icon-registry'
import { Tooltip } from '@ui/primitives'

/** Section key → icon name when API/DB does not provide a valid icon */
const SECTION_ICON_FALLBACK: Record<string, string> = {
  home: 'Home',
  orders: 'PackageSearch',
  assembly: 'ScanBarcode',
  drivers: 'Truck',
  delivery: 'Truck',
  users: 'Users',
  customers: 'Users',
  catalog: 'Tags',
  billing: 'Receipt',
  reports: 'BarChart3',
  inventory: 'Boxes',
  settings: 'Settings',
  help: 'LifeBuoy',
  jhtestui: 'Bug',
}

/** Child key → icon name for sub-menu items */
const CHILD_ICON_FALLBACK: Record<string, string> = {
  orders_list: 'ClipboardList',
  orders_new: 'PlusCircle',
  orders_preparation: 'List',
  orders_processing: 'Loader2',
  orders_assembly: 'ScanBarcode',
  orders_qa: 'CheckCircle',
  orders_ready: 'CircleCheck',
  orders_packing: 'Box',
  orders_delivery: 'Truck',
  drivers_list: 'Users',
  drivers_routes: 'Truck',
  catalog_services: 'Tags',
  catalog_pricing: 'Tags',
  catalog_addons: 'Tags',
  billing_invoices: 'Receipt',
  billing_vouchers: 'Receipt',
  billing_payments: 'Receipt',
  billing_cashup: 'Receipt',
  reports_orders: 'BarChart3',
  reports_payments: 'Receipt',
  reports_invoices: 'Receipt',
  reports_revenue: 'BarChart3',
  reports_customers: 'Users',
  inventory_stock: 'Boxes',
  inventory_machines: 'Boxes',
  settings_general: 'Settings',
  settings_users: 'Users',
  settings_roles: 'Settings2',
  settings_permissions: 'Settings2',
  settings_workflow_roles: 'ClipboardCheck',
  settings_branding: 'Settings',
  settings_subscription: 'Receipt',
  settings_all: 'Settings',
  users_list: 'Users',
}

export default function CmxSidebar() {
  const pathname = usePathname()
  const { currentTenant } = useAuth()
  const isRTL = useRTL()
  const { isCollapsed, toggleCollapse, prefersReducedMotion } = useSidebar()
  const t = useTranslations('layout.sidebar')
  const tNav = useTranslations('navigation')
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({})
  const [hoverSectionKey, setHoverSectionKey] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { navigation, isLoading: navigationLoading } = useNavigation()
  const userRole = currentTenant?.user_role?.toLowerCase() as UserRole | undefined

  useEffect(() => {
    async function loadFeatureFlags() {
      if (!currentTenant) {
        setFeatureFlags({})
        return
      }
      try {
        const cached = getCachedFeatureFlags(currentTenant.tenant_id)
        if (cached) setFeatureFlags(cached)
      } catch (error) {
        console.error('Error loading feature flags:', error)
        if (!getCachedFeatureFlags(currentTenant.tenant_id)) setFeatureFlags({})
      }
    }
    loadFeatureFlags()
  }, [currentTenant])

  const getSectionIcon = (section: NavigationSection) => {
    const fromApi =
      typeof section.icon === 'function'
        ? section.icon
        : typeof section.icon === 'string'
          ? getIcon(section.icon)
          : null
    if (fromApi && typeof fromApi === 'function') return fromApi
    const fallbackName = SECTION_ICON_FALLBACK[section.key] ?? 'Home'
    return getIcon(fallbackName)
  }

  const getChildIcon = (childKey: string) => {
    const name = CHILD_ICON_FALLBACK[childKey]
    return name ? getIcon(name) : getIcon('List')
  }

  /** Format plan code for display (e.g. FREE_TRIAL -> "Free Trial", starter -> "Starter") */
  const formatPlanDisplay = (planCode: string | undefined): string => {
    if (!planCode) return 'Free Trial'
    const normalized = planCode.toLowerCase().replace(/_/g, ' ')
    return normalized
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const getNavLabel = (key: string, fallback: string): string => {
    const translationKeyMap: Record<string, string> = {
      'home': 'dashboard',
      'orders': 'orders', 'orders_list': 'allOrders', 'orders_new': 'newOrder',
      'orders_preparation': 'preparation', 'orders_processing': 'processing',
      'orders_assembly': 'assembly', 'orders_qa': 'qualityCheck', 'orders_ready': 'ready',
      'orders_packing': 'packing', 'orders_delivery': 'delivery',
      'assembly': 'assembly', 'drivers': 'driversAndRoutes',
      'drivers_list': 'allDrivers', 'drivers_routes': 'routes', 'customers': 'customers',
      'catalog': 'catalog', 'catalog_services': 'services', 'catalog_pricing': 'pricing',
      'catalog_addons': 'addons', 'billing': 'invoicesAndPayments', 'billing_invoices': 'invoices',
      'billing_vouchers': 'receiptVouchers', 'billing_payments': 'payments', 'billing_cashup': 'cashUp',
      'reports': 'reportsAndAnalytics', 'inventory': 'inventoryAndMachines', 'inventory_stock': 'stock',
      'inventory_machines': 'machines', 'settings': 'settings', 'settings_general': 'general',
      'settings_users': 'teamMembers', 'settings_roles': 'rolesAndPermissions',
      'settings_workflow_roles': 'workflowRoles', 'settings_branding': 'branding',
      'settings_subscription': 'subscription', 'settings_all': 'allSettings', 'help': 'help', 'jhtestui': 'jwtTest',
      'delivery': 'delivery', 'users': 'users', 'users_list': 'teamMembers',
      'reports_orders': 'reportsAndAnalytics', 'reports_payments': 'payments', 'reports_invoices': 'invoices',
      'reports_revenue': 'reportsAndAnalytics', 'reports_customers': 'customers',
      'settings_permissions': 'rolesAndPermissions',
    }
    const translationKey = translationKeyMap[key]
    if (translationKey) {
      try { return tNav(translationKey) } catch { return fallback }
    }
    return fallback
  }

  const filteredNavigation = useMemo(() => {
    const isFeatureEnabled = (flag: string | undefined) => {
      if (!flag) return true
      if (!(flag in featureFlags)) return true
      return featureFlags[flag] === true
    }
    return navigation
      .filter((section) => isFeatureEnabled(section.featureFlag))
      .map((section) => {
        if (section.children) {
          const filteredChildren = section.children.filter((child) =>
            isFeatureEnabled(child.featureFlag)
          )
          return { ...section, children: filteredChildren }
        }
        return section
      })
  }, [navigation, featureFlags])

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

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
    const isDifferent =
      keysToExpand.size !== expandedSections.size ||
      [...keysToExpand].some((k) => !expandedSections.has(k))
    if (isDifferent) setExpandedSections(keysToExpand)
  }, [pathname, filteredNavigation])

  useEffect(() => setIsMobileOpen(false), [pathname])

  useEffect(() => {
    if (isMobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [isMobileOpen])

  // Keyboard shortcut: Ctrl/Cmd + B toggles sidebar (desktop only)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault()
        toggleCollapse()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleCollapse])

  const handleFlyoutEnter = useCallback((key: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    setHoverSectionKey(key)
  }, [])

  const handleFlyoutLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setHoverSectionKey(null), 120)
  }, [])

  useEffect(() => () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
  }, [])

  return (
    <>
      <div className={`lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center ${isRTL ? 'flex-row-reverse' : 'justify-between'}`}>
        <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
          <button
            type="button"
            className="text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md p-2"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <span className={`${isRTL ? 'mr-3' : 'ml-3'} text-lg font-semibold text-gray-900`}>CleanMateX</span>
        </div>
      </div>

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        dir="ltr"
        role="navigation"
        aria-label={t('navLabel')}
        className={`
          fixed top-0 bottom-0 z-40 bg-gray-50 border-gray-200 flex flex-col shadow-sm
          ${prefersReducedMotion ? '' : 'transition-[transform,width] duration-300 ease-in-out'}
          ${isRTL ? 'right-0 border-l' : 'left-0 border-r'}
          w-64 lg:translate-x-0
          ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
          ${isMobileOpen ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')}
        `}
        style={isRTL ? { left: 'auto', right: 0 } : { right: 'auto', left: 0 }}
      >
        <div className={`pt-4 pb-3 border-b border-gray-200 bg-white flex-shrink-0 overflow-hidden ${isCollapsed ? 'px-2 lg:px-2' : 'px-4 lg:px-4'} ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link
            href="/dashboard"
            className={`flex items-center min-w-0 ${isCollapsed ? 'lg:justify-center' : ''} ${isRTL ? 'flex-row-reverse space-x-reverse' : 'space-x-2'}`}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">C</span>
            </div>
            <div className={`min-w-0 overflow-hidden ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="block text-xl font-bold text-gray-900 truncate whitespace-nowrap">CleanMateX</span>
              {currentTenant && (
                <span className="block text-xs text-gray-500 font-medium mt-0.5 truncate whitespace-nowrap">
                  {t('currentPlan')}: {formatPlanDisplay(currentTenant.s_current_plan)}
                </span>
              )}
            </div>
          </Link>
        </div>

        {currentTenant && !isCollapsed && (
          <div className="px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">{t('currentTenant')}</div>
            <div className="mt-1 text-sm font-semibold text-gray-900 line-clamp-1 break-words">{currentTenant.tenant_name}</div>
            <div className="mt-0.5 text-xs text-gray-600">{t('role')}: {currentTenant.user_role}</div>
          </div>
        )}

        <div className={`flex-shrink-0 border-b border-gray-200 px-2 py-2 ${isCollapsed ? 'lg:px-1' : 'lg:px-2'}`}>
          <button
            type="button"
            onClick={toggleCollapse}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            className={`hidden lg:flex w-full items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${isCollapsed ? 'lg:justify-center' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {isCollapsed ? (
              <PanelLeft className="h-5 w-5" />
            ) : (
              <>
                <PanelLeftClose className="h-5 w-5" />
                <span>{t('collapseSidebar')}</span>
              </>
            )}
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto min-h-0 py-3 flex-shrink min-w-0 ${isCollapsed ? 'px-1' : 'px-2'}`}>
          {navigationLoading ? (
            <div className="px-3 py-4">
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filteredNavigation.map((section) => {
                const SectionIcon = getSectionIcon(section)
                const isActive = isPathActive(pathname, section.path)
                const hasChildren = section.children && section.children.length > 0
                const label = getNavLabel(section.key, section.label)

                if (isCollapsed && hasChildren) {
                  const showFlyout = hoverSectionKey === section.key
                  return (
                    <li
                      key={section.key}
                      className="relative"
                      onMouseEnter={() => handleFlyoutEnter(section.key)}
                      onMouseLeave={handleFlyoutLeave}
                    >
                      <button
                        type="button"
                        aria-haspopup="true"
                        aria-expanded={showFlyout}
                        aria-label={label}
                        className={`w-full flex items-center justify-center px-2 py-2.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                          isActive
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'text-gray-700 hover:bg-white hover:shadow-sm border border-transparent'
                        }`}
                      >
                        <SectionIcon className="h-5 w-5 flex-shrink-0 text-current opacity-90" />
                      </button>
                      {showFlyout && (
                        <div
                          className={`absolute top-0 z-50 min-w-48 py-1 bg-white rounded-lg shadow-lg border border-gray-200 ${
                            isRTL ? 'right-full' : 'left-full'
                          }`}
                          role="menu"
                          aria-label={label}
                        >
                          <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {label}
                          </div>
                          <ul className="space-y-0.5 py-1" role="group">
                            {section.children!.map((child) => {
                              const ChildIcon = getChildIcon(child.key)
                              const childActive = pathname === child.path
                              return (
                                <li key={child.key} role="none">
                                  <Link
                                    href={child.path}
                                    role="menuitem"
                                    className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg mx-1 transition-colors ${
                                      childActive
                                        ? 'bg-blue-100 text-blue-800 font-medium'
                                        : 'text-gray-600 hover:bg-gray-50'
                                    } ${isRTL ? 'flex-row-reverse' : ''}`}
                                  >
                                    <ChildIcon className="h-4 w-4 flex-shrink-0 opacity-80" />
                                    <span className="truncate">{getNavLabel(child.key, child.label)}</span>
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </li>
                  )
                }

                if (isCollapsed && !hasChildren) {
                  return (
                    <li key={section.key}>
                      <Tooltip content={label} side={isRTL ? 'left' : 'right'}>
                        <Link
                          href={section.path}
                          aria-label={label}
                          className={`w-full flex items-center justify-center px-2 py-2.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                            isActive
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'text-gray-700 hover:bg-white hover:shadow-sm border border-transparent'
                          }`}
                        >
                          <SectionIcon className="h-5 w-5 flex-shrink-0 text-current opacity-90" />
                        </Link>
                      </Tooltip>
                    </li>
                  )
                }

                return (
                  <li key={section.key}>
                    {hasChildren ? (
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleSection(section.key)}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 gap-2 ${
                            isActive
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'text-gray-700 hover:bg-white hover:shadow-sm border border-transparent'
                          } ${isRTL ? 'flex-row-reverse' : ''}`}
                        >
                          <div className={`flex items-center min-w-0 gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                            <SectionIcon className="h-5 w-5 flex-shrink-0 text-current opacity-90" />
                            <span className="truncate">{label}</span>
                          </div>
                          {expandedSections.has(section.key) ? (
                            <ChevronDown className={`h-4 w-4 flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                          ) : (
                            <ChevronRight className={`h-4 w-4 flex-shrink-0 ${isRTL ? 'rotate-180' : ''}`} />
                          )}
                        </button>
                        {expandedSections.has(section.key) && (
                          <ul className="mt-0.5 ms-2 space-y-0.5 border-s border-gray-200 ps-2">
                            {section.children!.map((child) => {
                              const ChildIcon = getChildIcon(child.key)
                              const childActive = pathname === child.path
                              return (
                                <li key={child.key}>
                                  <Link
                                    href={child.path}
                                    className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors duration-150 ${
                                      childActive
                                        ? 'bg-blue-100 text-blue-800 font-medium border border-blue-200'
                                        : 'text-gray-600 hover:bg-white hover:shadow-sm border border-transparent'
                                    } ${isRTL ? 'flex-row-reverse' : ''}`}
                                  >
                                    <ChildIcon className="h-4 w-4 flex-shrink-0 opacity-80" />
                                    <span className="truncate">{getNavLabel(child.key, child.label)}</span>
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <Link
                        href={section.path}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
                          isActive
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'text-gray-700 hover:bg-white hover:shadow-sm border border-transparent'
                        } ${isRTL ? 'flex-row-reverse' : ''}`}
                      >
                        <SectionIcon className="h-5 w-5 flex-shrink-0 text-current opacity-90" />
                        <span className="truncate flex-1">{label}</span>
                        {section.badge && (
                          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800">
                            {section.badge}
                          </span>
                        )}
                      </Link>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </nav>

        <div className={`border-t border-gray-200 flex-shrink-0 ${isCollapsed ? 'p-2' : 'p-4'}`}>
          <div className="text-xs text-gray-500 text-center">CleanMateX v1.0</div>
        </div>
      </aside>
    </>
  )
}
