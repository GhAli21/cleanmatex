'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ExternalLink, MapPin, PackageCheck, Phone, Truck } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { cmxMessage, CmxStatusBadge } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogDescription, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { formatDateTime } from '@/lib/utils/rtl';
import { getDrivers } from '@/app/actions/drivers/drivers-actions';
import { DriverPicker } from '@features/drivers/ui/driver-picker';
import { assignDeliveryDriver } from '@features/drivers/api/delivery-route-command-api';
import type { OrgDriver } from '@/lib/types/drivers';
import type { DeliveryRouteManifest, DeliveryRouteManifestDriver } from '@/lib/services/delivery/delivery-route-query.service';

/**
 * Props for a route manifest that may show a local driver-assignment result
 * before the authoritative route read model is refreshed.
 */
interface DeliveryRouteManifestProps {
  /** Tenant-scoped manifest supplied by the delivery read contract. */
  route: DeliveryRouteManifest;
  /** Called after a successful driver reassignment so the caller can refetch the manifest. */
  onDriverAssigned?: () => void;
}

interface AuditActor {
  id: string;
  displayName: string | null;
}

interface AuditActorsResponse {
  success: boolean;
  data?: AuditActor[];
}

function statusVariant(statusCode: string): 'success' | 'processing' | 'warning' | 'default' {
  if (statusCode === 'delivered' || statusCode === 'completed') return 'success';
  if (statusCode === 'in_transit' || statusCode === 'in_progress') return 'processing';
  if (statusCode === 'pending' || statusCode === 'planned') return 'warning';
  return 'default';
}

function mapHref(address: string, latitude: number | null, longitude: number | null): string {
  const query = latitude !== null && longitude !== null ? `${latitude},${longitude}` : address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Definition-list row for the secondary "Route details" section. */
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-secondary-bg-rgb,248_250_252))] px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

/**
 * Route manifest uses the Delivery read contract only; opening a stop never
 * changes its state and keeps the eventual driver/mobile handoff consistent.
 */
