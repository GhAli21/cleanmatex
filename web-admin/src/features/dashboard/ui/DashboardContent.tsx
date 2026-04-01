'use client'

/**
 * Dashboard Content Component — Windows 2000 Edition 🖥️
 */

import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useAuth } from '@/lib/auth/auth-context'
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

/** Classic Win2K window chrome wrapper */
function Win2KWindow({
  title,
  children,
  className = '',
  icon,
}: {
  title: string
  children: React.ReactNode
  className?: string
  icon?: React.ReactNode
}) {
  return (
    <div className={`win2k-panel ${className}`} style={{ borderRadius: 0 }}>
      {/* Title bar */}
      <div className="win2k-titlebar">
        {icon ?? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="white" aria-hidden="true">
            <rect x="1" y="1" width="14" height="14" fill="#316AC5" />
            <rect x="3" y="3" width="4" height="4" fill="white" />
            <rect x="9" y="3" width="4" height="4" fill="white" />
            <rect x="3" y="9" width="4" height="4" fill="white" />
            <rect x="9" y="9" width="4" height="4" fill="white" />
          </svg>
        )}
        <span style={{ fontFamily: "'Trebuchet MS', 'MS Sans Serif', Arial, sans-serif", fontSize: 11, fontWeight: 'bold' }}>
          {title}
        </span>
        {/* Window controls */}
        <div className="flex items-center gap-1 ml-auto">
          {['_', '□', '✕'].map((ctrl, i) => (
            <span
              key={i}
              className="win2k-btn"
              style={{ minWidth: 18, width: 18, height: 18, padding: '0 2px', fontSize: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}
              aria-hidden="true"
            >
              {ctrl}
            </span>
          ))}
        </div>
      </div>
      {/* Window body */}
      <div style={{ padding: '8px', backgroundColor: 'var(--win2k-face)' }}>
        {children}
      </div>
    </div>
  )
}

/** Win2K stat card */
function Win2KStat({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail?: string
}) {
  return (
    <div className="win2k-panel" style={{ padding: '6px 10px' }}>
      <p className="win2k-label" style={{ marginBottom: 4 }}>{label}</p>
      <div className="win2k-inset" style={{ padding: '4px 8px', marginBottom: 4 }}>
        <p className="win2k-value">{value}</p>
      </div>
      {detail && <p className="win2k-text" style={{ color: '#444' }}>{detail}</p>}
    </div>
  )
}

