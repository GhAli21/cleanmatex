/**
 * Assembly Screen - Detail Page
 * Item verification and grouping
 * PRD-010: Workflow-based assembly detail
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';
import { useWorkflowContext } from '@/lib/hooks/use-workflow-context';
import { useOrderTransition } from '@/lib/hooks/use-order-transition';
import { useWorkflowSystemMode } from '@/lib/config/workflow-config';
import { useMessage } from '@ui/feedback';

interface AssemblyItem {
  id: string;
  product_name: string;
  quantity: number;
  item_status: string;
}

interface AssemblyOrder {
  id: string;
  order_no: string;
  customer: {
    name: string;
    phone: string;
  };
  items: AssemblyItem[];
}

export default function AssemblyDetailPage() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const { showSuccess, showErrorFrom } = useMessage();
  const useNewWorkflowSystem = useWorkflowSystemMode();
  const transition = useOrderTransition();
  const [order, setOrder] = useState<AssemblyOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const orderId = (params as any)?.id as string | undefined;
  const { data: wfContext } = useWorkflowContext(orderId ?? null);

  useEffect(() => {
    const loadOrder = async () => {
      if (!currentTenant || !orderId) return;
      
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/orders/${orderId}/state`);
        const json = await res.json();
        if (json.success && json.data?.order) {
          setOrder(json.data.order);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    };

    loadOrder();
  }, [orderId, currentTenant]);

  const handleAssemble = async () => {
    if (!orderId) return;
    setSubmitting(true);
    try {
      // Resolve next status using workflow context
      const nextStatus =
        wfContext?.flags?.qa_enabled
          ? 'qa'
          : wfContext?.flags?.packing_enabled
          ? 'packing'
          : 'ready';

      const result = await transition.mutateAsync({
        orderId,
        input: {
          screen: 'assembly',
          to_status: nextStatus,
          notes: 'Assembly complete',
          useOldWfCodeOrNew: useNewWorkflowSystem,
        },
      });

      if (result.success) {
        showSuccess(t('assembly.messages.taskCreated'));
        router.push(nextStatus === 'qa' ? '/dashboard/qa' : nextStatus === 'packing' ? '/dashboard/packing' : '/dashboard/ready');
      } else {
        setError(result.error || t('assembly.messages.taskCreateFailed'));
      }
    } catch (err: any) {
      showErrorFrom(err, { fallback: t('assembly.messages.taskCreateFailed') });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        Order not found
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <Link href="/dashboard/assembly" className="text-blue-600 hover:underline mb-2 inline-block">
          ← {t('assembly.backToAssembly')}
        </Link>
        <h1 className="text-3xl font-bold">{t('screens.assembly')} - {order.order_no}</h1>
        <p className="text-gray-600 mt-1">{order.customer.name} • {order.customer.phone}</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">{t('assemblyDetail.verifyItems')}</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-gray-600">{t('assemblyDetail.quantity')}: {item.quantity}</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm">
                    {t('assemblyDetail.ready')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              {t('assemblyDetail.hint')}
            </p>
          </div>
        </div>

        {/* Actions Panel */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold mb-4">{t('assemblyDetail.actionsTitle')}</h3>
            
            <button
              onClick={handleAssemble}
              disabled={submitting}
              className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? t('assemblyDetail.processing') : t('assemblyDetail.complete')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

