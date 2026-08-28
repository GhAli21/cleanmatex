# Live Normalized Workflow Profile Runtime - Tenant Contract

This tenant contract implements HQ [ADR-SAAS-MNG-0010](F:/jhapp/cleanmatexsaas/docs/features/SAAS_Platform_Management/ADRs/ADR-SAAS-MNG-0010_Live_Normalized_Workflow_Profile_Runtime.md).

## Runtime rule

For every operational order command, `WorkflowPolicyResolver` loads the order's
stored `wf_profile_id` and `wf_version_no` from normalized profile-version
tables. It returns module ownership, executable actions/channels/gates, initial
rules, and fulfilment evidence requirements. The result is server-derived and
tenant-scoped.

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

## Service rule

No screen, mobile application, public page, or integration writes workflow
status directly. Stage-owned command services remain the only writers and use
the resolved live policy plus transaction-locked order facts.
