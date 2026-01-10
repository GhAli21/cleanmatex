/**
 * Explain Drawer Component
 * Shows full 7-layer resolution trace for a setting
 *
 * Phase 4: Client Frontend Enhancement
 */

'use client';

import React, { useState, useEffect } from 'react';
import { X, Info, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import { Button, Card } from '@/components/ui';
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
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="absolute inset-y-0 right-0 max-w-2xl w-full bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Setting Resolution Trace
              </h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {settingCode}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {trace && !isLoading && !error && (
            <div className="space-y-6">
              {/* Final Value Card */}
              <Card className="bg-green-50 border-green-200">
                <div className="p-4">
                  <h3 className="text-sm font-medium text-green-900 mb-2">
                    Final Effective Value
                  </h3>
                  <div className="flex items-center justify-between">
                    <code className="text-lg font-mono text-green-800">
                      {JSON.stringify(trace.finalValue)}
                    </code>
                    <SourceBadge
                      source={trace.finalSource as any}
                      className="ml-4"
                    />
                  </div>
                </div>
              </Card>

              {/* Inheritance Chain (if profile-based) */}
              {trace.inheritanceChain && trace.inheritanceChain.length > 0 && (
                <Card>
                  <div className="p-4">
                    <h3 className="text-sm font-medium text-gray-900 mb-3">
                      Profile Inheritance Chain
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {trace.inheritanceChain.map((profileCode, index) => (
                        <React.Fragment key={profileCode}>
                          <div className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-mono">
                            {profileCode}
                          </div>
                          {index < trace.inheritanceChain!.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-gray-400" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-600">
                      Resolution flows from left (child) to right (root)
                    </p>
                  </div>
                </Card>
              )}

              {/* 7-Layer Resolution Timeline */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">
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
              <div className="text-xs text-gray-500 pt-4 border-t border-gray-200">
                <p>Computed at: {new Date(trace.computedAt).toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
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
    ? 'bg-green-50 border-green-300'
    : isActive
    ? 'bg-blue-50 border-blue-200'
    : 'bg-gray-50 border-gray-200';

  return (
    <Card className={`${bgColor} transition-all`}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-xs font-medium">
              {layerNumber}
            </span>
            <div>
              <h4 className="text-sm font-medium text-gray-900">
                {layer.layer.replace(/_/g, ' ')}
              </h4>
              <p className="text-xs text-gray-600">
                Source: <code className="font-mono">{layer.sourceId}</code>
              </p>
            </div>
          </div>
          <div>
            {isActive ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-gray-400" />
            )}
          </div>
        </div>

        <div className="mt-2 pl-8">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">Value:</span>
            <code className="text-sm font-mono text-gray-900">
              {JSON.stringify(layer.value)}
            </code>
          </div>

          {layer.reason && (
            <div className="mt-1">
              <span className="text-xs text-gray-600">Reason: </span>
              <span className="text-xs text-gray-800">{layer.reason}</span>
            </div>
          )}

          <div className="mt-1">
            <span className={`text-xs ${isActive ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
              {isActive ? '✓ Applied' : 'Skipped/Overridden'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
