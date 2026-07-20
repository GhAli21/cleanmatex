# CleanMateX Order Finance Remediation Rules

These rules apply to all files inside this `Remediation_Work_Packages` folder.

No need for maker-checker in approve even same user can approve if he have the required permission.

## Current stage

We are currently planning and reviewing.

Do not implement application code, migrations, APIs, frontend components, or tests unless the user explicitly asks to implement a specific Bxx work package.

## Planning files are editable

All README, Dxxx decision files, Bxx work-package files, dependency maps, and capability-bundle files in this folder are active planning documents.

Modify the existing related files directly when:

* correcting a finding;
* improving a decision;
* resolving a contradiction;
* changing scope;
* updating dependencies;
* adding missing backend, API, frontend, permission, audit, or test requirements;
* correcting links;
* changing the implementation sequence.

Do not create unnecessary duplicate files or addenda when the existing planning files can be updated.

## Update all affected files

When changing a rule or design, update every related planning file so there are no contradictions.

For example, a refund-policy change may require updating:

* the relevant Dxxx decisions;
* B01;
* B02;
* B09;
* README.md;
* the Refund Lifecycle bundle;
* dependencies and implementation sequence.

Do not update only one file and leave the others inconsistent.

## Approval

Do not invent formal approval.

Keep these separate:

```text
Recommended decision
Approved decision
```

Use:

```text
Approved decision: NOT YET APPROVED
```

until the user explicitly approves it.

Do not invent:

* approver;
* owner;
* approval date;
* reviewer;
* implementation commit;
* verification result.

## Full-cycle planning

For every user-facing or operator-facing capability, include all applicable parts:

* backend service and business logic;
* database effects;
* API or endpoint;
* validation;
* permissions;
* frontend page, screen, dialog, tab, action, or reusable component;
* loading, empty, error, retry, success, and disabled states;
* i18n and RTL;
* accessibility;
* audit trail;
* observability;
* jobs or workers;
* idempotency and concurrency;
* unit, integration, API, database, UI, reconciliation, accounting, and regression tests;
* rollout and rollback.

For an internal-only package, state:

```text
Frontend surface: NOT_APPLICABLE
Reason:
Existing consumer:
Operational visibility:
```

Do not create unnecessary UI for internal refactoring.

## Scope

Keep each Bxx package focused on its own responsibility.

Do not silently merge unrelated work packages.

Related packages may reference each other and may be grouped into capability bundles.

A single Bxx package must not make an entire capability `PRODUCTION_READY`.

## Safety

UI design may be planned before backend fixes are complete.

Do not mark production UI activation as allowed when it would expose a known financially incorrect backend.

State:

```text
UI design allowed:
UI implementation allowed:
Production activation allowed:
Required backend gates:
```
## Release and promotion (owner rule, 2026-07-16)

Every implementation commit follows this promotion path — no exceptions for financial packages:

```text
commit
→ deploy to Preview
→ QA executes the package's test/QA checklist on Preview
→ QA finished AND owner approval recorded
→ promote to production
```

Rules:

* nothing goes to production directly from a commit;
* a package may not be marked `VERIFIED` before its Preview QA is finished and approved;
* production feature-flag activation (Safety blocks) additionally requires the recorded Preview QA approval;
* rollback must be exercised or provably executable on Preview before production promotion;
* record the Preview deployment, QA result, and approval in the package's `Completion evidence`.

## Working discipline (owner rules, 2026-07-16)

