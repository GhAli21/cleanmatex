# Testing guide and scenarios

Status: proposed acceptance plan, not executed enhancement evidence. Updated: 2026-10-24.

For the working test/feedback cycle, follow [tester-handoff-guide.md](tester-handoff-guide.md) and update [tester-results.md](tester-results.md). Select scope-appropriate cases from this catalog for each small improvement; the catalog is not a requirement to implement or test every deferred mechanism in every iteration.

See [README](README.md), [deployment](deploy_guide.md), [observability and benchmarking](technical_docs/observability_and_benchmarking.md), and [existing quote implementation evidence](../Payment_Modal_Review/Payment_Modal_v4_Quote_Performance.md).

## Evidence boundary

The earlier coordinated quote implementation recorded 22 focused suites / 393 tests passing, full ESLint, typecheck, production build, i18n and scoped New/Edit access checks. That result predates these proposed enhancements and is not a fresh run. The earlier successful-quote runtime test was blocked by missing tenant base currency; payment UI verification was blocked by missing active POS session. Six baseline navigation-inventory mismatches were recorded. None was reverified while writing this pack.

Every future result must identify the candidate commit, environment, fixture prerequisites, command, captured output, exit code, skipped tests and failure classification. An unreachable DB or skipped session fixture is not integration proof. Unit, DB, browser, load and deployment evidence remain separate.

## Fixtures and safe execution

Prepare isolated approved local/staging fixtures with two tenants, two cashiers, differing permissions, two branches, multiple customers and a verified base currency/precision. Include normal/express products, customer prices, quantity tiers, inclusive/exclusive tax, exemptions and compounds, active/expired/exhausted promos, stored-value accounts and gift PIN requirements. Configure real POS and drawer sessions through supported workflows.

Verify the environment before any test that writes. Quotes are not payment reservations and may invoke existing loyalty-expiry maintenance. Financial submit tests require explicit fixture ownership and expected ledger/debit reconciliation. Do not disable auth, CSRF, tenant predicates or operational gates to satisfy a test. Do not reset Supabase or apply migrations. Future schema fixtures require the user's approved migration application first.

## T01: financial parity

Use the current authoritative implementation as the baseline oracle for equivalent inputs, and independently assert important business invariants so both paths cannot agree on the same defect. Compare canonical amounts at configured currency precision, selected tax identities/order, tax base/components, method eligibility and credit outcome. Do not use a blanket floating-point tolerance that conceals a real smallest-unit difference.

Cover these combinations in focused fixtures and property-based cases where useful:

- Inclusive and exclusive product pricing, exempt customers, zero-rate/absent configured taxes, compound taxes and selected/default tax profiles.
- Normal/express prices, customer and branch precedence, fallback after a successfully absent price list, price overrides including zero, quantity boundaries, repeated identical lines and same product with different quantity/context.
- Percent/fixed/manual discounts, explicit/automatic promos, date/usage limits, candidate ordering/ties, stacking and quantity-dependent eligibility.
- Gift validation/PIN, partial/exhausted balance, concurrent spend between quote and submit, invalidated/expired gift and discount-versus-settlement semantics.
- Pay on collection, B2B invoice/credit hold, allowed partial pay, exact credit-limit boundary and existing outstanding exposure.
- Cash/card/split tender, method disable layers, order/leg thresholds, overpayment disposition, change due and cash-change rounding with 2/3/4-decimal fixtures.
- Preference charges, order-level charges and supported mixed sale items. Ensure duplicate lines are not aggregated when pricing tiers are per line.

Required assertions: no silent money mutation; no invented currency; no success after required configuration failure; no eligibility based on a different total; unchanged final order/invoice/voucher/debit invariants.

## T02: request-local memoization

These are acceptance tests for proposed memoization, not a statement that it exists.

1. Invoke the same resolver concurrently from multiple stages in one request. Assert one underlying call and the same result/error semantics for all waiters.
2. Vary tenant, branch, effective user/role, setting scope, context and resolver options wherever they influence resolution. Assert no key collision. Never deduplicate different authorization scopes just because the setting code matches.
3. Begin two independent HTTP requests concurrently. Assert they do not share request-local state, including rejected promises and customer-sensitive facts.
4. Distinguish successfully unset configuration, explicit zero/false, missing required currency, infrastructure failure, invalid selection and denial. A cached failure must not be converted to zero or treated as absence.
5. Verify strict and legacy callers keep their documented error/default semantics while sharing only the underlying compatible facts.
6. Ensure async work actually runs inside the request context and that it ends without a global unbounded Map. Test nested/parallel tasks and intentional late completion after HTTP timeout.
7. If a rejected lookup is evicted for retry, define and test that policy explicitly; do not accidentally issue a retry storm within one quote.

