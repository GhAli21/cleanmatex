# CleanMateX Edit Order V2 — Open Decisions & Release Gates

**Version:** 3.0

A production-ready specification must expose unknowns instead of hiding assumptions. These gates do not invalidate the architecture; they block only dependent work packages/modes.

| Gate | Recommended direction | Must be resolved before |
|---|---|---|
| Target metadata versus runtime/data proof | Operator0547/0548 application verified on both:555 records/latest0549; exact WP02 columns/constraints/guards/comments/ACLs match SQL. Runtime authenticated/deferred rollback/data proof remains open. WP02 report section17 owns current evidence | real fixture verification, target backfill/cutover |
| Prisma schema/client reconciliation | CLOSED for scoped WP02 sync:75 additions,2 Change models and required relations/keys/index maps now in schema.prisma/generated Client6.19.3. Validation, deployed-introspection parity, focused TypeScript and21 migration contracts PASS;253 prior models/scalars preserved. SQL-owned runtime enforcement remains separate | schema/client sync prerequisite passed; WP03 still requires explicit approval and remaining gate disposition |
| Historical commitment source/timezone | source-by-source proof; unresolved legacy orders remain ineligible | historical V2 enablement |
| Commercial operation-policy binding storage | extend existing workflow/profile policy model; fail closed missing binding | capability completion / Apply enablement |
| New/changed line pricing context | preserve unchanged line facts; choose exact policy for new/changed lines after non-zero adjustment tests | calculation WP |
| Inclusive unit-price compatibility proof | Wording reconciled: inclusive selling amounts are gross; exclusive are pre-tax. Prove mode-correct calculation, legacy 10,3 storage quantization/range and currency precision | WP08/WP12 persistence |
| Preference extra-price compatibility proof | Accounting reconciled: ITEM/PIECE extras are in line totals; ORDER preference charges are separate. Prove exactly-once projection/cache/snapshot behavior | WP07/WP08 |
| Charge taxability | keep current non-taxable B18 behavior unless domain decision/config says otherwise | taxable charge support |
| Issued fiscal correction composition/precision | Finance/Fiscal-owned corrections; block unsupported states | paid/issued-doc Edit modes |
| B2B AR correction | use existing AR correction authority or deny unsupported issued state | B2B edited obligation |
| Finance resolution eligibility | finite source-qualified supported actions; no invented gateway automation | financial follow-up WP |
| Charge/discount correction operation vocabulary | define only operations required by actual committed writer closure | writer migration WP |
| Role mapping for new permissions | enumerate real current roles; explicit reviewed grants only | pilot |
| Membership-safe tenant and direct authority | Helper trusts user metadata; membership itself has permissive writes; broad existing grants/unguarded definer RPCs persist. WP02 new history denies ordinary roles but does not close existing membership/committed-writer authority. Security/preflight owns exact evidence | server authorization prerequisites, WP17/WP18; pilot |
| Immutable Change insertion | NEW0548 structurally uses preallocated UUID, exactly one complete immutable master insertion and deferred removal-lineage existence checks only; reference keys/RESTRICT actions remain immediate. Parser/static tests pass; real late-master/missing-master/rollback/ORM proof unrun | operator fixture review, WP11/WP12; WP18 proof |
| Active hierarchy versus Split/removal origin | Current Split changes item parent without descendants/nonatomically. Even future atomic transfer conflicts with removed descendants retained at origin under all-row parent FKs. Historical(id,tenant) strategy frozen; global hierarchy/shape SQL withheld, not merely NOT VALID | complete WP02 hierarchy contract; governed removal/Split activation; WP17/WP18 |
| Tracked-item quantity materialization | ADD_ITEM initial quantity plus ADD_PIECE increments and selected tracked reductions must be normalized exactly once; approve the operation catalog's required structural contract without changing frozen piece invariants | WP06 tracked flows |
| Bounded public DTOs/history | Freeze actual operation/body/nesting/note/proof/key/rate/page limits against supported sizing; strict schemas and history disclosure/permission contract required | WP04 before public WP10/WP12; WP15 history |
| Review signer and policy freshness | Existing workflow HMAC signer is reusable but has narrower binding and no key-ring rotation contract. Approve Change domain separation/expiry/rotation; qualify HQ/cache currentness and settlement-source fingerprint | WP05/WP10/WP12 |
| Finance source-lock protocol | Current order/payment/refund-first lock paths differ. Agree a deterministic common parent/source/voucher/drawer protocol and prove distinct-refund source caps and Change/Finance races | WP09/WP11/WP12/WP16; WP18 |
| Separate Finance endpoint contract | Living plan's additional-payment/financial-resolution paths remain proposed. Finalize Finance-owned DTOs, permissions, source caps, independent replay/status, required-collection holds and supported restoration/manual gateway modes | WP16 and affected modes |
| Event consumer and notification bridge | Freeze one exact registered Change token/handler and post-commit bridge to existing Notification Hub with Change-qualified deduplication; unknown Finance events are currently skipped as processed | WP11/WP19 |
| Operational budgets/support | Existing pack latency/availability figures are proposed, not verified platform SLOs. Approve measured lock/query/load/retention/retry/alert and support budgets | WP18/WP19 |
| Compilation and production proof | WP01 protection passes freshly; project typecheck still fails outside its tests, including current notification UI. Real V2 DB/migration/RLS/concurrency/browser/Finance proof is not implemented or run | WP01.5 completion; dependent validation and WP18/WP19 |
| Export consistency | Supplied DOCX/ZIP are reference snapshots. Regenerate/content-and-layout-verify from reconciled Markdown/CSV before distributing a refreshed pack | publication gate; not bounded WP02 preparation |

No coding agent may silently decide one of these and ship it as a default. The implementation PR/work package must either reference the approved decision or keep the dependent mode disabled/fail closed.
