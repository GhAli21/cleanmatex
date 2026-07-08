# Deferred Tasks — Payment Modal Composable Capability Program

Tasks explicitly **out of the program's scope** but tracked so they do not disappear.
Owner: Order Financial Platform. Source: user decisions of 2026-07-09.

---

## 1. Credit-limit override — gated exception (HIGH PRIORITY)

**Context.** Phase 0B of the program hard-denies B2B credit-limit exceedance by
default: the orchestrator no longer honors the client `creditLimitOverride`
boolean (`web-admin/lib/services/order-submit-orchestrator.service.ts:377`).
Before 0B, any user with `orders:create` could bypass the limit with only an
audit stamp (`creditLimitOverrideBy`/`creditLimitOverrideAt`, `:628-631`).

**Task.** Re-enable override **only** under a two-part gate — BOTH required;
permission alone is never sufficient:

1. **Explicit enablement** policy/config, defaults **OFF** (tenant-level setting
   consumed per the settings contract — design decision at implementation time).
2. **New permission** `orders:override_credit_limit`.

**Definition of done (all mandatory — no TS-only permission):**
- [ ] Backend enforcement in the orchestrator (honor `creditLimitOverride` only when both gates hold; keep audit stamping)
- [ ] DB seed migration for `orders:override_credit_limit` (next free `supabase/migrations/` seq; migration workflow: create SQL → STOP → user applies)
- [ ] Enablement setting definition + consumption path
- [ ] Tests: denied-without-permission · denied-without-enablement · allowed-with-both · audit stamp present
- [ ] i18n/support reason message (EN/AR) for the denial
- [ ] Docs: permission inventory refresh (`/rebuild-platform-info-inventories`), feature docs, RBAC role review (`/update-rbac-role` if roles change)

**Until shipped:** exceeding the limit is a hard `B2B_CREDIT_EXCEEDED` denial for
everyone. The UI override affordance is removed in program Phase 5; between 0B
and Phase 5 the affordance may still render but the server rejects it
(accepted interim seam — not a bug).

---

## 2. Kill-switch removal (post-QA, before production hardening)

**Context.** `PAYMENT_MODE_USER_CONTROLLED` in
`web-admin/src/features/orders/payment/config/payment-modal-config.ts` is a
TEMPORARY constant letting QA flip back to legacy auto-escalate-and-lock
behavior without a revert.

**Task (after QA sign-off of the program):**
- [ ] Delete the constant; `PaymentModalConfig.userControlledMode` becomes always-true (or the field is removed)
- [ ] Delete the legacy auto-escalation/lock branch it gated (container decision layer)
- [ ] Delete `simpleDisabled` from `payment-mode-toggle.tsx` if (as expected) it is unused by then — see plan handoff rule H9
- [ ] Remove any tests that exist only to cover the legacy branch; keep user-controlled tests
- [ ] Gates green (eslint 0 / tsc 0 / jest incl. oracle / build / i18n)
- [ ] Update `Payment_Modal_Implementation_STATUS.md` + architecture doc

**Do not** build new logic that depends on the `false` branch in the meantime.
