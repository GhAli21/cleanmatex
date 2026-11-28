'use client'

/**
 * PRD-003: Customer Detail Page
 *
 * Detailed view of a single customer with tabbed interface
 * Features:
 * - Profile tab with inline editing
 * - Addresses tab with CRUD operations
 * - Orders tab with order history
 * - Loyalty tab with points and rewards
 * - Advance balance and record advance payment
 */

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'
import { getCustomerById } from '@/lib/api/customers'
import { useAuth } from '@/lib/auth/auth-context'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import type { CustomerWithTenantData } from '@/lib/types/customer'
import { CustomerOrdersSection } from '@features/customers/ui/customer-orders-section'
import { CustomerAddressesSection } from '@features/customers/ui/customer-addresses-section'
import { CustomerPreferencesTab } from '@features/customers/ui/customer-preferences-tab'
import { CustomerWhatsAppConsentCard } from '@features/customers/ui/customer-whatsapp-consent-card'
import { CustomerMarketingConsentCard } from '@features/customers/ui/customer-marketing-consent-card'
import { CustomerStoredValueTab } from '@features/customers/ui/customer-stored-value-tab'
import { CustomerLoyaltyTab } from '@features/customers/ui/customer-loyalty-tab'
import { CustomerAuditHistoryTab } from '@features/customers/ui/customer-audit-history-tab'
import {
  CustomerAppPasswordAction,
  CustomerAppPasswordCard,
} from '@features/customers/ui/customer-app-password-action'
import {
  CustomerB2BContactsTab,
  CustomerB2BContractsTab,
  CustomerB2BStatementsTab,
} from '@features/customers/ui/customer-b2b-tabs'
import UpgradeProfileModal from '@features/customers/ui/upgrade-profile-modal'
import { CustomerEditModal } from '@features/orders/ui/customer-edit-modal'
import { CmxPhoneDisplay } from '@ui/data-display'
import { FileAttachments } from '@features/file-util'
import { FILE_CATEGORIES, FILE_SOURCES } from '@/lib/constants/file-util'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
import { CmxButton } from '@ui/primitives'

// Tab definitions
type TabId = 'profile' | 'addresses' | 'orders' | 'loyalty' | 'preferences' | 'stored_value' | 'files' | 'audit' | 'b2b_contacts' | 'b2b_contracts' | 'b2b_statements'

interface Tab {
  id: TabId
  label: string
  icon: string
}

/**
 *
 */
