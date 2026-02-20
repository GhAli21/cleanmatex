/**
 * Tenant Registration Page
 * Multi-step self-service registration form
 * Route: /register/tenant (public)
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CmxButton, CmxInput, CmxSelect, Alert } from '@ui/primitives';
import type { TenantRegistrationRequest } from '@/lib/types/tenant';

type Step = 1 | 2 | 3;

const COUNTRIES = [
  { value: 'OM', label: 'Oman (عمان)' },
  { value: 'SA', label: 'Saudi Arabia (السعودية)' },
  { value: 'AE', label: 'UAE (الإمارات)' },
  { value: 'KW', label: 'Kuwait (الكويت)' },
  { value: 'BH', label: 'Bahrain (البحرين)' },
  { value: 'QA', label: 'Qatar (قطر)' },
];

const CURRENCIES = [
  { value: 'OMR', label: 'OMR - Omani Rial' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'KWD', label: 'KWD - Kuwaiti Dinar' },
  { value: 'BHD', label: 'BHD - Bahraini Dinar' },
  { value: 'QAR', label: 'QAR - Qatari Riyal' },
];

const TIMEZONES = [
  { value: 'Asia/Muscat', label: 'Asia/Muscat (UTC+4)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
  { value: 'Asia/Kuwait', label: 'Asia/Kuwait (UTC+3)' },
  { value: 'Asia/Bahrain', label: 'Asia/Bahrain (UTC+3)' },
  { value: 'Asia/Qatar', label: 'Asia/Qatar (UTC+3)' },
];

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic (العربية)' },
];

export default function TenantRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);

  const [formData, setFormData] = useState<TenantRegistrationRequest>({
    businessName: '',
    businessNameAr: '',
    slug: '',
    email: '',
    phone: '',
    country: 'OM',
    currency: 'OMR',
    timezone: 'Asia/Muscat',
    language: 'en',
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
      if (!formData.businessName) newErrors.businessName = 'Business name is required';
      if (!formData.slug) newErrors.slug = 'Slug is required';
      if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
        newErrors.slug = 'Slug must contain only lowercase letters, numbers, and hyphens';
      }
      if (formData.slug && slugAvailable === false) {
        newErrors.slug = 'This slug is already taken. Please choose another.';
      }
      if (!formData.email) newErrors.email = 'Email is required';
      if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
      if (!formData.phone) newErrors.phone = 'Phone number is required';
    }

    if (currentStep === 2) {
      if (!formData.country) newErrors.country = 'Country is required';
      if (!formData.currency) newErrors.currency = 'Currency is required';
      if (!formData.timezone) newErrors.timezone = 'Timezone is required';
    }

    if (currentStep === 3) {
      if (!formData.adminUser.email) newErrors.adminEmail = 'Admin email is required';
      if (formData.adminUser.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.adminUser.email)) {
        newErrors.adminEmail = 'Invalid email format';
      }
      if (!formData.adminUser.password) newErrors.adminPassword = 'Password is required';
      if (formData.adminUser.password && formData.adminUser.password.length < 8) {
        newErrors.adminPassword = 'Password must be at least 8 characters';
      }
      if (formData.adminUser.password && !/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/.test(formData.adminUser.password)) {
        newErrors.adminPassword = 'Password must include uppercase, number, and special character';
      }
      if (!formData.adminUser.displayName) newErrors.adminDisplayName = 'Display name is required';
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
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // Redirect to success page or dashboard
      router.push('/register/tenant/success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create Your Account</h1>
          <p className="mt-2 text-gray-600">
            Start your 14-day free trial. No credit card required.
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
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      step > s ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            <span>Business Info</span>
            <span>Preferences</span>
            <span>Admin Account</span>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="error" message={error} onClose={() => setError('')} className="mb-6" />
        )}

        {/* Form Card */}
        <CmxCard>
          <CmxCardHeader>
            <div>
              <CmxCardTitle>
                {step === 1
                  ? 'Business Information'
                  : step === 2
                  ? 'Regional Preferences'
                  : 'Admin Account'}
              </CmxCardTitle>
              <CmxCardDescription>
                {step === 1
                  ? 'Tell us about your laundry business'
                  : step === 2
                  ? 'Configure your regional settings'
                  : 'Create your administrator account'}
              </CmxCardDescription>
            </div>
          </CmxCardHeader>
          <CmxCardContent>
          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name <span className="text-red-500">*</span></label>
                <CmxInput
                  value={formData.businessName}
                  onChange={(e) => handleBusinessNameChange(e.target.value)}
                  placeholder="e.g., Fresh Clean Laundry"
                  required
                  className="w-full"
                />
                {errors.businessName && <p className="mt-1 text-sm text-red-600">{errors.businessName}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name (Arabic)</label>
                <CmxInput
                  value={formData.businessNameAr || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, businessNameAr: e.target.value }))
                  }
                  placeholder="e.g., مغسلة فريش كلين"
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-500">Optional: Arabic name for bilingual support</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug (URL Identifier) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <CmxInput
                    value={formData.slug}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, slug: e.target.value }));
                      setSlugAvailable(null);
                    }}
                    onBlur={() => checkSlugAvailability(formData.slug)}
                    placeholder="e.g., fresh-clean"
                    required
                    className="w-full pr-20"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                    {slugChecking ? (
                      <span className="text-gray-400">Checking...</span>
                    ) : slugAvailable === true ? (
                      <span className="text-green-500">✓</span>
                    ) : slugAvailable === false ? (
                      <span className="text-red-500">✗</span>
                    ) : null}
                  </div>
                </div>
                {errors.slug && <p className="mt-1 text-sm text-red-600">{errors.slug}</p>}
                <p className="mt-1 text-xs text-gray-500">Will be used in your URL: app.cleanmatex.com/fresh-clean</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Email <span className="text-red-500">*</span></label>
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
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-500">*</span></label>
                <CmxInput
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="+968 9012 3456"
                  required
                  className="w-full"
                />
                {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
              </div>
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country <span className="text-red-500">*</span></label>
                <CmxSelect
                  value={formData.country}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, country: e.target.value }))
                  }
                  options={COUNTRIES}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency <span className="text-red-500">*</span></label>
                <CmxSelect
                  value={formData.currency}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, currency: e.target.value }))
                  }
                  options={CURRENCIES}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Used for invoices and pricing</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone <span className="text-red-500">*</span></label>
                <CmxSelect
                  value={formData.timezone}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, timezone: e.target.value }))
                  }
                  options={TIMEZONES}
                  required
                />
                <p className="mt-1 text-xs text-gray-500">For scheduling and timestamps</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Language <span className="text-red-500">*</span></label>
                <CmxSelect
                  value={formData.language}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, language: e.target.value }))
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Email <span className="text-red-500">*</span></label>
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
                {errors.adminEmail && <p className="mt-1 text-sm text-red-600">{errors.adminEmail}</p>}
                <p className="mt-1 text-xs text-gray-500">You'll use this email to log in</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
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
                {errors.adminPassword && <p className="mt-1 text-sm text-red-600">{errors.adminPassword}</p>}
                <p className="mt-1 text-xs text-gray-500">Min 8 characters with uppercase, number, and special character</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Display Name <span className="text-red-500">*</span></label>
                <CmxInput
                  value={formData.adminUser.displayName}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      adminUser: { ...prev.adminUser, displayName: e.target.value },
                    }))
                  }
                  placeholder="John Admin"
                  required
                  className="w-full"
                />
                {errors.adminDisplayName && <p className="mt-1 text-sm text-red-600">{errors.adminDisplayName}</p>}
              </div>

              <Alert
                variant="info"
                message="Your 14-day free trial starts immediately. No credit card required."
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <CmxButton
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              Back
            </CmxButton>

            {step < 3 ? (
              <CmxButton onClick={handleNext}>Next</CmxButton>
            ) : (
              <CmxButton onClick={handleSubmit} loading={isLoading}>
                Create Account
              </CmxButton>
            )}
          </div>
          </CmxCardContent>
        </CmxCard>

        {/* Login Link */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <a href="/login" className="text-blue-600 hover:text-blue-700 font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}

