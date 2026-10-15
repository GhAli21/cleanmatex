# Change Log — v3.0 (2026-10-02)

- Added production completeness contract to architecture.
- Added master Production Implementation Specification.
- Added exact API route/DTO/error/idempotency contract.
- Added DB schema blueprint with Change tables, order fields, removal lineage, RLS, backfill and rollback.
- Added V1 operation/capability catalog and normalization rules.
- Added detailed frontend/UI/UX state and screen behavior.
- Added service/module responsibilities and transaction-composition rules.
- Added explicit RBAC/security/tenant-isolation contract.
- Added outbox/event, logging, metrics, tracing, SLO and support requirements.
- Added requirement traceability matrix.
- Added migration/cutover/incident runbook.
- Added explicit Open Decisions & Release Gates so unresolved business facts cannot become hidden developer assumptions.
- Preserved v2.1 configuration ownership and added effective-source requirements and Edit-specific naming guidance.

## Final current-code reconciliation — 2026-10-02

- Corrected v3.0 authority/version metadata; retained one living WP01–WP20 plan and converted the imported duplicate to a redirect. Production Specification now references maintained companions instead of stale embedded copies.
- Preserved fresh verified WP01 protection and PARTIAL WP01.5/WP02 preparation. Replaced absent historical evidence-file links with the final review report; no package was marked complete solely from old text.
- Reconciled deployed local/hosted schema differences, history/live hierarchy, complete-master insertion, lifecycle NULL/precision, unsafe tenant/helper/RPC grants, API proof/DTO/replay, quantity ownership, transaction adapters, Finance locks/corrections, settings ownership, UI uncertain results and event consumers.
- Expanded test traceability to all 57 frozen statements and 26 scenarios; recorded passing current protection, external typecheck failures and unrun real production proofs.
- Classified supplied DOCX/ZIP as unchanged reference snapshots pending regenerated exports. Verdict and evidence are in [the final validation report](../Edit_Order_V2_v3.0_Final_Validation_Report_Codex.md).
- Documentation-only: no runtime/test implementation, migration authoring/application, configuration change or WP02-and-later implementation.

## WP06 and WP07 documentation synchronization — 2026-10-14

- Added [WP06 report](WP06_Item_Piece_Projection_v3.0.md) and [WP07 report](WP07_Preference_Projection_v3.0.md). The living plan now points at those reports and limits both packages to their in-memory results.
- Recorded the frozen quantity contract in the Operation Capability Catalog and closed the in-memory tracked-quantity gate. Selling totals and snapshot persistence stay open for WP08 and WP11.
- Recorded that neither package adds a database object, HTTP route, or Edit screen. The service map, API catalog, schema blueprint, and UI specification name the remaining owners.

## WP08 documentation synchronization — 2026-10-14

- Added [WP08 report](WP08_Calculation_Adapter_v3.0.md). The living plan limits the package to the pure adapter.
- Recorded the selling-unit decision: Create still uses base price; an Edit new or changed line uses an authorized override or the quote final price.
- Recorded that compound tax resolution, currency-increment rounding, persistence scale, and both routes remain later work. No database object or screen was added.

## WP10 documentation synchronization — 2026-10-14

- Added [WP10 report](WP10_Preview_v3.0.md). The living plan limits the package to the read-only Preview route. Apply remains unbuilt.

## WP09 documentation synchronization — 2026-10-14

- Added [WP09 report](WP09_Financial_Result_v3.0.md). The living plan limits the package to in-memory classification through the existing D005 formula.
- Recorded that fiscal obligation is the original document plus later corrections, and that unsupported or duplicate correction is denied.
- Recorded that no payment, invoice, tax document, or `order_change_id` column is written.

## Implementation governance consolidation — 2026-10-14

- Added `CleanMateX_Edit_Order_V2_Order_Change_2026-10-02_v3.0_Implementation_Governance.md` as the mandatory execution-governance contract; the living implementation plan remains the sole WP sequence/progress authority.
- Centralized reuse-first discovery, canonical domain ownership, domain-agnostic shared-component rules, separation of concerns, single-source-of-truth, thin orchestration, legacy Edit migration/deprecation, architecture verification, documentation synchronization, and WP Definition of Done.
- Required existing-code reuse/domain ownership evidence in applicable WP reports.
- Added the explicit rule that Order Change V2/v3.0 is canonical for new committed-edit functionality; useful legacy Edit behavior is migrated into V2/v3.0, while legacy mutation paths become compatibility/deprecated and are retired after cutover.
- Reclassified WP07, WP08, and WP09 from unqualified DONE to PARTIAL pending a one-time retroactive governance reuse/domain-boundary audit. Existing implementation/test evidence is preserved. WP10 must be revalidated if remediation changes their contracts.
- Updated README/active-set/completeness/plan references. No runtime code, migration, database data, permission, flag, or production rollout was changed by this documentation update.

## Testing documentation governance — 2026-10-14

- Added `..._v3.0_Test_Guide_and_Scenario_Matrix.md` as the detailed testing-execution companion for unit/service/API/DB/security/concurrency/E2E and release evidence.
- Added `..._v3.0_Manual_UI_Test_Guide.md` containing only human-judgement UI scenarios; every scenario requires exact navigation path, route when known, page/screen, UI area/control, steps, expected results, EN/AR/RTL/device checks and evidence.
- Clarified that manual testing is not a substitute for missing automation. Objective authorization, RLS, atomicity, idempotency, concurrency, persisted-money and version/revision behavior remain automated requirements.
- Strengthened the WP Definition of Done with the explicit statement that coding completion alone is not DONE and synchronized testing/documentation evidence is required.
- Updated the living plan and active-set indexes to reference the two testing companions. No runtime code, migration, data, permission, feature flag or rollout configuration was changed by this documentation update.