export default function DashboardContent() {
  const { user, currentTenant } = useAuth()
  const t = useTranslations('dashboard')
  const tLayout = useTranslations('layout.topBar')
  const isRTL = useRTL()

  return (
    <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* ── Welcome Window ── */}
      <Win2KWindow title="Welcome — CleanMateX Dashboard">
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <p className="win2k-label" style={{ fontSize: 13 }}>
              {t('welcome')}, {user?.user_metadata?.display_name || user?.email}!
            </p>
            <p className="win2k-text" style={{ marginTop: 4 }}>
              Welcome to CleanMateX Laundry Management System.
            </p>
          </div>
          {currentTenant && (
            <div className="win2k-inset" style={{ minWidth: 220, padding: '6px 10px', flex: 1 }}>
              <p className="win2k-label" style={{ marginBottom: 2 }}>
                {tLayout('currentTenant')}
              </p>
              <p style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 13, fontWeight: 'bold', color: 'var(--win2k-titlebar-start)' }}>
                {currentTenant.tenant_name}
              </p>
              <p className="win2k-text">
                {tLayout('role')}: <strong>{currentTenant.user_role}</strong>
              </p>
            </div>
          )}
        </div>
      </Win2KWindow>

      {/* ── Alerts ── */}
      <Win2KWindow title="System Notifications">
        <AlertsWidget />
      </Win2KWindow>

      {/* ── KPI Row 1 ── */}
      <Win2KWindow title="Key Performance Indicators">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 6 }}>
          <div className="win2k-panel" style={{ padding: 6 }}>
            <OrdersTodayWidget />
          </div>
          <Win2KStat label={t('activeCustomers')} value="0" detail={t('totalActiveCustomers')} />
          <Win2KStat label={t('pendingDeliveries')} value="0" detail={t('readyForDelivery')} />
          <Win2KStat label={t('todayRevenue')} value="0.000 OMR" detail="Today&apos;s total" />
        </div>
      </Win2KWindow>

      {/* ── Order Status & Revenue ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: 8 }} className="lg-grid">
          <Win2KWindow title="Order Status">
            <OrderStatusWidget />
          </Win2KWindow>
          <Win2KWindow title="Revenue">
            <RevenueWidget />
          </Win2KWindow>
        </div>
      </div>

      {/* ── Performance Metrics ── */}
      <Win2KWindow title="Performance Metrics">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
          <div className="win2k-panel" style={{ padding: 6 }}>
            <TurnaroundTimeWidget />
          </div>
          <div className="win2k-panel" style={{ padding: 6 }}>
            <DeliveryRateWidget />
          </div>
          <div className="win2k-panel" style={{ padding: 6 }}>
            <IssuesWidget />
          </div>
        </div>
      </Win2KWindow>

      {/* ── Business Insights ── */}
      <Win2KWindow title="Business Insights">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
          <div className="win2k-panel" style={{ padding: 6 }}>
            <PaymentMixWidget />
          </div>
          <div className="win2k-panel" style={{ padding: 6 }}>
            <DriverUtilizationWidget />
          </div>
          <div className="win2k-panel" style={{ padding: 6 }}>
            <UsageWidget />
          </div>
        </div>
      </Win2KWindow>

      {/* ── Top Services & Recent Orders ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 8 }}>
        <Win2KWindow title="Top Services">
          <TopServicesWidget />
        </Win2KWindow>
        <Win2KWindow title={t('recentOrders')}>
          <RecentOrdersList />
        </Win2KWindow>
      </div>

      {/* ── Getting Started Guide ── */}
      <Win2KWindow title="Getting Started">
        <div className="win2k-groupbox">
          <p
            className="win2k-label"
            style={{
              position: 'absolute',
              top: -9,
              left: 8,
              backgroundColor: 'var(--win2k-face)',
              padding: '0 4px',
            }}
          >
            Setup Checklist
          </p>
          <table className="win2k-table">
            <thead>
              <tr>
                <th style={{ width: 28 }}>✓</th>
                <th>Task</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'center', color: 'green', fontWeight: 'bold' }}>✓</td>
                <td className="win2k-text">{t('authActive')}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', color: '#808080' }}>○</td>
                <td>
                  <Link
                    href="/dashboard/customers"
                    style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}
                  >
                    {t('addFirstCustomer')} {isRTL ? '←' : '→'}
                  </Link>
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', color: '#808080' }}>○</td>
                <td>
                  <Link
                    href="/dashboard/orders/new"
                    style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}
                  >
                    {t('createFirstOrder')} {isRTL ? '←' : '→'}
                  </Link>
                </td>
              </tr>
              <tr>
                <td style={{ textAlign: 'center', color: '#808080' }}>○</td>
                <td>
                  <a
                    href="/dashboard/settings"
                    style={{ color: 'var(--win2k-link)', textDecoration: 'underline', fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}
                  >
                    {t('configureServices')} {isRTL ? '←' : '→'}
                  </a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Status bar */}
        <div className="win2k-statusbar" style={{ marginTop: 8, display: 'flex', gap: 12 }}>
          <span style={{ borderRight: '1px solid var(--win2k-shadow)', paddingRight: 12 }}>Ready</span>
          <span style={{ borderRight: '1px solid var(--win2k-shadow)', paddingRight: 12 }}>CleanMateX v1.0</span>
          <span>{new Date().toLocaleDateString()}</span>
        </div>
      </Win2KWindow>

    </div>
  )
}
