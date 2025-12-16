/**
 * Tenant Settings Page
 * Comprehensive settings interface with 4 tabs
 * Route: /dashboard/settings (protected)
 */

'use client';

import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Card,
  Input,
  Select,
  Button,
  Alert,
  Badge,
} from '@/components/ui';
import type { Tenant } from '@/lib/types/tenant';
import { GeneralSettings } from './components/GeneralSettings';
import { BrandingSettings } from './components/BrandingSettings';
import { BusinessHoursSettings } from './components/BusinessHoursSettings';
import { SubscriptionSettings } from './components/SubscriptionSettings';

export default function SettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTenantData();
  }, []);

  const fetchTenantData = async () => {
    try {
      const response = await fetch('/api/v1/tenants/me');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch tenant data');
      }

      setTenant(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert
          variant="error"
          title="Error Loading Settings"
          message={error || 'Unable to load tenant data'}
        />
      </div>
    );
  }

  const tabs = [
    {
      id: 'general',
      label: 'General',
      icon: '⚙️',
      content: <GeneralSettings tenant={tenant} onUpdate={fetchTenantData} />,
    },
    {
      id: 'branding',
      label: 'Branding',
      icon: '🎨',
      content: <BrandingSettings tenant={tenant} onUpdate={fetchTenantData} />,
    },
    {
      id: 'hours',
      label: 'Business Hours',
      icon: '🕒',
      content: <BusinessHoursSettings tenant={tenant} onUpdate={fetchTenantData} />,
    },
    {
      id: 'subscription',
      label: 'Subscription',
      icon: '💳',
      content: <SubscriptionSettings tenant={tenant} />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
            <p className="mt-1 text-gray-600">
              Manage your account, branding, and preferences
            </p>
          </div>
          <Badge variant={tenant.status === 'trial' ? 'warning' : 'success'}>
            {tenant.status === 'trial' ? 'Trial Account' : 'Active'}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} defaultTab="general" />
    </div>
  );
}
