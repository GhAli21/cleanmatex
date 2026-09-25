# Changelog — Tenant Guard Restoration

## 2026-09-25 — Step 0 + Phase 1 discovery

- Added the `$extends` Tenant Guard (`lib/db/tenant-guard.ts`): log/enforce modes, `TENANT_MISMATCH` detection, `withTenantGuardBypass`, JSONL reporting, and call-time callsite/context binding.
- Ported the performance monitor to `$extends` (it was also dead under `$use`).
- Removed the dead `$use` tenant middleware and its two tests.
- `withTenantContext` now awaits inside its scope. This fixes lost tenant context for lazily returned Prisma queries.
- Added unit tests (28), a real-DB cross-tenant test (9), a static audit script with an npm script, and a rewritten `lib/db/PRISMA_SETUP.md`.
- Phase 1 output: [VIOLATIONS.md](VIOLATIONS.md).
