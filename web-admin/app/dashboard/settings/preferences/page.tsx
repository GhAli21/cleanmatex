/**
 * User Preferences Settings Page
 * Phase 4: Client Frontend Enhancement
 *
 * User-scoped settings (language, theme, timezone, notifications, etc.)
 * Route: /dashboard/settings/preferences
 */

'use client';

import React, { useState, useEffect } from 'react';
import { User, Globe, Palette, Clock, Bell } from 'lucide-react';
import { Card, Button, Select, Input } from '@ui/compat';
import { settingsClient, type ResolvedSetting } from '@/lib/api/settings-client';
import { EnhancedSettingField } from '@features/settings/ui/enhanced-setting-field';

export default function UserPreferencesPage() {
  const [effectiveSettings, setEffectiveSettings] = useState<ResolvedSetting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch effective settings for current user
      const settings = await settingsClient.getEffectiveSettings({
        userId: 'me', // Current user from JWT
      });
      setEffectiveSettings(settings);
    } catch (err) {
      console.error('Failed to load preferences:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load preferences'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (settingCode: string, value: any) => {
    setIsSaving(true);
    try {
      await settingsClient.upsertOverride({
        settingCode,
        value,
        userId: 'me',
        overrideReason: 'User preference',
      });
      await fetchSettings();
    } catch (err) {
      console.error('Failed to save preference:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-red-900 mb-2">
                Error Loading Preferences
              </h2>
              <p className="text-red-800 mb-4">{error}</p>
              <Button onClick={fetchSettings} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-teal-100 rounded-lg">
            <User className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              User Preferences
            </h1>
            <p className="mt-1 text-gray-600">
              Customize your personal settings and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Language & Localization */}
      <Card className="mb-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Language & Localization
          </h2>
        </div>

        <div className="space-y-4">
          <UserPreference
            settingCode="user.language"
            label="Language"
            description="Preferred language for the interface"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
          >
            <Select>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </Select>
          </UserPreference>

          <UserPreference
            settingCode="user.timezone"
            label="Timezone"
            description="Your local timezone"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
          >
            <Select>
              <option value="Asia/Muscat">Asia/Muscat (Oman)</option>
              <option value="Asia/Riyadh">Asia/Riyadh (Saudi Arabia)</option>
              <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
            </Select>
          </UserPreference>

          <UserPreference
            settingCode="user.date_format"
            label="Date Format"
            description="Preferred date display format"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
          >
            <Select>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            </Select>
          </UserPreference>
        </div>
      </Card>

      {/* Theme & Appearance */}
      <Card className="mb-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Theme & Appearance
          </h2>
        </div>

        <div className="space-y-4">
          <UserPreference
            settingCode="user.theme"
            label="Theme"
            description="Light or dark mode"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
          >
            <Select>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="system">System</option>
            </Select>
          </UserPreference>

          <UserPreference
            settingCode="user.density"
            label="Display Density"
            description="Spacing between UI elements"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
          >
            <Select>
              <option value="compact">Compact</option>
              <option value="comfortable">Comfortable</option>
              <option value="spacious">Spacious</option>
            </Select>
          </UserPreference>
        </div>
      </Card>

      {/* Notifications */}
      <Card className="mb-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Notifications
          </h2>
        </div>

        <div className="space-y-4">
          <UserPreference
            settingCode="user.email_notifications"
            label="Email Notifications"
            description="Receive notifications via email"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
            isBoolean
          >
            <input type="checkbox" className="rounded border-gray-300" />
          </UserPreference>

          <UserPreference
            settingCode="user.sms_notifications"
            label="SMS Notifications"
            description="Receive notifications via SMS"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
            isBoolean
          >
            <input type="checkbox" className="rounded border-gray-300" />
          </UserPreference>

          <UserPreference
            settingCode="user.browser_notifications"
            label="Browser Notifications"
            description="Show browser push notifications"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
            isBoolean
          >
            <input type="checkbox" className="rounded border-gray-300" />
          </UserPreference>
        </div>
      </Card>

      {/* Default Branch */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">
            Workspace
          </h2>
        </div>

        <UserPreference
          settingCode="user.default_branch"
          label="Default Branch"
          description="Branch selected by default when logging in"
          effectiveSettings={effectiveSettings}
          onSave={handleSave}
        >
          <Select>
            <option value="">Select branch...</option>
            {/* Branch options would be loaded dynamically */}
          </Select>
        </UserPreference>
      </Card>
    </div>
  );
}

// ============================================================
// USER PREFERENCE COMPONENT
// ============================================================

interface UserPreferenceProps {
  settingCode: string;
  label: string;
  description: string;
  effectiveSettings: ResolvedSetting[];
  onSave: (settingCode: string, value: any) => void;
  children: React.ReactElement;
  isBoolean?: boolean;
}

function UserPreference({
  settingCode,
  label,
  description,
  effectiveSettings,
  onSave,
  children,
  isBoolean = false,
}: UserPreferenceProps) {
  const resolved = effectiveSettings.find(s => s.stngCode === settingCode);
  const [value, setValue] = useState(resolved?.stngValue);

  const handleChange = (newValue: any) => {
    setValue(newValue);
    onSave(settingCode, newValue);
  };

  return (
    <EnhancedSettingField
      settingCode={settingCode}
      label={label}
      description={description}
      value={value}
      source={resolved?.stngSourceLayer as any || 'SYSTEM_DEFAULT'}
      sourceName={resolved?.stngSourceId}
      isOverridable={true}
      isLocked={false}
      userId="me"
      onReset={() => onSave(settingCode, null)}
    >
      {React.cloneElement(children, {
        value: isBoolean ? undefined : value,
        checked: isBoolean ? !!value : undefined,
        onChange: (e: any) => {
          const newValue = isBoolean ? e.target.checked : e.target.value;
          handleChange(newValue);
        },
      })}
    </EnhancedSettingField>
  );
}
