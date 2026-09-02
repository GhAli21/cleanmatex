# Semantic profile assurance

**Superseded for live runtime:** use [live_runtime_assurance.md](live_runtime_assurance.md). This file records the compiled-artifact assurance slice and is not V1.0 runtime law.

Automated coverage for the tenant semantic-profile runtime. This is not the
staff S10 operator/e2e canary.

## What is proven

| Concern | Evidence |
|---------|----------|
| Artifact identity | Loader uses `artifact_id` + checksum from the order snapshot and rejects missing or mismatched compiled rows |
| Snapshot incompleteness | Profile/version pins without compiled identity fail closed; unsnapshotted historic orders remain legacy |
| Assignment precedence | Branch beats tenant default; equal-specificity conflicts fail closed; mixed service snapshots require a split |
| Pilot vs PUBLISHED | Pinned PILOT is allowed only when `org_tenants_mst.is_hq_test_demo` is true; latest-assignment still selects PUBLISHED |
| Forged screen/channel | Runtime adapter returns no edge for a public-only command on `staff_web` or an action on a non-owner screen |
| Gate/evidence policy | Shared evaluator tests cover hard-block facts; unsupported OTP/partial/return remain fail closed |
| HTTP integrity | `PROFILE_SNAPSHOT_INCOMPLETE`, `PROFILE_ARTIFACT_UNAVAILABLE`, `PROFILE_ARTIFACT_INVALID`, and `PROFILE_EXECUTION_INVALID` map to HTTP `409` on stage, actions, transition, pickup, preparation, delivery complete, and available-actions |

## Development-order recreation

New orders under an active assignment stamp the compiled artifact identity at
create time. Historic in-flight rows that have only `wf_profile_id` /
`wf_version_no` fail closed and must be completed on a true unsnapshotted
legacy path or recreated after HQ publishes a compiled profile.

Reassignment in HQ does not rewrite in-flight snapshots. The loader never
consults the current assignment.

## Observability and rollback

- Typed `PROFILE_*` codes on command APIs; workflow-context already returned `409`.
- Graph-pin loader remains in-repo as an audit record and is not on the execute path.
- Rollback of this slice is a code revert of the HTTP mapper and tests; it does not require a migration.

## Residual (not this slice)

- Operator/e2e staff POD delivery smoke **S10** (`p7-harden`)
- Performance soak under concurrent commands
- Visual accessibility / RTL review of unavailable-state UI
- HQ/tenant cross-project close-out docs
