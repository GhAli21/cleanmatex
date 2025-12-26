/**
 * Processing Table Component
 * Dense, sortable data table with all order details
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ArrowUpDown, SquarePen, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback/cmx-message';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { ProcessingOrder, SortField, SortDirection } from '@/types/processing';

interface ProcessingTableProps {
  orders: ProcessingOrder[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onRefresh: () => void;
  onEditClick?: (orderId: string) => void; // NEW: Callback for edit button
}

export function ProcessingTable({
  orders,
  sortField,
  onSort,
  onRefresh,
  onEditClick,
}: ProcessingTableProps) {
  const t = useTranslations('processing.table');

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const hour12 = hours % 12 || 12;
    return `${day}/${month}/${year} ${hour12}${ampm}`;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <th
      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 transition-colors rtl:text-right"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        <ArrowUpDown
          className={`h-4 w-4 ${
            sortField === field ? 'text-blue-600' : 'text-gray-400'
          }`}
        />
      </div>
    </th>
  );

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <p className="text-gray-600 text-lg">{t('noOrders')}</p>
        <Link
          href="/dashboard/orders/new"
          className="inline-block mt-4 text-blue-600 hover:text-blue-700 font-medium"
        >
          {t('createNew')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <SortableHeader field="id">{t('id')}</SortableHeader>
                <SortableHeader field="ready_by_at">{t('readyBy')}</SortableHeader>
                <SortableHeader field="customer_name">{t('customer')}</SortableHeader>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 rtl:text-right">
                  {t('order')}
                </th>
                <SortableHeader field="total_items">{t('pcs')}</SortableHeader>
                {/* ✅ NEW PROGRESS COLUMN */}
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 rtl:text-right">
                  {t('progress')}
                </th>
                <SortableHeader field="notes">{t('notes')}</SortableHeader>
                <SortableHeader field="total">{t('total')}</SortableHeader>
                <SortableHeader field="status">{t('status')}</SortableHeader>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <OrderRow
                  key={order.id}
                  order={order}
                  formatDate={formatDate}
                  onRefresh={onRefresh}
                  onEditClick={onEditClick}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Render dialogs outside the table */}
      {orders.map((order) => (
        <OrderRowDialog
          key={`dialog-${order.id}`}
          order={order}
          onRefresh={onRefresh}
        />
      ))}
    </>
  );
}

interface OrderRowProps {
  order: ProcessingOrder;
  formatDate: (date: string) => string;
  onRefresh: () => void;
  onEditClick?: (orderId: string) => void; // NEW: Callback for edit button
}

