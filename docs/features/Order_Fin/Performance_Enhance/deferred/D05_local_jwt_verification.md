# D05 — Local JWT verification in shared authentication

Status: **Deferred. Not approved. Not implemented by this performance plan.**

See the [implementation plan](../implementation_plan.md) and [pack overview](../README.md). This is an authentication architecture change, not a Payment V4 shortcut.

## Motivation and current evidence

[requirePermission](../../../../../web-admin/lib/middleware/require-permission.ts) uses the [JWT/tenant validator](../../../../../web-admin/lib/middleware/jwt-tenant-validator.ts). The shared [server auth helper](../../../../../web-admin/lib/auth/server-auth.ts) verifies the user and calls the [session guard](../../../../../web-admin/lib/auth/session-guard.ts). Session validation covers membership, revocation, idle/absolute expiry, session limits, and forced-password state; active results already have a bounded short-lived process cache.

`supabase.auth.getClaims()` may reduce remote verification work for supported signing configurations, but local JWT verification is not equivalent to current session/membership authorization. Local behavior depends on the deployed signer, key discovery/cache, library version, rotation, and token type. Decoding a token without verification is never an alternative.

## Why outside the initial scope

A quote-only auth fork would produce inconsistent security rules across preview, submit, and other APIs. Changing verification must be evaluated in the shared auth boundary and preserve all current admission checks. Performance value must be measured separately from database/session/permission latency that would remain.

## Entry criteria

- Inventory deployed Supabase signing algorithms and keys in each environment without exposing secrets.
- Verify installed SDK behavior and current official support for local verification, JWKS refresh/rotation, legacy/shared-secret fallback, and SSR cookie refresh.
- Security/session owners approve the unchanged membership, revocation, expiry, password-change, and tenant-binding contract.
- Capture auth-stage measurements and a representative matrix of cookie/bearer and supported session flows.

## Proposed design and tasks

1. Keep one shared authenticated request-context entry point. Return only cryptographically verified identity plus server-validated session tenant; never use posted tenant IDs or editable user metadata as authority.
2. Verify signature, issuer, audience, algorithm policy, expiry, not-before, and required claims using supported SDK primitives. Reject malformed/unverifiable tokens and disallowed token classes.
3. Retain `guardSession` or its approved equivalent for server-side active membership, ended sessions, idle/absolute lifetime, forced-password change, and lazy registration semantics. A valid signature does not prove that a session remains admitted.
4. Define JWKS cache bounds, unknown-key refresh, key rotation overlap, network failure behavior, and signing-mode fallback. Avoid homemade signature verification or relaxed issuer/audience validation.
5. Preserve SSR refresh and cookie writes, bearer-client RLS context, and original failure classifications. Avoid duplicate verification inside nested services through request-local authenticated context reuse.
6. Apply the change across the shared callers identified by the auth owner. Payment quote and submit must not use different trust boundaries.
7. Log redacted verification mode, stage durations, key-refresh failure classes, and admission errors; never log tokens, cookies, credentials, or full sensitive claims.

## Ownership and invariants

- **Tenant auth/session owners:** shared verifier, session registry, protected APIs, and browser recovery behavior.
- **HQ/auth infrastructure:** coordinate only shared identity configuration, signer rotation, or cross-application contracts actually involved. No HQ auth bypass is proposed.
- Existing CSRF, permission, price-override, tenant isolation, and final financial validation remain mandatory.
- Authorization and current membership remain server decisions. A verified JWT is identity evidence, not proof of current permissions or available money.
- No schema migration is assumed. If later necessary, create a new reviewed migration in the tenant repository for user application; never apply it from this plan.

## Required tests

- Correct/incorrect signatures; issuer/audience mismatch; expired/not-yet-valid/malformed tokens; unsupported algorithm; missing subject/session claims.
- Cached keys, unknown key, rotation overlap, JWKS outage, and legacy signing fallback without fail-open behavior.
- Ended/revoked/idle-expired/absolute-expired sessions, inactive membership, forced password change, lazy registration, and registry outage.
- Cookie and bearer routes, SSR refresh, login/logout/recovery, tenant binding, permission denial, CSRF, and quote/submit equivalence.
- Shared caller compatibility and measured auth-stage impact under cold/warm conditions.

## Rollout and rollback

Use an approved shared verifier selection with a controlled cohort after security tests. Compare error classifications and session admission, not only speed. Roll back to the previous shared verifier while retaining session enforcement. Signing-key configuration rollback needs its own operational procedure and must not strand valid sessions or accept revoked ones.

## Completion evidence

Required: signer/SDK compatibility report; shared-callsite impact review; security approval; session and key-rotation test evidence; production-like timings; observability; rollout and rollback rehearsal. Local verification is not enabled or claimed validated by this document.
