/**
 * Profile Info Card Component
 * Displays current tenant's assigned system profile
 *
 * Phase 4: Client Frontend Enhancement
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Unlock, Info, RefreshCw } from 'lucide-react';
import { CmxCard, CmxButton, Badge } from '@ui/primitives';
import { settingsClient, type TenantProfileInfo } from '@/lib/api/settings-client';

interface ProfileInfoCardProps {
  tenantId?: string;
  onRecompute?: () => void;
}

export function ProfileInfoCard({ tenantId, onRecompute }: ProfileInfoCardProps) {
  const [profileInfo, setProfileInfo] = useState<TenantProfileInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecomputing, setIsRecomputing] = useState(false);

  useEffect(() => {
    fetchProfileInfo();
  }, [tenantId]);

  const fetchProfileInfo = async () => {
    try {
      const data = await settingsClient.getTenantProfile(tenantId);
      setProfileInfo(data);
    } catch (err) {
      console.error('Failed to fetch profile info:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecompute = async () => {
    setIsRecomputing(true);
    try {
      await settingsClient.recomputeCache(tenantId);
      await fetchProfileInfo();
      onRecompute?.();
    } catch (err) {
      console.error('Failed to recompute cache:', err);
    } finally {
      setIsRecomputing(false);
    }
  };

  if (isLoading) {
    return (
      <CmxCard className="p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
        </div>
      </CmxCard>
    );
  }

  if (!profileInfo) {
    return null;
  }

  const hasProfile = !!profileInfo.stng_profile_code;

  return (
    <CmxCard className={`p-4 ${profileInfo.stng_profile_locked ? 'bg-blue-50 border-blue-200' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
              System Profile
              {profileInfo.stng_profile_locked && (
                <Lock className="h-4 w-4 text-blue-600" title="Profile Locked" />
              )}
            </h3>
            {hasProfile ? (
              <>
                <p className="text-lg font-semibold text-blue-600 mt-1">
                  {profileInfo.stng_profile_name || profileInfo.stng_profile_code}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" className="text-xs">
                    v{profileInfo.stng_profile_version_applied || 1}
                  </Badge>
                  {profileInfo.stng_profile_locked && (
                    <Badge variant="primary" className="text-xs">
                      Locked
                    </Badge>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-600 mt-1">
                No profile assigned
              </p>
            )}
          </div>
        </div>

        <CmxButton
          variant="outline"
          size="sm"
          onClick={handleRecompute}
          disabled={isRecomputing}
        >
          {isRecomputing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Recomputing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Recompute
            </>
          )}
        </CmxButton>
      </div>

      {profileInfo.stng_profile_locked && hasProfile && (
        <div className="mt-3 p-3 bg-blue-100 rounded-lg flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            This profile is locked by the platform administrator. You can view settings but cannot override them.
          </p>
        </div>
      )}

      {!hasProfile && (
        <div className="mt-3 p-3 bg-gray-100 rounded-lg flex items-start gap-2">
          <Info className="h-4 w-4 text-gray-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-700">
            No system profile is assigned. All settings use system defaults. Contact your administrator to assign a profile.
          </p>
        </div>
      )}
    </CmxCard>
  );
}
