/**
 * HQ catalog lookups (read-only in cleanmatex).
 *
 * Each lookup lives in its own service file for maintenance.
 * Writes belong in cleanmatexsaas — never add CUD here.
 */

export type {
  LookupCatalogBase,
  LookupServiceResult,
  LookupSupabaseClient,
} from './types';

export {
  listActivePriorities,
  getPrioritiesByCodes,
  isActivePriority,
  type PriorityLookupRow,
  type PriorityLookupMap,
} from './priority-lookup.service';

export {
  listActiveIssueTypes,
  getIssueTypesByCodes,
  isActiveIssueType,
  type IssueTypeLookupRow,
  type IssueTypeLookupMap,
} from './issue-type-lookup.service';
