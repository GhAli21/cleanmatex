'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ExternalLink, MapPin, PackageCheck, Truck } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { cmxMessage, CmxStatusBadge } from '@ui/feedback';
import { CmxDialog, CmxDialogContent, CmxDialogDescription, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { getDrivers } from '@/app/actions/drivers/drivers-actions';
import { DriverPicker } from '@features/drivers/ui/driver-picker';
import { assignDeliveryDriver } from '@features/drivers/api/delivery-route-command-api';
import type { OrgDriver } from '@/lib/types/drivers';
import type { DeliveryRouteManifest } from '@/lib/services/delivery/delivery-route-query.service';

/**
 * Props for a route manifest that may show a local driver-assignment result
 * before the authoritative route read model is refreshed.
 */
interface DeliveryRouteManifestProps {
  /** Tenant-scoped manifest supplied by the delivery read contract. */
  route: DeliveryRouteManifest;
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

/**
 * Route manifest uses the Delivery read contract only; opening a stop never
 * changes its state and keeps the eventual driver/mobile handoff consistent.
 */
export function DeliveryRouteManifest({ route }: DeliveryRouteManifestProps) {
  const t = useTranslations('workflow.delivery');
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [drivers, setDrivers] = useState<OrgDriver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | undefined>(route.driverId ?? undefined);
  const [assignedDriver, setAssignedDriver] = useState<OrgDriver | null>(null);
  const [isLoadingDrivers, startLoadingDrivers] = useTransition();
  const [isAssigning, startAssigning] = useTransition();

  const currentDriverId = assignedDriver?.id ?? route.driverId;
  const displayDriver = assignedDriver?.name ?? (currentDriverId ? currentDriverId : t('routes.fields.unassigned'));

  /** Load current tenant choices only after an operator asks to change assignment. */
  const openDriverDialog = () => {
    setSelectedDriverId(currentDriverId ?? undefined);
    setDriverDialogOpen(true);
    startLoadingDrivers(async () => {
      const result = await getDrivers();
      if (!result.success || !result.data) {
        cmxMessage.error(t('manifest.driverLoadFailed'));
        return;
      }

      setDrivers(result.data);
      setAssignedDriver(result.data.find((driver) => driver.id === currentDriverId) ?? null);
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
        const selectedDriver = drivers.find((driver) => driver.id === result.driverId) ?? null;
        setAssignedDriver(selectedDriver);
        setDriverDialogOpen(false);
        cmxMessage.success(t('manifest.driverAssigned'));
        if (result.driverWarning) {
          cmxMessage.warning(t('manifest.driverAssignmentWarning'));
        }
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
            <p className="mt-1 break-all text-sm font-medium">{displayDriver}</p>
            <CmxButton
              className="mt-2"
              variant="outline"
              size="sm"
              onClick={openDriverDialog}
              disabled={isLoadingDrivers || isAssigning}
            >
              {currentDriverId ? t('manifest.reassignDriver') : t('manifest.assignDriver')}
            </CmxButton>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('manifest.started')}</p>
            <p className="mt-1 text-sm font-medium">
              {route.startedAt ? new Date(route.startedAt).toLocaleString() : t('manifest.notStarted')}
            </p>
          </div>
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
            <CmxDialogTitle>{currentDriverId ? t('manifest.reassignDriver') : t('manifest.assignDriver')}</CmxDialogTitle>
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
