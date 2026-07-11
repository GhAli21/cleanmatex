# Deferred Tasks — Payment Modal Composable Capability Program

Tasks explicitly **out of the program's scope** but tracked so they do not disappear.
Owner: Order Financial Platform. Source: user decisions of 2026-07-09.

---

## 1. Credit-limit override — ❌ CANCELLED by user decision (2026-07-11)

**Decision (user, 2026-07-11):** keep the hard block permanently — exceeding the
B2B credit limit is **never** allowed via a cashier/manager override. If the
limit is reached the customer **pays the balance down**, or an **administrator
raises the credit limit from the B2B customer edit screen** (out of this
program's scope). The gated-override feature is therefore **not being built**.

**What shipped instead (2026-07-11):**
- The misleading override affordance (the "I confirm override of credit limit"
  checkbox, `creditExceededWarn`/`creditOverrideConfirm` copy, the `warn`-mode
  softening, and the dead `CREDIT_LIMIT_OVERRIDE` right-rail warning subsystem)
  was **removed**. Exceeding always blocks with an **actionable** message that
  names the two real exits (pay down, or admin raises the limit).
- **Credit-check-amount bug fixed:** the credit limit is now checked against the
  **receivable actually created** (the unpaid `CREDIT_INVOICE` portion), not the
  full sale total — server (`order-submit-orchestrator.service.ts`,
  `checkCreditLimit(customerId, unpaidBalance)`) and client
  (`isB2BCreditLimitBlocking` compares `remainingBalance > available`) now agree.
  So a customer can pay part now (cash/card/gift) to bring the credit portion
  within their available limit and the order proceeds — the correct,
  market-standard behavior.
- The frozen submit payload still carries `creditLimitOverride` (always false,
  server-ignored — Phase 0B); the schema is unchanged.

**Recorded future consideration (NOT a gap, do not build without a driver):**
At real B2B scale, the industry-standard release valve is a **permissioned,
audited, per-order override** (finance-manager role approves one order with a
mandatory reason, fully logged) — the pure hard block can strand a corporate
customer at the counter. Revisit only when B2B volume warrants it; if pursued,
gate on BOTH an explicit tenant enablement setting (default OFF) AND a new
`orders:override_credit_limit` permission, with a DB seed migration + audit
stamping + EN/AR denial copy + inventory refresh.

---

## 2. Kill-switch removal — ✅ DONE (2026-07-11, seq 64)

**Context.** `PAYMENT_MODE_USER_CONTROLLED` was a TEMPORARY constant letting QA
flip back to legacy auto-escalate-and-lock behavior without a revert.

**Completed after QA sign-off:**
- [x] Deleted the constant and the `PaymentModalConfig.userControlledMode` field
- [x] Deleted the legacy auto-escalation/lock branch it gated (container decision layer) + `autoEscalated` state + legacy escalation banner
- [x] Deleted `simpleDisabled`/`simpleDisabledReason` from `payment-mode-toggle.tsx` + its story (H9)
- [x] Updated the config test (removed kill-switch assertions); no legacy-only tests existed
- [x] Removed orphaned i18n keys `mode.escalatedTitle` + `mode.simpleDisabledHint` (EN+AR)
- [x] Gates green (eslint 0 / tsc 0 / jest incl. oracle / build / i18n)
- [x] ADR status flipped to Accepted & Implemented; STATUS updated

---

## 3. QA server-guard debug hook removal — ✅ DONE (2026-07-11, seq 64)

**Context.** `submitOrder` in `use-order-submission.ts` had a TEMPORARY, opt-in
QA hook driven by `?qaServerGuard=<SERVER_ERROR_CODE>` to exercise the
server-error→guard path without staging a real rejection race.

**Completed after QA sign-off:**
- [x] Deleted the `TEMPORARY QA HOOK` block from `use-order-submission.ts`
- [x] Confirmed no other code references `qaServerGuard`
- [x] Gates green (eslint 0 / tsc 0 / jest / build)
