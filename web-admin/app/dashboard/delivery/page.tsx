/**
 * Delivery Management Dashboard
 * Route management and delivery tracking
 * PRD-013: Delivery Management & POD
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth/auth-context';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxKpiStatCard } from '@ui/data-display/cmx-kpi-stat-card';
import { Truck, MapPin, CheckCircle2, Clock, XCircle } from 'lucide-react';

interface DeliveryRoute {
  id: string;
  routeNumber: string;
  driverName?: string;
  status: string;
  totalStops: number;
  completedStops: number;
  startedAt?: string;
}

export default function DeliveryPage() {
  const router = useRouter();
  const t = useTranslations('workflow');
  const { currentTenant } = useAuth();
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRoutes = async () => {
      if (!currentTenant) return;

      setLoading(true);
      try {
        // TODO: Fetch routes from API
        // const res = await fetch('/api/v1/delivery/routes');
        // const json = await res.json();
        setRoutes([]);
      } catch (err: any) {
        setError(err.message || 'Failed to load routes');
      } finally {
        setLoading(false);
      }
    };

    loadRoutes();
  }, [currentTenant]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Truck className="h-8 w-8" />
          Delivery Management
        </h1>
        <p className="text-gray-600 mt-1">Manage delivery routes and track deliveries</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <CmxKpiStatCard
          title="Active Routes"
          value={routes.filter((r) => r.status === 'in_progress').length}
          icon={<Truck className="h-5 w-5" />}
        />
        <CmxKpiStatCard
          title="Planned Routes"
          value={routes.filter((r) => r.status === 'planned').length}
          icon={<Clock className="h-5 w-5" />}
        />
        <CmxKpiStatCard
          title="Completed Today"
          value={routes.filter((r) => r.status === 'completed').length}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <CmxKpiStatCard
          title="Failed"
          value={routes.filter((r) => r.status === 'failed').length}
          icon={<XCircle className="h-5 w-5" />}
        />
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="flex justify-end mb-4">
        <CmxButton onClick={() => router.push('/dashboard/delivery/routes/new')}>
          <Truck className="h-4 w-4 mr-2" />
          Create Route
        </CmxButton>
      </div>

      {routes.length === 0 ? (
        <CmxCard>
          <CmxCardContent className="py-12 text-center">
            <MapPin className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 text-lg">No delivery routes</p>
            <p className="text-gray-500 text-sm mt-2">Create a route to start managing deliveries</p>
          </CmxCardContent>
        </CmxCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routes.map((route) => (
            <CmxCard key={route.id} className="hover:shadow-lg transition-all">
              <CmxCardHeader>
                <CmxCardTitle className="flex items-center justify-between">
                  <span>{route.routeNumber}</span>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      route.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : route.status === 'in_progress'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {route.status}
                  </span>
                </CmxCardTitle>
              </CmxCardHeader>
              <CmxCardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Driver:</span>
                    <span className="font-medium">{route.driverName || 'Unassigned'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Stops:</span>
                    <span className="font-medium">
                      {route.completedStops}/{route.totalStops}
                    </span>
                  </div>
                  {route.startedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Started:</span>
                      <span className="font-medium">
                        {new Date(route.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <CmxButton
                    variant="outline"
                    className="w-full"
                    onClick={() => router.push(`/dashboard/delivery/routes/${route.id}`)}
                  >
                    View Route
                  </CmxButton>
                </div>
              </CmxCardContent>
            </CmxCard>
          ))}
        </div>
      )}
    </div>
  );
}