function OrderRow({ order, formatDate, onRefresh, onEditClick }: OrderRowProps) {
  const router = useRouter();
  const t = useTranslations('processing.table');
  const isPaid = order.payment_status === 'paid';
  const isUrgent = order.priority === 'urgent' || order.priority === 'express';

  // State for loading and success message
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingEdit, setIsLoadingEdit] = useState(false);  // ✅ NEW
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Determine row highlight color
  const rowHighlight = isUrgent ? 'border-l-4 border-l-pink-500' : 'border-l-4 border-l-blue-200';

  const handleStatusToggleClick = () => {
    // Dispatch custom event to open dialog
    window.dispatchEvent(new CustomEvent(`open-confirm-dialog-${order.id}`, {
      detail: { orderId: order.id }
    }));
  };
  
  // Listen for loading and success events
  useEffect(() => {
    const handleLoadingStart = () => setIsLoading(true);
    const handleLoadingEnd = () => setIsLoading(false);
    const handleSuccess = () => {
      setSuccessMessage(t('markReadySuccess') || 'Order marked as ready successfully');
      setTimeout(() => {
        onRefresh();
        setSuccessMessage(null);
      }, 1500);
    };

    window.addEventListener(`mark-ready-loading-start-${order.id}`, handleLoadingStart);
    window.addEventListener(`mark-ready-loading-end-${order.id}`, handleLoadingEnd);
    window.addEventListener(`mark-ready-success-${order.id}`, handleSuccess);
    
    return () => {
      window.removeEventListener(`mark-ready-loading-start-${order.id}`, handleLoadingStart);
      window.removeEventListener(`mark-ready-loading-end-${order.id}`, handleLoadingEnd);
      window.removeEventListener(`mark-ready-success-${order.id}`, handleSuccess);
    };
  }, [order.id, onRefresh, t]);


  const handleEdit = () => {
    console.log('[OrderRow] Edit clicked for order:', order.id);
    setIsLoadingEdit(true);

    if (onEditClick) {
      onEditClick(order.id);
      // Reset loading after modal should open
      setTimeout(() => setIsLoadingEdit(false), 500);
    } else {
      router.push(`/dashboard/processing/${order.id}`);
    }
  };

  return (
    <React.Fragment>
      <tr className={`hover:bg-gray-50 ${rowHighlight}`}>
      {/* ID */}
      <td className="px-4 py-4">
        <div className="font-medium text-blue-600">{order.order_no}</div>
      </td>

      {/* READY BY */}
      <td className="px-4 py-4">
        <div className="text-sm">{formatDate(order.ready_by_at)}</div>
      </td>

      {/* CUSTOMER */}
      <td className="px-4 py-4">
        <div className="font-medium">{order.customer_name}</div>
        {order.customer_name2 && (
          <div className="text-sm text-gray-500">{order.customer_name2}</div>
        )}
      </td>

      {/* ORDER - Multi-line items */}
      <td className="px-4 py-4">
        <div className="space-y-1 max-w-xs">
          {order.items.slice(0, 3).map((item, idx) => (
            <div key={idx} className="text-sm">
              {item.product_name} x {item.quantity}
            </div>
          ))}
          {order.items.length > 3 && (
            <div className="text-sm text-gray-500">
              +{order.items.length - 3} {t('moreItems')}
            </div>
          )}
          <Link
            href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/processing')}&returnLabel=${encodeURIComponent(t('backToProcessing') || 'Back to Processing')}`}
            className="inline-block mt-2 text-xs text-blue-600 hover:text-blue-700"
          >
            {t('details')} →
          </Link>
        </div>
      </td>

      {/* PCS */}
      <td className="px-4 py-4 text-right">
        <div className="font-medium">{order.total_items}</div>
      </td>

      {/* ✅ PROGRESS - NEW */}
      <td className="px-4 py-4">
        <div className="w-24">
          {(() => {
            const progressPercent = order.total_items > 0
              ? Math.round((order.quantity_ready || 0) / order.total_items * 100)
              : 0;
            
            return (
              <>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-700">
                    {progressPercent}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      progressPercent === 100 ? 'bg-green-600' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.min(100, progressPercent)}%` }}
                  />
                </div>
              </>
            );
          })()}
        </div>
      </td>

      {/* NOTES */}
      <td className="px-4 py-4">
        <div className="text-sm text-gray-600 max-w-xs truncate">
          {order.notes || '—'}
        </div>
      </td>

      {/* TOTAL */}
      <td className="px-4 py-4 text-right">
        <div className="font-semibold">OMR {order.total.toFixed(3)}</div>
      </td>

      {/* STATUS - Action Icons */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3 justify-end">
          {/* Payment/Priority Tag */}
          {!isPaid && (
            <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
              1st
            </span>
          )}

          {/* ✅ Edit Icon with Loading State */}
          <button
            onClick={handleEdit}
            disabled={isLoadingEdit}
            className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-wait"
            title={isLoadingEdit ? (t('opening') || 'Opening...') : (t('edit') || 'Edit')}
            aria-label={t('edit') || 'Edit'}
          >
            {isLoadingEdit ? (
              <Loader2 className="h-4 w-4 text-gray-600 animate-spin" />
            ) : (
              <SquarePen className="h-4 w-4 text-gray-600" />
            )}
          </button>

          {/* Status Toggle Icon */}
          <button
            onClick={handleStatusToggleClick}
            disabled={isLoading}
            className="p-2 hover:bg-green-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
            title={isLoading ? (t('processing') || 'Processing...') : t('complete')}
            aria-label={t('complete')}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 text-green-600 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 text-green-600" />
            )}
          </button>

          {/* Current Status Badge */}
          <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
            {order.current_status}
          </span>
        </div>
      </td>

    </tr>
    
      {/* Success Message Row */}
      {successMessage && (
        <tr>
          <td colSpan={9} className="px-4 py-3 bg-green-50 border-t border-green-200">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium">{successMessage}</span>
            </div>
          </td>
        </tr>
      )}
    </React.Fragment>
  );
}

// Separate component for Dialog to render outside table structure
function OrderRowDialog({ order, onRefresh }: { order: ProcessingOrder; onRefresh: () => void }) {
  const t = useTranslations('processing.table');
  const tDetail = useTranslations('processing.detail');
  const tCommon = useTranslations('common');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [rackLocation, setRackLocation] = useState('');
  const [rackLocationError, setRackLocationError] = useState('');

  // Listen for dialog open events from the row
  useEffect(() => {
    const handleOpenDialog = (event: CustomEvent) => {
      if (event.detail.orderId === order.id) {
        setShowConfirmDialog(true);
      }
    };

    window.addEventListener(`open-confirm-dialog-${order.id}`, handleOpenDialog as EventListener);
    return () => {
      window.removeEventListener(`open-confirm-dialog-${order.id}`, handleOpenDialog as EventListener);
    };
  }, [order.id]); 

  const handleConfirm = async () => {
    // Validate rack location
    if (!rackLocation.trim()) {
      setRackLocationError(tDetail('validation.rackLocationRequired') || 'Rack location is required');
      return;
    }

    window.dispatchEvent(new CustomEvent(`mark-ready-loading-start-${order.id}`));
    setShowConfirmDialog(false);
    
    try {
      const res = await fetch(`/api/v1/orders/${order.id}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          toStatus: 'ready',
          notes: 'Processing completed via quick action',
          metadata: {
            rack_location: rackLocation.trim()
          }
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          // Reset rack location state
          setRackLocation('');
          setRackLocationError('');
          // Dispatch success event
          window.dispatchEvent(new CustomEvent(`mark-ready-success-${order.id}`));
        } else {
          window.dispatchEvent(new CustomEvent(`mark-ready-loading-end-${order.id}`));
          cmxMessage.error(t('markReadyError') || 'Failed to update order status', {
            description: json.error,
            duration: 5000,
          });
        }
      } else {
        window.dispatchEvent(new CustomEvent(`mark-ready-loading-end-${order.id}`));
        const error = await res.json().catch(() => ({ error: t('markReadyError') || 'Failed to update order status' }));
        cmxMessage.error(t('markReadyError') || 'Failed to update order status', {
          description: error.error,
          duration: 5000,
        });
      }
    } catch (error) {
      setIsLoading(false);
      window.dispatchEvent(new CustomEvent(`mark-ready-loading-end-${order.id}`));
      console.error('Error updating order:', error);
      cmxMessage.error(t('markReadyError') || 'Error updating order status', {
        description: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
    }
  };

  const handleCancel = () => {
    setShowConfirmDialog(false);
    // Reset rack location state
    setRackLocation('');
    setRackLocationError('');
  };

  const handleOpenChange = (open: boolean) => {
    setShowConfirmDialog(open);
    if (!open) {
      // Reset rack location state when dialog closes
      setRackLocation('');
      setRackLocationError('');
    }
  };

  return (
    <Dialog open={showConfirmDialog} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            {t('confirmMarkReady') || 'Confirm Mark as Ready'}
          </DialogTitle>
          <DialogDescription>
            {t('confirmMarkReadyMessage') || `Are you sure you want to mark order ${order.order_no} as ready?`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            label={t('rackLocation') || tDetail('rackLocation') || 'Rack Location'}
            value={rackLocation}
            onChange={(e) => {
              setRackLocation(e.target.value);
              setRackLocationError('');
            }}
            placeholder={tDetail('rackLocationPlaceholder') || 'e.g., Rack A-12'}
            error={rackLocationError}
            required
            helpText={tDetail('rackLocationHelp') || 'Enter the rack location where this order is stored'}
          />
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {tCommon('cancel') || 'Cancel'}
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isLoading || !rackLocation.trim()}
            isLoading={isLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('processing') || 'Processing...'}
              </>
            ) : (
              t('confirmReady') || 'Confirm Ready'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
