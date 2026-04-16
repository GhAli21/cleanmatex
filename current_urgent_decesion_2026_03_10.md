# Current Urgent Decision - 2026_03_10

APPROVAL_STATUS: APPROVED
APPROVED_BY: Jehad
APPROVED_AT: 10-03-2026

## Purpose

This file captures documentation and consolidation decisions that need user approval before they are treated as confirmed project direction.

Fill in your choices, change `APPROVAL_STATUS` to `APPROVED` when you are satisfied, and then the approved choices can be used as governing direction for the ongoing documentation refresh.

## Decision 1: Canonical Planning Authority

### Current Situation

The repository currently has two overlapping planning areas:

- `docs/plan/`
- `docs/plan_cr/`

Both act like planning authorities, and both contain a `master_plan_cc_01.md` file or equivalent master-planning role.

### Why This Matters

Without a single planning authority:

- feature docs can point to different plan sources
- PRDs can drift from implementation at different rates
- future documentation updates can keep duplicating effort

### Options

- Option A: `docs/plan/` is the canonical planning authority; `docs/plan_cr/` becomes backlog or archive material over time
- Option B: `docs/plan_cr/` is the canonical planning authority; `docs/plan/` becomes legacy or high-level archive material
- Option C: split responsibilities formally
  - `docs/plan/` = high-level roadmap and approved master plans
  - `docs/plan_cr/` = working PRD backlog and draft planning material

### Recommendation

Option C is the safest short-term path because it avoids destructive reclassification while giving the documentation refresh a clear rule.

### Your Decision

Chosen option: Option C

Reason: follow your Recommendation

Additional constraints: Update their files and put the all updated to `docs/plan/` and no need to have `docs/plan_cr/`, actually those folders I created in the beginning when I create plans using claude ai I put in `docs/plan/` and the plans created by cursor ai I put in `docs/plan_cr/`

## Decision 2: Historical Files Inside Active Feature Folders

### Current Situation

Several active feature folders contain historical residue such as:

- session summaries
- progress snapshots
- implementation-complete notes
- old subfolders
- duplicate planning notes

### Why This Matters

Leaving historical files mixed into active feature folders makes it harder to know which documents are current.

### Options

- Option A: move historical material into `docs/_archive/` and keep active folders lean
- Option B: keep historical material inside each feature folder, but clearly relabel it under a dedicated `history/` subfolder
- Option C: hybrid approach
  - major historical material moves to `docs/_archive/`
  - feature-local history that still has operational value stays in a dedicated local `history/` subfolder

### Recommendation

Option C is the most practical because it preserves useful feature-local history while still cleaning up the active working surface.

### Your Decision

Chosen option: Option C

Reason: Follow your Recommendation

Additional constraints: do the best practice 

## Decision 3: Documentation Depth For Reserved Or Lightly Implemented Areas

### Current Situation

Some top-level areas such as `cmx_mobile_apps/`, `packages/`, `infra/`, and `qa/` have little or no local documentation content today.

### Why This Matters

There are two valid documentation approaches:

- keep lightweight truthful placeholder docs until implementation grows
- write fuller forward-looking specs now

### Options

- Option A: keep these docs minimal and implementation-truthful until real module content exists
- Option B: expand them now with forward-looking planned scope and target structure

### Recommendation

Option A is the best fit for the current refresh goal because your direction is to align docs to already real implemented scope and keep them compatible and consolidated.

### Your Decision

Chosen option: Option A

Reason: follow your Recommendation

Additional constraints:

## Notes For Approval

- If you approve this file, the documentation refresh can use these choices as explicit project direction.
- If you leave it unapproved, I can continue with conservative best-practice assumptions, but any affected areas may need later correction.