## T03: authentication, authorization and CSRF

- Unauthenticated, expired, revoked, removed-membership, idle-expired and absolute-expired sessions fail safely; forced password change blocks business APIs. Infrastructure failure remains fail closed.
- An API request retains one authoritative session/tenant resolution after any proxy duplication change. Cookie refresh and logout still work. Do not trust caller-supplied tenant IDs or user metadata for tenant ownership.
- If `getClaims()` is ever evaluated, verify deployed signing mode, verified subject, expired/malformed tokens, key rotation/refresh and deletion/revocation behavior; retain the server session guard. Treat this as shared auth work with wider tests.
- Required `orders:create`, optional detailed-balance visibility and conditional `pricing:override` are evaluated separately. A cashier denied rich balances can still receive the permitted operational checkout subset. Resource-scoped allow/deny, tenant-wide fallback, admin and wildcard semantics remain equivalent to authoritative checks.
- Missing, wrong, expired/rotated or cross-session CSRF token rejects without financial work. Single-flight token acquisition recovers after failure/rotation, does not retry submission automatically after uncertain writes and does not leak a previous user's token.
- Validate posted foreign branch/customer/product identifiers, bounded body/line limits, invalid JSON and safe error content.

## T04: quote lifecycle and future display reuse

Existing unique-opening authority is the baseline. Any display-cache proposal must add explicit tests before it changes that behavior.

- First open shares exactly one core opening quote between shell and engine. No preliminary currency/tax/options/balance waterfall returns.
- Cart edits lock submission immediately during debounce; rapid edits and edit/revert cannot revive earlier authority. Aborted/out-of-order responses never replace the active quote.
- Reopen with the same cart may show last confirmed values only under the approved freshness policy. Distinguish displayed data from permission to submit; background validation failure disables affected financial actions.
- Cart, customer, branch, normal/express mode, preferences, promo, gift and tax-selection changes have distinct canonical identities where financially relevant. Verify identical object property order does not force a duplicate request; meaningful array ordering remains preserved.
- Tenant/user change, sign-out/sign-in, impersonation/session replacement if supported, branch change, browser focus/reconnect and back/forward navigation cannot expose another actor's quote/balance or make stale authority current.
- For deferred D04 only: prefetch is bounded, debounced and cancellable; hover/focus and cart-valid triggers deduplicate. Invalid/missing contexts do not prefetch. A prefetch failure does not trap the modal or flood retries. Include side-effect checks for existing loyalty expiry maintenance. P5 display-only reuse must not enable these speculative whole-quote triggers.
- Confirmation binds to the current session, revision and quote response. Pending, failed or replaced quote invalidates review. Clicking Confirm while refresh begins is rejected; fresh explicit review is required.
- A changed currency/precision requires explicit safe recovery; never relabel or round already-entered money underneath the cashier.

## T05: metadata and drawers

Brands/terminals are configuration; drawer/POS availability is operational state. Test them separately even if both are warmed early.

- Brands/terminals load concurrently where safe and are scoped by tenant/user/branch. Empty configuration differs from failure. An optional terminal failure does not block an eligible cash flow; terminal-required methods remain blocked.
- Open/close/reassign a drawer or POS session while a page is open. A cached list is revalidated at the appropriate authority boundary and cannot authorize a closed session. Membership/branch mismatch is rejected.
- A slower metadata request does not freeze the whole modal. A relevant unavailable method has clear localized recovery; Cancel remains available.
- Retry refreshes the failed scope without discarding form values or silently changing selected tender. Submission checks current operational state independently.

## T06: mismatch and idempotent submit

Change a price, tax selection/configuration, promo, currency or eligibility between quote and submit in an approved isolated fixture. The server recalculates; changed amounts reject before financial writes. Same numeric total with different currency or relevant provenance must not slip through any proposed fingerprint contract.

Verify proposed in-place mismatch recovery: show the difference, fetch the current quote, preserve typed money/legs, block obsolete confirmation, require review and obtain the appropriate submission identity. Existing page reload behavior is the baseline, not completion of the proposed recovery.

Test same idempotency key/same payload replay, same key/different payload rejection, simultaneous duplicates, timeout after unknown response, and safely retrying a rolled-back mismatch. Do not auto-resubmit a changed payload with the old key or claim a second payment. Reconcile order/invoice/voucher/debit and audit records after each transactional scenario.

## T07: accessibility and localization

Run Simple/Advanced, EN/AR and RTL on desktop and a narrow viewport. Verify loading/refresh/error descriptions, visible labels, currency direction/precision, keyboard focus on modal open/close, Escape/Cancel, screen-reader loading announcement without repeated spam, disabled-action explanations and confirmation recovery. Reuse Cmx components and resolved translations. Check reduced-motion behavior where loading indicators support it.

