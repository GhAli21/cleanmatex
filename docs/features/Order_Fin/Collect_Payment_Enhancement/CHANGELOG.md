# Changelog — Collect Payment Enhancement

## 1.0.0 — 2026-08-15

Production hardening of the shared Collect Payment modal across its three mount surfaces. **No database migration.**

### Fixed — user-visible

- **Dead control.** The Ready trigger was an ungated raw `<button>` while the modal bailed on missing permission — a user without `orders:collect_payment` clicked and nothing happened.
- **Raw i18n key on screen.** `cashDrawer.errors.noOpenSession` did not exist (only `messages.noOpenSession`), so the literal key path rendered exactly when a cash collection was blocked.
- **Money precision.** Change-due was formatted with a hardcoded `toFixed(3)` in the customer stored-value fields, and two `decimalPlaces={3}` props sat beside it — wrong on any 2-decimal currency.
- **Stale outstanding balance.** The prop could be minutes old on the Delivery list; the balance is now re-read from the server on open and on submit failure.
- **Non-cash collections were unreconcilable.** No reference/check fields existed in the UI, and the route schema could not carry them.

### Fixed — correctness

- No-silent-money-mutation gap: the reset effect ran on `[open, outstandingAmount]`, so a parent refetch could overwrite a typed amount.
- `cashLegRef` shadowing made the pay-extra path and the submit-time resolution fallback reference different legs.
- `willBePending` read an explicit-override-only field, so a method resolving to PENDING through the D9 fallback chain wrongly displayed as fully paid.
- Cash tendered below the amount was only guarded by a `min` attribute this dialog never validated against.

### Added

- `CollectPaymentButton` — permission-aware trigger shared by all three call sites.
- `CmxChangeDueRow` (`src/ui/data-display`) + 5 Storybook stories.
- Full state contract: catalog-load error with Retry, empty state, persistent inline submit errors.
- Quick-tender denomination chips, prominent change-due, Enter-to-submit, remaining-after-payment line.
- Reference / check number / bank / date fields with `requires_reference` enforcement.
- Collection notes → `org_order_payments_dtl.rec_notes` (column already existed, never written).
- Optional `onPrintReceipt` (Ready wires the 80mm receipt — closes a B04 deferral) and `handoverIntent`.
- `resolved_creation_status` on `checkout-options`, computed with the same expression `collectPaymentTx` uses.

### Changed

- `collectionPaymentLegSchema` + `collectionNotesSchema` are now shared by `/payments` and `/collect-payment`, which previously declared the leg shape independently and had drifted.
- `VoucherLineForWiring.notes` added as **optional** (strictly additive — no handler or fixture touched); `LINE_SELECT` gained `notes`.
- Collect idempotency hash now includes `notes`.
- All legacy toasts replaced with `cmxMessage` (CRITICAL RULE #16).
- Amount and Cash Tendered moved from raw number inputs to `CmxMoneyField`.

### Deferred

- **Split tender** and the `PaymentAmountMoneyField` keypad — both depend on adopting `usePaymentLegs`. The API has always accepted N legs; this is a UI-only gap.
- `usePaymentCatalog` fetching was **not** adopted: it maps a non-ok response to an empty option list, which would erase this modal's load-error + Retry surface.

### Gates

tsc 0 · eslint 0 · check:i18n passed · full jest 259 suites / 2423 tests · build ✓ · inventories drift 0.
Manual QA and a dedicated modal test file remain open.
