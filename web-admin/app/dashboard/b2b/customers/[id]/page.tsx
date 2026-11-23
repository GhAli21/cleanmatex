'use client';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxButton } from '@ui/primitives';
import { CmxPhoneDisplay } from '@ui/data-display';

/**
 * B2B Customer View Page
 * Dedicated view for B2B customers with company-first layout and B2B-specific tabs
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getCustomerById } from '@/lib/api/customers';
import type { CustomerWithTenantData } from '@/lib/types/customer';
import { CustomerOrdersSection } from '@features/customers/ui/customer-orders-section';
import { CustomerAddressesSection } from '@features/customers/ui/customer-addresses-section';
import { CustomerPreferencesTab } from '@features/customers/ui/customer-preferences-tab';
import { CustomerLoyaltyTab } from '@features/customers/ui/customer-loyalty-tab';
import {
  CustomerB2BContactsTab,
  CustomerB2BContractsTab,
  CustomerB2BStatementsTab,
} from '@features/customers/ui/customer-b2b-tabs';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';


import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { B2B_B2B_CUSTOMERS_ACCESS } from '@features/b2b/access/b2b-access'

type TabId = 'profile' | 'addresses' | 'orders' | 'loyalty' | 'preferences' | 'b2b_contacts' | 'b2b_contracts' | 'b2b_statements';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

/**
 *
 */
