# Collect Payment Enhancement

Production hardening of the shared **Collect Payment** modal — the surface that settles the outstanding balance of an order that already exists.

**Status:** Phases 1–6 complete, 2026-08-15. Split tender deferred (see [STATUS.md](STATUS.md)).
**Migration:** none required or made.

## Pack

| Doc | Purpose |
|---|---|
| [STATUS.md](STATUS.md) | Per-phase outcome, deviations, gates — the source of truth for progress |
| [developer_guide.md](developer_guide.md) | Architecture, contracts, the three mount surfaces, extension points |
| [user_guide.md](user_guide.md) | What a cashier sees and does |
| [testing_guide_and_scenarios.md](testing_guide_and_scenarios.md) | Test matrix + manual scenarios |
| [CHANGELOG.md](CHANGELOG.md) | Change log |
| [version.txt](version.txt) | Current version |

## What this covers

`web-admin/src/features/orders/ui/collect-payment/order-collect-payment-modal.tsx` and its three mounts:

| Route | Lifecycle |
|---|---|
| `/dashboard/ready/[id]` | persistent, `open` toggles |
| `/dashboard/delivery` | **conditional remount per list row** |
| `/dashboard/orders/[id]` → Financial tab | persistent, `open` toggles |

The governed-edit CHARGE path deliberately does **not** mount it — `collectPaymentTx` is `PAY_ON_COLLECTION`-scoped (B12).

## Headline outcomes

- **Dead control fixed.** The Ready trigger was an ungated raw `<button>` while the modal bailed on missing permission — a user without `orders:collect_payment` clicked and nothing happened.
- **Raw i18n key removed.** `cashDrawer.errors.noOpenSession` did not exist; the literal key path rendered exactly when a cash collection was blocked.
- **Stale balance closed.** The outstanding figure is now read from the server on open, not trusted from a possibly-minutes-old list row.
- **Non-cash collections are reconcilable.** Reference / check fields existed in the service and DB but were unreachable over HTTP and absent from the UI.
- **Two money-display bugs fixed** by extracting `CmxChangeDueRow` (hardcoded 3-decimal formatting on 2-decimal tenants).

## Related

- Work packages: [B04](../Remediation_Work_Packages/B04_Later_Collection_BVM_Parity.md) (receipt print + reference-field deferrals now closed), [B05](../Remediation_Work_Packages/B05_Later_Collection_Idempotency.md), [B31](../Remediation_Work_Packages/B31_Later_Collection_Default_Status.md) (resolved-status gap now closed)
- ADR-022 — partial later collection is allowed by default
- ADR-PACK-008 — pay-on-collection is not AR (why the `PAY_ON_COLLECTION` gate exists)
- QA: [`Remediation_Work_Packages/QA_TEST_GUIDE.md`](../Remediation_Work_Packages/QA_TEST_GUIDE.md) §11
