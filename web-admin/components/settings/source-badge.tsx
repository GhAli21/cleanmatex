/**
 * Source Badge Component
 * Shows where a setting value comes from (7-layer resolution)
 *
 * Phase 4: Client Frontend Enhancement
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui';

export type SettingSource =
  | 'SYSTEM_DEFAULT'
  | 'SYSTEM_PROFILE'
  | 'PLAN_CONSTRAINT'
  | 'FEATURE_FLAG'
  | 'TENANT_OVERRIDE'
  | 'BRANCH_OVERRIDE'
  | 'USER_OVERRIDE';

interface SourceBadgeProps {
  source: SettingSource;
  sourceName?: string;
  className?: string;
}

const SOURCE_CONFIG: Record<
  SettingSource,
  {
    label: string;
    color: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error';
    icon: string;
  }
> = {
  SYSTEM_DEFAULT: {
    label: 'System',
    color: 'default',
    icon: '⚙️',
  },
  SYSTEM_PROFILE: {
    label: 'Profile',
    color: 'primary',
    icon: '📋',
  },
  PLAN_CONSTRAINT: {
    label: 'Plan',
    color: 'error',
    icon: '🔒',
  },
  FEATURE_FLAG: {
    label: 'Feature Flag',
    color: 'warning',
    icon: '🚩',
  },
  TENANT_OVERRIDE: {
    label: 'Tenant',
    color: 'success',
    icon: '🏢',
  },
  BRANCH_OVERRIDE: {
    label: 'Branch',
    color: 'secondary',
    icon: '🏪',
  },
  USER_OVERRIDE: {
    label: 'User',
    color: 'primary',
    icon: '👤',
  },
};

export function SourceBadge({ source, sourceName, className }: SourceBadgeProps) {
  const config = SOURCE_CONFIG[source];

  const displayText = sourceName
    ? `${config.label}: ${sourceName}`
    : config.label;

  return (
    <Badge variant={config.color} className={className}>
      <span className="mr-1">{config.icon}</span>
      {displayText}
    </Badge>
  );
}

/**
 * Mini Source Badge - Compact version for inline use
 */
export function MiniSourceBadge({ source, className }: Pick<SourceBadgeProps, 'source' | 'className'>) {
  const config = SOURCE_CONFIG[source];

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${className || ''}`}
      title={config.label}
    >
      <span>{config.icon}</span>
    </span>
  );
}