1. **Progress after every task:** after each task (not only package boundaries), update the plan progress and statuses — the owning Bxx file, the master index row, and `RESUME_CONTINUATION.md` when the next action changes. Stale status is a defect.
2. **Documentation after every package:** when a package finishes implementation and its Preview QA, update/create/refresh all related documentation before the package may be marked `VERIFIED` — feature docs (permissions, navigation, settings, flags, i18n keys, API routes, migrations, constants, env vars), STATUS docs, and user/developer guides. Use the `/documentation` skill for the pack.
3. **Skills before code, always:** load the related skills properly before writing in each domain — `/database` (SQL/migrations), `/backend` (services/APIs), `/frontend` (UI), `/i18n` (translations/RTL), `/multitenancy` (org_* access), `/implementation` (features), `/navigation` (nav dual-write), `/testing`, `/documentation`. Code written without the domain skill loaded must be re-verified against it.
4. **Never ignore the project CLAUDE.md** (`F:\jhapp\cleanmatex\CLAUDE.md`): follow its CRITICAL RULES, use the required skills and agents per task type, read the rule docs it references. **UI reusability:** always use existing Cmx reusable components (`@ui/*` per `web-admin/.clauderc`); when an element will appear in 2+ places, create a reusable Cmx component instead of duplicating markup.
5. **Production-grade only:** follow best practices with no gaps and no bugs — full-cycle delivery, UI/UX best practices (state contract, accessibility, EN/AR + RTL), validated inputs, idempotent money paths, honest error reporting. "Works on the happy path" is not done.
6. **Manual QA guide — ALWAYS keep it current (owner rule, 2026-07-18):** [`QA_TEST_GUIDE.md`](QA_TEST_GUIDE.md) is a living manual-test document the owner runs. **After implementing ANY package (or a scoped change to one), you MUST add/refresh its QA scenarios in this guide** — before reporting the package done. Each scenario must be **owner-runnable and explain HOW/WHERE**: the sidebar path + URL + what to click/enter (see its §0.1 Screen map), then Expected → Result. Cover new screens, actions, flags, permissions, and any DB/config prerequisites. Updating this guide is part of the per-package "done" definition, alongside the Bxx file + master index + `RESUME_CONTINUATION.md` + memory updates.

## Required sections in every Bxx work package

Every Bxx file must include:

```text
## Delivery surfaces

Backend services:
Database/schema:
API/endpoints:
Frontend page/screen/dialog/action:
Reusable components/helpers:
Permissions:
Validation:
i18n/RTL:
Accessibility:
Audit trail:
Observability:
Jobs/workers:
Feature flag:
Rollout:
Rollback:
```

For every user-facing or operator-facing capability, also include:

```text
## End-to-end operational flow
```

Describe the complete flow from opening the page or action through API validation, backend execution, database and financial effects, snapshot/reconciliation updates, user feedback, audit, and failure recovery.

For a truly internal package, use:

```text
Frontend page/screen/dialog/action: NOT_APPLICABLE
Reason:
Existing consumer:
Operational visibility:
Failure detection:
Recovery method:
```

Do not use vague statements such as:

```text
Frontend as needed
API if required
Tests later
```

Identify the actual or proposed service, endpoint, page, screen, dialog, action, helper, permission, and test surface wherever possible.

## Statuses during planning

Normally use:

```text
DRAFT
PROPOSED
UNDER_REVIEW
DECISION_REQUIRED
NOT_STARTED
READY_FOR_DESIGN
BLOCKED
DEFERRED
```

Do not use `IMPLEMENTED`, `VERIFIED`, or `PRODUCTION_READY` unless implementation and verification actually occurred.

## Before implementation

A Bxx package may become `READY_FOR_IMPLEMENTATION` only when:

* required decisions are approved;
* scope and out-of-scope are clear;
* dependencies are satisfied;
* backend and frontend applicability are covered;
* acceptance criteria are testable;
* required tests are defined;
* rollout and rollback are defined;
* the user explicitly authorizes implementation of that package.

## Validation after every planning change

Before finishing, verify:

* related files were updated;
* decision and work-package content agrees;
* dependencies are correct;
* statuses are consistent;
* backlog and decision numbering are consistent;
* capability bundles are updated;
* backend/API/frontend scope is covered;
* internal packages justify frontend non-applicability;
* Markdown links work;
* no application code was modified.

Do not report the planning update as complete while contradictions or broken links remain.
