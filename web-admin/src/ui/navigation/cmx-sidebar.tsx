'use client'
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */

/**
 * CmxSidebar - Modern redesigned sidebar navigation component
 *
 * Features:
 * - Compact unified brand/tenant header with top-of-sidebar per-user Color Palette Picker
 * - High-contrast distinct bilingual Menu Search + Ctrl+K Quick-Jump Command Palette
 * - DB-persisted tenant-scoped Pinned Favorites (★) filtered by active permissions/flags
 * - Color-coded domain icon badges & 3px logical start active accent bar
 * - Unclipped fixed-position hover flyout in collapsed 64px rail mode
 * - Full EN/AR RTL logical classes & Light/Dark mode support
 *
 * @module ui/navigation
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import {
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  Search,
  Star,
  Palette,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useRTL } from '@/lib/hooks/useRTL'
import { useNavigation } from '@/lib/hooks/use-navigation'
import { useSidebar } from '@/lib/context/sidebar-context'
import { useFeatureFlagsQuery } from '@/lib/hooks/use-feature-flags'
import { useUserSidebarPreferences } from '@/lib/hooks/use-user-sidebar-preferences'
import { UI_SIDEBAR_THEMES, type UiSidebarTheme } from '@/lib/constants/ui-theme'
import { isPathActive, type NavigationSection } from '@/config/navigation'
import { getIcon } from '@/lib/utils/icon-registry'
import { useTenantBrand } from '@/lib/theme/tenant-brand'
import { Tooltip } from '@ui/primitives'
import { cn } from '@/lib/utils'
import {
  CmxSidebarSearchDialog,
  type QuickJumpItem,
} from './cmx-sidebar-search-dialog'

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

/** Section key → semantic domain icon badge tint class (defined in globals.css) */
const SECTION_TINT_MAP: Record<string, string> = {
  home: 'cmx-sb-tint-primary',
  orders: 'cmx-sb-tint-sky',
  assembly: 'cmx-sb-tint-sky',
  delivery: 'cmx-sb-tint-sky',
  drivers: 'cmx-sb-tint-sky',
  customers: 'cmx-sb-tint-emerald',
  users: 'cmx-sb-tint-emerald',
  catalog: 'cmx-sb-tint-violet',
  inventory: 'cmx-sb-tint-violet',
  billing: 'cmx-sb-tint-amber',
  erp_lite: 'cmx-sb-tint-amber',
  internal_fin: 'cmx-sb-tint-amber',
  finance_vouchers: 'cmx-sb-tint-amber',
  reports: 'cmx-sb-tint-rose',
  settings: 'cmx-sb-tint-neutral',
  config_settings: 'cmx-sb-tint-neutral',
  tenant_admin: 'cmx-sb-tint-neutral',
  help: 'cmx-sb-tint-neutral',
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

/** Fallback i18n key map for hardcoded navigation.ts items without DB label2. */
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

const SWATCH_CLASS_MAP: Record<UiSidebarTheme, string> = {
  OCEAN: 'cmx-sb-swatch-OCEAN',
  MIDNIGHT: 'cmx-sb-swatch-MIDNIGHT',
  EMERALD: 'cmx-sb-swatch-EMERALD',
  INDIGO: 'cmx-sb-swatch-INDIGO',
  SAND: 'cmx-sb-swatch-SAND',
}

interface FlyoutState {
  section: NavigationSection
  top: number
}

export default function CmxSidebar() {
  const pathname = usePathname()
  const { currentTenant } = useAuth()
  const isRTL = useRTL()
  const { isCollapsed, toggleCollapse, prefersReducedMotion } = useSidebar()
  const t = useTranslations('layout.sidebar')
  const tNav = useTranslations('navigation')
  const brand = useTenantBrand()
  const logoMain = brand.logoUrl ?? brand.logoDarkUrl
  const logoDark = brand.logoUrl ? brand.logoDarkUrl : null

  const { sidebarTheme, pinnedKeys, setSidebarTheme, togglePin } = useUserSidebarPreferences()
  const pinnedSet = useMemo(() => new Set(pinnedKeys), [pinnedKeys])

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [quickJumpOpen, setQuickJumpOpen] = useState(false)
  const [colorPickerOpen, setColorPickerOpen] = useState(false)
  const [flyout, setFlyout] = useState<FlyoutState | null>(null)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const colorPickerRef = useRef<HTMLDivElement | null>(null)

  const { navigation, isLoading: navigationLoading } = useNavigation()
  const { data: featureFlags = {} } = useFeatureFlagsQuery({
    enabled: Boolean(currentTenant?.tenant_id),
  })

  const getSectionIcon = useCallback((section: NavigationSection) => {
    const fromApi =
      typeof section.icon === 'function'
        ? section.icon
        : typeof section.icon === 'string'
          ? getIcon(section.icon)
          : null
    if (fromApi && typeof fromApi === 'function') return fromApi
    const fallbackName = SECTION_ICON_FALLBACK[section.key] ?? 'Home'
    return getIcon(fallbackName)
  }, [])

  const getChildIcon = useCallback((childKey: string) => {
    const name = CHILD_ICON_FALLBACK[childKey]
    return name ? getIcon(name) : getIcon('List')
  }, [])

  const getSectionTint = useCallback((sectionKey: string): string => {
    return SECTION_TINT_MAP[sectionKey] ?? 'cmx-sb-tint-primary'
  }, [])

  const formatPlanDisplay = (planCode: string | undefined): string => {
    if (!planCode) return 'Free Trial'
    const normalized = planCode.toLowerCase().replace(/_/g, ' ')
    return normalized
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  }

  const getNavLabel = useCallback(
    (key: string, label: string, label2?: string): string => {
      if (isRTL && label2) return label2
      if (label && label !== key) return label
      const translationKey = NAV_TRANSLATION_KEY_MAP[key]
      if (translationKey) {
        try {
          return tNav(translationKey)
        } catch {
          // Fall through to raw label/key
        }
      }
      return label || key
    },
    [isRTL, tNav],
  )

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
            isFeatureEnabled(child.featureFlag),
          )
          return { ...section, children: filteredChildren }
        }
        return section
      })
  }, [navigation, featureFlags])

  // Flat list of all permitted screens for Quick Jump + Pinned resolution
  const allQuickJumpItems = useMemo<QuickJumpItem[]>(() => {
    const items: QuickJumpItem[] = []
    for (const section of filteredNavigation) {
      const sectionLabel = getNavLabel(section.key, section.label, section.label2)
      const tintClass = getSectionTint(section.key)
      if (section.children && section.children.length > 0) {
        for (const child of section.children) {
          const childLabel = getNavLabel(child.key, child.label, child.label2)
          items.push({
            key: child.key,
            path: child.path,
            label: childLabel,
            parentLabel: sectionLabel,
            searchText: `${childLabel} ${child.label} ${child.label2 ?? ''} ${sectionLabel} ${section.label} ${section.label2 ?? ''} ${child.key}`.toLowerCase(),
            icon: getChildIcon(child.key),
            tintClass,
          })
        }
      } else {
        items.push({
          key: section.key,
          path: section.path,
          label: sectionLabel,
          searchText: `${sectionLabel} ${section.label} ${section.label2 ?? ''} ${section.key}`.toLowerCase(),
          icon: getSectionIcon(section),
          tintClass,
        })
      }
    }
    return items
  }, [filteredNavigation, getChildIcon, getNavLabel, getSectionIcon, getSectionTint])

  // Pinned items auto-pruned to only permitted screens in current tenant/role
  const pinnedItems = useMemo(() => {
    if (pinnedKeys.length === 0) return []
    const byKey = new Map(allQuickJumpItems.map((item) => [item.key, item]))
    return pinnedKeys
      .map((key) => byKey.get(key))
      .filter((item): item is QuickJumpItem => Boolean(item))
  }, [allQuickJumpItems, pinnedKeys])

  const normalizedSearch = searchQuery.trim().toLowerCase()

  const visibleNavigation = useMemo(() => {
    if (!normalizedSearch) return filteredNavigation
    const result: NavigationSection[] = []
    for (const section of filteredNavigation) {
      const sectionLabel = getNavLabel(section.key, section.label, section.label2)
      const sectionHay = `${sectionLabel} ${section.label} ${section.label2 ?? ''} ${section.key}`.toLowerCase()
      const sectionMatches = sectionHay.includes(normalizedSearch)
      if (section.children && section.children.length > 0) {
        const matchingChildren = section.children.filter((child) => {
          const childLabel = getNavLabel(child.key, child.label, child.label2)
          const childHay = `${childLabel} ${child.label} ${child.label2 ?? ''} ${child.key} ${sectionHay}`.toLowerCase()
          return childHay.includes(normalizedSearch)
        })
        if (sectionMatches || matchingChildren.length > 0) {
          result.push({
            ...section,
            children: matchingChildren.length > 0 ? matchingChildren : section.children,
          })
        }
      } else if (sectionMatches) {
        result.push(section)
      }
    }
    return result
  }, [filteredNavigation, getNavLabel, normalizedSearch])

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const activeSectionsSignature = useMemo(() => {
    const activeKeys = filteredNavigation
      .filter((section) =>
        section.children?.some((child) => isPathActive(pathname, child.path)),
      )
      .map((section) => section.key)
    return JSON.stringify([pathname, activeKeys])
  }, [pathname, filteredNavigation])

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
    setFlyout(null)
  }

  useEffect(() => {
    if (isMobileOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileOpen])

  // Global keyboard shortcuts: Ctrl/Cmd + B (collapse), Ctrl/Cmd + K (quick jump)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        toggleCollapse()
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setQuickJumpOpen((prev) => !prev)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleCollapse])

  // Close top color picker popover on outside click
  useEffect(() => {
    if (!colorPickerOpen) return undefined
    const handleOutside = (event: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setColorPickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [colorPickerOpen])

  const openFlyout = useCallback((section: NavigationSection, triggerEl: HTMLElement) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
    const rect = triggerEl.getBoundingClientRect()
    const maxTop = Math.max(64, window.innerHeight - 280)
    setFlyout({ section, top: Math.min(Math.max(56, rect.top), maxTop) })
  }, [])

  const scheduleCloseFlyout = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => setFlyout(null), 140)
  }, [])

  const cancelCloseFlyout = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
      hoverTimeoutRef.current = null
    }
  }, [])

  useEffect(
    () => () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
    },
    [],
  )

  const tenantSubtitle = currentTenant
    ? [
        currentTenant.tenant_name,
        currentTenant.user_role,
        formatPlanDisplay(currentTenant.s_current_plan),
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 start-0 end-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md p-2"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-label={isMobileOpen ? t('collapseSidebar') : t('expandSidebar')}
          >
            {isMobileOpen ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
          </button>
          <span className="ms-3 text-lg font-semibold text-foreground">{brand.name}</span>
        </div>
        <button
          type="button"
          onClick={() => setQuickJumpOpen(true)}
          aria-label={t('quickJumpTitle')}
          className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Mobile Backdrop */}
      {isMobileOpen ? (
        <div
          className="fixed inset-0 bg-foreground/40 z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      ) : null}

      {/* Main Sidebar Rail */}
      <aside
        role="navigation"
        aria-label={t('navLabel')}
        data-sidebar-theme={sidebarTheme}
        className={cn(
          'cmx-sb-surface fixed top-0 bottom-0 start-0 z-40 border-e flex flex-col shadow-sm',
          prefersReducedMotion ? '' : 'transition-[transform,width] duration-300 ease-in-out',
          'w-64',
          isCollapsed ? 'lg:w-16' : 'lg:w-64',
          isMobileOpen ? 'translate-x-0' : 'max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full',
        )}
      >
        {/* 1. Compact Unified Header + Top-of-Sidebar Color Picker + Collapse Toggle */}
        <div
          ref={colorPickerRef}
          className={cn(
            'relative border-b cmx-sb-border flex-shrink-0 flex items-center justify-between gap-1.5',
            isCollapsed ? 'px-2 py-3 lg:flex-col lg:gap-2' : 'px-3 py-3',
          )}
        >
          <Link
            href="/dashboard"
            prefetch={false}
            className={cn(
              'flex items-center min-w-0 gap-2.5',
              isCollapsed ? 'lg:justify-center' : 'flex-1',
            )}
          >
            {logoMain ? (
              <>
                <img
                  src={logoMain}
                  alt=""
                  className={cn(
                    'w-8 h-8 rounded-lg object-contain flex-shrink-0',
                    logoDark ? 'cmx-logo-light' : '',
                  )}
                />
                {logoDark ? (
                  <img
                    src={logoDark}
                    alt=""
                    className="cmx-logo-dark w-8 h-8 rounded-lg object-contain flex-shrink-0"
                  />
                ) : null}
              </>
            ) : (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                <span className="text-primary-foreground font-bold text-base">
                  {brand.name.charAt(0)}
                </span>
              </div>
            )}
            <div className={cn('min-w-0 overflow-hidden', isCollapsed ? 'lg:hidden' : '')}>
              <span className="block text-sm font-bold cmx-sb-fg truncate leading-tight">
                {brand.name}
              </span>
              {tenantSubtitle ? (
                <span
                  className="block text-[11px] cmx-sb-muted-fg truncate mt-0.5"
                  title={tenantSubtitle}
                >
                  {tenantSubtitle}
                </span>
              ) : null}
            </div>
          </Link>

          {/* Header Controls: Sidebar Color Picker + Desktop Collapse */}
          <div className={cn('flex items-center gap-0.5 shrink-0', isCollapsed ? 'lg:flex-col' : '')}>
            <button
              type="button"
              onClick={() => setColorPickerOpen((prev) => !prev)}
              aria-haspopup="true"
              aria-expanded={colorPickerOpen}
              aria-label={t('sidebarColor')}
              title={t('sidebarColor')}
              className="cmx-sb-item rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Palette className="h-4 w-4" aria-hidden />
            </button>

            <button
              type="button"
              onClick={toggleCollapse}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
              title={isCollapsed ? t('expandSidebar') : t('collapseSidebar')}
              className="cmx-sb-item hidden lg:inline-flex rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isCollapsed ? (
                <PanelLeft className="h-4 w-4" aria-hidden />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>

          {/* Per-User Sidebar Color Swatch Popover */}
          {colorPickerOpen ? (
            <div
              role="dialog"
              aria-label={t('mySidebarColor')}
              className={cn(
                'absolute top-full z-50 mt-1.5 w-52 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl p-2.5 space-y-2',
                isCollapsed ? 'start-2' : 'end-2',
              )}
            >
              <div className="text-xs font-semibold text-foreground">{t('mySidebarColor')}</div>
              <div className="grid grid-cols-5 gap-1.5">
                {UI_SIDEBAR_THEMES.map((themeCode) => {
                  const selected = sidebarTheme === themeCode
                  const label = t(`themes.${themeCode}` as 'themes.OCEAN')
                  return (
                    <button
                      key={themeCode}
                      type="button"
                      onClick={() => {
                        setSidebarTheme(themeCode)
                        setColorPickerOpen(false)
                      }}
                      aria-label={label}
                      aria-pressed={selected}
                      title={label}
                      className={cn(
                        'h-7 rounded-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        SWATCH_CLASS_MAP[themeCode],
                        selected ? 'ring-2 ring-ring ring-offset-1' : 'border border-border',
                      )}
                    />
                  )
                })}
              </div>
              <div className="text-[11px] text-muted-foreground">{t('savedPerUser')}</div>
            </div>
          ) : null}
        </div>

        {/* 2. High-Contrast Distinct Menu Search Bar */}
        <div className={cn('border-b cmx-sb-border flex-shrink-0', isCollapsed ? 'px-2 py-2' : 'px-2.5 py-2.5')}>
          {isCollapsed ? (
            <Tooltip content={`${t('quickJumpTitle')} (Ctrl+K)`} side={isRTL ? 'left' : 'right'}>
              <button
                type="button"
                onClick={() => setQuickJumpOpen(true)}
                aria-label={t('quickJumpTitle')}
                className="cmx-sb-search w-full h-9 rounded-lg flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Search className="h-4 w-4 cmx-sb-search-icon" aria-hidden />
              </button>
            </Tooltip>
          ) : (
            <div className="relative flex items-center">
              <Search
                className="h-3.5 w-3.5 cmx-sb-search-icon absolute start-2.5 pointer-events-none"
                aria-hidden
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchQuery('')
                }}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                className="cmx-sb-search w-full h-9 ps-8 pe-14 text-xs font-medium rounded-lg shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('quickJumpEsc')}
                  className="absolute end-1.5 rounded p-1 cmx-sb-muted-fg hover:opacity-80"
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setQuickJumpOpen(true)}
                  title={`${t('quickJumpTitle')} (Ctrl+K)`}
                  className="cmx-sb-search-kbd absolute end-1.5 px-1.5 py-0.5 text-[10px] font-mono rounded hover:opacity-85"
                >
                  Ctrl K
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. Scrollable Navigation (Pinned Favorites + Sections) */}
        <nav
          className={cn(
            'flex-1 overflow-y-auto min-h-0 py-2.5 flex-shrink min-w-0 space-y-3',
            isCollapsed ? 'px-1.5' : 'px-2',
          )}
        >
          {navigationLoading ? (
            <div className="px-2 py-2 space-y-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-9 bg-muted/40 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Pinned Favorites (DB-persisted per user, tenant-scoped) */}
              {!isCollapsed && !normalizedSearch && pinnedItems.length > 0 ? (
                <div className="space-y-0.5 pb-2 border-b cmx-sb-border">
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider cmx-sb-muted-fg flex items-center justify-between">
                    <span>{t('pinnedSection')}</span>
                    <span className="tabular-nums">{pinnedItems.length}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {pinnedItems.map((item) => {
                      const ItemIcon = item.icon
                      const active = isPathActive(pathname, item.path)
                      return (
                        <li
                          key={`pin-${item.key}`}
                          className={cn(
                            'group relative flex items-center rounded-lg transition-colors',
                            active ? 'cmx-sb-item-active' : 'cmx-sb-item',
                          )}
                        >
                          {active ? (
                            <span className="cmx-sb-active-bar absolute start-0 top-1.5 bottom-1.5 w-[3px] rounded-full" />
                          ) : null}
                          <Link
                            href={item.path}
                            prefetch={false}
                            aria-current={active ? 'page' : undefined}
                            className="flex-1 flex items-center gap-2 px-2 py-1.5 text-xs min-w-0"
                          >
                            <span
                              className={cn(
                                'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md',
                                item.tintClass,
                              )}
                            >
                              <ItemIcon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="truncate">{item.label}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => togglePin(item.key)}
                            aria-label={t('unpinItem', { label: item.label })}
                            title={t('unpinItem', { label: item.label })}
                            className="p-1.5 shrink-0 text-warning hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                          >
                            <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ) : null}

              {/* Main Navigation Sections */}
              <div className="space-y-0.5">
                {!isCollapsed ? (
                  <div className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider cmx-sb-muted-fg">
                    {t('navigationSection')}
                  </div>
                ) : null}

                {visibleNavigation.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs cmx-sb-muted-fg">
                    {t('noSearchResults')}
                  </div>
                ) : (
                  <ul className="space-y-0.5">
                    {visibleNavigation.map((section) => {
                      const SectionIcon = getSectionIcon(section)
                      const tintClass = getSectionTint(section.key)
                      const hasChildren = Boolean(section.children && section.children.length > 0)
                      const isChildActive =
                        hasChildren &&
                        section.children!.some((child) => isPathActive(pathname, child.path))
                      const isActive = isPathActive(pathname, section.path) || isChildActive
                      const label = getNavLabel(section.key, section.label, section.label2)
                      const isExpanded = Boolean(normalizedSearch) || expandedSections.has(section.key)

                      // Collapsed Rail Mode: Parent with children -> fixed unclipped flyout
                      if (isCollapsed && hasChildren) {
                        return (
                          <li key={section.key}>
                            <button
                              type="button"
                              aria-haspopup="menu"
                              aria-expanded={flyout?.section.key === section.key}
                              aria-label={label}
                              onMouseEnter={(e) => openFlyout(section, e.currentTarget)}
                              onMouseLeave={scheduleCloseFlyout}
                              onClick={(e) => openFlyout(section, e.currentTarget)}
                              className={cn(
                                'relative w-full h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isActive ? 'cmx-sb-item-active' : 'cmx-sb-item',
                              )}
                            >
                              {isActive ? (
                                <span className="cmx-sb-active-bar absolute start-0 top-2 bottom-2 w-[3px] rounded-full" />
                              ) : null}
                              <span
                                className={cn(
                                  'inline-flex h-7 w-7 items-center justify-center rounded-lg',
                                  tintClass,
                                )}
                              >
                                <SectionIcon className="h-4 w-4" aria-hidden />
                              </span>
                            </button>
                          </li>
                        )
                      }

                      // Collapsed Rail Mode: Single link
                      if (isCollapsed && !hasChildren) {
                        return (
                          <li key={section.key}>
                            <Tooltip content={label} side={isRTL ? 'left' : 'right'}>
                              <Link
                                href={section.path}
                                prefetch={false}
                                aria-label={label}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                  'relative w-full h-10 flex items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  isActive ? 'cmx-sb-item-active' : 'cmx-sb-item',
                                )}
                              >
                                {isActive ? (
                                  <span className="cmx-sb-active-bar absolute start-0 top-2 bottom-2 w-[3px] rounded-full" />
                                ) : null}
                                <span
                                  className={cn(
                                    'inline-flex h-7 w-7 items-center justify-center rounded-lg',
                                    tintClass,
                                  )}
                                >
                                  <SectionIcon className="h-4 w-4" aria-hidden />
                                </span>
                              </Link>
                            </Tooltip>
                          </li>
                        )
                      }

                      // Expanded Mode: Section with children
                      if (hasChildren) {
                        return (
                          <li key={section.key}>
                            <button
                              type="button"
                              onClick={() => toggleSection(section.key)}
                              aria-expanded={isExpanded}
                              className={cn(
                                'w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium rounded-lg transition-colors gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                isActive ? 'cmx-sb-fg font-semibold' : 'cmx-sb-item',
                              )}
                            >
                              <span className="flex items-center min-w-0 gap-2.5">
                                <span
                                  className={cn(
                                    'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                                    tintClass,
                                  )}
                                >
                                  <SectionIcon className="h-3.5 w-3.5" aria-hidden />
                                </span>
                                <span className="truncate">{label}</span>
                              </span>
                              <span className="flex items-center gap-1.5 shrink-0">
                                {section.badge ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-danger-bg text-danger-text tabular-nums">
                                    {section.badge}
                                  </span>
                                ) : null}
                                {isExpanded ? (
                                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
                                )}
                              </span>
                            </button>

                            {isExpanded ? (
                              <ul className="mt-0.5 ms-4 space-y-0.5 border-s cmx-sb-border ps-2.5">
                                {section.children!.map((child) => {
                                  const ChildIcon = getChildIcon(child.key)
                                  const childActive = isPathActive(pathname, child.path)
                                  const childLabel = getNavLabel(child.key, child.label, child.label2)
                                  const isPinned = pinnedSet.has(child.key)
                                  return (
                                    <li
                                      key={child.key}
                                      className={cn(
                                        'group relative flex items-center rounded-lg transition-colors',
                                        childActive ? 'cmx-sb-item-active' : 'cmx-sb-item',
                                      )}
                                    >
                                      {childActive ? (
                                        <span className="cmx-sb-active-bar absolute start-0 top-1.5 bottom-1.5 w-[3px] rounded-full" />
                                      ) : null}
                                      <Link
                                        href={child.path}
                                        prefetch={false}
                                        aria-current={childActive ? 'page' : undefined}
                                        className="flex-1 flex items-center gap-2 px-2.5 py-1.5 text-xs min-w-0"
                                      >
                                        <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                                        <span className="truncate">{childLabel}</span>
                                      </Link>
                                      <button
                                        type="button"
                                        onClick={() => togglePin(child.key)}
                                        aria-label={
                                          isPinned
                                            ? t('unpinItem', { label: childLabel })
                                            : t('pinItem', { label: childLabel })
                                        }
                                        title={
                                          isPinned
                                            ? t('unpinItem', { label: childLabel })
                                            : t('pinItem', { label: childLabel })
                                        }
                                        className={cn(
                                          'p-1 shrink-0 rounded transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                          isPinned
                                            ? 'text-warning opacity-100'
                                            : 'cmx-sb-muted-fg opacity-0 group-hover:opacity-100',
                                        )}
                                      >
                                        <Star
                                          className={cn('h-3.5 w-3.5', isPinned ? 'fill-current' : '')}
                                          aria-hidden
                                        />
                                      </button>
                                    </li>
                                  )
                                })}
                              </ul>
                            ) : null}
                          </li>
                        )
                      }

                      // Expanded Mode: Single top-level link
                      const isPinned = pinnedSet.has(section.key)
                      return (
                        <li
                          key={section.key}
                          className={cn(
                            'group relative flex items-center rounded-lg transition-colors',
                            isActive ? 'cmx-sb-item-active' : 'cmx-sb-item',
                          )}
                        >
                          {isActive ? (
                            <span className="cmx-sb-active-bar absolute start-0 top-1.5 bottom-1.5 w-[3px] rounded-full" />
                          ) : null}
                          <Link
                            href={section.path}
                            prefetch={false}
                            aria-current={isActive ? 'page' : undefined}
                            className="flex-1 flex items-center gap-2.5 px-2 py-1.5 text-xs font-medium min-w-0"
                          >
                            <span
                              className={cn(
                                'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg',
                                tintClass,
                              )}
                            >
                              <SectionIcon className="h-3.5 w-3.5" aria-hidden />
                            </span>
                            <span className="truncate flex-1">{label}</span>
                            {section.badge ? (
                              <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-danger-bg text-danger-text tabular-nums">
                                {section.badge}
                              </span>
                            ) : null}
                          </Link>
                          <button
                            type="button"
                            onClick={() => togglePin(section.key)}
                            aria-label={
                              isPinned
                                ? t('unpinItem', { label })
                                : t('pinItem', { label })
                            }
                            title={
                              isPinned
                                ? t('unpinItem', { label })
                                : t('pinItem', { label })
                            }
                            className={cn(
                              'p-1.5 shrink-0 rounded transition-opacity focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                              isPinned
                                ? 'text-warning opacity-100'
                                : 'cmx-sb-muted-fg opacity-0 group-hover:opacity-100',
                            )}
                          >
                            <Star
                              className={cn('h-3.5 w-3.5', isPinned ? 'fill-current' : '')}
                              aria-hidden
                            />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </nav>

        {/* 4. Compact Utility Footer */}
        <div
          className={cn(
            'border-t cmx-sb-border flex-shrink-0 flex items-center text-[11px] cmx-sb-muted-fg',
            isCollapsed ? 'justify-center px-1.5 py-2.5' : 'justify-between px-3 py-2.5',
          )}
        >
          {!isCollapsed && currentTenant ? (
            <span className="inline-flex items-center gap-1.5 truncate">
              <span className="h-2 w-2 rounded-full bg-success shrink-0" aria-hidden />
              <span className="truncate">{formatPlanDisplay(currentTenant.s_current_plan)}</span>
            </span>
          ) : null}
          {/* cmx-ds-ignore UI008: product version */}
          <span className="font-mono text-[10px] shrink-0">v1.0</span>
        </div>
      </aside>

      {/* Fixed-Position Unclipped Flyout for Collapsed 64px Rail */}
      {isCollapsed && flyout ? (
        <div
          data-sidebar-theme={sidebarTheme}
          onMouseEnter={cancelCloseFlyout}
          onMouseLeave={scheduleCloseFlyout}
          style={{ top: `${flyout.top}px` }}
          role="menu"
          aria-label={getNavLabel(flyout.section.key, flyout.section.label, flyout.section.label2)}
          className="cmx-sb-surface fixed start-16 ms-1 z-50 w-52 rounded-xl border shadow-2xl py-1.5 hidden lg:block"
        >
          <div className="px-3 py-1.5 border-b cmx-sb-border text-[11px] font-semibold cmx-sb-muted-fg uppercase tracking-wide">
            {getNavLabel(flyout.section.key, flyout.section.label, flyout.section.label2)}
          </div>
          <ul className="space-y-0.5 p-1" role="group">
            {flyout.section.children?.map((child) => {
              const ChildIcon = getChildIcon(child.key)
              const childActive = isPathActive(pathname, child.path)
              return (
                <li key={child.key} role="none">
                  <Link
                    href={child.path}
                    prefetch={false}
                    role="menuitem"
                    onClick={() => setFlyout(null)}
                    className={cn(
                      'flex items-center gap-2 px-2.5 py-1.5 text-xs rounded-lg transition-colors',
                      childActive ? 'cmx-sb-item-active' : 'cmx-sb-item',
                    )}
                  >
                    <ChildIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{getNavLabel(child.key, child.label, child.label2)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}

      {/* Ctrl+K Quick-Jump Command Palette */}
      <CmxSidebarSearchDialog
        open={quickJumpOpen}
        onOpenChange={setQuickJumpOpen}
        items={allQuickJumpItems}
      />
    </>
  )
}
