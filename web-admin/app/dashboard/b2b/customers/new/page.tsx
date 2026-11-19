/**
 * B2B Customer Creation Page screen
 * Dedicated screen to create B2B customers within the B2B section
 */

'use client';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle, CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRTL } from '@/lib/hooks/useRTL';
import { createCustomer } from '@/lib/api/customers';
import { fetchCustomerCategories } from '@/lib/api/customer-categories';
import { getPhoneCountryCodeAction } from '@/app/actions/tenant/get-phone-country-code';
import { useAuth } from '@/lib/auth/auth-context';

import { useMessage } from '@ui/feedback';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { B2B_B2B_CUSTOMERS_NEW_ACCESS } from '@features/b2b/access/b2b-access'

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

/**
 *
 */
export default function B2BCustomerCreatePage() {
  const router = useRouter();
  const t = useTranslations('customers');
  const tB2b = useTranslations('b2b');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { currentTenant } = useAuth();
  const { showErrorFrom } = useMessage();

  const [displayName, setDisplayName] = useState('');
  const [customerCategoryId, setCustomerCategoryId] = useState('');
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
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentTenant?.tenant_id) {
      fetchCustomerCategories({ is_b2b: true, active_only: true })
        .then((data) => setCategories(data.filter((c) => c.is_b2b).map((c) => ({ id: c.id, name: c.name }))))
        .catch(() => { /* keep empty */ });
    }
  }, [currentTenant?.tenant_id]);

  useEffect(() => {
    if (currentTenant?.tenant_id) {
      getPhoneCountryCodeAction(currentTenant.tenant_id)
        .then((code) => {
          const found = COUNTRY_CODES.find((c) => c.code === code);
          setCountryCode(found ? code : '+968');
        })
        .catch(() => { /* keep default */ });
    }
  }, [currentTenant?.tenant_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!phone.trim()) {
      setError(t('phoneRequiredStubFull'));
      return;
    }
    if (!companyName.trim()) {
      setError(tB2b('companyName') ? `${tB2b('companyName')} is required` : 'Company name is required');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode}${phone.replace(/\D/g, '')}`;
      const companyNameTrimmed = companyName.trim();
      const companyName2Trimmed = companyName2.trim() || undefined;
      await createCustomer({
        type: 'b2b',
        phone: fullPhone,
        email: email.trim() || undefined,
        displayName: displayName.trim() || companyNameTrimmed,
        name: companyNameTrimmed,
        name2: companyName2Trimmed,
        companyName: companyNameTrimmed,
        companyName2: companyName2Trimmed,
        taxId: taxId.trim() || undefined,
        creditLimit: creditLimit ? Number(creditLimit) : undefined,
        paymentTermsDays: paymentTermsDays ? Number(paymentTermsDays) : undefined,
        costCenterCode: costCenterCode.trim() || undefined,
        address: address.trim() || undefined,
        area: area.trim() || undefined,
        building: building.trim() || undefined,
        floor: floor.trim() || undefined,
        categoryId: customerCategoryId.trim() || undefined,
      });
      router.push('/dashboard/b2b/customers');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('failedToCreateCustomer');
      setError(errorMsg);
      showErrorFrom(err, { fallback: t('failedToCreateCustomer') });
      setLoading(false);
    }
  };

  return (
    <RequireAnyPermission permissions={B2B_B2B_CUSTOMERS_NEW_ACCESS.page.permissions ?? []}>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CmxButton variant="ghost" size="icon" asChild>
              <Link href="/dashboard/b2b/customers" aria-label={tCommon('back')}>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
            </CmxButton>
            <div>
              <h1 className="text-2xl font-semibold">{tB2b('createB2BCustomer') || 'Create B2B Customer'}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {tB2b('createB2BCustomerSubtitle') || 'Add a new business customer with company details and credit terms'}
              </p>
            </div>
          </div>
        </div>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{tB2b('companyDetails') || 'Company & Contact Details'}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="rounded-md p-4 border-s-4 border-e-0 border-destructive bg-danger-bg">
                  <p className="text-sm text-danger-text">{error}</p>
                </div>
              )}

              {/* Category first - B2B categories only (is_b2b=true) */}
              <div>
                <Label htmlFor="customerCategoryId" className="mb-1 block text-start">{t('category') || 'Category'}</Label>
                <CmxSelect
                  id="customerCategoryId"
                  value={customerCategoryId}
                  onChange={(e) => setCustomerCategoryId(e.target.value)}
                  disabled={loading}
                  options={[
                    { value: '', label: tCommon('select') || 'Select...' },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Contact person */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground border-b pb-2">{t('contactInformation') || 'Contact'}</h3>
                  <div>
                    <Label htmlFor="displayName" className="mb-1 block text-start">{t('displayName')}</Label>
                    <CmxInput id="displayName" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} placeholder={tB2b('companyName')} disabled={loading} />
                    <p className="text-xs text-muted-foreground mt-1">{t('displayNameHelper') || 'Defaults to company name if empty'}</p>
                  </div>
                  <div>
                    <Label htmlFor="phone" className="mb-1 block text-start">{t('phoneNumber')} <span className="text-danger-text">*</span></Label>
                    <div className="flex gap-2" dir="ltr">
                      <div className="w-28 shrink-0">
                        <CmxSelect
                          aria-label={t('countryCode') || 'Country code'}
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          disabled={loading}
                          options={COUNTRY_CODES.map((c) => ({ value: c.code, label: `${c.flag} ${c.code}` }))}
                        />
                      </div>
                      <CmxInput id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className="flex-1 tabular-nums" placeholder="90123456" required disabled={loading} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email" className="mb-1 block text-start">{t('emailOptional')}</Label>
                    <CmxInput id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder="customer@example.com" disabled={loading} />
                  </div>
                </div>

                {/* Company details */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-foreground border-b pb-2">{tB2b('companyInfo') || 'Company Info'}</h3>
                  <div>
                    <Label htmlFor="companyName" className="mb-1 block text-start">{tB2b('companyName')} <span className="text-danger-text">*</span></Label>
                    <CmxInput id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} placeholder={tB2b('companyName')} required disabled={loading} />
                  </div>
                  <div>
                    <Label htmlFor="companyName2" className="mb-1 block text-start">{tB2b('companyName2')}</Label>
                    <CmxInput id="companyName2" type="text" value={companyName2} onChange={(e) => setCompanyName2(e.target.value)} dir="rtl" className="text-end" placeholder={tB2b('companyName2')} disabled={loading} />
                  </div>
                  <div>
                    <Label htmlFor="taxId" className="mb-1 block text-start">{tB2b('taxId')}</Label>
                    <CmxInput id="taxId" type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} dir="ltr" placeholder={tB2b('taxId')} disabled={loading} />
                  </div>
                  <div>
                    <Label htmlFor="costCenterCode" className="mb-1 block text-start">{tB2b('costCenterCode')}</Label>
                    <CmxInput id="costCenterCode" type="text" value={costCenterCode} onChange={(e) => setCostCenterCode(e.target.value)} dir="ltr" placeholder={tB2b('costCenterCode')} disabled={loading} />
                  </div>
                </div>
              </div>

              {/* Credit & payment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <h3 className="text-sm font-medium text-foreground md:col-span-2">{tB2b('creditLimit')} & {tB2b('paymentTermsDays')}</h3>
                <div>
                  <Label htmlFor="creditLimit" className="mb-1 block text-start">{tB2b('creditLimit')}</Label>
                  <CmxInput id="creditLimit" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} min={0} step={0.01} dir="ltr" className="tabular-nums" placeholder="0" disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="paymentTermsDays" className="mb-1 block text-start">{tB2b('paymentTermsDays')}</Label>
                  <CmxInput id="paymentTermsDays" type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} min={0} dir="ltr" className="tabular-nums" placeholder="30" disabled={loading} />
                </div>
              </div>

              {/* Address (optional) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                <h3 className="text-sm font-medium text-foreground md:col-span-2">{t('address') || 'Address'}</h3>
                <div className="md:col-span-2">
                  <Label htmlFor="address" className="mb-1 block text-start">{t('address')}</Label>
                  <CmxInput id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} placeholder={t('address')} disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="area" className="mb-1 block text-start">{t('area') || 'Area'}</Label>
                  <CmxInput id="area" type="text" value={area} onChange={(e) => setArea(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="building" className="mb-1 block text-start">{t('building') || 'Building'}</Label>
                  <CmxInput id="building" type="text" value={building} onChange={(e) => setBuilding(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} disabled={loading} />
                </div>
                <div>
                  <Label htmlFor="floor" className="mb-1 block text-start">{t('floor') || 'Floor'}</Label>
                  <CmxInput id="floor" type="text" value={floor} onChange={(e) => setFloor(e.target.value)} dir="ltr" disabled={loading} />
                </div>
              </div>

              <div className="pt-6 flex items-center justify-end gap-3">
                <CmxButton type="button" variant="outline" disabled={loading} asChild>
                  <Link href="/dashboard/b2b/customers">{tCommon('cancel')}</Link>
                </CmxButton>
                <CmxButton type="submit" loading={loading} disabled={loading}>
                  {loading ? (t('creating') || 'Creating...') : (tB2b('createB2BCustomer') || 'Create B2B Customer')}
                </CmxButton>
              </div>
            </form>
          </CmxCardContent>
        </CmxCard>
      </div>
    </RequireAnyPermission>
  );
}
