/**
 * Small in-memory stand-in for the Supabase query builder used by the scan tests.
 * Supports from().select().eq().is().in().limit().maybeSingle() / await, and update().eq() (records the patch).
 */
export type Row = Record<string, unknown>;

export function fakeSupabase(tables: Record<string, Row[]>) {
  const updates: Array<{ table: string; patch: Row; filters: Array<[string, unknown]> }> = [];
  const queries: Array<{ table: string; filters: Array<[string, string, unknown]> }> = [];

  function builder(table: string) {
    const filters: Array<[string, string, unknown]> = [];
    let limit: number | null = null;
    let patch: Row | null = null;
    const run = () => {
      queries.push({ table, filters: [...filters] });
      let rows = (tables[table] ?? []).filter((r) =>
        filters.every(([op, col, val]) => {
          if (op === 'eq') return r[col] === val;
          if (op === 'is') return (r[col] ?? null) === val;
          if (op === 'in') return (val as unknown[]).includes(r[col]);
          return true;
        }),
      );
      if (patch) {
        updates.push({ table, patch, filters: filters.map(([, c, v]) => [c, v]) });
        rows.forEach((r) => Object.assign(r, patch));
      }
      if (limit != null) rows = rows.slice(0, limit);
      return rows;
    };
    const api: Record<string, unknown> = {
      select: () => api,
      update: (p: Row) => {
        patch = p;
        return api;
      },
      eq: (c: string, v: unknown) => (filters.push(['eq', c, v]), api),
      is: (c: string, v: unknown) => (filters.push(['is', c, v]), api),
      in: (c: string, v: unknown[]) => (filters.push(['in', c, v]), api),
      limit: (n: number) => ((limit = n), api),
      order: () => api,
      insert: async (row: Row) => {
        (tables[table] ??= []).push(row);
        return { data: null, error: null };
      },
      maybeSingle: async () => {
        const rows = run();
        if (rows.length > 1) return { data: null, error: { message: 'multiple rows' } };
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const rows = run();
        if (rows.length !== 1) return { data: null, error: { message: 'not exactly one row' } };
        return { data: rows[0], error: null };
      },
      then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) =>
        Promise.resolve({ data: run(), error: null }).then(resolve, reject),
    };
    return api;
  }

  const client = { from: (t: string) => builder(t) };
  return { client: client as never, updates, queries };
}
