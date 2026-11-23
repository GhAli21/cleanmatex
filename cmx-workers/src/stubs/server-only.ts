// Stand-in for the `server-only` package. It exists to stop Next.js client bundles importing server
// code; cmx-workers is server-only by construction, and the real package throws outside Next.js.
export {};
