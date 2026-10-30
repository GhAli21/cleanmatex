# Order payment performance enhancement

Version: 1.1.1. Review date: 2026-10-24. Status: awaiting the user's future implementation request and mandatory current-system revalidation; no new application improvement selected yet.

This folder is the implementation-planning home for the next Payment Modal V4 performance increment. It covers the shared New/Edit payment flow in the Organization app. It does not replace the existing [V4 architecture](../Payment_Modal_Review/Payment_Modal_v4_Engine_Architecture.md) or the [coordinated-quote implementation record](../Payment_Modal_Review/Payment_Modal_v4_Quote_Performance.md).

The objective is to reduce avoidable work and improve perceived opening speed while preserving current tenant isolation, verified currency, payment eligibility, money-entry behavior, and transactional submission checks. No speed figure in this pack is a measured production result.

## Start here

Before implementing or resuming, recheck the changed system and revise this plan under Step 0. Earlier findings and candidate tasks are not automatically current after related system work.

- [Tester handoff guide](tester-handoff-guide.md) and [editable results log](tester-results.md): run one measured improvement at a time and record the engineer's response and stop/continue decision.
- [Implementation plan](implementation_plan.md): active baseline/change/test/decision loop, with detailed candidate workstreams retained for evidence-backed selection.
- [Performance coding rules](performance-coding-rules.md): implementation requirements for scoped reuse, concurrency, caching, financial correctness, UI, measurement and review.
- [Development sequence](development_plan.md): execution order and change boundaries.
- [Findings and proposal assessment](technical_docs/findings_and_proposal_assessment.md): what is verified, already implemented, conditional, or inaccurate in the supplied suggestions.
- [Decisions and risks](decisions_and_risks.md): mandatory choices, open questions, and controls.
- [Current status](current_status.md) and [progress summary](progress_summary.md): distinguish existing work from pending enhancements.

## Implementation and acceptance references

- [Developer guide](developer_guide.md) and [technical flows](developer_guide_mermaid.md).
- [Financial snapshot contract](technical_docs/financial_snapshot_contract.md).
- [Testing guide](testing_guide_and_scenarios.md).
- [Observability and benchmarking](technical_docs/observability_and_benchmarking.md).
- [Deployment and rollback](deploy_guide.md).
- [Cashier guide](user_guide.md) and [cashier flow](user_guide_mermaid.md).
- [Changelog](CHANGELOG.md) and [version](version.txt).

## Separate deferred proposals

Each item has its own scope, prerequisites, implementation approach, tests, and release boundary:

- [D01 Shared settings cache](deferred/D01_shared_settings_cache.md).
- [D02 Set-based settings resolver](deferred/D02_set_based_settings_resolver.md).
- [D03 Batch pricing](deferred/D03_batch_pricing.md).
- [D04 Speculative quote prefetch](deferred/D04_speculative_quote_prefetch.md).
- [D05 Local JWT verification](deferred/D05_local_jwt_verification.md).
- [D06 Permission claims and shared caching](deferred/D06_permission_claims_and_caching.md).
- [D07 Authoritative permission batching](deferred/D07_authoritative_permission_batching.md).
- [D08 Rollout flag and automatic rollback](deferred/D08_rollout_flag_and_automatic_rollback.md).
- [D09 Operational-state events](deferred/D09_operational_state_events.md).

## Boundaries

Execution follows the agreed small-improvement loop: select the next change from measured evidence, retest, and stop when agreed performance and correctness criteria are met. The phase list and deferred proposals are a roadmap, not a requirement to implement every item.

Initial phases require no new database objects, navigation entries, permission codes, plan limits, packages, environment variables, or shared cache service. A newly discovered requirement for one changes that phase's scope and must be documented before implementation. Database proposals are deferred; no migration has been created or applied for this documentation task.

Settings and platform flag policy remain owned by HQ (the SaaS Backoffice). Database migrations remain owned by this repository. Existing legacy service access is a compatibility fact, not permission to introduce new direct `sys_stng_*` or feature-flag table reads.

The previous successful-quote browser run was blocked by missing base currency and POS session in its local fixture. Those are recorded historical observations, not a fresh configuration audit. See [current status](current_status.md) before accepting any runtime claim.
