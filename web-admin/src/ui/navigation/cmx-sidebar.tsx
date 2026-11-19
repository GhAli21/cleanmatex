'use client'
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */

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
import { useFeatureFlagsQuery } from '@/lib/hooks/use-feature-flags'
import {
  isPathActive,
  type NavigationSection,
  type UserRole,
} from '@/config/navigation'
import { getIcon } from '@/lib/utils/icon-registry'
import { useTenantBrand } from '@/lib/theme/tenant-brand'
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
  config_settings: 'Settings2',
  settings: 'Settings',
  tenant_admin: 'Building2',
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
  catalog_speed_pricing: 'Tags',
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
  settings_branding: 'Palette',
  tenant_admin_subscription: 'CreditCard',
  settings_all: 'Settings',
  settings_preferences: 'Users',
  settings_finance: 'DollarSign',
  settings_payments: 'CreditCard',
  settings_workflows: 'Workflow',
  users_list: 'Users',
}

/** Fallback i18n key map — used only for hardcoded navigation.ts items (super_admin / tenant_admin
 *  fallback path) that have no label2 from the DB. DB-sourced items bypass this entirely. */
const NAV_TRANSLATION_KEY_MAP: Record<string, string> = {
  home: 'dashboard',
  orders: 'orders',
  orders_list: 'allOrders',
  orders_new: 'newOrder',
  orders_preparation: 'preparation',
  orders_processing: 'processing',
  orders_assembly: 'assembly',
  orders_qa: 'qualityCheck',
  orders_ready: 'ready',
  orders_packing: 'packing',
  orders_delivery: 'delivery',
  assembly: 'assembly',
  drivers: 'driversAndRoutes',
  drivers_list: 'allDrivers',
  drivers_routes: 'routes',
  delivery: 'delivery',
  users: 'users',
  users_list: 'teamMembers',
  customers: 'customers',
  catalog: 'catalog',
  catalog_services: 'services',
  catalog_pricing: 'pricing',
  catalog_speed_pricing: 'speedPricing',
  catalog_addons: 'addons',
  billing: 'invoicesAndPayments',
  billing_invoices: 'invoices',
  billing_vouchers: 'receiptVouchers',
  billing_payments: 'payments',
  billing_cashup: 'cashUp',
  reports: 'reportsAndAnalytics',
  reports_orders: 'reportsAndAnalytics',
  reports_payments: 'payments',
  reports_invoices: 'invoices',
  reports_revenue: 'reportsAndAnalytics',
  reports_customers: 'customers',
  inventory: 'inventoryAndMachines',
  inventory_stock: 'stock',
  inventory_machines: 'machines',
  config_settings: 'configAndSettings',
  settings: 'settings',
  settings_general: 'general',
  settings_users: 'teamMembers',
  settings_roles: 'rolesAndPermissions',
  settings_permissions: 'rolesAndPermissions',
  settings_branding: 'branding',
  tenant_admin: 'tenantAdmin',
  tenant_admin_subscription: 'subscription',
  settings_all: 'allSettings',
  settings_preferences: 'userPreferences',
  settings_finance: 'settingsFinance',
  settings_payments: 'paymentSetup',
  settings_workflows: 'workflows',
  erp_lite: 'financeAndAccounting',
  erp_lite_coa: 'chartOfAccounts',
  erp_lite_gl: 'generalLedger',
  erp_lite_reports: 'financialReports',
  erp_lite_ar: 'arAging',
  erp_lite_expenses: 'expenses',
  erp_lite_bank_recon: 'bankReconciliation',
  erp_lite_ap: 'accountsPayable',
  erp_lite_po: 'purchaseOrders',
  erp_lite_branch_pl: 'branchPL',
  internal_fin: 'internalFinanceOps',
  finance_vouchers: 'businessVouchers',
  finance_vouchers_new: 'newVoucher',
  finance_vouchers_reports: 'voucherReports',
  help: 'help',
  jhtestui: 'jwtTest',
}

