# Canonicalization Reference

## 1. Candidate Scoring Rubric

Score each candidate:

- implementation alignment: `0-3`
- current-truth accuracy: `0-3`
- pack completeness: `0-2`
- naming clarity: `0-1`
- future maintainability: `0-1`

Highest score usually wins.

## 2. Decision Rules

Prefer, in order:

1. implemented reality
2. current active maintenance
3. stable domain naming
4. pack-shaped structure
5. fewer broken assumptions

## 3. Folder Outcomes

Every candidate should end in one state:

- `canonical`
- `supporting`
- `legacy`
- `redirect-stub`
- `archive-candidate`

Each non-canonical state maps 1:1 to a `**Doc Status:**` marker value of the same name (see `/documentation-archive-migration` reference.md §1). Write it into the file as part of classification (reference.md §6, step 5), not only in your report.

## 4. Redirect Stub Minimum Content

Include:

- this location is no longer canonical
- canonical replacement path
- whether remaining material is historical only

## 5. Red Flags

Treat these as signs that a folder should probably not be canonical:

- mostly session notes
- numbered PRD folder with no current status
- title no longer matches implemented scope
- duplicate workflow docs elsewhere with fresher facts

## 6. Safe Next Step After Canon Selection

1. mark winner
2. mark loser states
3. update indexes
4. add redirect stubs
5. migrate useful content selectively
6. hand off execution: `archive-candidate`/`redirect-stub` folders → `/documentation-archive-migration`; remaining gaps in the winning folder → `/documentation-pack-repair`

## 7. Where `archive-candidate` Actually Lands

This skill only classifies and marks — it does not move files. `/documentation-archive-migration` discovers marked files (`Archive Candidate`, `Legacy`, or `Superseded` — see its reference.md §1 for the full synonym list) and executes against one of two real repo patterns:

- per-feature `history/` folder (e.g. `docs/features/003_customer_management/history/`) for domain-specific legacy material
- dated top-level sweep `docs/_archive/<YYYY-MM>/<category>/` for repo-wide cleanup passes

Don't propose a third folder shape when recommending an `archive-candidate` outcome.
