# Documentation Audit Reference

## 1. Audit Modes

- `presence-audit`: required files exist or not
- `structure-audit`: naming, lookup, and folder layout
- `quality-audit`: stale facts, contradictions, broken routing, misleading status

Start with the lightest mode that answers the user request.

## 2. Recommended Tiering

- `near-complete`: `1-2` missing files
- `partial`: `3-8` missing files
- `major-gaps`: `9+` missing files

## 3. Suggested Metrics

- total folders audited
- complete packs
- missing `README.md`
- missing testing guides
- missing status/progress docs
- folders with `technical_docs/`
- folders with lookup files

## 4. Common Risks To Call Out

- duplicate domains
- PRD-heavy folders acting like active truth
- missing testing docs
- no status snapshot
- no development plan
- stale indexes

## 5. Good Audit Output Shape

- one short summary
- one compact tier table or bullet grouping
- one recommended execution order