export default function B2BCustomerViewPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerWithTenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [error, setError] = useState<string | null>(null);
  const [advanceBalance, setAdvanceBalance] = useState<number>(0);

  const { formatMoneyWithCode } = useTenantCurrency();
  const t = useTranslations('customers');
  const tB2b = useTranslations('b2b');
  const tCommon = useTranslations('common');

  const baseTabs: Tab[] = [
    { id: 'profile', label: t('profile'), icon: '👤' },
    { id: 'addresses', label: t('addresses'), icon: '📍' },
    { id: 'orders', label: t('orderHistory'), icon: '📦' },
    { id: 'preferences', label: t('preferences'), icon: '⚙️' },
    { id: 'loyalty', label: t('loyalty'), icon: '⭐' },
  ];

  const b2bTabs: Tab[] = [
    { id: 'b2b_contacts', label: tB2b('contacts') || 'Contacts', icon: '👥' },
    { id: 'b2b_contracts', label: tB2b('contracts'), icon: '📄' },
    { id: 'b2b_statements', label: tB2b('statements'), icon: '📋' },
  ];

  const tabs: Tab[] = [...baseTabs, ...b2bTabs];

  useEffect(() => {
    async function loadCustomer() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCustomerById(customerId);
        if (data.type !== 'b2b') {
          router.replace(`/dashboard/customers/${customerId}`);
          return;
        }
        setCustomer(data);
      } catch (err) {
        console.error('Error loading B2B customer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    }

    if (customerId) loadCustomer();
  }, [customerId, router]);

  // Canonical advance balance (stored-value ledger). Money is RECEIVED via the
  // customer account receipt flow — the old inline record-advance form wrote
  // the legacy payments ledger (dropped by migration 0395) (ADR-002) and was removed.
  useEffect(() => {
    async function loadAdvanceBalance() {
      try {
        const res = await fetch(`/api/v1/customers/${customerId}/stored-value`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const body = await res.json();
        if (res.ok && body.success) {
          setAdvanceBalance(Number(body.data?.advance ?? 0));
        }
      } catch {
        // Ignore
      }
    }
    if (customerId) loadAdvanceBalance();
  }, [customerId]);

  if (loading) {
    return (
    <RequireAnyPermission permissions={B2B_B2B_CUSTOMERS_ACCESS.page.permissions ?? []}>
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-muted rounded animate-pulse" />
      </div>
    </RequireAnyPermission>
  );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-danger-border bg-danger-bg p-6 text-center">
          <h2 className="text-xl font-semibold text-danger-text mb-2">
            {t('customerNotFound') || 'Customer Not Found'}
          </h2>
          <p className="text-danger-text mb-6">{error || 'Customer does not exist'}</p>
          <CmxButton variant="primary" asChild>
            <Link href="/dashboard/b2b/customers">{tCommon('back')} - {tB2b('customers')}</Link>
          </CmxButton>
        </div>
      </div>
    );
  }

  const displayName = customer.companyName || customer.displayName || [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || '—';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-muted-foreground">
        <Link href="/dashboard/b2b" className="hover:text-foreground transition-colors">
          B2B
        </Link>
        <span className="mx-2">/</span>
        <Link href="/dashboard/b2b/customers" className="hover:text-foreground transition-colors">
          {tB2b('customers')}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{displayName}</span>
      </nav>

      {/* Header - Company-first for B2B */}
      <CmxCard>
        <CmxCardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-lg bg-info-bg flex items-center justify-center text-info-text text-2xl font-bold">
                {(customer.companyName || customer.firstName || 'C').charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {customer.companyName || displayName}
                </h1>
                {customer.companyName && customer.firstName && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {customer.firstName} {customer.lastName || ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  {customer.phone && (
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <span>{t('phone')}:</span>
                      <CmxPhoneDisplay
                        value={customer.phone}
                        showFlag
                        copyable
                        telLink
                        whatsappLink
                        className="font-semibold text-foreground"
                      />
                    </span>
                  )}
                  {customer.email && (
                    <span className="text-muted-foreground">
                      {t('email')}: <strong>{customer.email}</strong>
                    </span>
                  )}
                  {customer.customerNumber && (
                    <span className="text-muted-foreground">
                      Customer #: <strong>{customer.customerNumber}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CmxButton variant="outline" asChild>
                <Link href={`/dashboard/b2b/customers/${customerId}/edit`}>
                  {tCommon('edit')}
                </Link>
              </CmxButton>
            </div>
          </div>
        </CmxCardHeader>
      </CmxCard>

      {/* Company & Credit Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {customer.companyName2 && (
          <CmxCard>
            <CmxCardContent className="pt-4">
              <p className="text-muted-foreground text-sm">{tB2b('companyName2')}</p>
              <p className="font-medium">{customer.companyName2}</p>
            </CmxCardContent>
          </CmxCard>
        )}
        {customer.taxId != null && (
          <CmxCard>
            <CmxCardContent className="pt-4">
              <p className="text-muted-foreground text-sm">{tB2b('taxId')}</p>
              <p className="font-medium">{customer.taxId}</p>
            </CmxCardContent>
          </CmxCard>
        )}
        <CmxCard>
          <CmxCardContent className="pt-4">
            <p className="text-muted-foreground text-sm">{tB2b('creditLimit')}</p>
            <p className="font-medium">
              {customer.creditLimit != null
                ? Number(customer.creditLimit).toLocaleString()
                : '—'}
            </p>
          </CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardContent className="pt-4">
            <p className="text-muted-foreground text-sm">{tB2b('paymentTermsDays')}</p>
            <p className="font-medium">{customer.paymentTermsDays ?? '—'}</p>
          </CmxCardContent>
        </CmxCard>
      </div>

      {/* Advance balance (canonical stored-value ledger) */}
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('advanceBalance')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatMoneyWithCode(advanceBalance)}
              </p>
              {advanceBalance === 0 && (
                <p className="text-sm text-muted-foreground mt-2">{t('noAdvancePayments')}</p>
              )}
            </div>
            <div className="text-end">
              <Link
                href="/dashboard/customers/account-receipt"
                className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              >
                {t('receiveAccountPayment')}
              </Link>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">{t('receiveAccountPaymentHint')}</p>
            </div>
          </div>
        </CmxCardContent>
      </CmxCard>

      {/* Tabs */}
      <CmxCard>
        <div className="border-b border-border">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-primary text-primary-text'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}
                `}
              >
                <span className="me-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
        <div className="p-6">
          {activeTab === 'profile' && (
            <B2BProfileTab customer={customer} />
          )}
          {activeTab === 'addresses' && (
            <CustomerAddressesSection
              customerId={customer.id}
              addresses={customer.addresses ?? []}
              onAddressesChange={async () => {
                try {
                  const data = await getCustomerById(customerId);
                  setCustomer(data);
                } catch {
                  // Keep current state
                }
              }}
            />
          )}
          {activeTab === 'preferences' && (
            <CustomerPreferencesTab customerId={customer.id} />
          )}
          {activeTab === 'orders' && (
            <CustomerOrdersSection
              customerId={customer.id}
              returnToCustomerUrl={`/dashboard/b2b/customers/${customer.id}`}
              returnToCustomerLabel={displayName ? `Back to ${displayName}` : undefined}
            />
          )}
          {activeTab === 'loyalty' && (
            <CustomerLoyaltyTab customerId={customer.id} />
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
      </CmxCard>
    </div>
  );
}

// B2B Profile Tab - Company & contact info emphasized
function B2BProfileTab({ customer }: { customer: CustomerWithTenantData }) {
  const t = useTranslations('customers');
  const tB2b = useTranslations('b2b');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">{tB2b('companyInfo')}</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{tB2b('companyName')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.companyName || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{tB2b('companyName2')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.companyName2 || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{tB2b('taxId')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.taxId || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{tB2b('creditLimit')}</dt>
              <dd className="mt-1 text-sm text-foreground">
                {customer.creditLimit != null ? Number(customer.creditLimit).toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{tB2b('paymentTermsDays')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.paymentTermsDays ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{tB2b('costCenterCode')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.costCenterCode || '—'}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-foreground mb-4">{t('contactInformation') || 'Contact Person'}</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('firstName')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.firstName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('lastName')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.lastName || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('phone')}</dt>
              <dd className="mt-1 text-sm text-foreground">
                <CmxPhoneDisplay value={customer.phone} showFlag copyable telLink whatsappLink />
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('email')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">{t('address')}</dt>
              <dd className="mt-1 text-sm text-foreground">{customer.address || '—'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

