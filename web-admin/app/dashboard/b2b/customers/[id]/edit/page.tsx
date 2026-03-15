'use client';

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
import { getPhoneCountryCodeAction } from '@/app/actions/tenant/get-phone-country-code';
import { useAuth } from '@/lib/auth/auth-context';
import { useRTL } from '@/lib/hooks/useRTL';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/primitives/card';
import { Button } from '@ui/primitives/button';
import { useMessage } from '@ui/feedback';
import type { CustomerWithTenantData } from '@/lib/types/customer';

const COUNTRY_CODES = [
  { code: '+968', label: 'Oman', flag: '🇴🇲' },
  { code: '+966', label: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+971', label: 'UAE', flag: '🇦🇪' },
  { code: '+965', label: 'Kuwait', flag: '🇰🇼' },
  { code: '+973', label: 'Bahrain', flag: '🇧🇭' },
  { code: '+974', label: 'Qatar', flag: '🇶🇦' },
  { code: '+20', label: 'Egypt', flag: '🇪🇬' },
  { code: '+962', label: 'Jordan', flag: '🇯🇴' },
  { code: '+961', label: 'Lebanon', flag: '🇱🇧' },
];

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
  const [countryCode, setCountryCode] = useState('+968');
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
    if (currentTenant?.id) {
      fetchCustomerCategories({ is_b2b: true, active_only: true })
        .then((data) => setCategories(data.map((c) => ({ id: c.id, name: c.name }))))
        .catch(() => {});
    }
  }, [currentTenant?.id]);

  useEffect(() => {
    if (currentTenant?.id) {
      getPhoneCountryCodeAction(currentTenant.id)
        .then((code) => {
          const found = COUNTRY_CODES.find((c) => c.code === code);
          setCountryCode(found ? code : '+968');
        })
        .catch(() => {});
    }
  }, [currentTenant?.id]);

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
      const fullPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode}${phone.replace(/\D/g, '')}`;
      await updateCustomer(customerId, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
        phone: fullPhone,
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

  const inputClass = (dir?: 'ltr' | 'rtl') =>
    `block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${dir === 'rtl' ? 'text-right' : isRTL ? 'text-right' : 'text-left'}`;
  const labelClass = `block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`;
  const flexRow = `flex ${isRTL ? 'flex-row-reverse' : ''}`;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error && !customer) {
    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-xl font-semibold text-red-900 mb-2">{t('customerNotFound') || 'Customer Not Found'}</h2>
          <p className="text-red-700 mb-6">{error}</p>
          <Button variant="default" asChild>
            <Link href="/dashboard/b2b/customers">{tCommon('back')} - {tB2b('customers')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className={`${flexRow} items-center justify-between gap-4`}>
        <div className={`${flexRow} items-center gap-3`}>
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/dashboard/b2b/customers/${customerId}`} aria-label={tCommon('back')}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">
              {tB2b('editB2BCustomer') || 'Edit B2B Customer'}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {customer?.companyName || [customer?.firstName, customer?.lastName].filter(Boolean).join(' ')}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tB2b('companyDetails')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className={`rounded-md p-4 ${isRTL ? 'border-r-4 border-l-0' : 'border-l-4 border-r-0'} border-red-400 bg-red-50`}>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 border-b pb-2">{t('contactInformation') || 'Contact Person'}</h3>
                <div>
                  <label htmlFor="firstName" className={labelClass}>{t('firstName')} <span className="text-red-500">*</span></label>
                  <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} required disabled={saving} />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelClass}>{t('lastName')}</label>
                  <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} disabled={saving} />
                </div>
                <div>
                  <label htmlFor="phone" className={labelClass}>{t('phoneNumber')} <span className="text-red-500">*</span></label>
                  <div className={flexRow}>
                    <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} disabled={saving} className={`inline-flex items-center px-3 py-2 border border-gray-300 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 ${isRTL ? 'rounded-r-md border-r border-l-0' : 'rounded-l-md border-l border-r-0'}`}>
                      {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={`flex-1 ${inputClass('ltr')} ${isRTL ? 'rounded-l-md' : 'rounded-r-md'}`} placeholder="90123456" required disabled={saving} />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className={labelClass}>{t('emailOptional')}</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={inputClass()} disabled={saving} />
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 border-b pb-2">{tB2b('companyInfo')}</h3>
                <div>
                  <label htmlFor="companyName" className={labelClass}>{tB2b('companyName')} <span className="text-red-500">*</span></label>
                  <input id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} required disabled={saving} />
                </div>
                <div>
                  <label htmlFor="companyName2" className={labelClass}>{tB2b('companyName2')}</label>
                  <input id="companyName2" type="text" value={companyName2} onChange={(e) => setCompanyName2(e.target.value)} dir="rtl" className={inputClass('rtl')} disabled={saving} />
                </div>
                <div>
                  <label htmlFor="taxId" className={labelClass}>{tB2b('taxId')}</label>
                  <input id="taxId" type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} dir="ltr" className={inputClass()} disabled={saving} />
                </div>
                <div>
                  <label htmlFor="costCenterCode" className={labelClass}>{tB2b('costCenterCode')}</label>
                  <input id="costCenterCode" type="text" value={costCenterCode} onChange={(e) => setCostCenterCode(e.target.value)} dir="ltr" className={inputClass()} disabled={saving} />
                </div>
                <div>
                  <label htmlFor="customerCategoryId" className={labelClass}>{t('category') || 'Category'}</label>
                  <select id="customerCategoryId" value={customerCategoryId} onChange={(e) => setCustomerCategoryId(e.target.value)} disabled={saving} className={inputClass()}>
                    <option value="">{tCommon('select') || 'Select...'}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-900 md:col-span-2">{tB2b('creditLimit')} & {tB2b('paymentTermsDays')}</h3>
              <div>
                <label htmlFor="creditLimit" className={labelClass}>{tB2b('creditLimit')}</label>
                <input id="creditLimit" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} min={0} step={0.01} dir="ltr" className={inputClass()} disabled={saving} />
              </div>
              <div>
                <label htmlFor="paymentTermsDays" className={labelClass}>{tB2b('paymentTermsDays')}</label>
                <input id="paymentTermsDays" type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} min={0} dir="ltr" className={inputClass()} disabled={saving} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-900 md:col-span-2">{t('address') || 'Address'}</h3>
              <div className="md:col-span-2">
                <label htmlFor="address" className={labelClass}>{t('address')}</label>
                <input id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} disabled={saving} />
              </div>
              <div>
                <label htmlFor="area" className={labelClass}>{t('area') || 'Area'}</label>
                <input id="area" type="text" value={area} onChange={(e) => setArea(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} disabled={saving} />
              </div>
              <div>
                <label htmlFor="building" className={labelClass}>{t('building') || 'Building'}</label>
                <input id="building" type="text" value={building} onChange={(e) => setBuilding(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} disabled={saving} />
              </div>
              <div>
                <label htmlFor="floor" className={labelClass}>{t('floor') || 'Floor'}</label>
                <input id="floor" type="text" value={floor} onChange={(e) => setFloor(e.target.value)} dir="ltr" className={inputClass()} disabled={saving} />
              </div>
            </div>

            <div className={`pt-6 flex items-center ${isRTL ? 'flex-row-reverse justify-start gap-3' : 'justify-end gap-3'}`}>
              <Button type="button" variant="outline" disabled={saving} asChild>
                <Link href={`/dashboard/b2b/customers/${customerId}`}>{tCommon('cancel')}</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (t('saving') || 'Saving...') : (tCommon('save') || 'Save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
