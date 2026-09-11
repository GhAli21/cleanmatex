/**
 * User notification preference helpers.
 *
 * Coarse prefs use event_code = NULL and branch_id = NULL. PostgreSQL UNIQUE
 * treats those NULLs as distinct, so legacy upserts created duplicate rows.
 * Readers must keep the newest row per scope until the DB constraint is fixed.
 */

export interface UserPrefScopeRow {
  id?: string
  user_id?: string
  channel_code?: string
  event_code?: string | null
  branch_id?: string | null
  updated_at?: string | null
  created_at?: string | null
}

/**
 * Build a stable key for one preference scope (user + channel + optional event + branch).
 * @param row Preference row in API/DB snake_case
 */
export function userPrefScopeKey(row: UserPrefScopeRow): string {
  return `${row.user_id ?? ''}\0${row.channel_code ?? ''}\0${row.event_code ?? ''}\0${row.branch_id ?? ''}`
}

/**
 * Newest write wins when duplicate NULL-scoped rows exist.
 * @param row Preference row with optional timestamps
 */
export function userPrefRowTime(row: UserPrefScopeRow): number {
  const raw = row.updated_at ?? row.created_at
  if (!raw) return 0
  const parsed = Date.parse(raw)
  return Number.isNaN(parsed) ? 0 : parsed
}

/**
 * Return the newest row in a same-scope group.
 * @param rows Duplicate or single-scope preference rows
 */
export function pickLatestUserPrefRow<T extends UserPrefScopeRow>(rows: T[]): T | null {
  if (rows.length === 0) return null
  return [...rows].sort((a, b) => userPrefRowTime(b) - userPrefRowTime(a))[0] ?? null
}

/**
 * Collapse duplicate prefs so each (channel, event, branch) scope appears once.
 * @param rows Raw preference rows, possibly with NULL-key duplicates
 */
export function collapseUserPrefRows<T extends UserPrefScopeRow>(rows: T[]): T[] {
  const byScope = new Map<string, T[]>()
  for (const row of rows) {
    const key = userPrefScopeKey(row)
    const group = byScope.get(key)
    if (group) group.push(row)
    else byScope.set(key, [row])
  }

  const collapsed: T[] = []
  for (const group of byScope.values()) {
    const latest = pickLatestUserPrefRow(group)
    if (latest) collapsed.push(latest)
  }
  return collapsed
}
