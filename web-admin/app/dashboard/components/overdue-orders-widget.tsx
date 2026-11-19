'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Clock, RefreshCw, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface OverdueOrder {
  id: string;
  order_no: string;
  customer_name: string;
  ready_by: string;
  hours_overdue: number;
  status: string;
}

/**
 *
 */
export function OverdueOrdersWidget() {
  const router = useRouter();
  const [orders, setOrders] = useState<OverdueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchOverdueOrders();

    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchOverdueOrders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchOverdueOrders = async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/orders/overdue');

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch overdue orders');
      }

      const data = await response.json();
      setOrders(data.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching overdue orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to load overdue orders');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchOverdueOrders();
  };

  const handleOrderClick = (orderId: string) => {
    router.push(`/dashboard/orders/${orderId}`);
  };

  const formatHoursOverdue = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    } else if (hours < 24) {
      return `${Math.round(hours)}h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = Math.round(hours % 24);
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
  };

  const getSeverityColor = (hours: number): string => {
    if (hours > 48) return 'text-danger-text bg-danger-bg';
    if (hours > 24) return 'text-warning-text bg-warning-bg';
    return 'text-warning-text bg-warning-bg';
  };

  if (loading && !isRefreshing) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Overdue Orders</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-danger-bg">
            <AlertCircle className="h-5 w-5 text-danger-text" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Overdue Orders
            </h3>
            {orders.length > 0 && (
              <p className="text-sm text-muted-foreground">
                {orders.length} order{orders.length !== 1 ? 's' : ''} past due date
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw
            className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        {error ? (
          <div className="rounded-lg bg-danger-bg p-4 text-sm text-danger-text">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-success-bg mb-4">
              <Clock className="h-8 w-8 text-success-text" />
            </div>
            <h4 className="text-lg font-medium text-foreground mb-1">
              All Caught Up!
            </h4>
            <p className="text-sm text-muted-foreground">
              No overdue orders at the moment
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Order
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Due Date
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Overdue
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {orders.map((order) => (
                    <tr
                      key={order.id}
                      className="hover:bg-muted cursor-pointer transition-colors"
                      onClick={() => handleOrderClick(order.id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-foreground">
                          #{order.order_no}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {order.status}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {order.customer_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-foreground">
                          {new Date(order.ready_by).toLocaleDateString('en-OM', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-end">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getSeverityColor(
                            order.hours_overdue
                          )}`}
                        >
                          <Clock className="h-3 w-3" />
                          {formatHoursOverdue(order.hours_overdue)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOrderClick(order.id);
                          }}
                          className="text-primary-text hover:text-primary-text/80"
                          aria-label="View order"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {orders.length > 5 && (
              <div className="text-center pt-2">
                <button
                  onClick={() => router.push('/dashboard/orders?filter=overdue')}
                  className="text-sm text-primary-text hover:text-primary-text/80 font-medium"
                >
                  View all overdue orders →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
