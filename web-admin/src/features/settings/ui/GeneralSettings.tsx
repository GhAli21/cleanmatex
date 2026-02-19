/**
 * General Settings Tab
 * Business name, contact info, regional preferences
 */

'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardFooter, Input, Select, Alert } from '@ui/compat';
import { CmxButton } from '@ui/primitives';
import type { Tenant, TenantUpdateRequest } from '@/lib/types/tenant';
import type { ResolvedSetting } from '@/lib/api/settings-client';

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

interface GeneralSettingsProps {
  tenant: Tenant;
  onUpdate: () => void;
  effectiveSettings?: ResolvedSetting[];
}

export function GeneralSettings({ tenant, onUpdate, effectiveSettings }: GeneralSettingsProps) {
  const [formData, setFormData] = useState({
    name: tenant.name,
    name2: tenant.name2 || '',
    phone: tenant.phone,
    address: tenant.address || '',
    city: tenant.city || '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccess('');
    setError('');

    try {
      const updates: TenantUpdateRequest = {
        name: formData.name,
        name2: formData.name2 || undefined,
        phone: formData.phone,
        address: formData.address || undefined,
        city: formData.city || undefined,
      };

      const response = await fetch('/api/v1/tenants/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update settings');
      }

      setSuccess('Settings updated successfully');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader
          title="General Information"
          subtitle="Update your business name, contact details, and regional settings"
        />

        {success && (
          <Alert
            variant="success"
            message={success}
            onClose={() => setSuccess('')}
            className="mb-4"
          />
        )}

        {error && (
          <Alert variant="error" message={error} onClose={() => setError('')} className="mb-4" />
        )}

        <div className="space-y-6">
          {/* Business Name */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Business Name (English)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <Input
              label="Business Name (Arabic)"
              value={formData.name2}
              onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
              placeholder="Optional"
            />
          </div>

          {/* Contact Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={tenant.email}
              disabled
              helpText="Contact support to change email"
            />

            <Input
              label="Phone Number"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              required
            />
          </div>

          {/* Address */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Building number, street name"
            />

            <Input
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="e.g., Muscat"
            />
          </div>

          {/* Regional Settings */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Regional Preferences
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Country
                </label>
                <p className="text-gray-900">{tenant.country}</p>
                <p className="text-xs text-gray-500 mt-1">Contact support to change</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency
                </label>
                <p className="text-gray-900">{tenant.currency}</p>
                <p className="text-xs text-gray-500 mt-1">Contact support to change</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timezone
                </label>
                <p className="text-gray-900">{tenant.timezone}</p>
                <p className="text-xs text-gray-500 mt-1">Contact support to change</p>
              </div>
            </div>
          </div>

          {/* Account Info */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Slug</label>
                <p className="mt-1 text-gray-900">{tenant.slug}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Your URL: app.cleanmatex.com/{tenant.slug}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Account Created
                </label>
                <p className="mt-1 text-gray-900">
                  {new Date(tenant.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <CardFooter>
          <div className="flex justify-end gap-3">
            <CmxButton
              type="button"
              variant="outline"
              onClick={() => setFormData({
                name: tenant.name,
                name2: tenant.name2 || '',
                phone: tenant.phone,
                address: tenant.address || '',
                city: tenant.city || '',
              })}
            >
              Reset
            </CmxButton>
            <CmxButton type="submit" loading={isLoading}>
              Save Changes
            </CmxButton>
          </div>
        </CardFooter>
      </Card>
    </form>
  );
}
