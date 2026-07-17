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
