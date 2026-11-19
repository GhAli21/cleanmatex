'use client'

/**
 * Dashboard Content Component
 *
 * Main dashboard page with comprehensive KPI widgets and metrics
 */

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/auth-context'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { useRTL } from '@/lib/hooks/useRTL'
import { UsageWidget } from './UsageWidget'
import {
  OrdersTodayWidget,
  OrderStatusWidget,
  RevenueWidget,
  TurnaroundTimeWidget,
  DeliveryRateWidget,
  IssuesWidget,
  PaymentMixWidget,
  DriverUtilizationWidget,
  TopServicesWidget,
  AlertsWidget,
} from './widgets'
import { RecentOrdersList } from './RecentOrdersList'
import { SetupHealthHomeCard } from '@features/setup-health/ui/setup-health-home-card'

/**
 *
 */
export default function DashboardContent() {
  const { user, currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const tLayout = useTranslations('layout.topBar')
  const isRTL = useRTL()
  const { formatMoneyWithCode } = useTenantCurrency()

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-foreground mb-2">
          {t('welcome')}, {user?.user_metadata?.display_name || user?.email}!
        </h2>
        {currentTenant && (
          <div className="mt-4 p-4 bg-info-bg rounded-md">
            <h3 className="text-sm font-medium text-primary-text mb-1">
              {tLayout('currentTenant')}
            </h3>
            <p className="text-lg font-semibold text-primary-text line-clamp-1 break-words">
              {currentTenant.tenant_name}
            </p>
            <p className="text-sm text-primary-text">
              {tLayout('role')}: {currentTenant.user_role}
            </p>
          </div>
        )}
      </div>

      {/* Alerts - High Priority */}
      <AlertsWidget />

      {/* Setup Health tile (hidden without setup_health:view) */}
      <SetupHealthHomeCard />

      {/* KPI Row 1: Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <OrdersTodayWidget />
        <div className="bg-card rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            {t('activeCustomers')}
          </h3>
          <p className="text-3xl font-bold text-foreground">0</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('totalActiveCustomers')}</p>
        </div>
        <div className="bg-card rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            {t('pendingDeliveries')}
          </h3>
          <p className="text-3xl font-bold text-foreground">0</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('readyForDelivery')}</p>
        </div>
        <div className="bg-card rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            {t('todayRevenue')}
          </h3>
          <p className="text-3xl font-bold text-foreground">{formatMoneyWithCode(0)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t('revenue')}</p>
        </div>
      </div>

      {/* KPI Row 2: Order Status & Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <OrderStatusWidget />
        </div>
        <RevenueWidget />
      </div>

      {/* KPI Row 3: Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <TurnaroundTimeWidget />
        <DeliveryRateWidget />
        <IssuesWidget />
      </div>

      {/* KPI Row 4: Business Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <PaymentMixWidget />
        <DriverUtilizationWidget />
        <UsageWidget />
      </div>

      {/* KPI Row 5: Top Services (Full Width) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TopServicesWidget />
        <div className="bg-card rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            {t('recentOrders')}
          </h2>
          <RecentOrdersList />
        </div>
      </div>

      {/* Getting Started Guide - Only show if no data */}
      <div className="bg-card rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">
          {t('gettingStarted')}
        </h2>
        <ul className="space-y-3">
          <li className="flex items-start">
            <svg
              className="h-6 w-6 text-success-text me-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-foreground">
              {t('authActive')}
            </span>
          </li>
          <li className="flex items-start">
            <svg
              className="h-6 w-6 text-muted-foreground me-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <Link
              href="/dashboard/customers"
              className="text-primary-text hover:text-primary-text/80 font-medium"
            >
              {t('addFirstCustomer')} {isRTL ? '←' : '→'}
            </Link>
          </li>
          <li className="flex items-start">
            <svg
              className="h-6 w-6 text-muted-foreground me-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
            <Link
              href="/dashboard/orders/new"
              className="text-primary-text hover:text-primary-text/80 font-medium"
            >
              {t('createFirstOrder')} {isRTL ? '←' : '→'}
            </Link>
          </li>
          <li className="flex items-start">
            <svg
              className="h-6 w-6 text-muted-foreground me-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6v6m0 0v6m-6 0h12"
              />
            </svg>
            <a
              href="/dashboard/settings"
              className="text-primary-text hover:text-primary-text/80 font-medium"
            >
              {t('configureServices')} {isRTL ? '←' : '→'}
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
