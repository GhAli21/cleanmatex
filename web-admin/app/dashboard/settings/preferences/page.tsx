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
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CmxCard } from '@ui/primitives/cmx-card';
import { CmxButton, CmxCheckbox, CmxSelect } from '@ui/primitives';
import { settingsClient, type ResolvedSetting } from '@/lib/api/settings-client';
import { EnhancedSettingField } from '@features/settings/ui/enhanced-setting-field';

/**
 * User preferences settings page.
 */
export default function UserPreferencesPage() {
  const tAppearance = useTranslations('authSession.appearance');
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

  const handleSave = async (settingCode: string, value: unknown) => {
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <CmxCard className="p-6 border-danger-border bg-danger-bg">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-danger-text mb-2">
                Error Loading Preferences
              </h2>
              <p className="text-danger-text mb-4">{error}</p>
              <CmxButton onClick={fetchSettings} variant="outline">
                Try Again
              </CmxButton>
            </div>
          </div>
        </CmxCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-info-bg rounded-lg">
            <User className="h-6 w-6 text-primary-text" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              User Preferences
            </h1>
            <p className="mt-1 text-muted-foreground">
              Customize your personal settings and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Language & Localization */}
      <CmxCard className="mb-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
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
            <CmxSelect
              disabled={isSaving}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'Arabic' },
              ]}
            />
          </UserPreference>

          <UserPreference
            settingCode="user.timezone"
            label="Timezone"
            description="Your local timezone"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
          >
            <CmxSelect
              disabled={isSaving}
              options={[
                { value: 'Asia/Muscat', label: 'Asia/Muscat (Oman)' },
                { value: 'Asia/Riyadh', label: 'Asia/Riyadh (Saudi Arabia)' },
                { value: 'Asia/Dubai', label: 'Asia/Dubai (UAE)' },
              ]}
            />
          </UserPreference>

          <UserPreference
            settingCode="user.date_format"
            label="Date Format"
            description="Preferred date display format"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
          >
            <CmxSelect
              disabled={isSaving}
              options={[
                { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
                { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
                { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
              ]}
            />
          </UserPreference>
        </div>
      </CmxCard>

      {/* Theme & Appearance: set on the Appearance page (sys_users_mst), not in settings */}
      <CmxCard className="mb-6 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{tAppearance('title')}</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {tAppearance('elsewhereHint')}{' '}
          <Link href="/dashboard/account/appearance" className="font-medium text-primary-text underline">
            {tAppearance('openLink')}
          </Link>
        </p>
      </CmxCard>

      {/* Notifications */}
      <CmxCard className="mb-6 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
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
            <CmxCheckbox disabled={isSaving} />
          </UserPreference>

          <UserPreference
            settingCode="user.sms_notifications"
            label="SMS Notifications"
            description="Receive notifications via SMS"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
            isBoolean
          >
            <CmxCheckbox disabled={isSaving} />
          </UserPreference>

          <UserPreference
            settingCode="user.browser_notifications"
            label="Browser Notifications"
            description="Show browser push notifications"
            effectiveSettings={effectiveSettings}
            onSave={handleSave}
            isBoolean
          >
            <CmxCheckbox disabled={isSaving} />
          </UserPreference>
        </div>
      </CmxCard>

      {/* Default Branch */}
      <CmxCard className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">
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
          <CmxSelect
            disabled={isSaving}
            placeholder="Select branch..."
            options={[]}
          />
        </UserPreference>
      </CmxCard>
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
  onSave: (settingCode: string, value: unknown) => void;
  /** CmxSelect or CmxCheckbox — receives controlled props via cloneElement. */
  children: React.ReactElement<Record<string, unknown>>;
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
  const resolved = effectiveSettings.find((s) => s.stngCode === settingCode);
  const [value, setValue] = useState(resolved?.stngValue);

  const handleChange = (newValue: unknown) => {
    setValue(newValue);
    onSave(settingCode, newValue);
  };

  const handleNativeChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const el = e.currentTarget;
    const newValue = isBoolean && 'checked' in el ? el.checked : el.value;
    handleChange(newValue);
  };

  const injectedProps: Record<string, unknown> = {
    onChange: handleNativeChange,
  };
  if (isBoolean) {
    injectedProps.checked = Boolean(value);
  } else {
    injectedProps.value = value ?? '';
  }

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
      {React.cloneElement(children, injectedProps)}
    </EnhancedSettingField>
  );
}
