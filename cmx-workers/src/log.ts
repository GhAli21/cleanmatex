/** One JSON line per event on stdout/stderr (Render keeps them). Ids and codes only, never payload contents. */
type Level = 'info' | 'warn' | 'error';

export function log(level: Level, msg: string, ctx: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...ctx });
  if (level === 'info') console.log(line);
  else console.error(line);
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
