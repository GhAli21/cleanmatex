/**
 * Tenant Registration Page
 * Multi-step self-service registration form
 * Route: /register/tenant (public)
 */

'use client';

import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import React, { useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getCountryCallingCode, type CountryCode } from 'libphonenumber-js';
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives';
import { CmxTimeZoneSelect } from '@ui/clock';
import {
  CmxCard,
  CmxCardHeader,
  CmxCardTitle,
  CmxCardDescription,
  CmxCardContent,
} from '@ui/primitives/cmx-card';
import type { TenantRegistrationRequest } from '@/lib/types/tenant';
import {
  REGISTRATION_SERVER_DEFAULTS,
  currencyForCountry,
  readBrowserRegistrationDefaults,
  subscribeRegistrationDefaults,
  type RegistrationLocaleDefaults,
} from '@/lib/utils/registration-browser-defaults';

type Step = 1 | 2 | 3;

const COUNTRIES = [
  { value: 'US', label: 'United States (الولايات المتحدة)' },
  { value: 'OM', label: 'Oman (عمان)' },
  { value: 'SA', label: 'Saudi Arabia (السعودية)' },
  { value: 'AE', label: 'UAE (الإمارات)' },
  { value: 'KW', label: 'Kuwait (الكويت)' },
  { value: 'BH', label: 'Bahrain (البحرين)' },
  { value: 'QA', label: 'Qatar (قطر)' },
];

const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'OMR', label: 'OMR - Omani Rial' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'KWD', label: 'KWD - Kuwaiti Dinar' },
  { value: 'BHD', label: 'BHD - Bahraini Dinar' },
  { value: 'QAR', label: 'QAR - Qatari Riyal' },
];


const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic (العربية)' },
];

function ensureOption(
  options: Array<{ value: string; label: string }>,
  value: string,
  label: string,
): Array<{ value: string; label: string }> {
  return options.some((option) => option.value === value) ? options : [{ value, label }, ...options];
}

function regionOptionLabel(code: string): string {
  try {
    const english = new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
    const arabic = new Intl.DisplayNames(['ar'], { type: 'region' }).of(code);
    return arabic && arabic !== code ? `${english} (${arabic})` : english;
  } catch {
    return code;
  }
}

function currencyOptionLabel(code: string): string {
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'currency' }).of(code);
    return name ? `${code} - ${name}` : code;
  } catch {
    return code;
  }
}

function phonePlaceholder(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) return '+1';
  try {
    return `+${getCountryCallingCode(country as CountryCode)}`;
  } catch {
    return '+1';
  }
}

/**
 *
 */
