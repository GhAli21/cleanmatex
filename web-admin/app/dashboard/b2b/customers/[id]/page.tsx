'use client';

/**
 * B2B Customer View Page
 * Dedicated view for B2B customers with company-first layout and B2B-specific tabs
 */

import { useState, useEffect, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getCustomerById } from '@/lib/api/customers';
import { getPaymentsForCustomer, processPayment } from '@/app/actions/payments/process-payment';
import type { CustomerWithTenantData } from '@/lib/types/customer';
import type { PaymentMethodCode } from '@/lib/types/payment';
import { CustomerOrdersSection } from '@features/customers/ui/customer-orders-section';
import { CustomerAddressesSection } from '@features/customers/ui/customer-addresses-section';
import { CustomerPreferencesTab } from '@features/customers/ui/customer-preferences-tab';
import {
  CustomerB2BContactsTab,
  CustomerB2BContractsTab,
  CustomerB2BStatementsTab,
} from '@features/customers/ui/customer-b2b-tabs';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/primitives/card';
import { Button } from '@ui/primitives/button';

type TabId = 'profile' | 'addresses' | 'orders' | 'loyalty' | 'preferences' | 'b2b_contacts' | 'b2b_contracts' | 'b2b_statements';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

export default function B2BCustomerViewPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const [customer, setCustomer] = useState<CustomerWithTenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('profile');
  const [error, setError] = useState<string | null>(null);
  const [advancePayments, setAdvancePayments] = useState<Array<{ id: string; paid_amount: number; payment_kind?: string; invoice_id?: string }>>([]);
  const [advanceAmount, setAdvanceAmount] = useState<number>(0);
  const [advanceMethod, setAdvanceMethod] = useState<PaymentMethodCode>('CASH');
  const [advanceError, setAdvanceError] = useState<string | null>(null);
  const [advanceSuccess, setAdvanceSuccess] = useState<string | null>(null);
  const [advancePending, startAdvanceTransition] = useTransition();

  const { currentTenant, user } = useAuth();
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

  useEffect(() => {
    async function loadPayments() {
      try {
        const result = await getPaymentsForCustomer(customerId);
        if (result.success && result.data) setAdvancePayments(result.data);
      } catch {
        // Ignore
      }
    }
    if (customerId) loadPayments();
  }, [customerId]);

  const unappliedAdvancePayments = advancePayments.filter((p) => !p.invoice_id);
  const advanceBalanceTotal = unappliedAdvancePayments.reduce((sum, p) => sum + Number(p.paid_amount), 0);

  const handleRecordAdvance = (e: React.FormEvent) => {
    e.preventDefault();
    setAdvanceError(null);
    setAdvanceSuccess(null);
    if (advanceAmount <= 0) {
      setAdvanceError(t('noAdvancePayments'));
      return;
    }
    const tenantOrgId = currentTenant?.tenant_id;
    const userId = user?.id;
    if (!tenantOrgId || !userId) {
      setAdvanceError('Not authenticated');
      return;
    }
    startAdvanceTransition(async () => {
      const result = await processPayment(tenantOrgId, userId, {
        customerId,
        paymentKind: 'advance',
        paymentMethod: advanceMethod,
        amount: advanceAmount,
      });
      if (result.success) {
        setAdvanceSuccess(t('advanceRecorded'));
        setAdvanceAmount(0);
        const res = await getPaymentsForCustomer(customerId);
        if (res.success && res.data) setAdvancePayments(res.data);
        router.refresh();
      } else {
        setAdvanceError(result.error ?? 'Failed to record advance');
      }
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-2">
            {t('customerNotFound') || 'Customer Not Found'}
          </h2>
          <p className="text-red-700 mb-6">{error || 'Customer does not exist'}</p>
          <Button variant="default" asChild>
            <Link href="/dashboard/b2b/customers">{tCommon('back')} - {tB2b('customers')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName = customer.companyName || customer.displayName || [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || '—';

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center text-sm text-gray-500">
        <Link href="/dashboard/b2b" className="hover:text-gray-700 transition-colors">
          B2B
        </Link>
        <span className="mx-2">/</span>
        <Link href="/dashboard/b2b/customers" className="hover:text-gray-700 transition-colors">
          {tB2b('customers')}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 font-medium">{displayName}</span>
      </nav>

      {/* Header - Company-first for B2B */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600 text-2xl font-bold">
                {(customer.companyName || customer.firstName || 'C').charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {customer.companyName || displayName}
                </h1>
                {customer.companyName && customer.firstName && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {customer.firstName} {customer.lastName || ''}
                  </p>
                )}
                <div className="flex flex-wrap gap-4 mt-2 text-sm">
                  {customer.phone && (
                    <span className="text-gray-600">
                      {t('phone')}: <strong>{customer.phone}</strong>
                    </span>
                  )}
                  {customer.email && (
                    <span className="text-gray-600">
                      {t('email')}: <strong>{customer.email}</strong>
                    </span>
                  )}
                  {customer.customerNumber && (
                    <span className="text-gray-600">
                      Customer #: <strong>{customer.customerNumber}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/dashboard/b2b/customers/${customerId}/edit`}>
                  {tCommon('edit')}
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Company & Credit Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {customer.companyName2 && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-gray-500 text-sm">{tB2b('companyName2')}</p>
              <p className="font-medium">{customer.companyName2}</p>
            </CardContent>
          </Card>
        )}
        {customer.taxId != null && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-gray-500 text-sm">{tB2b('taxId')}</p>
              <p className="font-medium">{customer.taxId}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="pt-4">
            <p className="text-gray-500 text-sm">{tB2b('creditLimit')}</p>
            <p className="font-medium">
              {customer.creditLimit != null
                ? Number(customer.creditLimit).toLocaleString()
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-gray-500 text-sm">{tB2b('paymentTermsDays')}</p>
            <p className="font-medium">{customer.paymentTermsDays ?? '—'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Advance balance & Record advance */}
      <Card>
        <CardHeader>
          <CardTitle>{t('advanceBalance')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {advanceBalanceTotal.toFixed(3)} OMR
              </p>
              {unappliedAdvancePayments.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('unappliedAdvanceCount', { count: unappliedAdvancePayments.length })}
                </p>
              )}
            </div>
            <form onSubmit={handleRecordAdvance} className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('recordAdvance')}</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    step="0.001"
                    min={0}
                    value={advanceAmount || ''}
                    onChange={(e) => setAdvanceAmount(Number(e.target.value) || 0)}
                    placeholder="Amount"
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm w-32 text-right"
                  />
                  <select
                    value={advanceMethod}
                    onChange={(e) => setAdvanceMethod(e.target.value as PaymentMethodCode)}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                  </select>
                  <Button type="submit" disabled={advancePending || advanceAmount <= 0}>
                    {advancePending ? '...' : t('recordAdvance')}
                  </Button>
                </div>
              </div>
            </form>
          </div>
          {advanceError && <p className="mt-2 text-sm text-red-600">{advanceError}</p>}
          {advanceSuccess && <p className="mt-2 text-sm text-green-600">{advanceSuccess}</p>}
          {unappliedAdvancePayments.length === 0 && advanceBalanceTotal === 0 && (
            <p className="text-sm text-gray-500 mt-2">{t('noAdvancePayments')}</p>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Card>
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <span className="mr-2">{tab.icon}</span>
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
            <LoyaltyTab
              customerId={customer.id}
              loyaltyPoints={customer.tenantData?.loyaltyPoints || 0}
            />
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
      </Card>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{tB2b('companyInfo')}</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">{tB2b('companyName')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.companyName || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{tB2b('companyName2')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.companyName2 || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{tB2b('taxId')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.taxId || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{tB2b('creditLimit')}</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {customer.creditLimit != null ? Number(customer.creditLimit).toLocaleString() : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{tB2b('paymentTermsDays')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.paymentTermsDays ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{tB2b('costCenterCode')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.costCenterCode || '—'}</dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('contactInformation') || 'Contact Person'}</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('firstName')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.firstName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('lastName')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.lastName || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('phone')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('email')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">{t('address')}</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.address || '—'}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function LoyaltyTab({ customerId, loyaltyPoints }: { customerId: string; loyaltyPoints: number }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Loyalty Points & Rewards</h3>
      <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-sm mb-1">Current Balance</p>
            <p className="text-4xl font-bold">{loyaltyPoints}</p>
            <p className="text-purple-100 text-sm mt-1">points</p>
          </div>
          <div className="text-6xl">⭐</div>
        </div>
      </div>
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500 mb-2">No transactions yet</p>
        <p className="text-sm text-gray-400">
          Points history will appear here once the customer earns or redeems points
        </p>
      </div>
    </div>
  );
}
