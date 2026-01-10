/**
 * Enhanced Setting Field Component
 * Shows setting with source badge, explain button, and reset functionality
 *
 * Phase 4: Client Frontend Enhancement
 */

'use client';

import React, { useState } from 'react';
import { HelpCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import { SourceBadge, type SettingSource } from './source-badge';
import { ExplainDrawer } from './explain-drawer';
import { settingsClient } from '@/lib/api/settings-client';

interface EnhancedSettingFieldProps {
  settingCode: string;
  label: string;
  description?: string;
  value: any;
  source: SettingSource;
  sourceName?: string;
  isOverridable: boolean;
  isLocked: boolean;
  children: React.ReactNode;
  onReset?: () => void;
  tenantId?: string;
  branchId?: string;
  userId?: string;
}

export function EnhancedSettingField({
  settingCode,
  label,
  description,
  value,
  source,
  sourceName,
  isOverridable,
  isLocked,
  children,
  onReset,
  tenantId,
  branchId,
  userId,
}: EnhancedSettingFieldProps) {
  const [showExplain, setShowExplain] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const hasOverride =
    source === 'TENANT_OVERRIDE' ||
    source === 'BRANCH_OVERRIDE' ||
    source === 'USER_OVERRIDE';

  const canReset = isOverridable && hasOverride && !isLocked;

  const handleReset = async () => {
    if (!canReset || !onReset) return;

    setIsResetting(true);
    try {
      await settingsClient.deleteOverride(settingCode, {
        tenantId,
        branchId,
        userId,
      });
      onReset();
    } catch (err) {
      console.error('Failed to reset setting:', err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Label Row */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">
            {label}
          </label>
          {description && (
            <p className="mt-1 text-xs text-gray-500">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          {/* Source Badge */}
          <SourceBadge source={source} sourceName={sourceName} />

          {/* Explain Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowExplain(true)}
            className="text-gray-400 hover:text-gray-600"
            title="Explain how this value is resolved"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>

          {/* Reset Button */}
          {canReset && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={isResetting}
              title="Reset to default value"
            >
              {isResetting ? (
                <RotateCcw className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Input Field */}
      <div className="relative">
        {children}

        {/* Locked Overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-gray-100 bg-opacity-50 cursor-not-allowed rounded flex items-center justify-center">
            <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded shadow">
              Locked by profile
            </span>
          </div>
        )}

        {/* Not Overridable Notice */}
        {!isOverridable && !isLocked && (
          <div className="mt-1 text-xs text-gray-500">
            This setting cannot be overridden
          </div>
        )}
      </div>

      {/* Explain Drawer */}
      <ExplainDrawer
        settingCode={settingCode}
        tenantId={tenantId}
        branchId={branchId}
        userId={userId}
        isOpen={showExplain}
        onClose={() => setShowExplain(false)}
      />
    </div>
  );
}
