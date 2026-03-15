
/**
 * B2B Customer Creation Page screen
 * Dedicated screen to create B2B customers within the B2B section
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRTL } from '@/lib/hooks/useRTL';
import { createCustomer } from '@/lib/api/customers';
import { getPhoneCountryCodeAction } from '@/app/actions/tenant/get-phone-country-code';
import { useAuth } from '@/lib/auth/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/primitives/card';
import { Button } from '@ui/primitives/button';
import { useMessage } from '@ui/feedback';

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

export default function B2BCustomerCreatePage() {
  const router = useRouter();
  const t = useTranslations('customers');
  const tB2b = useTranslations('b2b');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { currentTenant } = useAuth();
  const { showErrorFrom } = useMessage();

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (currentTenant?.id) {
      getPhoneCountryCodeAction(currentTenant.id)
        .then((code) => {
          const found = COUNTRY_CODES.find((c) => c.code === code);
          setCountryCode(found ? code : '+968');
        })
        .catch(() => { /* keep default */ });
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

    setLoading(true);
    try {
      const fullPhone = phone.trim().startsWith('+') ? phone.trim() : `${countryCode}${phone.replace(/\D/g, '')}`;
      await createCustomer({
        type: 'b2b',
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
      });
      router.push('/dashboard/b2b/customers');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : t('failedToCreateCustomer');
      setError(errorMsg);
      showErrorFrom(err, { fallback: t('failedToCreateCustomer') });
      setLoading(false);
    }
  };

  const inputClass = (dir?: 'ltr' | 'rtl') =>
    `block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed ${dir === 'rtl' ? 'text-right' : isRTL ? 'text-right' : 'text-left'}`;
  const labelClass = `block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`;
  const flexRow = `flex ${isRTL ? 'flex-row-reverse' : ''}`;

  return (
    <div className="space-y-6">
      <div className={flexRow + ' items-center justify-between gap-4'}>
        <div className={flexRow + ' items-center gap-3'}>
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/b2b/customers" aria-label={tCommon('back')}>
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{tB2b('createB2BCustomer') || 'Create B2B Customer'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {tB2b('createB2BCustomerSubtitle') || 'Add a new business customer with company details and credit terms'}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{tB2b('companyDetails') || 'Company & Contact Details'}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className={`rounded-md p-4 ${isRTL ? 'border-r-4 border-l-0' : 'border-l-4 border-r-0'} border-red-400 bg-red-50`}>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact person */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 border-b pb-2">{t('contactInformation') || 'Contact Person'}</h3>
                <div>
                  <label htmlFor="firstName" className={labelClass}>{t('firstName')} <span className="text-red-500">*</span></label>
                  <input id="firstName" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} placeholder={t('firstName')} required disabled={loading} />
                </div>
                <div>
                  <label htmlFor="lastName" className={labelClass}>{t('lastName')}</label>
                  <input id="lastName" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} placeholder={t('lastName')} disabled={loading} />
                </div>
                <div>
                  <label htmlFor="phone" className={labelClass}>{t('phoneNumber')} <span className="text-red-500">*</span></label>
                  <div className={flexRow}>
                    <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} disabled={loading} className={`inline-flex items-center px-3 py-2 border border-gray-300 bg-gray-50 text-gray-700 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 ${isRTL ? 'rounded-r-md border-r border-l-0' : 'rounded-l-md border-l border-r-0'}`}>
                      {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.code}</option>)}
                    </select>
                    <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={`flex-1 ${inputClass('ltr')} ${isRTL ? 'rounded-l-md' : 'rounded-r-md'}`} placeholder="90123456" required disabled={loading} />
                  </div>
                </div>
                <div>
                  <label htmlFor="email" className={labelClass}>{t('emailOptional')}</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" className={inputClass()} placeholder="customer@example.com" disabled={loading} />
                </div>
              </div>

              {/* Company details */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-900 border-b pb-2">{tB2b('companyInfo') || 'Company Info'}</h3>
                <div>
                  <label htmlFor="companyName" className={labelClass}>{tB2b('companyName')} <span className="text-red-500">*</span></label>
                  <input id="companyName" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} placeholder={tB2b('companyName')} required disabled={loading} />
                </div>
                <div>
                  <label htmlFor="companyName2" className={labelClass}>{tB2b('companyName2')}</label>
                  <input id="companyName2" type="text" value={companyName2} onChange={(e) => setCompanyName2(e.target.value)} dir="rtl" className={inputClass('rtl')} placeholder={tB2b('companyName2')} disabled={loading} />
                </div>
                <div>
                  <label htmlFor="taxId" className={labelClass}>{tB2b('taxId')}</label>
                  <input id="taxId" type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} dir="ltr" className={inputClass()} placeholder={tB2b('taxId')} disabled={loading} />
                </div>
                <div>
                  <label htmlFor="costCenterCode" className={labelClass}>{tB2b('costCenterCode')}</label>
                  <input id="costCenterCode" type="text" value={costCenterCode} onChange={(e) => setCostCenterCode(e.target.value)} dir="ltr" className={inputClass()} placeholder={tB2b('costCenterCode')} disabled={loading} />
                </div>
              </div>
            </div>

            {/* Credit & payment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-900 md:col-span-2">{tB2b('creditLimit')} & {tB2b('paymentTermsDays')}</h3>
              <div>
                <label htmlFor="creditLimit" className={labelClass}>{tB2b('creditLimit')}</label>
                <input id="creditLimit" type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} min={0} step={0.01} dir="ltr" className={inputClass()} placeholder="0" disabled={loading} />
              </div>
              <div>
                <label htmlFor="paymentTermsDays" className={labelClass}>{tB2b('paymentTermsDays')}</label>
                <input id="paymentTermsDays" type="number" value={paymentTermsDays} onChange={(e) => setPaymentTermsDays(e.target.value)} min={0} dir="ltr" className={inputClass()} placeholder="30" disabled={loading} />
              </div>
            </div>

            {/* Address (optional) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
              <h3 className="text-sm font-medium text-gray-900 md:col-span-2">{t('address') || 'Address'}</h3>
              <div className="md:col-span-2">
                <label htmlFor="address" className={labelClass}>{t('address')}</label>
                <input id="address" type="text" value={address} onChange={(e) => setAddress(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} placeholder={t('address')} disabled={loading} />
              </div>
              <div>
                <label htmlFor="area" className={labelClass}>{t('area') || 'Area'}</label>
                <input id="area" type="text" value={area} onChange={(e) => setArea(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} disabled={loading} />
              </div>
              <div>
                <label htmlFor="building" className={labelClass}>{t('building') || 'Building'}</label>
                <input id="building" type="text" value={building} onChange={(e) => setBuilding(e.target.value)} dir={isRTL ? 'rtl' : 'ltr'} className={inputClass()} disabled={loading} />
              </div>
              <div>
                <label htmlFor="floor" className={labelClass}>{t('floor') || 'Floor'}</label>
                <input id="floor" type="text" value={floor} onChange={(e) => setFloor(e.target.value)} dir="ltr" className={inputClass()} disabled={loading} />
              </div>
            </div>

            <div className={`pt-6 flex items-center ${isRTL ? 'flex-row-reverse justify-start gap-3' : 'justify-end gap-3'}`}>
              <Button type="button" variant="outline" disabled={loading} asChild>
                <Link href="/dashboard/b2b/customers">{tCommon('cancel')}</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (t('creating') || 'Creating...') : (tB2b('createB2BCustomer') || 'Create B2B Customer')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
