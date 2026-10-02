# CleanMateX Edit Order V2 — Requirement Traceability Matrix

| ID | Requirement | Database | API | Backend | Frontend | Verification |
|---|---|---|---|---|---|---|
| R001 | Commitment boundary | org_orders_mst committed_at/by | change-context/Apply | order-change context/apply | Edit context | commitment migration+integration+E2E |
| R002 | Separate edit/workflow concurrency | edit_state_version + existing state_version | context/preview/apply | capability/apply | conflict dialog | DB concurrency + E2E |
| R003 | Stable item identity | item UUID + removal lineage | context/preview/apply | projection/mutation | item editor | identity integration/E2E |
| R004 | Stable piece identity | piece UUID + removal lineage | context/preview/apply | projection/mutation | piece editor/selection | piece integration/E2E |
| R005 | Stable preference identity | preference UUID + removal lineage | context/preview/apply | preference adapter | preference UI | all-level preference tests |
| R006 | Generic preference ops | change ops table | preview/apply | projection/preference | preference UI | ORDER/ITEM/PIECE matrix |
| R007 | Operation capability policy | workflow/profile config + order access | context/preview/apply | capability service | disabled/warn/override states | policy/gate tests |
| R008 | Preview no writes | none | POST changes/preview | preview service | Review Changes | purity/instrumentation tests |
| R009 | Atomic idempotent Apply | Change master/ops + idempotency/outbox | POST changes | apply service | Apply/retry | fault injection + concurrency |
| R010 | Immutable payment history | existing finance facts | Apply response only | financial result + snapshot | financial outcome | 20→15 financial tests |
| R011 | Separate financial follow-up | existing finance + optional lineage | additional payment / resolution | Finance-owned adapter | financial resolution dialog | source/cap/race tests |
| R012 | Tenant isolation | RLS + scoped FKs | all | all queries scoped | generic errors | cross-tenant RLS/API tests |
| R013 | Configuration ownership | settings/flags/workflow/domain configs | context | config resolver | effective behavior | config precedence tests |
| R014 | Legacy bypass closure | guards/no new table | legacy routes translate/deny | compat translators | existing screens | writer closure test |
| R015 | Audit/history | Change master/ops + legacy read | GET changes | history adapter | history timeline | audit exactness tests |
| R016 | Observability | outbox existing | all | logging/metrics/tracing | support surfaces | metrics/outbox tests |
| R017 | EN/AR/RTL/a11y | message catalogs | UI routes | frontend | all Edit UI | Playwright EN/AR/a11y |

## Complete frozen-invariant and scenario verification map (2026-10-02)

The original R001–R017 rows remain requirements, not test-completion claims. The profiles below specify every required layer. Each invariant/scenario references its profile(s), so layer requirements are explicit without repeating one canonical rule in multiple contracts. All V2 acceptance remains **NOT IMPLEMENTED / NOT RUN**; existing baseline tests qualify reuse only. Database, concurrency, RLS/security and migration assertions require a separately identified disposable test environment and operator-applied reviewed migrations; agents do not run migrations or mutate production fixtures.

Frozen Invariants has duplicate numeric labels 36/37 across its original and configuration sections. Review references use B01–B37 (original section), C36–C51 (configuration section), and V3A–V3D (completeness bullets). These labels preserve the frozen wording and avoid ambiguous test references.

