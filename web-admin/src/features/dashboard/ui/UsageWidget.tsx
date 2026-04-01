/**
 * Usage Dashboard Widget
 * Compact widget for main dashboard showing usage at-a-glance
 * Displays top 3 resources with progress bars and warnings
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { CmxCard, CmxButton, Badge } from '@ui/primitives';
import { CmxProgressBar } from '@ui/feedback';
import type { UsageMetrics } from '@/lib/types/tenant';

interface UsageWidgetProps {
  tenantId?: string; // Optional, defaults to current tenant
  compact?: boolean; // If true, show even more compact version
}

export function UsageWidget({ tenantId, compact = false }: UsageWidgetProps) {
  const tCommon = useTranslations('common');
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsage();
  }, [tenantId]);

  const fetchUsage = async () => {
    setIsLoading(true);
    setError('');
    
    return; // jh

    try {
      const response = await fetch('/api/v1/subscriptions/usage');

      if (!response.ok) {
        throw new Error('Failed to fetch usage metrics');
      }

      const data = await response.json();
      setUsage(data.data);
    } catch (err: unknown) {
      let errorMessage = 'Failed to load usage data';
      if (err instanceof Error) {
        errorMessage = (err as Error).message;
      } else if (typeof err === 'string') {
        errorMessage = err as string;
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const getProgressVariant = (percentage: number): 'default' | 'success' | 'warning' | 'danger' => {
    if (percentage >= 90) return 'danger';
    if (percentage >= 70) return 'warning';
    return 'success';
  };

  const hasWarnings = usage && usage.warnings.length > 0;
  const highUsageCount = usage
    ? [
        usage.usage.ordersPercentage,
        usage.usage.usersPercentage,
        usage.usage.branchesPercentage,
      ].filter((p) => p > 80).length
    : 0;

  if (isLoading) {
    return (
      <div className="win2k-panel" style={{ padding: '6px 10px' }}>
        <div style={{ height: 10, background: '#c0bdb5', width: '50%', marginBottom: 6 }} />
        <div className="win2k-progress-track"><div className="win2k-progress-fill" style={{ width: '40%' }} /></div>
      </div>
    );
  }

  if (error || !usage) {
    return (
      <div className="win2k-inset" style={{ padding: 8, textAlign: 'center' }}>
        <p className="win2k-text" style={{ color: '#cc0000', marginBottom: 6 }}>{error || 'Failed to load usage data'}</p>
        <button className="win2k-btn" onClick={fetchUsage}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'MS Sans Serif', Arial, sans-serif", fontSize: 11 }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <p className="win2k-label">Usage &amp; Limits</p>
        <p className="win2k-text" style={{ color: '#555' }}>
          {new Date(usage.currentPeriod.start).toLocaleDateString()} -{' '}
          {new Date(usage.currentPeriod.end).toLocaleDateString()}
        </p>
      </div>

      {/* Metrics */}
      {[
        { label: 'Orders', used: usage.usage.ordersCount, limit: usage.limits.ordersLimit, pct: usage.usage.ordersPercentage },
        { label: 'Users', used: usage.usage.usersCount, limit: usage.limits.usersLimit, pct: usage.usage.usersPercentage },
        { label: 'Branches', used: usage.usage.branchesCount, limit: usage.limits.branchesLimit, pct: usage.usage.branchesPercentage },
      ].map(({ label, used, limit, pct }) => (
        <div key={label} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <p className="win2k-label">{label}</p>
            <p className="win2k-text" style={{ fontFamily: 'Courier New, monospace' }}>
              {used} / {limit} ({pct.toFixed(0)}%)
            </p>
          </div>
          <div className="win2k-progress-track">
            <div
              className="win2k-progress-fill"
              style={{
                width: `${Math.min(pct, 100)}%`,
                background: pct >= 90
                  ? 'repeating-linear-gradient(90deg,#cc0000 0,#cc0000 8px,#aa0000 8px,#aa0000 10px)'
                  : pct >= 70 ? 'repeating-linear-gradient(90deg,#886600 0,#886600 8px,#664400 8px,#664400 10px)' : undefined,
              }}
            />
          </div>
        </div>
      ))}

      {/* Warnings */}
      {hasWarnings && (
        <div style={{ marginTop: 6, borderTop: '1px solid var(--win2k-shadow)', paddingTop: 4 }}>
          {usage.warnings.slice(0, 2).map((warning, idx) => (
            <div key={idx} className="win2k-panel" style={{ padding: '3px 6px', marginBottom: 3, borderColor: warning.type === 'limit_exceeded' ? '#cc0000 #fff #fff #cc0000' : undefined }}>
              <p className="win2k-label" style={{ color: warning.type === 'limit_exceeded' ? '#cc0000' : '#886600' }}>
                {warning.type === 'limit_exceeded' ? '⚠' : '!'} {warning.resource.toUpperCase()}
              </p>
              <p className="win2k-text">{warning.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8, borderTop: '1px solid var(--win2k-shadow)', paddingTop: 6 }}>
        <Link href="/dashboard/subscription">
          <button className="win2k-btn">View Details</button>
        </Link>
        {highUsageCount > 0 && (
          <Link href="/dashboard/subscription">
            <button className="win2k-btn" style={{ background: 'var(--win2k-titlebar-start)', color: '#fff', borderColor: '#0000aa #000044 #000044 #0000aa' }}>
              Upgrade Plan
            </button>
          </Link>
        )}
        <button className="win2k-btn" onClick={fetchUsage} style={{ marginLeft: 'auto' }}>↻</button>
      </div>
    </div>
  );
}