export function DeliveryRouteManifest({ route, onDriverAssigned }: DeliveryRouteManifestProps) {
  const t = useTranslations('workflow.delivery');
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [drivers, setDrivers] = useState<OrgDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | undefined>(route.driverId ?? undefined);
  const [isLoadingDrivers, startLoadingDrivers] = useTransition();
  const [isAssigning, startAssigning] = useTransition();

  const driver: DeliveryRouteManifestDriver | null = route.driver;
  const actorIds = useMemo(
    () => [...new Set([route.createdBy, route.updatedBy].filter((id): id is string => Boolean(id)))],
    [route.createdBy, route.updatedBy],
  );

  const actorsQuery = useQuery({
    queryKey: ['audit-actors', actorIds.join(',')],
    enabled: actorIds.length > 0,
    queryFn: async (): Promise<Map<string, string>> => {
      const params = new URLSearchParams();
      actorIds.forEach((id) => params.append('id', id));
      const response = await fetch(`/api/v1/audit/actors?${params.toString()}`);
      const payload = await response.json().catch(() => null) as AuditActorsResponse | null;
      if (!response.ok || !payload?.success) return new Map();
      return new Map((payload.data ?? []).map((actor) => [actor.id, actor.displayName ?? actor.id]));
    },
  });
  const actorName = (id: string | null) => (id ? actorsQuery.data?.get(id) ?? id : null);

  /** Load current tenant choices only after an operator asks to change assignment. */
  const openDriverDialog = () => {
    setSelectedDriverId(route.driverId ?? undefined);
    setDriverDialogOpen(true);
    startLoadingDrivers(async () => {
      const result = await getDrivers();
      if (!result.success || !result.data) {
        cmxMessage.error(t('manifest.driverLoadFailed'));
        return;
      }
      setDrivers(result.data);
    });
  };

  /** Server authority validates the driver and returns the non-blocking overlap warning. */
  const assignDriver = () => {
    if (!selectedDriverId) {
      cmxMessage.warning(t('manifest.driverRequired'));
      return;
    }

    startAssigning(async () => {
      try {
        const result = await assignDeliveryDriver(route.id, selectedDriverId);
        setDriverDialogOpen(false);
        cmxMessage.success(t('manifest.driverAssigned'));
        if (result.driverWarning) {
          cmxMessage.warning(t('manifest.driverAssignmentWarning'));
        }
        onDriverAssigned?.();
      } catch {
        cmxMessage.error(t('manifest.driverAssignFailed'));
      }
    });
  };

  return (
    <div className="space-y-5">
      <CmxCard className="overflow-hidden">
        <CmxCardHeader className="bg-slate-950 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Truck className="h-4 w-4" aria-hidden="true" />
                {t('manifest.eyebrow')}
              </div>
              <CmxCardTitle className="text-xl text-white">{route.routeNumber}</CmxCardTitle>
            </div>
            <CmxStatusBadge
              label={t(`routeStatus.${route.statusCode}`, { default: route.statusCode })}
              variant={statusVariant(route.statusCode)}
            />
          </div>
        </CmxCardHeader>
        <CmxCardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('manifest.progress')}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{t('manifest.progressValue', { completed: route.completedStops, total: route.totalStops })}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('manifest.driver')}</p>
            {driver ? (
              <div className="mt-1 space-y-0.5">
                <p className="text-sm font-medium">{driver.name}</p>
                {driver.phone ? (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <a href={`tel:${driver.phone}`} className="hover:underline">{driver.phone}</a>
                  </p>
                ) : null}
                {driver.vehicleType || driver.vehiclePlateNo ? (
                  <p className="text-xs text-muted-foreground">
                    {[driver.vehicleType, driver.vehiclePlateNo].filter(Boolean).join(' · ')}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-sm font-medium text-muted-foreground">{t('routes.fields.unassigned')}</p>
            )}
            <CmxButton
              className="mt-2"
              variant="outline"
              size="sm"
              onClick={openDriverDialog}
              disabled={isLoadingDrivers || isAssigning}
            >
              {driver ? t('manifest.reassignDriver') : t('manifest.assignDriver')}
            </CmxButton>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('routes.fields.branch')}</p>
            <p className="mt-1 text-sm font-medium">{route.branchName ?? '—'}</p>
          </div>
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader><CmxCardTitle className="text-base">{t('manifest.routeDetails')}</CmxCardTitle></CmxCardHeader>
        <CmxCardContent>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <DetailRow label={t('routes.fields.created')} value={route.createdAt ? formatDateTime(route.createdAt, locale) : '—'} />
            <DetailRow label={t('routes.fields.startedAt')} value={route.startedAt ? formatDateTime(route.startedAt, locale) : t('manifest.notStarted')} />
            <DetailRow label={t('routes.fields.completedAt')} value={route.completedAt ? formatDateTime(route.completedAt, locale) : '—'} />
            <DetailRow label={t('routes.fields.estimatedDurationMinutes')} value={route.estimatedDurationMinutes != null ? t('routes.fields.minutesValue', { count: route.estimatedDurationMinutes }) : '—'} />
            <DetailRow label={t('routes.fields.totalDistanceKm')} value={route.totalDistanceKm != null ? t('routes.fields.kmValue', { count: route.totalDistanceKm }) : '—'} />
            <DetailRow label={t('manifest.createdBy')} value={actorName(route.createdBy) ?? '—'} />
            <DetailRow label={t('manifest.updatedBy')} value={actorName(route.updatedBy) ?? '—'} />
            <DetailRow label={t('routes.fields.updatedAt')} value={route.updatedAt ? formatDateTime(route.updatedAt, locale) : '—'} />
          </dl>
          {route.notes ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <span className="font-medium">{t('routes.fields.notes')}:</span> {route.notes}
            </div>
          ) : null}
        </CmxCardContent>
      </CmxCard>

      <section aria-labelledby="delivery-stops-heading" className="space-y-3">
        <div className="flex items-center gap-2">
          <PackageCheck className="h-5 w-5 text-primary" aria-hidden="true" />
          <h2 id="delivery-stops-heading" className="text-lg font-semibold">{t('manifest.stops')}</h2>
        </div>
        <div className="grid gap-3">
          {route.stops.map((stop) => (
            <CmxCard key={stop.id} className="border-l-4 border-l-sky-500">
              <CmxCardContent className="flex flex-col gap-4 pt-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-bold text-sky-800">
                      {t('manifest.stopNumber', { sequence: stop.sequence })}
                    </span>
                    <CmxStatusBadge
                      label={t(`stopStatus.${stop.statusCode}`, { default: stop.statusCode })}
                      variant={statusVariant(stop.statusCode)}
                      size="sm"
                    />
                    <span className="font-semibold">{stop.order.orderNo}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {stop.contactName ?? stop.order.customerName ?? t('fallbacks.unknownCustomer')}
                    {stop.contactPhone || stop.order.customerPhone ? ` · ${stop.contactPhone ?? stop.order.customerPhone}` : ''}
                  </p>
                  <p className="flex items-start gap-2 text-sm">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{stop.address}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <CmxButton variant="outline" asChild>
                    <Link href={mapHref(stop.address, stop.latitude, stop.longitude)} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                      {t('manifest.openNavigation')}
                    </Link>
                  </CmxButton>
                  <CmxButton asChild>
                    <Link href={`/dashboard/delivery/routes/${route.id}/stops/${stop.id}`}>
                      {t('manifest.openStop')}
                    </Link>
                  </CmxButton>
                </div>
              </CmxCardContent>
            </CmxCard>
          ))}
        </div>
      </section>

      <CmxDialog open={driverDialogOpen} onOpenChange={setDriverDialogOpen}>
        <CmxDialogContent className="w-[calc(100%-2rem)] max-w-lg" scrollBody>
          <CmxDialogHeader>
            <CmxDialogTitle>{driver ? t('manifest.reassignDriver') : t('manifest.assignDriver')}</CmxDialogTitle>
            <CmxDialogDescription>{t('manifest.driverAssignmentDescription')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="py-4">
            <DriverPicker
              drivers={drivers}
              value={selectedDriverId}
              onChange={setSelectedDriverId}
              allowUnassigned={false}
              isLoading={isLoadingDrivers}
              disabled={isAssigning}
            />
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setDriverDialogOpen(false)} disabled={isAssigning}>
              {t('manifest.cancel')}
            </CmxButton>
            <CmxButton onClick={assignDriver} loading={isAssigning} disabled={isLoadingDrivers || !selectedDriverId}>
              {isAssigning ? t('manifest.assigningDriver') : t('manifest.saveDriver')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