export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string

  // State
  const [customer, setCustomer] = useState<CustomerWithTenantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [error, setError] = useState<string | null>(null)
  const [advanceBalance, setAdvanceBalance] = useState<number>(0)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const { currentTenant } = useAuth()
  const { formatMoneyWithCode, formatNumber } = useTenantCurrency()
  const locale = useLocale()
  const t = useTranslations('customers')
  const tB2b = useTranslations('b2b')
  const tCommon = useTranslations('common')
  const canUpdateCustomer = useHasPermission('customers', 'update')

  const baseTabs: Tab[] = [
    { id: 'profile', label: t('profile'), icon: '👤' },
    { id: 'addresses', label: t('addresses'), icon: '📍' },
    { id: 'orders', label: t('orderHistory'), icon: '📦' },
    { id: 'preferences', label: t('preferences'), icon: '⚙️' },
    { id: 'stored_value', label: t('storedValue.title'), icon: '💳' },
    { id: 'loyalty', label: t('loyalty'), icon: '⭐' },
    { id: 'files', label: t('files'), icon: '📎' },
    { id: 'audit', label: t('audit.tabLabel'), icon: '🕒' },
  ]

  const b2bTabs: Tab[] = [
    { id: 'b2b_contacts', label: tB2b('contacts') || 'Contacts', icon: '👥' },
    { id: 'b2b_contracts', label: tB2b('contracts'), icon: '📄' },
    { id: 'b2b_statements', label: tB2b('statements'), icon: '📋' },
  ]

  const tabs: Tab[] =
    customer?.type === 'b2b'
      ? [...baseTabs, ...b2bTabs]
      : baseTabs

  // Fetch customer data
  useEffect(() => {
    async function loadCustomer() {
      setLoading(true)
      setError(null)
      try {
        const data = await getCustomerById(customerId)
        setCustomer(data)
      } catch (err) {
        console.error('Error loading customer:', err)
        setError(err instanceof Error ? err.message : 'Failed to load customer')
      } finally {
        setLoading(false)
      }
    }

    if (customerId) {
      loadCustomer()
    }
  }, [customerId])

  // Canonical advance balance (stored-value ledger). Money is RECEIVED via the
  // customer account receipt flow (method + drawer + voucher + allocation) —
  // the old inline record-advance form wrote the deprecated
  // legacy payments ledger (ADR-002) and was removed.
  useEffect(() => {
    async function loadAdvanceBalance() {
      try {
        const res = await fetch(`/api/v1/customers/${customerId}/stored-value`, {
          credentials: 'include',
          cache: 'no-store',
        })
        const body = await res.json()
        if (res.ok && body.success) {
          setAdvanceBalance(Number(body.data?.advance ?? 0))
        }
      } catch {
        // Ignore; advance section will show zero
      }
    }
    if (customerId) loadAdvanceBalance()
  }, [customerId])

  // Get customer type badge
  const getTypeBadge = (type: string) => {
    const badges = {
      guest: { color: 'bg-muted text-foreground', label: t('types.guest') },
      stub: { color: 'bg-info-bg text-info-text', label: t('types.stub') },
      full: { color: 'bg-success-bg text-success-text', label: t('types.full') },
      walk_in: { color: 'bg-info-bg text-info-text', label: t('types.walk_in') },
      b2b: { color: 'bg-info-bg text-info-text', label: t('types.b2b') },
    }
    return badges[type as keyof typeof badges] || badges.guest
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
            <div className="bg-card rounded-lg shadow p-6">
              <div className="h-32 bg-muted rounded mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !customer) {
    return (
      <div className="min-h-screen bg-muted p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-danger-bg border border-danger-border rounded-lg p-6 text-center">
            <svg
              className="mx-auto h-12 w-12 text-danger-text mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-danger-text mb-2">
              {t('notFound')}
            </h2>
            <p className="text-danger-text mb-6">{error || t('notFoundDescription')}</p>
            <Link
              href="/dashboard/customers"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover"
            >
              {t('backToCustomers')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const typeBadge = getTypeBadge(customer.type)

  return (
    <div className="min-h-screen bg-muted p-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center text-sm text-muted-foreground">
          <Link
            href="/dashboard/customers"
            className="hover:text-foreground transition-colors"
          >
            {t('title')}
          </Link>
          <svg
            className="mx-2 h-4 w-4 rtl:rotate-180"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-foreground font-medium">
            {customer.firstName} {customer.lastName}
          </span>
        </nav>

        {/* Header */}
        <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary/70 to-primary flex items-center justify-center text-primary-foreground text-2xl font-bold">
                  {customer.firstName?.charAt(0).toUpperCase() || 'C'}
                  {customer.lastName?.charAt(0).toUpperCase() || ''}
                </div>
              </div>

              {/* Customer Info */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {customer.firstName} {customer.lastName}
                  </h1>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${typeBadge.color}`}
                  >
                    {typeBadge.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {customer.customerNumber && (
                    <div>
                      <span className="text-muted-foreground">{t('customerNumberShort')}:</span>
                      <span className="ms-2 font-medium text-foreground tabular-nums">
                        <bdi dir="ltr">{customer.customerNumber}</bdi>
                      </span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="inline-flex items-center gap-2">
                      <span className="text-muted-foreground">{t('phone')}:</span>
                      <CmxPhoneDisplay
                        value={customer.phone}
                        showFlag
                        copyable
                        telLink
                        whatsappLink
                        className="font-medium text-foreground"
                      />
                      {customer.phoneVerified && (
                        <span className="ms-1 text-success-text" title={t('phoneVerified')}>
                          ✓
                        </span>
                      )}
                    </div>
                  )}
                  {customer.email && (
                    <div>
                      <span className="text-muted-foreground">{t('email')}:</span>
                      <span className="ms-2 font-medium text-foreground">
                        <bdi dir="ltr">{customer.email}</bdi>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {customer.type === 'stub' && (
                <CmxButton
                  type="button"
                  size="sm"
                  className="bg-success text-on-solid hover:bg-success/90"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  {t('upgradeToFull')}
                </CmxButton>
              )}
              <CmxButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowEditModal(true)}
              >
                {tCommon('edit')}
              </CmxButton>
              {currentTenant?.tenant_id && (
                <CustomerAppPasswordAction
                  tenantId={currentTenant.tenant_id}
                  customerId={customer.id}
                />
              )}
            </div>
          </div>
        </div>

        {/* Modals */}
        {customer && showUpgradeModal && (
          <UpgradeProfileModal
            customer={customer}
            onClose={() => setShowUpgradeModal(false)}
            onSuccess={(updated) => {
              setCustomer({ ...customer, ...updated })
              setShowUpgradeModal(false)
            }}
          />
        )}
        <CustomerEditModal
          open={showEditModal}
          customerId={customerId}
          onClose={() => setShowEditModal(false)}
          onSuccess={(updated) => {
            setCustomer((prev) => (prev ? { ...prev, ...updated } : null))
            setShowEditModal(false)
          }}
        />

        {/* Advance balance (canonical stored-value ledger) */}
        <div className="bg-card rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">{t('advanceBalance')}</h2>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t('advanceBalance')}</p>
              <p className="text-2xl font-bold text-foreground tabular-nums">
                <bdi dir="ltr">{formatMoneyWithCode(advanceBalance)}</bdi>
              </p>
              {advanceBalance === 0 && (
                <p className="text-sm text-muted-foreground mt-2">{t('noAdvancePayments')}</p>
              )}
            </div>
            <div className="text-end">
              <Link
                href="/dashboard/customers/account-receipt"
                className="inline-block rounded-md bg-success px-4 py-2 text-sm font-medium text-on-solid hover:bg-success/90"
              >
                {t('receiveAccountPayment')}
              </Link>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t('receiveAccountPaymentHint')}</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-card rounded-lg shadow-sm">
          {/* Tab Navigation */}
          <div className="border-b border-border">
            <nav className="flex -mb-px" role="tablist">
              {tabs.map((tab) => (
                <CmxButton
                  key={tab.id}
                  type="button"
                  variant="ghost"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    rounded-none px-6 py-4 text-sm font-medium border-b-2 transition-colors hover:bg-transparent
                    ${
                      activeTab === tab.id
                        ? 'border-primary text-primary-text'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                    }
                  `}
                >
                  <span className="me-2">{tab.icon}</span>
                  {tab.label}
                </CmxButton>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'profile' && (
              <ProfileTab
                customer={customer}
                tenantId={currentTenant?.tenant_id}
                onUpdate={setCustomer}
              />
            )}
            {activeTab === 'addresses' && (
              <CustomerAddressesSection
                customerId={customer.id}
                addresses={customer.addresses ?? []}
                onAddressesChange={async () => {
                  try {
                    const data = await getCustomerById(customerId)
                    setCustomer(data)
                  } catch {
                    // Keep current state on refetch error
                  }
                }}
              />
            )}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                {currentTenant?.tenant_id && <CustomerWhatsAppConsentCard
                  key={`${currentTenant.tenant_id}:${customer.id}`}
                  tenantId={currentTenant.tenant_id}
                  customerId={customer.id}
                />}
                {currentTenant?.tenant_id && <CustomerMarketingConsentCard
                  key={`marketing:${currentTenant.tenant_id}:${customer.id}`}
                  tenantId={currentTenant.tenant_id}
                  customerId={customer.id}
                />}
                <CustomerPreferencesTab customerId={customer.id} />
              </div>
            )}
            {activeTab === 'orders' && (
              <CustomerOrdersSection
                customerId={customer.id}
                returnToCustomerUrl={`/dashboard/customers/${customer.id}`}
                returnToCustomerLabel={[customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() ? `Back to ${[customer.firstName, customer.lastName].filter(Boolean).join(' ')}` : undefined}
              />
            )}
            {activeTab === 'stored_value' && currentTenant?.tenant_id && (
              <CustomerStoredValueTab
                customerId={customer.id}
                tenantId={currentTenant.tenant_id}
              />
            )}
            {activeTab === 'loyalty' && (
              <CustomerLoyaltyTab customerId={customer.id} />
            )}
            {activeTab === 'files' && (
              <FileAttachments
                category={FILE_CATEGORIES.CUSTOMER_FILE}
                entityId={customer.id}
                source={FILE_SOURCES.CUSTOMER_PROFILE}
                readOnly={!canUpdateCustomer}
              />
            )}
            {activeTab === 'audit' && (
              <CustomerAuditHistoryTab customerId={customer.id} />
            )}
            {activeTab === 'b2b_contacts' && (
              <CustomerB2BContactsTab customerId={customer.id} />
            )}
            {activeTab === 'b2b_contracts' && (
              <CustomerB2BContractsTab customerId={customer.id} />
            )}
            {activeTab === 'b2b_statements' && (
              <CustomerB2BStatementsTab customerId={customer.id} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================================================================
// TAB COMPONENTS
// ==================================================================

/**
 * Profile Tab - Customer information with inline editing
 * @param root0
 * @param root0.customer
 * @param root0.onUpdate
 */
function ProfileTab({
  customer,
  tenantId,
  onUpdate: _onUpdate,
}: {
  customer: CustomerWithTenantData
  tenantId?: string
  onUpdate: (customer: CustomerWithTenantData) => void
}) {
  const t = useTranslations('customers')
  const tB2b = useTranslations('b2b')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const { formatNumber } = useTenantCurrency()

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {t('personalInfo')}
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('firstName')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.firstName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('lastName')}</dt>
              <dd className="mt-1 text-sm text-foreground">
                {customer.lastName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('phone')}</dt>
              <dd className="mt-1 text-sm text-foreground">
                <CmxPhoneDisplay value={customer.phone} showFlag copyable telLink whatsappLink />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('email')}</dt>
              <dd className="mt-1 text-sm text-foreground">
                {customer.email ? <bdi dir="ltr">{customer.email}</bdi> : '—'}
              </dd>
            </div>
          </dl>
        </div>

        {/* B2B Company Info */}
        {customer.type === 'b2b' && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {tB2b('companyInfo')}
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{tB2b('companyName')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {customer.companyName || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{tB2b('taxId')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {customer.taxId || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{tB2b('creditLimit')}</dt>
                <dd className="mt-1 text-sm text-foreground tabular-nums">
                  {customer.creditLimit != null
                    ? formatNumber(Number(customer.creditLimit))
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{tB2b('paymentTermsDays')}</dt>
                <dd className="mt-1 text-sm text-foreground tabular-nums">
                  {customer.paymentTermsDays != null ? formatNumber(customer.paymentTermsDays) : '—'}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Preferences (Full Profile Only) */}
        {customer.type === 'full' && (
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">
              {t('preferences')}
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('language')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {locale === 'ar' ? t('whatsappConsent.languageArabic') : t('whatsappConsent.languageEnglish')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('folding')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {customer.preferences?.folding || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('fragrance')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {customer.preferences?.fragrance || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('starchLevel')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  —
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Account Information */}
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">
            {t('accountInfo')}
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('customerType')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {t(`types.${customer.type}`) || customer.type}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('status')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {customer.profileStatus === 3 ? t('active') : `${t('status')} ${formatNumber(customer.profileStatus)}`}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('phoneVerified')}</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {customer.phoneVerified ? `${tCommon('yes')} ✓` : tCommon('no')}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">{t('memberSince')}</dt>
                <dd className="mt-1 text-sm text-foreground tabular-nums">
                  {new Date(customer.createdAt).toLocaleDateString(locale === 'ar' ? 'ar' : 'en-US')}
                </dd>
              </div>
            </dl>
            {tenantId && (
              <CustomerAppPasswordCard
                tenantId={tenantId}
                customerId={customer.id}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