| Profile | Proof | Unit | Actual service/API invocation | DB integration / concurrency / RLS-security / migrations | Playwright / EN-AR-RTL-a11y | Packages |
|---|---|---|---|---|---|---|
| P01 | Authority/commitment/Create | source classification and irreversible commitment | Service: actual Create and Change uncommitted rejection. API: new routes reject draft/legacy bypass. | commit/version CHECK and producer migration/backfill on disposable DB; normal direct committed DML denied | Create regressions; zero-item Quick Drop detailing | WP02–04/17/18 |
| P02 | Versions/atomicity/idempotency | normalization hash; no-op; exact once revision | Service: actual Apply fault injection and supplied tx composition. API: same-key payload conflict, replay, expired cache and lost response. | real row locks; two Apply winners; workflow/Finance races; rollback all facts; durable response; direct replay access scoped | conflict reload; frozen uncertain command; double-submit | WP04/11/12/15/18 |
| P03 | Preview purity/money proof | projection/calc equality; proof digest invalidation | Service: invoke Preview with instrumented writes; no promo redemption/snapshot. API: Preview zero DML and stale/tampered review rejection. | observe all canonical/history/outbox/usage tables unchanged; policy drift without version increment | estimate labels; Review acknowledgement; no silent money mutation | WP08–12/15/18 |
| P04 | Stable structure | line/piece UUID normalization; same-product lines; quantity/piece coherence | Service: actual mutations preserve IDs/logical removals/sequence; no product replacement. API: forged refs/cyclic refs/protected piece requests rejected. | scoped hierarchy FKs; active/history readers; split and sequence races; removal lineage migration | remove/undo/eligible piece selection; scan identities | WP02/06/11/13–15/17/18 |
| P05 | Generic preferences | all configured kinds and ORDER/ITEM/PIECE operations; ID preservation | Service: catalog resolution and extra charges exactly once. API: complete context refs; cross-parent/wrong-kind rejection. | composite piece preference hierarchy and soft removal; split/reparent; lineage | generic kind editor/read-only state and repeated-product targeting in EN/AR | WP02/04/07/11/14/18 |
| P06 | Calculation/domain configuration | unchanged line preservation; nonzero adjustment; inclusive/exclusive/charges/discount/precision | Service: real algorithms with explicit resolved inputs and transaction readers. API: client money untrusted; dependency errors and drift mapped. | persisted active totals equal snapshot; legacy10,3 range/quantization and rounding; no historical reinterpretation | review sources/warnings; money formatting; inline adjustment and typed-money protection | WP08/09/12/15/18 |
| P07 | Financial immutability/result | partial/paid deltas and overpayment; per-source caps | Service: real aggregation/snapshot and no settlement writes during Change. API: Apply outcomes vs separate follow-up contracts/permissions. | payment/voucher/credit/receipt history unchanged; Finance race serializes; posted AR and fiscal correction reconciliation | optional/required collection and supported resolution; denied follow-up does not undo Change | WP09/12/16/18 |
| P08 | Finance follow-up/source/cash | qualified source/method/disposition and restoration caps | Service: actual Finance command; manual gateway/refund lifecycle; drawer movement once. API: independent permissions/idempotency; server actor; uncertain follow-up replay. | parallel refund/resolve source cap; voucher/source lineage; cash/FX ledger; immutable original doc | separate Payment V4 adapter/resolution; failures retain Change | WP09/16/18 |
| P09 | Workflow capability/proof | operation/target decisions; hard denial; warning/override/reason | Service: reuse policy/gates without executing transition; reload actor/policy. API: permission revoked or proof edited/expired returns denial/conflict. | workflow version unchanged by Change; race with processing/cancel/split; missing binding fails closed | blocked target explanation/reason/ack/review; no status-array policy | WP05/10–12/14/15/18 |
| P10 | Tenancy/security/bypass | strict DTO/limits; actor/tenant not browser authority | Service: every org query visible tenant predicate and current parent verification. API: foreign-ID generic404; CSRF401/403; spoofing/direct legacy denial; limits413. | normal-role Data API/RPC/SECURITY DEFINER grants and RLS; composite FK; immutable history/commitment; allow legitimate Create/Workflow/Finance | permission/not-found/support states avoid leaks | WP02/04/05/12/17/18 |
| P11 | Ownership/configuration/rollout | source/default/failure and precedence; no policy forest | Service: HQ/domain resolver adapters; revalidate freshness/fingerprint. API: context capability source; feature OFF/revoked; no browser policies. | review permission/flag seeds and specific role grants; unsafe inherited grants revoked; no V2 cohort bypass | capability-driven fields; branch/customer/currency read-only | WP05/08/09/17–19 |
| P12 | Order access block | temporary expiry re-evaluation; permanent block absolute | Service: block guard reloaded under lock. API: block between context/Preview/Apply; authorized override cannot bypass. | CHECK expiry/state consistency; permanent block cannot clear; actor/source audited | reason/expiry/read-only denied controls | WP02/05/12/14/18 |
| P13 | Audit/outbox/observability | safe before/after diff and event payload; no secrets | Service: transaction history/outbox with actual registered consumer. API: cursor history/auth/money redaction/request identifiers. | immutable history; rollback no event; at-least-once business effect idempotent; removal/split history preserved | history/revision/support refs; failed follow-up linked | WP11/12/15/17/18/20 |
| P14 | UI/localization/a11y | Edit reducer/builder IDs and no-op/dirty; shared Create preserved | Service: controller context/review/apply/error state tests with actual hook. API: real route/DTO integration, permission/not-found/error/conflict/replay. | support representative fixture-backed UI/Finance scenarios; no schema proof via browser mocks | Playwright EN/AR/RTL keyboard/focus/error/undo/Review/mobile; no vacuous assertions | WP13–16/18 |

