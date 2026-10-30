# Settings: Plan Limits and Feature Flags vs Overrides

**Date:** 2026-10-28 · **Status:** ✅ ADOPTED by owner 2026-10-28. Implemented in `0652_stng_ceilings_and_cleanup.sql` (pending apply): ceilings fold, `stng_disabled_value_jsonb`, 24 unused settings deactivated, 15 dead plan constraints deactivated. Verification fingerprint (17 kept settings × 7 contexts) must stay `27355a0ff472c357315a3e004b87182a`. **HQ follow-up (cleanmatexsaas):** write-time validation in `StngTenantOverridesService` and a "limited by plan" hint. Reads are already safe because overrides can no longer exceed a ceiling. · **Scope:** `fn_stng_resolve_settings_set` (0648) and HQ override writes

## 1. How it works today

Resolution order, where a higher priority wins when its value is non-null:

| Priority | Layer | Effect today |
|---|---|---|
| 100 | SYSTEM_DEFAULT (catalog) | base value |
| 200+ | SYSTEM_PROFILE (profile chain) | most specific profile wins |
| 300 | PLAN_CONSTRAINT | `deny` → catalog default; `max_value`/`min_value` → clamp **the profile/default value only** |
| 400 | FEATURE_FLAG | any required flag off → **catalog default** |
| 500/600/700 | TENANT / BRANCH / USER override | **beat both of the above** |

## 2. Findings (remote, 2026-10-28)

| # | Finding | Live impact |
|---|---|---|
| F1 | **Overrides bypass plan limits and disabled flags** (priority 500+ > 300/400). A tenant override of `users.max_users = 1000` on a Starter plan would win. | Latent: no override exists on any constrained setting today. |
| F2 | **A disabled flag forces the catalog *default*, not "off".** `B2B_CONTRACTS_ENABLED` and `ERP_LITE_ENABLED` default to `true`, so with the flag **off** they still resolve `true` (seen for BlueWave on FREE_TRIAL). | Latent: the app gates B2B/ERP on the feature flags themselves (`canAccess`, `requireFeature`, navigation), never on these settings. `B2B_CREDIT_LIMIT_MODE` is read but defaults to the safe `'block'`. |
| F3 | **The plan-constraint layer is dead config.** All 15 constraints target codes (`users.max_users`, `branches.max_branches`, `workflow.*`, `notifications.sms_enabled`, `receipts.custom_templates`) that **do not exist** in the settings catalog. Constraints exist only for STARTER/BUSINESS/ENTERPRISE; tenants are on FREE_TRIAL/ENTERPRISE. | None today. These limits are not enforced anywhere through settings. Plan limits live in the HQ plan-limits system. |

## 3. Recommendation (industry-standard entitlement model)

**Entitlements are ceilings; configuration lives inside them.** What a plan or flag grants is decided commercially; overrides only tune within it. This is how mature SaaS platforms layer entitlement over configuration.

1. **Re-order the fold: evaluate overrides first, then apply entitlements last as caps.**
   - Flag off → force the setting's **disabled value** (new optional catalog field `stng_disabled_value_jsonb`; fall back to the catalog default only if not set). For `*_ENABLED` booleans the disabled value is `false`, which fixes F2.
   - Plan `deny` → disabled value. `max_value`/`min_value` → clamp the **final** value, including overrides, which fixes F1.
   - `stng_source_layer` reports `PLAN_CONSTRAINT`/`FEATURE_FLAG` whenever a cap changed the value, so the UI can explain "limited by your plan".
2. **Validate at write time (HQ `StngTenantOverridesService`):** reject or warn on an override that exceeds the tenant's plan, so admins don't save values that can never apply. Show "limited by plan" in the UI.
3. **Clean up F3:** either retarget the 15 constraints to real catalog codes, or retire `sys_plan_setting_constraints` in favour of the HQ plan-limits system so there is **one** source of plan limits. Recommended: **retire**, since plan limits (users, branches, orders) are quantities enforced by the plan-limit service, not tenant settings.
4. **Single gating source in code:** keep gating features on feature flags (current practice). Settings that mirror a flag (`*_ENABLED`) should either be removed or read only through the resolver's capped value.

## 4. Impact if adopted

- No live tenant value changes today (F1 and F2 are latent, F3 is inert). I'll verify this with the same old-vs-new equivalence diff used for 0647/0648 before any rewire.
- Touches: resolver migration (fold order and disabled value), one catalog column, HQ override validation (cleanmatexsaas), and a retirement or retarget migration for plan constraints.
