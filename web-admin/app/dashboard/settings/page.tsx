/**
 * Enhanced Tenant Settings Page
 * Phase 4: Client Frontend Enhancement
 *
 * Features:
 * - Profile info display
 * - Source badges for each setting
 * - Explain drawer for resolution trace
 * - Reset to default functionality
 *
 * Route: /dashboard/settings (protected)
 */

'use client';

import React, { useState, useEffect } from 'react';
import { CmxCard } from '@ui/primitives/cmx-card';
import { Badge } from '@ui/primitives/badge';
import { CmxButton, Alert } from '@ui/primitives';
import { CmxTabsPanel } from '@ui/navigation';
import { Info, HelpCircle } from 'lucide-react';
import type { Tenant } from '@/lib/types/tenant';
import { GeneralSettings } from '@features/settings/ui/GeneralSettings';
import { BrandingSettings } from '@features/settings/ui/BrandingSettings';
import { BusinessHoursSettings } from '@features/settings/ui/BusinessHoursSettings';
import { TenantSettings } from '@features/settings/ui/TenantSettings';
import { BranchSettings } from '@features/settings/ui/BranchSettings';
import { UserSettings } from '@features/settings/ui/UserSettings';
import { FeatureFlagsSettings } from '@features/settings/ui/FeatureFlagsSettings';
import { PlanLimitsSettings } from '@features/settings/ui/PlanLimitsSettings';
import { SubscriptionSettings } from '@features/settings/ui/SubscriptionSettings';
import { ProfileInfoCard } from '@features/settings/ui/profile-info-card';
import { settingsClient, type ResolvedSetting } from '@/lib/api/settings-client';

export default function SettingsPage() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [effectiveSettings, setEffectiveSettings] = useState<ResolvedSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch tenant data
      const tenantResponse = await fetch('/api/v1/tenants/me');
      const tenantData = await tenantResponse.json();

      if (!tenantResponse.ok) {
        throw new Error(tenantData.error || 'Failed to fetch tenant data');
      }

      setTenant(tenantData.data);

      // Fetch effective settings
      const settings = await settingsClient.getEffectiveSettings();
      setEffectiveSettings(settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecompute = async () => {
    try {
      await fetchData();
    } catch (err) {
      console.error('Failed to recompute settings:', err);
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
      id: 'tenant-settings',
      label: 'Tenant Settings',
      icon: <span>🧩</span>,
      content: <TenantSettings />,
    },
    {
      id: 'branch-settings',
      label: 'Branch Settings',
      icon: <span>🏬</span>,
      content: <BranchSettings />,
    },
    {
      id: 'user-settings',
      label: 'User Settings',
      icon: <span>👤</span>,
      content: <UserSettings />,
    },
    {
      id: 'feature-flags',
      label: 'Feature Flags',
      icon: <span>🚩</span>,
      content: <FeatureFlagsSettings />,
    },
    {
      id: 'plan-limits',
      label: 'Plan Limits',
      icon: <span>📊</span>,
      content: <PlanLimitsSettings />,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Page Header */}
      <div className="mb-6">
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

      {/* Profile Info Card */}
      <div className="mb-6">
        <ProfileInfoCard onRecompute={handleRecompute} />
      </div>

      {/* Info Banner */}
      <div className="mb-6">
        <CmxCard className="bg-blue-50 border-blue-200">
          <div className="p-4 flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-900">
                7-Layer Settings Resolution
              </h3>
              <p className="mt-1 text-sm text-blue-800">
                Settings are resolved through 7 layers: System Default → Profile → Plan → Feature Flags → Tenant → Branch → User.
                Look for source badges next to each setting to see where the value comes from.
              </p>
              <CmxButton
                variant="ghost"
                size="sm"
                className="mt-2 text-blue-700 hover:text-blue-900 p-0 h-auto"
              >
                <HelpCircle className="h-4 w-4 mr-1" />
                Learn more about settings resolution
              </CmxButton>
            </div>
          </div>
        </CmxCard>
      </div>

      {/* Tabs */}
      <CmxTabsPanel tabs={tabs} defaultTab="general" />
    </div>
  );
}