### Every frozen invariant

| Reference | Frozen requirement | Required profiles | Current V2 proof |
|---|---|---|---|
| B01 | Post-commit commercial mutation uses one governed Order Change boundary. | P01,P10 | Missing; baseline reuse evidence only |
| B02 | Create Order remains separate from Order Change. | P01,P14 | Missing; baseline reuse evidence only |
| B03 | Commitment is irreversible. | P01,P10 | Missing; baseline reuse evidence only |
| B04 | committed_at is the commitment source of truth. | P01 | Missing; baseline reuse evidence only |
| B05 | Workflow and commercial versions are independent. | P02 | Missing; baseline reuse evidence only |
| B06 | One successful Change increments edit_state_version exactly once. | P02 | Missing; baseline reuse evidence only |
| B07 | Preview never mutates. | P03 | Missing; baseline reuse evidence only |
| B08 | Apply is atomic. | P02 | Missing; baseline reuse evidence only |
| B09 | Apply is idempotent. | P02 | Missing; baseline reuse evidence only |
| B10 | Existing committed item IDs remain stable. | P04 | Missing; baseline reuse evidence only |
| B11 | Existing committed piece IDs remain stable. | P04 | Missing; baseline reuse evidence only |
| B12 | Existing preference IDs remain stable. | P05 | Missing; baseline reuse evidence only |
| B13 | Product ID is not order-line identity. | P04 | Missing; baseline reuse evidence only |
| B14 | Piece sequence is not piece identity. | P04 | Missing; baseline reuse evidence only |
| B15 | No product replacement operation exists. | P04 | Missing; baseline reuse evidence only |
| B16 | Adding a piece increases quantity. | P04 | Missing; baseline reuse evidence only |
| B17 | Removing a piece decreases quantity. | P04 | Missing; baseline reuse evidence only |
| B18 | All configurable preference kinds use generic preference operations. | P05 | Missing; baseline reuse evidence only |
| B19 | PIECE preferences retain order -> item -> piece hierarchy. | P05,P10 | Missing; baseline reuse evidence only |
| B20 | Server is authoritative for money. | P03,P06 | Missing; baseline reuse evidence only |
| B21 | Existing pricing/tax/discount engines are reused. | P06 | Missing; baseline reuse evidence only |
| B22 | Existing financial aggregation/snapshot logic is reused. | P07 | Missing; baseline reuse evidence only |
| B23 | Historical payment/voucher facts are immutable. | P07,P10 | Missing; baseline reuse evidence only |
| B24 | Commercial delta is not a payment/refund instruction. | P07 | Missing; baseline reuse evidence only |
| B25 | Overpayment is derived from financial state. | P07 | Missing; baseline reuse evidence only |
| B26 | Additional collection may use Payment Modal V4. | P08,P14 | Missing; baseline reuse evidence only |
| B27 | Overpayment uses a focused Financial Resolution capability. | P08,P14 | Missing; baseline reuse evidence only |
| B28 | Issued fiscal facts are not rewritten. | P07,P08 | Missing; baseline reuse evidence only |
| B29 | Current semantic workflow engine is reused, not duplicated. | P09 | Missing; baseline reuse evidence only |
| B30 | Hard-coded whole-order editability is not V2 authority. | P09,P11 | Missing; baseline reuse evidence only |
| B31 | Tenant isolation is enforced server-side. | P10 | Missing; baseline reuse evidence only |
| B32 | External calls are outside the core Change transaction. | P02,P13 | Missing; baseline reuse evidence only |
| B33 | org_order_edit_history is legacy/compatibility only for V2. | P13 | Missing; baseline reuse evidence only |
| B34 | New Order must remain working through every migration phase. | P01,P14 | Missing; baseline reuse evidence only |
| B35 | Customer identity is immutable post-commit in V1. | P10,P11 | Missing; baseline reuse evidence only |
| B36 | Branch change is prohibited/deferred in V1; no V1 setting or override enables reassignment. | P10,P11 | Missing; baseline reuse evidence only |
| B37 | Cancellation/Return/Issue/Stop remain separate business workflows. | P09,P10 | Missing; baseline reuse evidence only |
| C36 | No monolithic Edit policy table in V1. | P11 | Missing; baseline reuse evidence only |
| C37 | No duplicate Pricing, Tax, Finance, Delivery, Notification or RBAC configuration is created for Edit Order. | P06,P07,P08,P11,P13 | Missing; baseline reuse evidence only |
| C38 | Workflow commercial-operation policy replaces hard-coded editable-status arrays as V2 authority. | P09 | Missing; baseline reuse evidence only |
| C39 | Per-order Edit blocking is order state, not tenant configuration. | P12 | Missing; baseline reuse evidence only |
| C40 | Missing sensitive commercial-operation policy fails closed. | P09,P11 | Missing; baseline reuse evidence only |
| C41 | `orders:edit` and `orders:edit_override` are separate permissions. | P09,P10,P11 | Missing; baseline reuse evidence only |
| C42 | Price override reuses `pricing:override`. | P06,P10,P11 | Missing; baseline reuse evidence only |
| C43 | Additional-due policy remains Finance-owned. | P07,P08 | Missing; baseline reuse evidence only |
| C44 | Overpayment disposition remains Finance-owned. | P07,P08 | Missing; baseline reuse evidence only |
| C45 | Issued fiscal-document behavior remains Tax/Fiscal-owned. | P07,P08 | Missing; baseline reuse evidence only |
| C46 | Customer identity reassignment is not configurable in V1; it is denied. | P10,P11 | Missing; baseline reuse evidence only |
| C47 | Branch reassignment is not configurable in V1; it is denied/deferred. | P10,P11 | Missing; baseline reuse evidence only |
| C48 | Generic maker/checker or amount-threshold Edit approval is deferred. | P09,P11 | Missing; baseline reuse evidence only |
| C49 | Edit V2 uses its own rollout flag and never repurposes B12 `order_fin_governed_amendments`. | P11 | Missing; baseline reuse evidence only |
| C50 | UI consumes server-resolved capabilities and never becomes the policy authority. | P11,P14 | Missing; baseline reuse evidence only |
| C51 | Apply revalidates material policy/calculation inputs and requires re-review on material drift. | P03,P09,P11 | Missing; baseline reuse evidence only |
| V3A | Every persisted business behavior must trace to DB/API/service/UI/test or an explicit non-UI owner. | P01,P04,P05,P06,P07,P09,P10,P13,P14 | Missing; baseline reuse evidence only |
| V3B | Missing required configuration fails closed or uses only a documented frozen default. | P11 | Missing; baseline reuse evidence only |
| V3C | Open decision gates are release blockers for dependent modes, not permission for developer guessing. | P11 | Missing; baseline reuse evidence only |
| V3D | Enabled cohorts cannot retain an ungoverned committed commercial write bypass. | P01,P10,P11 | Missing; baseline reuse evidence only |

