# Live Normalized Workflow Profile Runtime - Tenant Contract

This tenant contract implements HQ [ADR-SAAS-MNG-0010](F:/jhapp/cleanmatexsaas/docs/features/SAAS_Platform_Management/ADRs/ADR-SAAS-MNG-0010_Live_Normalized_Workflow_Profile_Runtime.md).

## Runtime rule

For every operational order command, `WorkflowPolicyResolver` loads the order's
stored `wf_profile_id`, `wf_profile_version_id`, and `wf_version_no` from
normalized profile-version tables. It returns module ownership, executable
actions/channels/gates, initial rules, operational switches, and fulfilment
evidence requirements. The result is server-derived and tenant-scoped.

The resolver must not read compiled artifacts, graph pins, templates, action
maps, screen contracts, screen memberships, or global catalog rows as policy
fallback.

## Assignment and live-order rule

Changing a tenant profile assignment changes only orders created afterwards.
Existing orders keep their profile/version binding, including an order that is
currently awaiting QA, packing, pickup, or delivery. Therefore a tenant that
switches from a QA profile to a non-QA profile does not bypass QA for existing
orders.

Pilot versions are editable for controlled end-to-end testing. An edit applies
to test orders already bound to that Pilot version. Published versions remain
locked; production changes require a new version and a new-order assignment.

## Ownership and fulfilment rule

An ordinary stage action may execute only on its source-status owner. The narrow
V1 exception is direct counter pickup: `pickup_handover` may execute
`CONFIRM_PICKUP` from observed `ready` only when the profile explicitly declares
that observer membership and direct pickup edge. It must use the same locked
collection, evidence, fulfilment, order transition, audit, and idempotency
transaction as staged pickup. Observers never receive general execution rights.

Partial pickup or delivery is enabled only when the corresponding stage-owned
service can atomically validate selected pieces, financial/evidence gates,
fulfilment records, status transition, and audit. A configured but unavailable
partial service fails policy validation; it is never ignored at runtime.

## Service rule

No screen, mobile application, public page, or integration writes workflow
status directly. Stage-owned command services remain the only writers and use
the resolved live policy plus transaction-locked order facts.

Legacy action maps, screen contracts, templates, and catalog transition mappings
may only be consumed by HQ's explicit starter-template import. They are not
tenant runtime fallback data.

## Migration gate

Draft migration `0470_live_normalized_workflow_profile_runtime.sql` has not been
applied. Before review/application, correct and database-test its ownership
guard for the explicit direct-counter pickup allow case and all other observer
execution reject cases. The tenant repository owns the migration; apply it only
after the coordinated plan review and local acceptance sequence.
