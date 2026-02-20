/**
 * Business Hours Settings Tab
 * Configure weekly business hours
 */

'use client';

import React, { useState } from 'react';
import { CmxButton, Alert } from '@ui/primitives';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardDescription, CmxCardContent, CmxCardFooter } from '@ui/primitives/cmx-card';
import type { Tenant, BusinessHours, DayHours } from '@/lib/types/tenant';
import type { ResolvedSetting } from '@/lib/api/settings-client';

const DAYS = [
  { key: 'mon', label: 'Monday' },
  { key: 'tue', label: 'Tuesday' },
  { key: 'wed', label: 'Wednesday' },
  { key: 'thu', label: 'Thursday' },
  { key: 'fri', label: 'Friday' },
  { key: 'sat', label: 'Saturday' },
  { key: 'sun', label: 'Sunday' },
] as const;

interface BusinessHoursSettingsProps {
  tenant: Tenant;
  onUpdate: () => void;
  effectiveSettings?: ResolvedSetting[];
}

export function BusinessHoursSettings({ tenant, onUpdate, effectiveSettings }: BusinessHoursSettingsProps) {
  const [businessHours, setBusinessHours] = useState<BusinessHours>(
    tenant.business_hours || {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleToggleDay = (day: keyof BusinessHours) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: prev[day] ? null : { open: '08:00', close: '18:00' },
    }));
  };

  const handleTimeChange = (
    day: keyof BusinessHours,
    field: 'open' | 'close',
    value: string
  ) => {
    setBusinessHours((prev) => ({
      ...prev,
      [day]: prev[day] ? { ...prev[day] as DayHours, [field]: value } : null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccess('');
    setError('');

    try {
      const response = await fetch('/api/v1/tenants/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ business_hours: businessHours }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update business hours');
      }

      setSuccess('Business hours updated successfully');
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update business hours');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <CmxCard>
        <CmxCardHeader>
          <div>
            <CmxCardTitle>Business Hours</CmxCardTitle>
            <CmxCardDescription>Set your weekly operating hours</CmxCardDescription>
          </div>
        </CmxCardHeader>
        <CmxCardContent>
        {success && (
          <Alert variant="success" message={success} onClose={() => setSuccess('')} className="mb-4" />
        )}

        {error && (
          <Alert variant="error" message={error} onClose={() => setError('')} className="mb-4" />
        )}

        <div className="space-y-3">
          {DAYS.map(({ key, label }) => {
            const hours = businessHours[key];
            const isOpen = !!hours;

            return (
              <div
                key={key}
                className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg"
              >
                {/* Day and Toggle */}
                <div className="w-32">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isOpen}
                      onChange={() => handleToggleDay(key)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-gray-900">{label}</span>
                  </label>
                </div>

                {/* Time Inputs */}
                {isOpen && hours ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      value={hours.open}
                      onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="time"
                      value={hours.close}
                      onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg"
                      required
                    />
                  </div>
                ) : (
                  <span className="text-gray-400">Closed</span>
                )}
              </div>
            );
          })}
        </div>
        </CmxCardContent>
        <CmxCardFooter>
          <div className="flex justify-end gap-3">
            <CmxButton
              type="button"
              variant="outline"
              onClick={() => setBusinessHours(tenant.business_hours || {})}
            >
              Reset
            </CmxButton>
            <CmxButton type="submit" loading={isLoading}>
              Save Hours
            </CmxButton>
          </div>
        </CmxCardFooter>
      </CmxCard>
    </form>
  );
}