### Every living-plan scenario

The scenario names below reconcile the current living plan Part 9; no superseded Scenario Matrix is used. Additional risk proofs are mapped afterward.

| Scenario | Required profiles | Specific assertion | Current V2 proof |
|---|---|---|---|
| S01 Uncommitted draft edit | P01,P14 | Change denied; Create still works | Missing / not run |
| S02 Committed unpaid add | P04,P06,P07,P14 | stable new ref; outstanding rises; no payment | Missing / not run |
| S03 Committed unpaid remove | P04,P07,P13 | logical descendants; historical UUIDs; outstanding falls | Missing / not run |
| S04 Quantity increase/decrease | P04,P09,P14 | exact eligible pieces; protected denial; no trim | Missing / not run |
| S05 Add/remove piece | P04,P05 | quantity plus/minus one; sequence not reused; parent valid | Missing / not run |
| S06 ORDER preference | P05,P06 | all generic kinds; additive exactly once | Missing / not run |
| S07 ITEM preference | P05,P06 | same-product line target; embedded extra once | Missing / not run |
| S08 PIECE preference | P05,P10,P14 | order-item-piece hierarchy; row UUID and generic kind | Missing / not run |
| S09 Paid20 to total15 | P07,P08 | payment20 immutable; overpayment5; no automatic refund | Missing / not run |
| S10 Paid10 to total20 | P07,P08 | outstanding10 and approved collection policy | Missing / not run |
| S11 Paid20 to total25 | P07,P08 | outstanding5; original payment type unchanged | Missing / not run |
| S12 Stored-value funded | P07,P08 | wallet/gift/advance/credit lineage and restoration caps | Missing / not run |
| S13 Split tender | P07,P08 | source-qualified resolution; no duplicate source spend | Missing / not run |
| S14 B2B AR | P07,P08,P10 | issued unsupported state denied or proper correction; no posted invoice rewrite | Missing / not run |
| S15 Quick Drop detailing | P01,P04,P09,P14 | valid zero detail context; committed Preparation uses Change | Missing / not run |
| S16 Workflow changes while editing | P02,P09,P14 | actual opposite lock order; conflict no merge | Missing / not run |
| S17 Another Change applies | P02,P14 | one winner per expected version; loser no writes | Missing / not run |
| S18 Idempotent retry | P02,P14 | exact response; one Change/outbox/revision; durable replay after cache expiry | Missing / not run |
| S19 Idempotency conflict | P02,P10 | same key changed payload denied; no new revision | Missing / not run |
| S20 Temporary block | P09,P12,P14 | expiry re-evaluates policy; block arrives between Preview/Apply | Missing / not run |
| S21 Permanent block | P10,P12 | no expiry/override/reopen loophole | Missing / not run |
| S22 Split restriction | P02,P04,P09 | Change then split and reverse; preserve IDs/history/preferences | Missing / not run |
| S23 Customer identity | P10,P11,P14 | snapshot correction only; picker locked; crafted identity denied | Missing / not run |
| S24 Branch/currency change | P10,P11,P14 | read-only; crafted foreign branch/currency denied | Missing / not run |
| S25 Cancel/Return/Issue | P01,P02,P09 | separate owner; races deny stale capability | Missing / not run |
| S26 Refund fails after Change | P07,P08,P14 | Change retained; separate refund rollback/recovery | Missing / not run |


