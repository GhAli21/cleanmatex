import 'server-only';

import { prisma } from '@/lib/db/prisma';
import type { SessionLifecycleCatalogs } from '@/lib/types/session-lifecycle-catalogs';

export type {
  SessionLifecycleCatalogEntry,
  SessionLifecycleCatalogs,
  SessionStatusCatalogEntry,
} from '@/lib/types/session-lifecycle-catalogs';

/**
 * Bilingual labels for the POS-session and cash-drawer-session lifecycle codes.
 *
 * These are global `sys_*` catalogs (no `tenant_org_id`) whose names HQ manages. Unlike the picker
 * catalogs in `cash-drawer-catalogs.service.ts`, inactive rows are returned too: a historical
 * session or event can carry a code that has since been switched off, and it still needs a label.
 */
export async function getSessionLifecycleCatalogs(): Promise<SessionLifecycleCatalogs> {
  const [posStatuses, posEvents, drawerStatuses] = await Promise.all([
    prisma.sys_pos_session_status_cd.findMany({
      orderBy: [{ display_order: 'asc' }, { code: 'asc' }],
      select: { code: true, name: true, name2: true, is_final: true, is_active: true, display_order: true },
    }),
    prisma.sys_pos_session_event_type_cd.findMany({
      orderBy: [{ display_order: 'asc' }, { code: 'asc' }],
      select: { code: true, name: true, name2: true, is_active: true, display_order: true },
    }),
    prisma.sys_cash_drawer_session_status_cd.findMany({
      orderBy: [{ display_order: 'asc' }, { code: 'asc' }],
      select: { code: true, name: true, name2: true, is_final: true, is_active: true, display_order: true },
    }),
  ]);

  return {
    posSessionStatuses: posStatuses.map((r) => ({
      code: r.code,
      name: r.name,
      name2: r.name2,
      isFinal: r.is_final,
      isActive: r.is_active,
      displayOrder: r.display_order ?? 0,
    })),
    posSessionEventTypes: posEvents.map((r) => ({
      code: r.code,
      name: r.name,
      name2: r.name2,
      isActive: r.is_active,
      displayOrder: r.display_order ?? 0,
    })),
    drawerSessionStatuses: drawerStatuses.map((r) => ({
      code: r.code,
      name: r.name,
      name2: r.name2,
      isFinal: r.is_final,
      isActive: r.is_active,
      displayOrder: r.display_order,
    })),
  };
}
