/**
 * Tenant Registration Page
 * Multi-step self-service registration form
 * Route: /register/tenant (public)
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Card, CardHeader, Alert } from '@/components/ui';
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
      // TODO: Implement actual slug check API
      // For now, simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSlugAvailable(true);
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
        <Card>
          <CardHeader
            title={
              step === 1
                ? 'Business Information'
                : step === 2
                ? 'Regional Preferences'
                : 'Admin Account'
            }
            subtitle={
              step === 1
                ? 'Tell us about your laundry business'
                : step === 2
                ? 'Configure your regional settings'
                : 'Create your administrator account'
            }
          />

          {/* Step 1: Business Info */}
          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Business Name"
                value={formData.businessName}
                onChange={(e) => handleBusinessNameChange(e.target.value)}
                error={errors.businessName}
                placeholder="e.g., Fresh Clean Laundry"
                required
              />

              <Input
                label="Business Name (Arabic)"
                value={formData.businessNameAr || ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, businessNameAr: e.target.value }))
                }
                placeholder="e.g., مغسلة فريش كلين"
                helpText="Optional: Arabic name for bilingual support"
              />

              <div>
                <Input
                  label="Slug (URL Identifier)"
                  value={formData.slug}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, slug: e.target.value }));
                    setSlugAvailable(null);
                  }}
                  onBlur={() => checkSlugAvailability(formData.slug)}
                  error={errors.slug}
                  placeholder="e.g., fresh-clean"
                  required
                  helpText="Will be used in your URL: app.cleanmatex.com/fresh-clean"
                  rightIcon={
                    slugChecking ? (
                      <span className="text-gray-400">Checking...</span>
                    ) : slugAvailable === true ? (
                      <span className="text-green-500">✓</span>
                    ) : slugAvailable === false ? (
                      <span className="text-red-500">✗</span>
                    ) : null
                  }
                />
              </div>

              <Input
                label="Business Email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                error={errors.email}
                placeholder="admin@freshclean.com"
                required
              />

              <Input
                label="Phone Number"
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                error={errors.phone}
                placeholder="+968 9012 3456"
                required
              />
            </div>
          )}

          {/* Step 2: Preferences */}
          {step === 2 && (
            <div className="space-y-4">
              <Select
                label="Country"
                value={formData.country}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, country: e.target.value }))
                }
                options={COUNTRIES}
                required
              />

              <Select
                label="Currency"
                value={formData.currency}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, currency: e.target.value }))
                }
                options={CURRENCIES}
                required
                helpText="Used for invoices and pricing"
              />

              <Select
                label="Timezone"
                value={formData.timezone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, timezone: e.target.value }))
                }
                options={TIMEZONES}
                required
                helpText="For scheduling and timestamps"
              />

              <Select
                label="Default Language"
                value={formData.language}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, language: e.target.value }))
                }
                options={LANGUAGES}
                required
              />
            </div>
          )}

          {/* Step 3: Admin Account */}
          {step === 3 && (
            <div className="space-y-4">
              <Input
                label="Admin Email"
                type="email"
                value={formData.adminUser.email}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    adminUser: { ...prev.adminUser, email: e.target.value },
                  }))
                }
                error={errors.adminEmail}
                placeholder="admin@freshclean.com"
                required
                helpText="You'll use this email to log in"
              />

              <Input
                label="Password"
                type="password"
                value={formData.adminUser.password}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    adminUser: { ...prev.adminUser, password: e.target.value },
                  }))
                }
                error={errors.adminPassword}
                required
                helpText="Min 8 characters with uppercase, number, and special character"
              />

              <Input
                label="Display Name"
                value={formData.adminUser.displayName}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    adminUser: { ...prev.adminUser, displayName: e.target.value },
                  }))
                }
                error={errors.adminDisplayName}
                placeholder="John Admin"
                required
              />

              <Alert
                variant="info"
                message="Your 14-day free trial starts immediately. No credit card required."
              />
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={step === 1}
            >
              Back
            </Button>

            {step < 3 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} isLoading={isLoading}>
                Create Account
              </Button>
            )}
          </div>
        </Card>

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