Additional living-plan proofs: Preview purity→P03; Apply atomicity→P02; calculation equality/catalog drift/unchanged prices/nonzero adjustment/inclusive-exclusive/precision/promotion usage→P03/P06; payment/refund/credit race and fiscal/AR corrections→P07/P08; active/history readers→P04/P05/P13; every commercial writer closure→P01/P10/P11; target hierarchy/direct Data API/RPC/proof spoofing/CSRF/body limits→P09/P10; outbox/source lineage/no duplicate cash postings→P08/P13; EN/AR/RTL/a11y/typed-money→P14. No financial, security or migration test layer is substituted by mocked controller tests.

### Current test evidence and honest coverage limits

On 2026-10-02 the five imported WP01 suites passed **44 tests**, **0 snapshots**, Jest **1.514 s**. This verifies WP01 substantial progress without declaring WP01.5 DONE:

| Current file under web-admin | Tests/proof | Limit |
|---|---|---|
| `__tests__/api/v1/orders/submit-order.route.test.ts` | 13 actual POST cases: CSRF/permission/schema, tenant/actor derivation, replay/errors | Infrastructure/idempotency/services mocked; no real DB/RLS/HTTP server |
| `__tests__/services/order-submit-orchestrator.protection.test.ts` | 13 actual orchestrator cases: same supplied transaction, domain failure propagation, split/pending settlement, preferences, promo/AR calls | Domain writers/calculation mocked; callback failures do not prove PostgreSQL rollback |
| `__tests__/services/order-submit-orchestrator.unpaid-balance.test.ts` | 5 actual orchestrator gift/remainder/AR/failure cases | No persisted credit/AR cap or Finance concurrency proof |
| `__tests__/features/orders/new-order-integration.test.ts` | 9 actual schema cases; former expect(true) placeholders are gone | Name does not make schema tests DB/browser integration |
| `__tests__/services/order-service.edit-boundary.test.ts` | 4 actual legacy update boundary/sentinel cases | Physical replacement is characterized, not an accepted V2 behavior |