## Existing commands and focused starting points

Run from `F:\jhapp\cleanmatex\web-admin` unless noted. These commands are verified package entry points and existing file names; they are instructions, not test results. Select only suites affected by the implementation, and add new acceptance tests where the proposed behavior has no current coverage.

```powershell
$env:NODE_OPTIONS = '--max-old-space-size=6144'
npm run typecheck
npx eslint . --quiet
npm run build
```

Focused existing quote and financial protections:

```powershell
npm test -- --runInBand --runTestsByPath __tests__/api/v1/orders/payment-quote.route.test.ts __tests__/services/payment-quote.service.test.ts __tests__/services/payment-quote-tax-snapshot.test.ts __tests__/features/orders/payment-quote-api.test.ts __tests__/features/orders/use-payment-quote.test.tsx __tests__/features/orders/payment-modal-v4.initialization.test.tsx
npm test -- --runInBand --runTestsByPath __tests__/services/checkout-options.service.test.ts __tests__/services/payment-config.service.test.ts __tests__/services/order-submit-orchestrator.protection.test.ts __tests__/services/order-submit-orchestrator.cash-rounding.test.ts __tests__/services/order-submit-orchestrator.unpaid-balance.test.ts __tests__/services/gift-card-service.test.ts __tests__/services/loyalty.service.test.ts __tests__/services/tax-engine.service.test.ts __tests__/services/tenant-settings.service.currency.test.ts
npm test -- --runInBand --runTestsByPath __tests__/features/orders/payment-modal-v4.utils.test.ts __tests__/characterization/create-money/create-pricing.golden.test.ts
```

After translation edits, run `npm run check:i18n` from the repository root. For actual access changes, use the scoped access-contract workflow from the root, then generated inventory checks; record existing drift separately.

The real-DB harness is `npm run test:db-integration -- --runTestsByPath <existing-or-new-DB-test-file>`. Replace the placeholder with the reviewed file. It uses `jest.db.config.js`, runs serially and may skip when DB prerequisites are absent. Existing session-registry/screen DB suites can be selected for shared session changes; they do not constitute a quote-performance integration suite. Verify logs show real executed assertions, never merely a graceful skip.

## Production-build browser execution

Start `npm run start -- --hostname 127.0.0.1 --port 3000` in a dedicated terminal after a successful build. Use a legitimate configured local/staging login; `auth.setup.ts` reads existing `E2E_LOGIN_EMAIL` / `E2E_LOGIN_PASSWORD` from the process environment. Do not print credentials or commit Playwright storage state. Load approved environment values using the project's normal secure local setup before invoking Playwright; missing login values do not produce authenticated acceptance proof.

In a second terminal from `web-admin`:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://127.0.0.1:3000'
npm run test:e2e -- e2e/payment-quote-api.spec.ts --project=chromium --workers=1 --reporter=line
npm run test:e2e -- e2e/payment-modal-v4.spec.ts --project=chromium --workers=1 --reporter=line
```

Run those invocations sequentially: they share authentication and artifact directories. The Playwright configuration may reuse a running local server; verify it is the intended production server, not a development process. Production Secure-cookie behavior should be tested through browser fetch as the existing API spec does; do not weaken cookie/CSRF controls for an APIRequest workaround. Close only task-owned server processes afterward.

Existing tests do not yet prove every proposed EN/AR, mismatch, memo or cross-user scenario. Implement targeted additions before marking those gates complete. Review captured traces/screenshots for secrets and financial data before sharing.

## Performance and load acceptance

Follow the [benchmark protocol](technical_docs/observability_and_benchmarking.md). Measure 3-line and 30-line carts, duplicates/unique lines, customer/no-customer, promo/gift and method-specific readiness. Separate first page/session cold open, infrastructure cold start, warm open, same-cart reopen and changed-cart refresh. Collect p50/p95 and failures both near the deployment and from an actual Oman path. Network emulation supplements, but does not replace, a measured geographic path.

Run controlled concurrency ramps representing simultaneous cashiers, measure pool/lock/DB CPU pressure, and include canceled/stale requests. Request-local reuse should reduce duplicate compatible lookups within one quote; line pricing must not grow unexpectedly without being reported. Track RPC requests, DB round trips and SQL work separately. No new load-test tool/package is mandated by this documentation; choose an approved harness and record it when implementation begins.

Hard targets such as 350/500 ms quote time or 100 ms reopen remain unverified hypotheses. Approve baseline-relative and absolute budgets after representative measurement. No latency win overrides money parity, tenant isolation, security or operational correctness.
