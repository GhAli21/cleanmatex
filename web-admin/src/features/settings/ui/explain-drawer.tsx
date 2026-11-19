/**
 * Explain Drawer Component
 * Shows full 7-layer resolution trace for a setting
 *
 * Phase 4: Client Frontend Enhancement
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Info, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { CmxButton, CmxCard } from '@ui/primitives';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';
import { settingsClient, type ExplainTrace } from '@/lib/api/settings-client';
import { SourceBadge } from './source-badge';

interface ExplainDrawerProps {
  settingCode: string;
  tenantId?: string;
  branchId?: string;
  userId?: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 *
 * @param root0
 * @param root0.settingCode
 * @param root0.tenantId
 * @param root0.branchId
 * @param root0.userId
 * @param root0.isOpen
 * @param root0.onClose
 */
export function ExplainDrawer({
  settingCode,
  tenantId,
  branchId,
  userId,
  isOpen,
  onClose,
}: ExplainDrawerProps) {
  const [trace, setTrace] = useState<ExplainTrace | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const trapRef = useFocusTrap(isOpen, { returnFocus: true });

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && settingCode) {
      fetchExplainTrace();
    }
  }, [isOpen, settingCode, tenantId, branchId, userId]);

  const fetchExplainTrace = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await settingsClient.explainSetting(settingCode, {
        tenantId,
        branchId,
        userId,
      });
      setTrace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load explanation');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-label="Setting Resolution Trace">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div ref={trapRef} className="absolute inset-y-0 end-0 max-w-2xl w-full bg-card shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-muted border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary-text" />
              <h2 className="text-lg font-semibold text-foreground">
                Setting Resolution Trace
              </h2>
            </div>
            <CmxButton
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </CmxButton>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {settingCode}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {error && (
            <div className="bg-danger-bg border border-danger-border rounded-lg p-4">
              <p className="text-sm text-danger-text">{error}</p>
            </div>
          )}

          {trace && !isLoading && !error && (
            <div className="space-y-6">
              {/* Final Value Card */}
              <CmxCard className="bg-success-bg border-success-border">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-success-text mb-2">
                    Final Effective Value
                  </h3>
                  <div className="flex items-center justify-between">
                    <code className="text-lg font-mono text-success-text">
                      {JSON.stringify(trace.finalValue)}
                    </code>
                    <SourceBadge
                      source={trace.finalSource as any}
                      className="ms-4"
                    />
                  </div>
                </div>
              </CmxCard>

              {/* Inheritance Chain (if profile-based) */}
              {trace.inheritanceChain && trace.inheritanceChain.length > 0 && (
                <CmxCard>
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-foreground mb-3">
                      Profile Inheritance Chain
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {trace.inheritanceChain.map((profileCode, index) => (
                        <React.Fragment key={profileCode}>
                          <div className="px-3 py-1 bg-info-bg text-info-text rounded text-sm font-mono">
                            {profileCode}
                          </div>
                          {index < trace.inheritanceChain!.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Resolution flows from left (child) to right (root)
                    </p>
                  </div>
                </CmxCard>
              )}

              {/* 7-Layer Resolution Timeline */}
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Resolution Layers (7-Layer Algorithm)
                </h3>
                <div className="space-y-3">
                  {trace.layers.map((layer, index) => (
                    <LayerCard
                      key={index}
                      layer={layer}
                      layerNumber={index + 1}
                      isActive={layer.applied}
                      isFinal={index === trace.layers.length - 1}
                    />
                  ))}
                </div>
              </div>

              {/* Metadata */}
              <div className="text-xs text-muted-foreground pt-4 border-t border-border">
                <p>Computed at: {new Date(trace.computedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-muted border-t border-border">
          <CmxButton onClick={onClose} className="w-full">
            Close
          </CmxButton>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// LAYER CARD COMPONENT
// ============================================================

interface LayerCardProps {
  layer: {
    layer: string;
    value: any;
    sourceId: string;
    applied: boolean;
    reason?: string;
  };
  layerNumber: number;
  isActive: boolean;
  isFinal: boolean;
}

function LayerCard({ layer, layerNumber, isActive, isFinal }: LayerCardProps) {
  const bgColor = isFinal
    ? 'bg-success-bg border-success-border'
    : isActive
    ? 'bg-info-bg border-info-border'
    : 'bg-muted border-border';

  return (
    <CmxCard className={`${bgColor} transition-all`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center text-xs font-medium">
              {layerNumber}
            </span>
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {layer.layer.replace(/_/g, ' ')}
              </h4>
              <p className="text-xs text-muted-foreground">
                Source: <code className="font-mono">{layer.sourceId}</code>
              </p>
            </div>
          </div>
          <div>
            {isActive ? (
              <CheckCircle2 className="h-5 w-5 text-success-text" />
            ) : (
              <XCircle className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="mt-2 ps-8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Value:</span>
            <code className="text-sm font-mono text-foreground">
              {JSON.stringify(layer.value)}
            </code>
          </div>

          {layer.reason && (
            <div className="mt-1">
              <span className="text-xs text-muted-foreground">Reason: </span>
              <span className="text-xs text-foreground">{layer.reason}</span>
            </div>
          )}

          <div className="mt-1">
            <span className={`text-xs ${isActive ? 'text-success-text font-medium' : 'text-muted-foreground'}`}>
              {isActive ? '✓ Applied' : 'Skipped/Overridden'}
            </span>
          </div>
        </div>
      </div>
    </CmxCard>
  );
}