## WP07–WP09 governance remediation — 2026-10-14

- Preference extras now use the existing charge-money helpers. Inclusive and exclusive tax live in `tax-extraction.ts`. Overpayment lives in `computeOverpaidAmount`, which the snapshot writer and the Edit classifier both call.
- Existing fixture numbers were unchanged. WP10 preview tests were re-run and passed. WP07, WP08, and WP09 are DONE for their in-memory slices. Apply, snapshot writing, compound tax, and currency-increment rounding remain later work.
- No migration, permission, feature flag, or screen was added. Billing, plans, and tenant role grants were not changed. `order_edit_v2` stays default-off.

## WP11 documentation synchronization — 2026-10-14

- Added [WP11 report](WP11_Persistence_Adapters_v3.0.md). The living plan limits the package to the caller-transaction adapter. Apply remains unbuilt.
- Recorded that idempotency claim and completion, Change insertion, descendant logical removal, and the registered `ORDER_CHANGE_APPLIED` handler share the caller transaction. No new table or HTTP route was added.

## order_edit_v2 default correction — 2026-10-14

- Local and remote `hq_ff_feature_flags_mst.default_value` for `order_edit_v2` are already `true`. The TypeScript catalog had drifted to `false` and is now `true`.
- No new migration was added. A tenant override can still disable the flag. The flag still only enables evaluation.

## WP12 documentation synchronization — 2026-10-14

- Added [WP12 report](WP12_Apply_v3.0.md). `POST /api/v1/orders/[id]/changes` commits one settled order-field Change or nothing. Commercial line writes remain rejected.
- The database test rolls the Change back and leaves no row. No migration, permission, feature flag, or screen was added. Billing, plans, and tenant role grants were not changed.

## WP13 documentation synchronization — 2026-10-14

- Added [WP13 report](WP13_Edit_Controller_v3.0.md). The Edit controller builds operations against persisted row ids and calls Preview and Apply.
- Create submission and the visible legacy Edit save are unchanged. No migration, permission, feature flag, or screen layout was added.

## WP17 closed — 2026-10-15

- Closed WP17 for the delivered writer scope. The direct-grant column guard is postponed in [WP17 postponed](WP17_Postponed_Committed_Column_Guard_v3.0.md). Grants stay in place. WP18 is next and is not started.

## WP17 repair function applied — 2026-10-15

- The operator applied `0627_fix_order_data_refuse_committed.sql` on the local and remote databases. Both function definitions refuse a committed repair. The function arguments did not change.

## WP17 structural Apply and repair guard — 2026-10-15

- Apply now saves a reviewed item add, item or piece removal, and quantity change without recreating existing pieces. Processing ignores an unchanged note and rejects a changed one. Charge void and preference-charge repair lock the order row.
- Added `0627_fix_order_data_refuse_committed.sql` for review. It is not applied. Migration `0113` was not edited. Direct table grants were not changed.

## WP17 commercial route closure — 2026-10-15

- Extended the committed-order guard to preparation items, piece create and delete, commercial piece fields, preferences, packing, bundles, conditions, and fix-order-data. Processing readiness and rack assignment stay on their existing routes.
- No migration, permission, feature flag, navigation entry, or billing change.

## WP17 legacy replacement closure — 2026-10-15

- Added [WP17 report](WP17_Committed_Writer_Closure_v3.0.md). The legacy full-replacement update returns 409 for a committed order while Edit Order V2 is on. Uncommitted orders still use that update. The rest of the Part 7 writers remain open.
- No migration, permission, feature flag, navigation entry, or billing change.

## WP16 financial follow-up — 2026-10-15

- Added [WP16 report](WP16_Financial_Follow_Up_v3.0.md). Follow-up after a committed Change uses the existing pay-on-collection route or the stored-value disposition owner. The original payment type is not changed. Cash and gateway refunds are not executed here.
- No new permission, feature flag, navigation entry, billing change, or migration.

## WP15 Apply coverage and parked stops — 2026-10-15

- Updated [WP15 report](WP15_Review_Apply_History_v3.0.md). Apply saves catalog preferences and tracked item and piece fields without deleting pieces. Order-level preference extras become preference charges, then the existing financial snapshot writer runs.
- Structural item and piece add, remove, and quantity stay stopped for WP17. Piece conditions and line-price rewrites stay with that later writer. Collection and overpayment resolution stay WP16, which is the next package and is not started.
- No new permission, feature flag, navigation entry, or billing change.

## WP15 review dialog — 2026-10-15

- Added [WP15 report](WP15_Review_Apply_History_v3.0.md). Review opens a dialog on the shared workspace. Apply uses the reviewed proof. A conflict reloads without merging. Change history is a read-only label list.

## WP14 shared workspace correction — 2026-10-15

- Replaced the separate Edit form with the existing New Order workspace. `EditOrderController` remains separate and Review calls Preview only. Customer identity, branch, and currency stay locked. Committed item, piece, and preference ids are projected into the shared presentation. Commercial line writes stay closed. See [WP14 report](WP14_Edit_Workspace_v3.0.md).

## WP14 documentation synchronization — 2026-10-14

- Added [WP14 report](WP14_Edit_Workspace_v3.0.md). The first workspace note described a separate form. The 2026-10-15 correction replaces that description.
- The route no longer acquires the legacy lock or calls the legacy update. Apply, commercial line edits, and the review dialog remain later work. No migration, permission, feature flag, or navigation entry was added.