export default function CmxSidebar() {
  const pathname = usePathname()
  const { currentTenant } = useAuth()
  const isRTL = useRTL()
  const { isCollapsed, toggleCollapse, prefersReducedMotion } = useSidebar()
  const t = useTranslations('layout.sidebar')
  const tNav = useTranslations('navigation')
  const brand = useTenantBrand()
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [hoverSectionKey, setHoverSectionKey] = useState<string | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { navigation, isLoading: navigationLoading } = useNavigation()
  const userRole = currentTenant?.user_role?.toLowerCase() as UserRole | undefined
  const { data: featureFlags = {} } = useFeatureFlagsQuery({
    enabled: Boolean(currentTenant?.tenant_id),
  })

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

  const getNavLabel = (key: string, label: string, label2?: string): string => {
    // Priority 1: DB Arabic label when in RTL mode
    if (isRTL && label2) return label2

    // Priority 2: DB English label — use it directly when it's a real value.
    // The service falls back to comp_code when label is null, so skip if label === key.
    if (label && label !== key) return label

    // Priority 3: i18n translation map — safety net for hardcoded navigation.ts
    // fallback items (super_admin / tenant_admin path) that have no label2.
    const translationKey = NAV_TRANSLATION_KEY_MAP[key]
    if (translationKey) {
      try { return tNav(translationKey) } catch { /* fall through */ }
    }

    return label || key
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

  // Sections holding the active route, serialized with the pathname so the
  // comparison below is by value (filteredNavigation is not referentially stable).
  const activeSectionsSignature = useMemo(() => {
    const activeKeys = filteredNavigation
      .filter((section) =>
        section.children?.some((child) => isPathActive(pathname, child.path))
      )
      .map((section) => section.key)
    return JSON.stringify([pathname, activeKeys])
  }, [pathname, filteredNavigation])

  // Adjust state during render on route change instead of in an effect
  // (react-hooks/set-state-in-effect): expand active sections, close mobile drawer.
  const [syncedSignature, setSyncedSignature] = useState<string | null>(null)
  const [syncedPathname, setSyncedPathname] = useState(pathname)
  if (activeSectionsSignature !== syncedSignature) {
    setSyncedSignature(activeSectionsSignature)
    const [, activeKeys] = JSON.parse(activeSectionsSignature) as [string, string[]]
    setExpandedSections(new Set(activeKeys))
  }
  if (pathname !== syncedPathname) {
    setSyncedPathname(pathname)
    setIsMobileOpen(false)
  }

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
      <div className="lg:hidden fixed top-0 start-0 end-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded-md p-2"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label="Toggle menu"
          >
            {isMobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <span className="ms-3 text-lg font-semibold text-foreground">{brand.name}</span>
        </div>
      </div>

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside
        role="navigation"
        aria-label={t('navLabel')}
        className={`
          fixed top-0 bottom-0 z-40 bg-muted border-border flex flex-col shadow-sm
          ${prefersReducedMotion ? '' : 'transition-[transform,width] duration-300 ease-in-out'}
          start-0 border-e
          w-64
          ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
          ${isMobileOpen ? 'translate-x-0' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full'}
        `}
      >
        <div className={`pt-4 pb-3 border-b border-border bg-card flex-shrink-0 overflow-hidden ${isCollapsed ? 'px-2 lg:px-2' : 'px-4 lg:px-4'} `}>
          <Link
            href="/dashboard"
            prefetch={false}
            className={`flex items-center min-w-0 ${isCollapsed ? 'lg:justify-center' : ''} space-x-2`}
          >
            {brand.logoUrl ? (
              // Organization logo (File Util public storage), decorative: the name is next to it.
              <img src={brand.logoUrl} alt="" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-primary-foreground font-bold text-lg">{brand.name.charAt(0)}</span>
              </div>
            )}
            <div className={`min-w-0 overflow-hidden ${isCollapsed ? 'lg:hidden' : ''}`}>
              <span className="block text-xl font-bold text-foreground truncate whitespace-nowrap">{brand.name}</span>
              {currentTenant && (
                <span className="block text-xs text-muted-foreground font-medium mt-0.5 truncate whitespace-nowrap">
                  {t('currentPlan')}: {formatPlanDisplay(currentTenant.s_current_plan)}
                </span>
              )}
            </div>
          </Link>
        </div>

        {currentTenant && !isCollapsed && (
          <div className="px-4 py-3 bg-card border-b border-border flex-shrink-0">
            <div className="text-xs font-medium text-primary-text uppercase tracking-wide">{t('currentTenant')}</div>
            <div className="mt-1 text-sm font-semibold text-foreground line-clamp-1 break-words">{currentTenant.tenant_name}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{t('role')}: {currentTenant.user_role}</div>
          </div>
        )}

        <div className={`flex-shrink-0 border-b border-border px-2 py-2 ${isCollapsed ? 'lg:px-1' : 'lg:px-2'}`}>
          <button
            type="button"
            onClick={toggleCollapse}
            aria-expanded={!isCollapsed}
            aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
            className={`hidden lg:flex w-full items-center justify-center gap-2 py-2 px-3 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${isCollapsed ? 'lg:justify-center' : ''} `}
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
                  <div key={i} className="h-10 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </div>
          ) : (
            <ul className="space-y-0.5">
              {filteredNavigation.map((section) => {
                const SectionIcon = getSectionIcon(section)
                const isActive = isPathActive(pathname, section.path)
                const hasChildren = section.children && section.children.length > 0
                const label = getNavLabel(section.key, section.label, section.label2)

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
                        className={`w-full flex items-center justify-center px-2 py-2.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                          isActive
                            ? 'bg-info-bg text-info-text border border-info-border'
                            : 'text-muted-foreground hover:bg-card hover:shadow-sm border border-transparent'
                        }`}
                      >
                        <SectionIcon className="h-5 w-5 flex-shrink-0 text-current opacity-90" />
                      </button>
                      {showFlyout && (
                        <div
                          className={`absolute top-0 z-50 min-w-48 py-1 bg-card rounded-lg shadow-lg border border-border ${
                            'start-full'
                          }`}
                          role="menu"
                          aria-label={label}
                        >
                          <div className="px-3 py-2 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {label}
                          </div>
                          <ul className="space-y-0.5 py-1" role="group">
                            {section.children!.map((child) => {
                              const ChildIcon = getChildIcon(child.key)
                              const childActive = isPathActive(pathname, child.path)
                              return (
                                <li key={child.key} role="none">
                                  <Link
                                    href={child.path}
                                    prefetch={false}
                                    role="menuitem"
                                    className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg mx-1 transition-colors ${
                                      childActive
                                        ? 'bg-info-bg text-info-text font-medium'
                                        : 'text-muted-foreground hover:bg-muted'
                                    } `}
                                  >
                                    <ChildIcon className="h-4 w-4 flex-shrink-0 opacity-80" />
                                    <span className="truncate">{getNavLabel(child.key, child.label, child.label2)}</span>
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
                          prefetch={false}
                          aria-label={label}
                          className={`w-full flex items-center justify-center px-2 py-2.5 text-sm font-medium rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
                            isActive
                              ? 'bg-info-bg text-info-text border border-info-border'
                              : 'text-muted-foreground hover:bg-card hover:shadow-sm border border-transparent'
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
                              ? 'bg-info-bg text-info-text border border-info-border'
                              : 'text-muted-foreground hover:bg-card hover:shadow-sm border border-transparent'
                          } `}
                        >
                          <div className="flex items-center min-w-0 gap-3">
                            <SectionIcon className="h-5 w-5 flex-shrink-0 text-current opacity-90" />
                            <span className="truncate">{label}</span>
                          </div>
                          {expandedSections.has(section.key) ? (
                            <ChevronDown className="h-4 w-4 flex-shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 flex-shrink-0 rtl:rotate-180" />
                          )}
                        </button>
                        {expandedSections.has(section.key) && (
                          <ul className="mt-0.5 ms-2 space-y-0.5 border-s border-border ps-2">
                            {section.children!.map((child) => {
                              const ChildIcon = getChildIcon(child.key)
                              const childActive = isPathActive(pathname, child.path)
                              return (
                                <li key={child.key}>
                                  <Link
                                    href={child.path}
                                    prefetch={false}
                                    className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors duration-150 ${
                                      childActive
                                        ? 'bg-info-bg text-info-text font-medium border border-info-border'
                                        : 'text-muted-foreground hover:bg-card hover:shadow-sm border border-transparent'
                                    } `}
                                  >
                                    <ChildIcon className="h-4 w-4 flex-shrink-0 opacity-80" />
                                    <span className="truncate">{getNavLabel(child.key, child.label, child.label2)}</span>
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
                        prefetch={false}
                        className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
                          isActive
                            ? 'bg-info-bg text-info-text border border-info-border'
                            : 'text-muted-foreground hover:bg-card hover:shadow-sm border border-transparent'
                        } `}
                      >
                        <SectionIcon className="h-5 w-5 flex-shrink-0 text-current opacity-90" />
                        <span className="truncate flex-1">{label}</span>
                        {section.badge && (
                          <span className="flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-danger-bg text-danger-text">
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

        <div className={`border-t border-border flex-shrink-0 ${isCollapsed ? 'p-2' : 'p-4'}`}>
          <div className="text-xs text-muted-foreground text-center">CleanMateX v1.0</div>
        </div>
      </aside>
    </>
  )
}
