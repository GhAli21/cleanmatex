// Stand-in for `react` in the worker bundle. Bundled web-admin services only use `cache` (request-scoped
// memoization in Next.js, e.g. lib/utils/operational-zone.server.ts); plain Node's `react` build has no
// `cache` export, so loading crashed. A worker job has no React request scope, where React's own cache
// does not memoize either, so returning the function unchanged is the same behaviour.
// Importing any other React export fails at build time (esbuild: no matching export), never at runtime.
export function cache<T extends (...args: never[]) => unknown>(fn: T): T {
  return fn;
}
