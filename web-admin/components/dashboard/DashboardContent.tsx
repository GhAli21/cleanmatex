'use client'

/**
 * Dashboard Content Component
 *
 * Main dashboard page with comprehensive KPI widgets and metrics
 */

import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { useRTL } from '@/lib/hooks/useRTL'
import { UsageWidget } from '@/components/dashboard/UsageWidget'
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
} from '@/components/dashboard/widgets'

export default function DashboardContent() {
  const { user, currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const tLayout = useTranslations('layout.topBar')
  const isRTL = useRTL()

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('welcome')}, {user?.user_metadata?.display_name || user?.email}!
        </h2>
        {currentTenant && (
          <div className="mt-4 p-4 bg-blue-50 rounded-md">
            <h3 className="text-sm font-medium text-blue-900 mb-1">
              {tLayout('currentTenant')}
            </h3>
            <p className="text-lg font-semibold text-blue-600 line-clamp-1 break-words">
              {currentTenant.tenant_name}
            </p>
            <p className="text-sm text-blue-700">
              {tLayout('role')}: {currentTenant.user_role}
            </p>
          </div>
        )}
      </div>

      {/* Alerts - High Priority */}
      <AlertsWidget />

      {/* KPI Row 1: Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <OrdersTodayWidget />
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {t('activeCustomers')}
          </h3>
          <p className="text-3xl font-bold text-gray-900">0</p>
          <p className="mt-2 text-sm text-gray-600">{t('totalActiveCustomers')}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {t('pendingDeliveries')}
          </h3>
          <p className="text-3xl font-bold text-gray-900">0</p>
          <p className="mt-2 text-sm text-gray-600">{t('readyForDelivery')}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-2">
            {t('todayRevenue')}
          </h3>
          <p className="text-3xl font-bold text-gray-900">0.000</p>
          <p className="mt-2 text-sm text-gray-600">OMR</p>
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
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {t('recentOrders')}
          </h2>
          <p className="text-gray-500">{t('noOrdersYet')}</p>
          {/* TODO: Add recent orders list */}
        </div>
      </div>

      {/* Getting Started Guide - Only show if no data */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {t('gettingStarted')}
        </h2>
        <ul className="space-y-3">
          <li className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
            <svg
              className={`h-6 w-6 text-green-500 ${isRTL ? 'ml-2' : 'mr-2'}`}
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
            <span className="text-gray-700">
              {t('authActive')}
            </span>
          </li>
          <li className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
            <svg
              className={`h-6 w-6 text-gray-400 ${isRTL ? 'ml-2' : 'mr-2'}`}
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
            <a
              href="/dashboard/customers"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('addFirstCustomer')} {isRTL ? '←' : '→'}
            </a>
          </li>
          <li className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
            <svg
              className={`h-6 w-6 text-gray-400 ${isRTL ? 'ml-2' : 'mr-2'}`}
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
            <a
              href="/dashboard/orders/new"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('createFirstOrder')} {isRTL ? '←' : '→'}
            </a>
          </li>
          <li className={`flex items-start ${isRTL ? 'flex-row-reverse' : ''}`}>
            <svg
              className={`h-6 w-6 text-gray-400 ${isRTL ? 'ml-2' : 'mr-2'}`}
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
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('configureServices')} {isRTL ? '←' : '→'}
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
