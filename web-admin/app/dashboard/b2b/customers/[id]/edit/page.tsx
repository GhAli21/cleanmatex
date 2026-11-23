'use client';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import { CmxPhoneInput } from '@ui/forms';

/**
 * B2B Customer Edit Page
 * Dedicated edit screen for B2B customers with full company and credit fields
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { getCustomerById, updateCustomer } from '@/lib/api/customers';
import { fetchCustomerCategories } from '@/lib/api/customer-categories';
import { useAuth } from '@/lib/auth/auth-context';
import { useRTL } from '@/lib/hooks/useRTL';

import { useMessage } from '@ui/feedback';
import type { CustomerWithTenantData } from '@/lib/types/customer';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { B2B_B2B_CUSTOMERS_EDIT_ACCESS } from '@features/b2b/access/b2b-access'

/**
 *
 */
export default function B2BCustomerEditPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string;

  const t = useTranslations('customers');
  const tB2b = useTranslations('b2b');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { currentTenant } = useAuth();
  const { showErrorFrom } = useMessage();

  const [customer, setCustomer] = useState<CustomerWithTenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyName2, setCompanyName2] = useState('');
  const [taxId, setTaxId] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [paymentTermsDays, setPaymentTermsDays] = useState('');
  const [costCenterCode, setCostCenterCode] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [building, setBuilding] = useState('');
  const [floor, setFloor] = useState('');
  const [customerCategoryId, setCustomerCategoryId] = useState('');
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getCustomerById(customerId);
        if (data.type !== 'b2b') {
          router.replace(`/dashboard/customers/${customerId}`);
          return;
        }
        setCustomer(data);
        setFirstName(data.firstName || '');
        setLastName(data.lastName || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setCompanyName(data.companyName || '');
        setCompanyName2(data.companyName2 || '');
        setTaxId(data.taxId || '');
        setCreditLimit(data.creditLimit != null ? String(data.creditLimit) : '');
        setPaymentTermsDays(data.paymentTermsDays != null ? String(data.paymentTermsDays) : '');
        setCostCenterCode(data.costCenterCode || '');
        setAddress(data.address || '');
        setArea(data.area || '');
        setBuilding(data.building || '');
        setFloor(data.floor || '');
        setCustomerCategoryId(data.customerCategoryId || '');
      } catch (err) {
        console.error('Error loading B2B customer:', err);
        setError(err instanceof Error ? err.message : 'Failed to load customer');
      } finally {
        setLoading(false);
      }
    }
    if (customerId) load();
  }, [customerId, router]);

  useEffect(() => {
    if (currentTenant?.tenant_id) {
      fetchCustomerCategories({ is_b2b: true, active_only: true })
        .then((data) => setCategories(data.map((c) => ({ id: c.id, name: c.name }))))
        .catch(() => {});
    }
  }, [currentTenant?.tenant_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError(t('firstNameRequired'));
      return;
    }
    if (!phone.trim()) {
      setError(t('phoneRequiredStubFull'));
      return;
    }
    if (!companyName.trim()) {
      setError(tB2b('companyName') ? `${tB2b('companyName')} is required` : 'Company name is required');
      return;
    }

    setSaving(true);
    try {
      await updateCustomer(customerId, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: phone.trim(),
        email: email.trim() || undefined,
        companyName: companyName.trim(),
        companyName2: companyName2.trim() || undefined,
        taxId: taxId.trim() || undefined,
        creditLimit: creditLimit ? Number(creditLimit) : undefined,
        paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : undefined,
        costCenterCode: costCenterCode.trim() || undefined,
        address: address.trim() || undefined,
        area: area.trim() || undefined,
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
        customerCategoryId: customerCategoryId.trim() || undefined,
      });
      router.push(`/dashboard/b2b/customers/${customerId}`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('failedToUpdateCustomer') || 'Failed to update customer';
      setError(errorMsg);
      showErrorFrom(err, { fallback: errorMsg });
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <RequireAnyPermission permissions={B2B_B2B_CUSTOMERS_EDIT_ACCESS.page.permissions ?? []}>
        <div className="space-y-6">
          <div className="h-8 bg-muted rounded w-1/4 animate-pulse" />
          <div className="h-64 bg-muted rounded animate-pulse" />
        </div>
      </RequireAnyPermission>
    );
  }

  if (error && !customer) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-danger-border bg-danger-bg p-6 text-center">
          <h2 className="text-xl font-semibold text-danger-text mb-2">{t('customerNotFound') || 'Customer Not Found'}</h2>
          <p className="text-danger-text mb-6">{error}</p>
          <CmxButton variant="primary" asChild>
            <Link href="/dashboard/b2b/customers">{tCommon('back')} - {tB2b('customers')}</Link>
          </CmxButton>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CmxButton variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/b2b/customers/${customerId}`} aria-label={tCommon('back')}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </CmxButton>
          <div>
            <h1 className="text-2xl font-semibold">
              {tB2b('editB2BCustomer') || 'Edit B2B Customer'}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {customer?.companyName || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ')}
            </p>
          </div>
        </div>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{tB2b('companyDetails')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md p-4 border-s-4 border-e-0 border-destructive bg-danger-bg">
                <p className="text-sm text-danger-text">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground border-b pb-2">{t('contactInformation') || 'Contact Person'}</h3>
                <div>
                  <Label htmlFor="firstName" className="mb-1 block text-start">{t('firstName')} <span className="text-danger-text">*</span></Label>
                  <CmxInput id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} required disabled={saving} />
                </div>
                <div>
                  <Label htmlFor="lastName" className="mb-1 block text-start">{t('lastName')}</Label>
                  <CmxInput id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} disabled={saving} />
                </div>
                <div>
                  <Label htmlFor="phone" className="mb-1 block text-start">{t('phoneNumber')} <span className="text-danger-text">*</span></Label>
                  <CmxPhoneInput
                    id="phone"
                    value={phone}
                    onChange={(e164) => setPhone(e164)}
                    required
                    disabled={saving}
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="mb-1 block text-start">{t('emailOptional')}</Label>
                  <CmxInput id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" disabled={saving} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-foreground border-b pb-2">{tB2b('companyInfo')}</h3>
                <div>
                  <Label htmlFor="companyName" className="mb-1 block text-start">{tB2b('companyName')} <span className="text-danger-text">*</span></Label>
                  <CmxInput id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} required disabled={saving} />
                </div>
                <div>
                  <Label htmlFor="companyName2" className="mb-1 block text-start">{tB2b('companyName2')}</Label>
                  <CmxInput id="companyName2" type="text" value={companyName2} onChange={(e) => setCompanyName2(e.target.value)} dir="rtl" className="text-end" disabled={saving} />
                </div>
                <div>
                  <Label htmlFor="taxId" className="mb-1 block text-start">{tB2b('taxId')}</Label>
                  <CmxInput id="taxId" type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} dir="ltr" disabled={saving} />
                </div>
                <div>
                  <Label htmlFor="costCenterCode" className="mb-1 block text-start">{tB2b('costCenterCode')}</Label>
                  <CmxInput id="costCenterCode" type="text" value={costCenterCode} onChange={(e) => setCostCenterCode(e.target.value)} dir="ltr" disabled={saving} />
                </div>
                <div>
                  <Label htmlFor="customerCategoryId" className="mb-1 block text-start">{t('category') || 'Category'}</Label>
                  <CmxSelect
                    id="customerCategoryId"
                    value={customerCategoryId}
                    onChange={(e) => setCustomerCategoryId(e.target.value)}
                    disabled={saving}
                    options={[
                      { value: '', label: tCommon('select') || 'Select...' },
                      ...categories.map((c) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-foreground md:col-span-2">{tB2b('creditLimit')} & {tB2b('paymentTermsDays')}</h3>
              <div>
                <Label htmlFor="creditLimit" className="mb-1 block text-start">{tB2b('creditLimit')}</Label>
                <CmxInput id="creditLimit" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} min={0} step={0.01} dir="ltr" className="tabular-nums" disabled={saving} />
              </div>
              <div>
                <Label htmlFor="paymentTermsDays" className="mb-1 block text-start">{tB2b('paymentTermsDays')}</Label>
                <CmxInput id="paymentTermsDays" type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} min={0} dir="ltr" className="tabular-nums" disabled={saving} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-foreground md:col-span-2">{t('address') || 'Address'}</h3>
              <div className="md:col-span-2">
                <Label htmlFor="address" className="mb-1 block text-start">{t('address')}</Label>
                <CmxInput id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} disabled={saving} />
              </div>
              <div>
                <Label htmlFor="area" className="mb-1 block text-start">{t('area') || 'Area'}</Label>
                <CmxInput id="area" type="text" value={area} onChange={(e) => setArea(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} disabled={saving} />
              </div>
              <div>
                <Label htmlFor="building" className="mb-1 block text-start">{t('building') || 'Building'}</Label>
                <CmxInput id="building" type="text" value={building} onChange={(e) => setBuilding(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} disabled={saving} />
              </div>
              <div>
                <Label htmlFor="floor" className="mb-1 block text-start">{t('floor') || 'Floor'}</Label>
                <CmxInput id="floor" type="text" value={floor} onChange={(e) => setFloor(e.target.value)} dir="ltr" disabled={saving} />
              </div>
            </div>

            <div className="pt-6 flex items-center justify-end gap-3">
              <CmxButton type="button" variant="outline" disabled={saving} asChild>
                <Link href={`/dashboard/b2b/customers/${customerId}`}>{tCommon('cancel')}</Link>
              </CmxButton>
              <CmxButton type="submit" loading={saving} disabled={saving}>
                {saving ? (t('saving') || 'Saving...') : (tCommon('save') || 'Save')}
              </CmxButton>
            </div>
          </form>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
