# AR Invoice — Production Readiness Audit

**Feature:** AR Invoice v1 / v1.5 / v2  
**Audit Date:** 2026-05-22  
**Scope:** `cleanmatex` tenant app only  
**Overall Status:** Ready for production rollout

## Executive Summary

AR Invoice is production-ready for controlled rollout.

The implemented scope now covers:

- canonical AR invoice lifecycle
- AR ledger, aging, statements, and print flows
- overpayment credit handling
- sensitive approval controls
- dispute operations
- dunning operations
- B2B statement-cycle setup
- access contracts and permission documentation
- bilingual EN/AR support
- targeted automated validation and successful production build

## Readiness Decision

| Area | Status | Notes |
|---|---|---|
| Database alignment | Pass | User confirmed migrations applied and types refreshed |
| Tenant isolation | Pass | Tenant-scoped service/query patterns and tenant-isolation tests are in place |
| API contracts | Pass | `/api/v1/ar/*` surface is permission-gated and schema-validated |
| UI completeness | Pass | V1 and V2 operational pages exist and are wired into navigation |
| Money handling | Pass | Canonical AR services and ledger/allocation paths are implemented |
| Approval controls | Pass | Sensitive AR actions require explicit approval flows |
| Localization | Pass | EN/AR translation parity passes |
| Build readiness | Pass | `npm run build` passes |
| Test baseline | Pass | Focused validation, access-contract, service, and tenant-isolation tests pass |
| Operational documentation | Pass | Release notes, test matrix, runbook, audit, and cleanup roadmap are documented |

## What Was Audited

### 1. Domain correctness

Reviewed expectations:

- `PAY_ON_COLLECTION` does not create AR exposure
- AR status/type constants mirror DB values
- overpayments become reusable AR credit
- sensitive actions are approval-aware
- disputes move invoices into `DISPUTED`
- dunning actions are logged
- statement cycles are tenant-scoped and non-destructive on preview

### 2. Multi-tenant safety

Verified expectations:

- tenant context is enforced in AR services
- tenant filters exist on tenant-scoped queries
- AR APIs rely on authenticated tenant context
- tenant-isolation regression coverage exists for AR balance projection

### 3. Access control

Verified:

- route contracts exist for V1 and V2 AR pages
- API permission inventory includes V2 endpoints
- navigation permissions align with surfaced routes
- sensitive operations remain permission-gated

### 4. Frontend readiness

Verified:

- internal finance AR routes render through existing dashboard patterns
- Cmx reusable components are used
- EN/AR keys were added for V2 screens
- build compiles successfully after the final route additions

### 5. Validation and release signals

Validated commands:

- `npm run typecheck`
- `npm run check:i18n`
- targeted AR tests
- `npm run build`

## Residual Risks

These do not block release, but they should stay visible:

1. Some non-AR legacy finance paths still exist outside the canonical AR stack.
They are already bridged where needed for AR correctness, but they remain architecture debt.

2. Legacy non-AR invoice numbering behavior still exists in older services.
Canonical AR issuance is isolated, but future changes should avoid mixing numbering rules.

3. Dunning delivery success depends on the configured downstream email/SMS infrastructure.
The AR app correctly records intent and status, but operational deliverability still depends on environment setup.

4. Statement cycles are configuration-ready, but scheduled execution orchestration is still an operations concern.
The current scope covers setup and preview, not a background scheduler rollout plan.

## Go-Live Recommendation

Recommended rollout posture:

1. Release to one internal tenant or pilot tenant first.
2. Execute the UAT pack in the target environment.
3. Monitor first-week signals:
   - invoice issue failures
   - allocation reversals
   - unapplied credit usage
   - dispute open/resolve volume
   - dunning failure rate
4. Expand to wider tenant availability after stable pilot behavior.

## Sign-Off Checklist

- [x] Schema deployed by user
- [x] Generated DB types refreshed by user
- [x] App routes implemented
- [x] Permissions and access contracts documented
- [x] EN/AR parity verified
- [x] Targeted tests green
- [x] Production build green
- [x] Operational docs prepared

## Recommendation

Proceed with UAT and controlled production rollout.