A scoped 15-suite run passed **170 tests**, **0 snapshots**, Jest **5.396 s**. It included the above five plus new-order-reducer, order-edit-dirty, order-editability, order-amendment.service, order-calculation.service, order-financial-aggregation, workflow-gate-decision.service, order-preference-charge-recalc.service, utils/idempotency and use-order-submission.price-override. This exact current selection is not claimed to reproduce the historic 15-suite/178-test selection, whose progress attachment is absent from the active pack.

Command (web-admin): `npm test -- --runInBand` followed by the five WP01 file paths above; extended command adds the ten baseline paths under `__tests__/features/orders/`, `__tests__/lib/utils/`, `__tests__/services/`, and `__tests__/utils/` as named above. See the temporary final validation report for the exact full command.

Changed-file ESLint for the five suites and `__tests__/helpers/order-submit-harness.ts` passed. A TypeScript compiler API program with strict=true, current ES2017 target and these six entry files reported zero diagnostics in the six files, but 79 dependency diagnostics; this is **not** a clean strict project check. Normal `npm run typecheck` failed in `app/actions/fx/converter-actions.ts:55`, `lib/services/fx/fx-decimal.ts` (ES2017 BigInt), `lib/services/tenants.service.ts:230` (subscription currency), and `src/features/notifications/ui/whatsapp-template-settings.tsx:99` (RHF union). These are current compilation gates, not Edit runtime changes.

The price-override fixture test constructs its own mapped payload (`use-order-submission.price-override.test.ts:6`); it does not invoke the hook and cannot prove controller/route preservation. `db-integration/order-amendment-governed-flow.db.test.ts:101` mocks calculation and `:158` silently returns when DB/demo fixtures are absent. Its green result must not count as executed concurrency/RLS or V2 Apply proof. This DB suite was not run in this review.

`e2e/new-order.spec.ts:45` builds a draft and opens payment workbench; it does not submit/verify a committed order. `e2e/preferences.spec.ts:43` accepts zero edit buttons and `:60` asserts only that visibility is boolean. Those assertions cannot prove preference save/identity/permission behavior. No V2 Playwright spec exists in the reviewed e2e folder; no browser, DB fixture, RLS, migration, concurrency, load or full-suite execution occurred. No frontend/runtime edits were made, so no build is claimed by this documentation review. Key parity, green baseline mocks and old ledger text do not satisfy P01–P14 release acceptance.
