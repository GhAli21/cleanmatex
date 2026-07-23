/**
 * Shared types for HQ-owned catalog lookups (sys_* / sys_lkp_*).
 *
 * Ownership: cleanmatexsaas (HQ Platform). This tenant app is READ-ONLY —
 * never insert / update / delete these tables from cleanmatex.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/** Optional injected client (tests / callers that already hold a session). */
export type LookupSupabaseClient = SupabaseClient;

export interface LookupServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface LookupCatalogBase {
  code: string;
  name: string | null;
  name2: string | null;
  display_order: number | null;
  color: string | null;
  icon: string | null;
}
