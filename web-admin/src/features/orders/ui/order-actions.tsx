/**
 * OrderActions Component
 * Status change actions with full API integration
 * PRD-005: Basic Workflow & Status Transitions
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package,
  CheckCircle,
  XCircle,
  MessageSquare,
  Loader2,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import { useMessage } from '@ui/feedback';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useScreenContract } from '@/lib/hooks/use-screen-contract';
import { Button } from '@ui/compat';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@ui/compat';
import { Textarea, Label, Alert, AlertDescription } from '@ui/compat';
import type { OrderStatus } from '@/lib/types/workflow';
import { STATUS_META, getAllowedTransitions } from '@/lib/types/workflow';

interface OrderActionsProps {
  order: {
    id: string;
    status: string;
    tenant_org_id: string;
  };
  /**
   * Optional screen identifier for workflow validation/transition routing.
   * Defaults to "orders".
   */
  screen?: string;
}

export function OrderActions({ order, screen = 'orders' }: OrderActionsProps) {
  const router = useRouter();
  const t = useTranslations('orders.actions');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const locale = useLocale();
  const { showSuccess, showErrorFrom, showError } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const { data: screenContract, isLoading: screenContractLoading } = useScreenContract(screen);
  const transition = useOrderTransition();
  const [loading, setLoading] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | null>(null);
  const [notes, setNotes] = useState('');
  const [allowedTransitions, setAllowedTransitions] = useState<OrderStatus[]>([]);
  const [blockers, setBlockers] = useState<string[]>([]);

  // Fetch allowed transitions on mount
  useEffect(() => {
    async function fetchAllowedTransitions() {
      try {
        const response = await fetch(`/api/v1/orders/${order.id}/transitions`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setAllowedTransitions(data.data);
          }
        }
      } catch (error) {
        // Non-blocking: leave buttons hidden if transitions cannot be fetched
      }
    }

    fetchAllowedTransitions();
  }, [order.id, order.status]);

  const handleStatusClick = (newStatus: OrderStatus) => {
    setSelectedStatus(newStatus);
    setNotes('');
    setBlockers([]);
    setShowDialog(true);
  };

  const handleConfirmChange = async () => {
    if (!selectedStatus) return;

    setLoading(true);
    setBlockers([]);

    try {
      const canUseEnhancedWorkflow = useNewWorkflowSystem && !!screenContract && !screenContractLoading;

      const data = await transition.mutateAsync({
        orderId: order.id,
        input: {
          screen,
          to_status: selectedStatus,
          notes: notes.trim() || undefined,
          // If enhanced isn't available for this screen (missing contract), force OLD path safely.
          useOldWfCodeOrNew: canUseEnhancedWorkflow,
        },
      });

      if (data.success) {
        const statusLabel = locale === 'ar' 
          ? STATUS_META[selectedStatus].labelAr 
          : STATUS_META[selectedStatus].label;
        showSuccess(t('success.statusUpdated', { status: statusLabel }));
        setShowDialog(false);
        router.refresh();
      } else {
        // Show error with blockers if quality gates failed
        if (data.blockers && data.blockers.length > 0) {
          setBlockers(data.blockers);
        } else {
          showError(data.error || t('errors.updateFailed'));
        }
      }
    } catch (error) {
      showErrorFrom(error, { fallback: t('errors.updateFailed') });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setShowDialog(false);
    setSelectedStatus(null);
    setNotes('');
    setBlockers([]);
  };

  // Quick action buttons for common transitions
  const currentStatus = (order.status || '').toLowerCase() as OrderStatus;
  const canMoveTo = (status: OrderStatus) => allowedTransitions.includes(status);

  // Generate action buttons based on current status
  const actionButtons = [];

  // Intake → Preparation
  if (currentStatus === 'intake' && canMoveTo('preparation')) {
    actionButtons.push({
      label: t('buttons.startPreparation'),
      status: 'preparation' as OrderStatus,
      color: 'blue',
      icon: Package,
    });
  }

  // Various statuses → Ready
  if (canMoveTo('ready') && currentStatus !== 'ready') {
    actionButtons.push({
      label: t('buttons.markAsReady'),
      status: 'ready' as OrderStatus,
      color: 'green',
      icon: CheckCircle,
    });
  }

  // Ready → Out for Delivery
  if (currentStatus === 'ready' && canMoveTo('out_for_delivery')) {
    actionButtons.push({
      label: t('buttons.outForDelivery'),
      status: 'out_for_delivery' as OrderStatus,
      color: 'teal',
      icon: ArrowRight,
    });
  }

  // Out for Delivery / Ready → Delivered
  if (canMoveTo('delivered') && currentStatus !== 'delivered') {
    actionButtons.push({
      label: t('buttons.markAsDelivered'),
      status: 'delivered' as OrderStatus,
      color: 'purple',
      icon: CheckCircle,
    });
  }

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    teal: 'bg-teal-600 hover:bg-teal-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    red: 'bg-red-600 hover:bg-red-700',
  };

  return (
    <>
      <div className="space-y-2">
        {actionButtons.map(({ label, status, color, icon: Icon }) => (
          <Button
            key={status}
            onClick={() => handleStatusClick(status)}
            disabled={loading}
            className={`w-full ${colorClasses[color]} text-white`}
            size="lg"
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </Button>
        ))}

        {/* Cancel Order - Always available if not already cancelled/closed */}
        {currentStatus !== 'cancelled' &&
          currentStatus !== 'closed' &&
          canMoveTo('cancelled') && (
            <Button
              onClick={() => handleStatusClick('cancelled')}
              disabled={loading}
              variant="outline"
              className={`w-full border-red-300 text-red-700 hover:bg-red-50 ${isRTL ? 'flex-row-reverse' : ''}`}
              size="lg"
            >
              <XCircle className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
              {t('buttons.cancelOrder')}
            </Button>
          )}
      </div>

      {/* Status Change Confirmation Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className={isRTL ? 'text-right' : 'text-left'}>
          <DialogHeader className={isRTL ? 'text-right' : 'text-left'}>
            <DialogTitle className={isRTL ? 'text-right' : 'text-left'}>
              {selectedStatus && t('dialog.changeStatusTo', { 
                status: locale === 'ar' 
                  ? STATUS_META[selectedStatus].labelAr 
                  : STATUS_META[selectedStatus].label 
              })}
            </DialogTitle>
            <DialogDescription className={isRTL ? 'text-right' : 'text-left'}>
              {selectedStatus && STATUS_META[selectedStatus].description}
            </DialogDescription>
          </DialogHeader>

          {blockers.length > 0 && (
            <Alert variant="destructive" className={isRTL ? 'text-right' : 'text-left'}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className={isRTL ? 'text-right' : 'text-left'}>
                <div className="font-semibold mb-1">{t('dialog.cannotChangeStatus')}:</div>
                <ul className={`list-disc ${isRTL ? 'list-inside' : 'list-inside'} space-y-1 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {blockers.map((blocker, index) => (
                    <li key={index}>{blocker}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className={`space-y-4 ${isRTL ? 'text-right' : 'text-left'}`}>
            <div>
              <Label htmlFor="notes" className={isRTL ? 'text-right' : 'text-left'}>
                {t('dialog.notes')} ({tCommon('optional')})
              </Label>
              <Textarea
                id="notes"
                placeholder={t('dialog.notesPlaceholder')}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                dir={isRTL ? 'rtl' : 'ltr'}
                className={`mt-1 ${isRTL ? 'text-right' : 'text-left'}`}
              />
            </div>
          </div>

          <DialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleConfirmChange}
              disabled={loading || blockers.length > 0}
              className={isRTL ? 'flex-row-reverse' : ''}
            >
              {loading && <Loader2 className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'} animate-spin`} />}
              {t('dialog.confirmChange')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
