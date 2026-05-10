# Cross-Project Integration Contracts

## Tenant App Rule

Do not copy implementation code between `cleanmatex` and `cleanmatexsaas`.

For cross-project work, document what the sibling project should build, expose, call, consume, regenerate, or document. Do not copy DTOs, enums, constants, utilities, validation schemas, UI components, API clients, or source files between repositories.

## Tenant-Side Responsibilities

`cleanmatex` is the tenant-facing application. Its implementation must stay tenant-scoped:

- Use RLS-aware access patterns.
- Always filter tenant data by `tenant_org_id`.
- Never use platform service-role patterns.
- Never query platform-managed settings or feature-flag tables directly.
- Consume platform-managed settings and feature flags through documented HQ APIs.

## Contract-First Coordination

Use one of these contracts instead of copied code:

- HTTP API contract
- Event payload contract
- Database schema and generated type contract
- UI behavior/token/accessibility contract
- ADR proposal for user decision on a package, generated artifact, or UI coordination

For ADRs created for package, generated artifact, strict-identical implementation, or UI coordination decisions, the ADR is approved only when the ADR file contains the exact marker `Approved_By_Jh`. Until the user writes `Approved_By_Jh` inside the ADR file, treat it as not approved and do not implement.

## Database Coordination

Database migrations are created in `cleanmatex` only. Agents must not apply migrations.

After the user applies a migration, regenerate types in the consuming project as needed. Do not manually copy generated or handwritten types between repos.

## Reference

Primary guide: `F:/jhapp/cleanmatexsaas/docs/dev/cross-project-integration-contracts/developer_guide.md`
