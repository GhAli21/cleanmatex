/**
 * Processing Screen - Detail Page
 * Per-item processing with 5-step tracking
 * PRD-010: Workflow-based processing detail
 * Enhanced UI/UX with modern components and visual progress indicators
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import { ChevronLeft, CheckCircle2, Circle, Loader2, AlertCircle, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@ui/primitives/badge';
import { CmxInput } from '@ui/primitives';
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardDescription, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives';
import { LoadingButton } from '@ui/primitives/loading-button';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { useWorkflowContext } from '@/lib/hooks/use-workflow-context';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';

interface ProcessingItem {
  id: string;
  product_name: string;
  quantity: number;
  item_status: string;
  item_last_step: string;
}

interface ProcessingOrder {
  id: string;
  order_no: string;
  status?: string;
  customer: {
    name: string;
    phone: string;
  };
  items: ProcessingItem[];
  rack_location: string;
}

const PROCESSING_STEPS = [
  { code: 'sorting', labelKey: 'steps.sorting' },
  { code: 'pretreatment', labelKey: 'steps.pretreatment' },
  { code: 'washing', labelKey: 'steps.washing' },
  { code: 'drying', labelKey: 'steps.drying' },
  { code: 'finishing', labelKey: 'steps.finishing' },
];

export default function ProcessingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('processing');
  const tCommon = useTranslations('common');
  const { currentTenant } = useAuth();
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');
  const [order, setOrder] = useState<ProcessingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [rackLocation, setRackLocation] = useState('');
  const [rackLocationError, setRackLocationError] = useState('');
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  const orderId = (params as any)?.id as string | undefined;
  const { data: wfContext } = useWorkflowContext(orderId ?? null);

  const loadOrder = async () => {
    if (!currentTenant || !orderId) return;
    
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/state`);
      const json = await res.json();
      if (json.success && json.data?.order) {
        setOrder(json.data.order);
        setRackLocation(json.data.order.rack_location || '');
      } else {
        setError(json.error || t('error.loadingFailed') || 'Failed to load order');
      }
    } catch (err: any) {
      setError(err.message || t('error.loadingFailed') || 'Failed to load order');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrder();
  }, [orderId, currentTenant]);

  const handleRecordStep = async (itemId: string, stepCode: string, stepSeq: number) => {
    if (!orderId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`/api/v1/orders/${orderId}/items/${itemId}/step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stepCode,
          stepSeq,
        }),
      });
      const json = await res.json();
      if (json.success) {
        // Reload order
        await loadOrder();
      } else {
        setError(json.error || 'Failed to record step');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to record step');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkReady = async () => {
    setRackLocationError('');

    if (!orderId) return;

    // Resolve next status based on workflow flags
    const nextStatus =
      wfContext?.flags?.assembly_enabled
        ? 'assembly'
        : wfContext?.flags?.qa_enabled
        ? 'qa'
        : wfContext?.flags?.packing_enabled
        ? 'packing'
        : 'ready';

    if (nextStatus === 'ready' && !rackLocation.trim()) {
      setRackLocationError(t('validation.rackLocationRequired') || 'Rack location is required');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'processing',
          to_status: nextStatus,
          notes: 'Processing complete',
          useOldWfCodeOrNew: useNewWorkflowSystem,
          rackLocation: rackLocation.trim() || undefined,
        },
      });

      if (result.success) {
        showSuccess(t('success.transitioned') || 'Transitioned');
        const nextRoute =
          nextStatus === 'assembly'
            ? '/dashboard/assembly'
            : nextStatus === 'qa'
            ? '/dashboard/qa'
            : nextStatus === 'packing'
            ? '/dashboard/packing'
            : '/dashboard/ready';
        router.push(nextRoute);
      } else {
        setError(result.error || t('error.transitionFailed') || 'Transition failed');
      }
    } catch (err) {
      showErrorFrom(err, { fallback: t('error.transitionFailed') || 'Transition failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const getStepStatus = (item: ProcessingItem, stepIndex: number) => {
    const currentStepIndex = PROCESSING_STEPS.findIndex(s => s.code === item.item_last_step);
    
    if (currentStepIndex === -1) {
      return stepIndex === 0 ? 'current' : 'pending';
    }
    
    if (stepIndex < currentStepIndex) {
      return 'completed';
    } else if (stepIndex === currentStepIndex) {
      return 'current';
    } else {
      return 'pending';
    }
  };

  const toggleItemExpansion = (itemId: string) => {
    setExpandedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Loading State
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-600">{tCommon('loading') || 'Loading...'}</p>
        </div>
      </div>
    );
  }

  // Error State - Order Not Found
  if (!order) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <CmxCard className="border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-900 mb-1">
                {t('error.orderNotFound') || 'Order not found'}
              </h3>
              <p className="text-red-700 mb-4">
                {t('error.orderNotFoundDesc') || 'The order you are looking for could not be found.'}
              </p>
              <LoadingButton
                variant="secondary"
                onClick={() => router.push('/dashboard/processing')}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                {t('backToProcessing') || 'Back to Processing'}
              </LoadingButton>
            </div>
          </div>
        </CmxCard>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Section */}
      <CmxCard className="border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex-1">
            <LoadingButton
              variant="ghost"
              size="sm"
              onClick={() => router.push('/dashboard/processing')}
              leftIcon={<ChevronLeft className="w-4 h-4" />}
              className="mb-4"
            >
              {t('backToProcessing') || 'Back to Processing'}
            </LoadingButton>
            
            <div className="flex flex-wrap items-center gap-3 mb-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                {t('title')} - {order.order_no}
              </h1>
              {order.status && (
                <Badge variant="info">
                  {order.status.replace('_', ' ').toUpperCase()}
                </Badge>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
              <div>
                <span className="font-medium">{t('customer') || 'Customer'}:</span>{' '}
                {order.customer.name}
              </div>
              <div>
                <span className="font-medium">{t('phone') || 'Phone'}:</span>{' '}
                {order.customer.phone}
              </div>
            </div>
          </div>
        </div>
      </CmxCard>

      {/* Error Alert */}
      {error && (
        <CmxCard className="border border-gray-200 p-6 bg-red-50 border-red-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">{error}</p>
              <CmxButton
                variant="ghost"
                size="sm"
                onClick={loadOrder}
                className="mt-2 text-red-700 hover:text-red-900"
              >
                {tCommon('refresh') || 'Retry'}
              </CmxButton>
            </div>
          </div>
        </CmxCard>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('items') || 'Order Items'}
          </h2>
          
          {order.items.length === 0 ? (
            <CmxCard className="border border-gray-200 p-8">
              <div className="text-center py-8 text-gray-500">
                {t('noItems') || 'No items found in this order'}
              </div>
            </CmxCard>
          ) : (
            order.items.map((item) => {
              const currentStepIndex = PROCESSING_STEPS.findIndex(s => s.code === item.item_last_step);
              const completedSteps = currentStepIndex >= 0 ? currentStepIndex + 1 : 0;
              const progressPercentage = (completedSteps / PROCESSING_STEPS.length) * 100;

              return (
                <CmxCard key={item.id} className="border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <CmxCardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {item.product_name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <span>
                            <span className="font-medium">{t('quantity') || 'Quantity'}:</span>{' '}
                            {item.quantity}
                          </span>
                          <Badge 
                            variant={item.item_status === 'ready' ? 'success' : 'info'}
                          >
                            {item.item_status || t('status.processing') || 'Processing'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CmxCardHeader>

                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">
                        {t('progress') || 'Progress'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {completedSteps} / {PROCESSING_STEPS.length} {t('stepsLabel') || 'steps'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progressPercentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Step Progress Indicator */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">
                      {t('processingSteps') || 'Processing Steps'}:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {PROCESSING_STEPS.map((step, idx) => {
                        const status = getStepStatus(item, idx);
                        const isCompleted = status === 'completed';
                        const isCurrent = status === 'current';
                        const isPending = status === 'pending';
                        const isDisabled = submitting || isCompleted || isPending;

                        return (
                          <button
                            key={step.code}
                            onClick={() => {
                              if (!isDisabled) {
                                handleRecordStep(item.id, step.code, idx + 1);
                              }
                            }}
                            disabled={isDisabled}
                            className={`
                              relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                              transition-all duration-200 border-2
                              ${isCompleted
                                ? 'bg-green-50 text-green-800 border-green-300 cursor-default'
                                : isCurrent
                                ? 'bg-blue-50 text-blue-800 border-blue-400 hover:bg-blue-100 hover:border-blue-500 shadow-sm'
                                : 'bg-gray-50 text-gray-500 border-gray-300 cursor-not-allowed opacity-60'
                              }
                              ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                              ${isCurrent && !submitting ? 'ring-2 ring-blue-200' : ''}
                            `}
                            title={
                              isCompleted
                                ? t('stepCompleted') || 'Step completed'
                                : isCurrent
                                ? t('stepCurrent') || 'Click to complete this step'
                                : t('stepPending') || 'Complete previous steps first'
                            }
                          >
                            <div className="flex-shrink-0">
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4 text-green-600" />
                              ) : (
                                <Circle className={`w-4 h-4 ${isCurrent ? 'text-blue-600 fill-blue-600' : 'text-gray-400'}`} />
                              )}
                            </div>
                            <span className="text-xs font-semibold text-gray-500 mr-1">
                              {idx + 1}.
                            </span>
                            <span className="flex-1 text-left">
                              {t(step.labelKey)}
                            </span>
                            {isCurrent && !submitting && (
                              <span className="text-xs text-blue-600 font-semibold ml-auto">
                                {t('clickToComplete') || 'Click'}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pieces Section - Expandable */}
                  {trackByPiece && orderId && currentTenant?.tenant_id && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => toggleItemExpansion(item.id)}
                        className={`w-full flex items-center justify-between text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors`}
                      >
                        <span>
                          {t('viewPieces') || 'View Pieces'}
                        </span>
                        {expandedItemIds.has(item.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      
                      {expandedItemIds.has(item.id) && (
                        <div className="mt-3">
                          <PiecesErrorBoundary>
                            <OrderPiecesManager
                              orderId={orderId}
                              itemId={item.id}
                              tenantId={currentTenant.tenant_id}
                              readOnly={false}
                              autoLoad={true}
                              onUpdate={loadOrder}
                            />
                          </PiecesErrorBoundary>
                        </div>
                      )}
                    </div>
                  )}
                </CmxCard>
              );
            })
          )}
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {t('orderActions') || 'Order Actions'}
          </h2>
          
          <CmxCard className="border border-gray-200 p-6">
            <CmxCardHeader>
              <div>
                <CmxCardTitle>{t('completeOrder') || 'Complete Order'}</CmxCardTitle>
                <CmxCardDescription>{t('completeOrderDesc') || 'Mark this order as ready for pickup'}</CmxCardDescription>
              </div>
            </CmxCardHeader>
            <CmxCardContent>
            {/* Rack Location Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('rackLocationOrder') || 'Rack Location'}
                <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <CmxInput
                  className="pl-10 w-full"
                  value={rackLocation}
                  onChange={(e) => {
                    setRackLocation(e.target.value);
                    setRackLocationError('');
                  }}
                  placeholder={t('rackLocationPlaceholder') || 'e.g., Rack A-12'}
                  required
                />
              </div>
              {rackLocationError && (
                <p className="mt-1 text-sm text-red-600">{rackLocationError}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {t('rackLocationHelp') || 'Enter the rack location where this order is stored'}
              </p>
            </div>

            {/* Mark Ready Button */}
            <LoadingButton
              variant="primary"
              size="lg"
              onClick={handleMarkReady}
              disabled={submitting || !rackLocation.trim()}
              loading={submitting}
              fullWidth
              loadingText={t('processing') || 'Processing...'}
              className="bg-green-600 hover:bg-green-700"
            >
              {t('markOrderReady') || 'Mark Order Ready'}
            </LoadingButton>

            {/* Info Text */}
            <p className="mt-4 text-xs text-gray-500 text-center">
              {t('markReadyInfo') || 'This will move the order to the ready status and make it available for pickup.'}
            </p>
            </CmxCardContent>
          </CmxCard>
        </div>
      </div>
    </div>
  );
}