export default function TenantRegisterPage() {
  const router = useRouter();
  const t = useTranslations('auth.tenantRegister');
  const tCommon = useTranslations('common');
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  const suggestedLocale = useSyncExternalStore(
    subscribeRegistrationDefaults,
    readBrowserRegistrationDefaults,
    () => REGISTRATION_SERVER_DEFAULTS,
  );
  const [localeChoice, setLocaleChoice] = useState<RegistrationLocaleDefaults | null>(null);
  const locale = localeChoice ?? suggestedLocale;

  const [formData, setFormData] = useState<TenantRegistrationRequest>({
    businessName: '',
    businessNameAr: '',
    slug: '',
    email: '',
    phone: '',
    country: REGISTRATION_SERVER_DEFAULTS.country,
    currency: REGISTRATION_SERVER_DEFAULTS.currency,
    timezone: REGISTRATION_SERVER_DEFAULTS.timezone,
    language: REGISTRATION_SERVER_DEFAULTS.language,
    adminUser: {
      email: '',
      password: '',
      displayName: '',
    },
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-generate slug from business name
  const handleBusinessNameChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      businessName: value,
      slug: value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    }));
    setSlugAvailable(null); // Reset slug validation
  };

  // Check slug availability (debounced)
  const checkSlugAvailability = async (slug: string) => {
    if (!slug || slug.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setSlugChecking(true);
    try {
      const res = await fetch(`/api/v1/tenants/check-slug?slug=${encodeURIComponent(slug)}`);
      const json = await res.json();
      if (res.ok) {
        setSlugAvailable(json.available === true);
      } else {
        setSlugAvailable(false);
      }
    } catch (err) {
      setSlugAvailable(false);
    } finally {
      setSlugChecking(false);
    }
  };

  // Validate current step
  const validateStep = (currentStep: Step): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 1) {
      if (!formData.businessName) newErrors.businessName = t('errors.businessNameRequired');
      if (!formData.slug) newErrors.slug = t('errors.slugRequired');
      if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
        newErrors.slug = t('errors.slugFormat');
      }
      if (formData.slug && slugAvailable === false) {
        newErrors.slug = t('errors.slugTaken');
      }
      if (!formData.email) newErrors.email = t('errors.emailRequired');
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = t('errors.invalidEmail');
      }
      if (!formData.phone) newErrors.phone = t('errors.phoneRequired');
    }

    if (currentStep === 2) {
      if (!locale.country) newErrors.country = t('errors.countryRequired');
      if (!locale.currency) newErrors.currency = t('errors.currencyRequired');
      if (!locale.timezone) newErrors.timezone = t('errors.timezoneRequired');
    }

    if (currentStep === 3) {
      if (!formData.adminUser.email) newErrors.adminEmail = t('errors.adminEmailRequired');
      if (formData.adminUser.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminUser.email)) {
        newErrors.adminEmail = t('errors.invalidEmail');
      }
      if (!formData.adminUser.password) newErrors.adminPassword = t('errors.passwordRequired');
      if (formData.adminUser.password && formData.adminUser.password.length < 8) {
        newErrors.adminPassword = t('errors.passwordLength');
      }
      if (formData.adminUser.password && !/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.adminUser.password)) {
        newErrors.adminPassword = t('errors.passwordComplexity');
      }
      if (!formData.adminUser.displayName) newErrors.adminDisplayName = t('errors.displayNameRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(3, prev + 1) as Step);
    }
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1) as Step);
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/tenants/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          country: locale.country,
          currency: locale.currency,
          timezone: locale.timezone,
          language: locale.language,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || t('registrationFailed'));
      }

      // Redirect to success page or dashboard
      router.push('/register/tenant/success');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('registrationFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="mt-2 text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step >= s
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step > s ? 'bg-primary' : 'bg-border'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>{t('stepBusiness')}</span>
            <span>{t('stepPreferences')}</span>
            <span>{t('stepAdmin')}</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <CmxSummaryMessage type="error" message={error} onDismiss={() => setError('')} className="mb-6" />
        )}

        {/* Form Card */}
        <CmxCard>
          <CmxCardHeader>
            <div>
              <CmxCardTitle>
                {step === 1
                  ? t('cardTitleBusiness')
                  : step === 2
                  ? t('cardTitlePreferences')
                  : t('cardTitleAdmin')}
              </CmxCardTitle>
              <CmxCardDescription>
                {step === 1
                  ? t('cardDescBusiness')
                  : step === 2
                  ? t('cardDescPreferences')
                  : t('cardDescAdmin')}
              </CmxCardDescription>
            </div>
          </CmxCardHeader>
          <CmxCardContent>
          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="block mb-1">{t('businessName')} <span className="text-danger-text">*</span></Label>
                <CmxInput
                  value={formData.businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  placeholder={t('businessNamePlaceholder')}
                  required
                  className="w-full"
                />
                {errors.businessName && <p className="mt-1 text-sm text-danger-text">{errors.businessName}</p>}
              </div>

              <div>
                <Label className="block mb-1">{t('businessNameAr')}</Label>
                <CmxInput
                  value={formData.businessNameAr || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, businessNameAr: e.target.value }))
                  }
                  placeholder={t('businessNameArPlaceholder')}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('businessNameArHint')}</p>
              </div>

              <div>
                <Label className="block mb-1">{t('slugLabel')} <span className="text-danger-text">*</span></Label>
                <div className="relative">
                  <CmxInput
                    value={formData.slug}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, slug: e.target.value }));
                      setSlugAvailable(null);
                    }}
                    onBlur={() => checkSlugAvailability(formData.slug)}
                    placeholder={t('slugPlaceholder')}
                    required
                    className="w-full pe-20"
                  />
                  <div className="absolute end-3 top-1/2 -translate-y-1/2 text-sm">
                    {slugChecking ? (
                      <span className="text-muted-foreground">{t('slugChecking')}</span>
                    ) : slugAvailable === true ? (
                      <span className="text-success-text">✓</span>
                    ) : slugAvailable === false ? (
                      <span className="text-danger-text">✗</span>
                    ) : null}
                  </div>
                </div>
                {errors.slug && <p className="mt-1 text-sm text-danger-text">{errors.slug}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{t('slugUrlHint')}</p>
              </div>

              <div>
                <Label className="block mb-1">{t('businessEmail')} <span className="text-danger-text">*</span></Label>
                <CmxInput
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="admin@freshclean.com"
                  required
                  className="w-full"
                />
                {errors.email && <p className="mt-1 text-sm text-danger-text">{errors.email}</p>}
              </div>

              <div>
                <Label className="block mb-1">{t('phoneNumber')} <span className="text-danger-text">*</span></Label>
                <CmxInput
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder={phonePlaceholder(locale.country)}
                  required
                  className="w-full"
                />
                {errors.phone && <p className="mt-1 text-sm text-danger-text">{errors.phone}</p>}
              </div>
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label className="block mb-1">{t('country')} <span className="text-danger-text">*</span></Label>
                <CmxSelect
                  value={locale.country}
                  onChange={(e) =>
                    setLocaleChoice((prev) => ({
                      ...(prev ?? suggestedLocale),
                      country: e.target.value,
                      currency: currencyForCountry(e.target.value),
                    }))
                  }
                  options={ensureOption(COUNTRIES, locale.country, regionOptionLabel(locale.country))}
                  required
                />
              </div>

              <div>
                <Label className="block mb-1">{t('currency')} <span className="text-danger-text">*</span></Label>
                <CmxSelect
                  value={locale.currency}
                  onChange={(e) =>
                    setLocaleChoice((prev) => ({ ...(prev ?? suggestedLocale), currency: e.target.value }))
                  }
                  options={ensureOption(CURRENCIES, locale.currency, currencyOptionLabel(locale.currency))}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('currencyHint')}</p>
              </div>

              <div>
                <Label className="block mb-1">{t('timezone')} <span className="text-danger-text">*</span></Label>
                <CmxTimeZoneSelect
                  source="public"
                  value={locale.timezone}
                  onChange={(zone) =>
                    setLocaleChoice((prev) => ({ ...(prev ?? suggestedLocale), timezone: zone }))
                  }
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">{t('timezoneHint')}</p>
              </div>

              <div>
                <Label className="block mb-1">{t('defaultLanguage')} <span className="text-danger-text">*</span></Label>
                <CmxSelect
                  value={locale.language}
                  onChange={(e) =>
                    setLocaleChoice((prev) => ({
                      ...(prev ?? suggestedLocale),
                      language: e.target.value === 'ar' ? 'ar' : 'en',
                    }))
                  }
                  options={LANGUAGES}
                  required
                />
              </div>
            </div>
          )}

          {/* Step 3: Admin Account */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label className="block mb-1">{t('adminEmail')} <span className="text-danger-text">*</span></Label>
                <CmxInput
                  type="email"
                  value={formData.adminUser.email}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      adminUser: { ...prev.adminUser, email: e.target.value },
                    }))
                  }
                  placeholder="admin@freshclean.com"
                  required
                  className="w-full"
                />
                {errors.adminEmail && <p className="mt-1 text-sm text-danger-text">{errors.adminEmail}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{t('adminEmailHint')}</p>
              </div>

              <div>
                <Label className="block mb-1">{t('password')} <span className="text-danger-text">*</span></Label>
                <CmxInput
                  type="password"
                  value={formData.adminUser.password}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      adminUser: { ...prev.adminUser, password: e.target.value },
                    }))
                  }
                  required
                  className="w-full"
                />
                {errors.adminPassword && <p className="mt-1 text-sm text-danger-text">{errors.adminPassword}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{t('passwordHint')}</p>
              </div>

              <div>
                <Label className="block mb-1">{t('displayName')} <span className="text-danger-text">*</span></Label>
                <CmxInput
                  value={formData.adminUser.displayName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      adminUser: { ...prev.adminUser, displayName: e.target.value },
                    }))
                  }
                  placeholder={t('displayNamePlaceholder')}
                  required
                  className="w-full"
                />
                {errors.adminDisplayName && <p className="mt-1 text-sm text-danger-text">{errors.adminDisplayName}</p>}
              </div>

              <CmxSummaryMessage
                type="info"
                message={t('trialNotice')}
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <CmxButton
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              {tCommon('back')}
            </CmxButton>

            {step < 3 ? (
              <CmxButton onClick={handleNext}>{tCommon('next')}</CmxButton>
            ) : (
              <CmxButton onClick={handleSubmit} loading={isLoading}>
                {t('createAccount')}
              </CmxButton>
            )}
          </div>
          </CmxCardContent>
        </CmxCard>

        {/* Login Link */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t('alreadyHaveAccount')}{' '}
          <Link href="/login" className="text-primary-text hover:text-primary-text/80 font-medium">
            {t('signIn')}
          </Link>
        </p>
      </div>
    </div>
  );
}

