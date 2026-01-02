/**
 * Assembly Screen - List Page
 * Shows orders in ASSEMBLY status (conditional on tenant settings)
 * PRD-010: Workflow-based assembly
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import Link from 'next/link';
import { useAssemblyDashboard, useCreateAssemblyTask } from '@/src/features/assembly/hooks/use-assembly';
import { AssemblyTaskModal } from '@/src/features/assembly/ui/assembly-task-modal';
import { useMessage } from '@ui/feedback/useMessage';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card';
import { CmxKpiStatCard } from '@ui/data-display/cmx-kpi-stat-card';
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AssemblyOrder {
  id: string;
  order_no: string;
  customer: {
    name: string;
    phone: string;
  };
  total_items: number;
  current_status: string;
}

export default function AssemblyPage() {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const [orders, setOrders] = useState<AssemblyOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  
  const { data: dashboardData, isLoading: dashboardLoading } = useAssemblyDashboard();
  const { mutate: createTask, isPending: isCreatingTask } = useCreateAssemblyTask();
  const { showSuccess, showError: showErrorMsg } = useMessage();

  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    const loadOrders = async () => {
      if (!currentTenant) return;
      
      setLoading(true);
      try {
        const params = new URLSearchParams({
          current_status: 'ready,assembly',
          page: String(pagination.page),
          limit: '20',
        });
        const res = await fetch(`/api/v1/orders?${params.toString()}`);
        const json = await res.json();
        if (json.success && json.data?.orders) {
          setOrders(json.data.orders);
          setPagination(json.data.pagination || { page: pagination.page, limit: 20, total: 0, totalPages: 0 });
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [currentTenant, pagination.page]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const handleAssembleOrder = async (orderId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    createTask(orderId, {
      onSuccess: (result) => {
        if (result.success && result.taskId) {
          setSelectedOrderId(orderId);
          setSelectedTaskId(result.taskId);
          showSuccess('Assembly task created');
        }
      },
      onError: (error) => {
        showErrorMsg(error.message || 'Failed to create assembly task');
      },
    });
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{t('screens.assembly')}</h1>
        <p className="text-gray-600 mt-1">Orders ready for assembly</p>
      </div>

      {/* Dashboard Stats */}
      {dashboardData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <CmxKpiStatCard
            title="Pending"
            value={dashboardData.pendingTasks}
            icon={<Package className="h-5 w-5" />}
          />
          <CmxKpiStatCard
            title="In Progress"
            value={dashboardData.inProgressTasks}
            icon={<Package className="h-5 w-5" />}
          />
          <CmxKpiStatCard
            title="QA Pending"
            value={dashboardData.qaPendingTasks}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <CmxKpiStatCard
            title="Completed Today"
            value={dashboardData.completedToday}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <CmxKpiStatCard
            title="Open Exceptions"
            value={dashboardData.exceptionsOpen}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {orders.length === 0 ? (
        <CmxCard>
          <CmxCardContent className="py-12 text-center">
            <p className="text-gray-600 text-lg">No orders in assembly</p>
          </CmxCardContent>
        </CmxCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((order) => (
            <CmxCard
              key={order.id}
              className="hover:shadow-lg transition-all cursor-pointer"
            >
              <CmxCardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <Link
                    href={`/dashboard/orders/${order.id}?returnUrl=${encodeURIComponent('/dashboard/assembly')}&returnLabel=${encodeURIComponent('Back to Assembly')}`}
                    className="text-xl font-bold text-blue-600 hover:underline"
                  >
                    {order.order_no}
                  </Link>
                  <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                    {order.total_items} items
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Customer:</span>
                    <span>{order.customer.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Phone:</span>
                    <span>{order.customer.phone}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <CmxButton
                    className="w-full"
                    onClick={(e) => handleAssembleOrder(order.id, e)}
                    loading={isCreatingTask}
                    disabled={isCreatingTask}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Assemble Order
                  </CmxButton>
                </div>
              </CmxCardContent>
            </CmxCard>
          ))}
        </div>
      )}

      {/* Assembly Task Modal */}
      {selectedOrderId && selectedTaskId && (
        <AssemblyTaskModal
          orderId={selectedOrderId}
          taskId={selectedTaskId}
          onClose={() => {
            setSelectedOrderId(null);
            setSelectedTaskId(null);
          }}
          onComplete={() => {
            // Refresh orders list
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

