
Yes. We can simplify substantially without losing production discipline.

I recommend this redesigned model:

- Keep policy in **normalized live profile-version tables** only: modules, status ownership, actions, gates, initial rules, fulfilment evidence, and assignments.
- Remove compiled JSON artifacts, checksums, graph snapshots, graph validation, and database RPC-based compiler/commit flows.
- Runtime loads the assigned `profile_id + version_no` directly from these live tables through one reusable `WorkflowPolicyResolver` service.
- Keep API/service boundaries. Screens, mobile, and integrations call the same action services; they never query tables or change status directly.
- Keep database foreign keys, unique constraints, audit records, and optimistic `policy_revision` locking. These are simple safety controls, not compilation complexity.

The important lifecycle becomes:

```text
DRAFT -> PILOT -> PUBLISHED -> RETIRED
```

- `DRAFT` and `PILOT` are editable.
- A Pilot can be assigned to a test tenant and the actual runtime reads its live rows, exactly as production would.
- `PUBLISHED` is locked for safety and auditability. To change it, clone to a new Draft/Pilot version.
- Assignment changes affect new orders only.
- Orders retain their assigned profile/version. If a Pilot version is edited, its existing Pilot orders see the live change. This is acceptable for controlled test tenants, but not for published production versions.

The simplified runtime rule is:

```text
Order -> assigned profile version -> live normalized policy rows -> available action/gates -> atomic stage service
```

No JSONB policy authority. No artifact loading. No global action-map or screen-contract fallback.

The UI also becomes much simpler:

1. Profile Basics
2. Stages and screen ownership
3. Actions and gates
4. Pickup and delivery rules
5. Test in Pilot
6. Publish
7. Assign to tenant

Replace “Compile” with **Check policy**: a normal service validation that checks missing references, duplicate actions, invalid ownership, and fulfilment requirements from the live tables. It does not create an artifact or freeze JSON.

One boundary must remain: multi-table policy saves still need an application transaction, such as a NestJS/Prisma transaction. Removing RPC functions is fine; removing transactions is not. Otherwise partial saves could leave a profile with modules saved but actions missing.

This is the best balance for your current development phase: much easier to operate, relational and readable, while still safe enough for real production once published versions are locked. I recommend stopping further compiler/artifact work and formally redesigning the HQ and CleanMateX contracts around this live normalized-policy resolver before more implementation.

The redesign needs to supersede the compiled-artifact architecture, not coexist with it. We should first approve one clean cross-project contract, then replace the runtime in controlled slices.

## Cross-Project Feature: Live Workflow Profile Policy Runtime

### `cleanmatex` tenant app
- Runtime: replace artifact loading with one tenant-safe `WorkflowPolicyResolver` that loads the order’s assigned `wf_profile_id + wf_version_no` from normalized profile-version tables.
- Services: keep all stage, payment, pickup, delivery, gate, audit, idempotency, and concurrency services unchanged; they receive the resolved live policy.
- Database: retain normalized semantic policy tables and profile/version assignment fields. Do not add JSONB policy authority or new RPC functions.
- Migrations: assess only missing relational constraints/indexes and then create forward-only migrations here. Existing artifact fields/tables become deprecated read-only data first, not abruptly dropped.
- Existing orders: retain their profile/version reference. Published versions are immutable, so their policy stays reproducible. Pilot edits intentionally affect Pilot orders using that same version in test/demo tenants.

### `cleanmatexsaas` HQ
- Studio: simplify to `Basics`, `Stages`, `Actions & Gates`, `Fulfilment`, `Test Pilot`, `Publish`, and `Assignments`.
- Replace Compile with **Check policy**: a normal service validation of live relational rows. It returns clear errors but creates no artifact, checksum, graph snapshot, or JSON document.
- Lifecycle: `DRAFT` and `PILOT` editable; `PUBLISHED` and `RETIRED` locked. A published change requires a new version.
- Assignment: continues to affect new orders only and is updated in place without a gap.
- Backend: use normal application transactions for multi-table saves. No profile compiler RPCs or artifact commit RPCs.

### Shared rules
- Global catalogs remain vocabulary and validation input only, never runtime decision data.
- Runtime reads only profile-version normalized tables, never legacy action maps, screen contracts, graph pins, templates, or JSONB.
- Each command still evaluates live order facts for payments, pieces, QA, POD, collection, and gates.
- Authentication, tenant isolation, audit logs, optimistic revision checks, idempotency, and service-layer APIs remain mandatory.

The main tradeoff is deliberate: editing a `PILOT` version changes the live policy for test orders using that Pilot version. That is simpler and matches your desired iterative testing. Published versions remain immutable, so real production orders do not change behavior unexpectedly.

I will next create a replacement ADR and cross-project migration/cutover plan, then update both repositories in stages. No code or migration has been changed for this redesign yet.
