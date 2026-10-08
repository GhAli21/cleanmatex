/** One bilingual row of a session-lifecycle code catalog (global `sys_*` table, names managed by HQ). */
export interface SessionLifecycleCatalogEntry {
  code: string;
  name: string;
  name2: string | null;
  isActive: boolean;
  displayOrder: number;
}

/** A status catalog row also says whether the status ends the session. */
export interface SessionStatusCatalogEntry extends SessionLifecycleCatalogEntry {
  isFinal: boolean;
}

/** Payload of `GET /api/v1/pos-sessions/catalogs`. */
export interface SessionLifecycleCatalogs {
  posSessionStatuses: SessionStatusCatalogEntry[];
  posSessionEventTypes: SessionLifecycleCatalogEntry[];
  drawerSessionStatuses: SessionStatusCatalogEntry[];
}
