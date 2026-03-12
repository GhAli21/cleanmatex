
Extract documentation to list all Permissions, Settings, Feature flags, Plan limits/constraints usage:
the used Plan was: 
platform_documentation_build_a414d472.plan.md

Maintenance:
Run extraction scripts after significant permission/API/settings changes
Add docs:validate to CI (optional) to catch doc drift
When adding new features, update both feature-level implementation_requirements.md and platform docs (or rely on extraction)

=================

Platform Documentation Build Plan is implemented. Summary:

## Completed Implementation

### Phase 1: Permissions Documentation (12 files)
All permission docs are under `docs/platform/permissions/`:
- PERMISSIONS_REFERENCE, PERMISSIONS_BY_MODULE, PERMISSIONS_BY_SCREEN, PERMISSIONS_BY_API
- NAVIGATION_PERMISSIONS, WORKFLOW_SCREEN_CONTRACTS, WORKFLOW_ROLES, ROLE_BASED_GUARDS
- API_AUTH_GAPS, SERVER_ACTIONS_AND_RLS, CMX_API_PERMISSIONS, ADMIN_APIS

### Phase 2: Settings Documentation (5 files)
- SETTINGS_REFERENCE, SETTINGS_BY_CATEGORY, SETTINGS_USAGE, PLAN_BOUND_SETTINGS, SETTINGS_HQ_API

### Phase 3: Feature Flags Documentation (4 files)
- FEATURE_FLAGS_REFERENCE, FEATURE_FLAGS_USAGE, NAVIGATION_FEATURE_FLAGS, TENANT_AND_PLAN_FLAGS

### Phase 4: Plan Limits Documentation (4 files)
- PLAN_LIMITS_REFERENCE, PLAN_LIMITS_USAGE, PLAN_CONSTRAINTS, SUBSCRIPTION_UI

### Phase 5: Extraction Scripts (5 scripts)
- `scripts/docs/extract-permissions.ts` — RequirePermission, useHasPermission, requirePermission
- `scripts/docs/extract-settings-usage.ts` — setting codes and resolution calls
- `scripts/docs/extract-feature-flags.ts` — feature flag checks
- `scripts/docs/extract-api-auth-audit.ts` — API routes auth audit
- `scripts/docs/validate-docs.ts` — doc drift checks

**npm scripts** (root `package.json`):
- `docs:extract-permissions`, `docs:extract-settings`, `docs:extract-feature-flags`
- `docs:extract-api-auth-audit`, `docs:validate`

`tsx` was added as a devDependency for running the TypeScript scripts.

### Phase 6: Integration
- `docs/features/_templates/implementation_requirements.md` — template aligned with Order_Service_Preferences
- `.cursor/rules/documentationrules.mdc` — link to `docs/platform/README.md`

## How to Run Extraction Scripts

From the repo root:

```bash
npm install          # install tsx
npm run docs:extract-permissions
npm run docs:extract-settings
npm run docs:extract-feature-flags
npm run docs:extract-api-auth-audit
npm run docs:validate
```

Extraction outputs:
- `docs/platform/permissions/extracted-permissions.json`
- `docs/platform/settings/extracted-settings-usage.json`
- `docs/platform/feature_flags/extracted-feature-flags-usage.json`
- `docs/platform/permissions/API_AUTH_AUDIT.md`