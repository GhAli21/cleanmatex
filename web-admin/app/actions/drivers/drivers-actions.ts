'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { DRIVERS_PERMISSIONS } from '@/lib/constants/permissions/drivers-perm';
import type { OrgDriver, CreateDriverInput, UpdateDriverInput } from '@/lib/types/drivers';

const REVALIDATE_PATH = '/dashboard/drivers';

type ActionResult<T> = { success: boolean; data?: T; error?: string };

function mapDriverRow(row: {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  linked_user_id: string | null;
  name: string;
  name2: string | null;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_plate_no: string | null;
  license_no: string | null;
  is_active: boolean;
  created_at: Date | null;
  updated_at: Date | null;
}, activeRouteDriverIds: Set<string>): OrgDriver {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    branch_id: row.branch_id,
    linked_user_id: row.linked_user_id,
    name: row.name,
    name2: row.name2,
    phone: row.phone,
    vehicle_type: row.vehicle_type,
    vehicle_plate_no: row.vehicle_plate_no,
    license_no: row.license_no,
    is_active: row.is_active,
    created_at: row.created_at?.toISOString() ?? null,
    updated_at: row.updated_at?.toISOString() ?? null,
    hasActiveRoute: activeRouteDriverIds.has(row.id),
  };
}

/** Lists tenant-scoped drivers, newest first, flagging anyone currently on a planned/in-progress route. */
export async function getDrivers(): Promise<ActionResult<OrgDriver[]>> {
  try {
    const { tenantId } = await getAuthContext();
    if (!(await hasPermissionServer(DRIVERS_PERMISSIONS.READ))) {
      return { success: false, error: 'Permission denied' };
    }
    return withTenantContext(tenantId, async () => {
      const [rows, activeRoutes] = await Promise.all([
        prisma.org_drivers_mst.findMany({
          where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
          orderBy: [{ name: 'asc' }],
        }),
        prisma.org_dlv_routes_mst.findMany({
          where: {
            tenant_org_id: tenantId,
            driver_id: { not: null },
            route_status_code: { in: ['planned', 'in_progress'] },
          },
          select: { driver_id: true },
        }),
      ]);
      const activeRouteDriverIds = new Set(
        activeRoutes.map((r) => r.driver_id).filter((id): id is string => Boolean(id)),
      );
      return { success: true, data: rows.map((row) => mapDriverRow(row, activeRouteDriverIds)) };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch drivers' };
  }
}

/** Creates a driver. Name is the only required field — matches org_drivers_mst.name NOT NULL. */
export async function createDriver(input: CreateDriverInput): Promise<ActionResult<OrgDriver>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(DRIVERS_PERMISSIONS.CREATE))) {
      return { success: false, error: 'Permission denied' };
    }
    return withTenantContext(tenantId, async () => {
      const row = await prisma.org_drivers_mst.create({
        data: {
          tenant_org_id: tenantId,
          name: input.name,
          name2: input.name2 ?? null,
          phone: input.phone ?? null,
          vehicle_type: input.vehicle_type ?? null,
          vehicle_plate_no: input.vehicle_plate_no ?? null,
          license_no: input.license_no ?? null,
          branch_id: input.branch_id ?? null,
          created_by: userId,
          created_at: new Date(),
          is_active: true,
          rec_status: 1,
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: mapDriverRow(row, new Set()) };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create driver' };
  }
}

/** Updates a driver's master data. Does not touch is_active — use toggleDriverActive for that. */
export async function updateDriver(id: string, input: UpdateDriverInput): Promise<ActionResult<OrgDriver>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(DRIVERS_PERMISSIONS.UPDATE))) {
      return { success: false, error: 'Permission denied' };
    }
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_drivers_mst.findFirst({
        where: { id, tenant_org_id: tenantId },
      });
      if (!existing) return { success: false, error: 'Driver not found' };

      const row = await prisma.org_drivers_mst.update({
        where: { id_tenant_org_id: { id, tenant_org_id: tenantId } },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.name2 !== undefined && { name2: input.name2 }),
          ...(input.phone !== undefined && { phone: input.phone }),
          ...(input.vehicle_type !== undefined && { vehicle_type: input.vehicle_type }),
          ...(input.vehicle_plate_no !== undefined && { vehicle_plate_no: input.vehicle_plate_no }),
          ...(input.license_no !== undefined && { license_no: input.license_no }),
          ...(input.branch_id !== undefined && { branch_id: input.branch_id }),
          updated_by: userId,
          updated_at: new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: mapDriverRow(row, new Set()) };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update driver' };
  }
}

/**
 * Deactivates (or reactivates) a driver. Deactivation is rejected while the
 * driver has a planned or in-progress route — reassign it first.
 */
export async function toggleDriverActive(id: string, isActive: boolean): Promise<ActionResult<{ is_active: boolean }>> {
  try {
    const { tenantId, userId } = await getAuthContext();
    if (!(await hasPermissionServer(isActive ? DRIVERS_PERMISSIONS.UPDATE : DRIVERS_PERMISSIONS.DELETE))) {
      return { success: false, error: 'Permission denied' };
    }
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_drivers_mst.findFirst({
        where: { id, tenant_org_id: tenantId },
      });
      if (!existing) return { success: false, error: 'Driver not found' };

      if (!isActive) {
        const activeRoute = await prisma.org_dlv_routes_mst.findFirst({
          where: { tenant_org_id: tenantId, driver_id: id, route_status_code: { in: ['planned', 'in_progress'] } },
          select: { route_number: true },
        });
        if (activeRoute) {
          return { success: false, error: `Cannot deactivate: driver is on active route ${activeRoute.route_number}.` };
        }
      }

      const row = await prisma.org_drivers_mst.update({
        where: { id_tenant_org_id: { id, tenant_org_id: tenantId } },
        data: { is_active: isActive, rec_status: isActive ? 1 : 0, updated_by: userId, updated_at: new Date() },
        select: { is_active: true },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: { is_active: row.is_active } };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update driver status' };
  }
}
