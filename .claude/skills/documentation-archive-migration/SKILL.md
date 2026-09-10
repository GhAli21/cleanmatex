---
name: documentation-archive-migration
description: Convert outdated, duplicate, or non-canonical CleanMateX documentation into redirect stubs, support-only references, or archive-ready material. Use when legacy docs should stop acting like active truth and need a safe migration path that preserves discoverability.
---

# Documentation Archive Migration

Retire legacy docs safely, using the repo's existing archive patterns.

## Use This Skill To

- execute retirement for docs already flagged non-canonical by `/documentation-audit` or `/documentation-canonicalization`
- convert old docs into redirect stubs
- mark folders as legacy or historical
- prepare docs for archival without losing discoverability

## Discovery Signal: The Doc Status Marker

This skill does not judge staleness itself — it executes what `/documentation-audit` and `/documentation-canonicalization` already flagged. Discovery is one grep, not re-analysis:

```
grep -rn "^\*\*Doc Status:\*\*" docs/
```

Every flagged file carries a line: `**Doc Status:** <value> — <reason>, flagged <date> by <source>`. Several synonyms are recognized for the same meaning (`Legacy`, `Superseded`, `Historical`, `Archive Candidate` all trigger the same action). See [reference.md](./reference.md) §1 for the full vocabulary and the action each value maps to.

If a doc looks stale but carries no marker, don't act on your own judgment — route it to `/documentation-audit` or `/documentation-canonicalization` first so it gets classified and marked.

## Repo Archive Patterns (use these, don't invent new ones)

- **Per-feature `history/` folder** — e.g. `docs/features/003_customer_management/history/`. Use when the legacy material is domain-specific and should stay co-located with its feature pack. Needs a local `README.md` index and an archive-pointer redirect stub left at the old location.
- **Dated top-level sweep** — `docs/_archive/<YYYY-MM>/<category>/` (e.g. `docs/_archive/2026-01/old-plans/`). Use for repo-wide cleanup passes covering many unrelated docs at once; log the sweep in a `REORGANIZATION_SUMMARY.md` in that dated folder.

## Workflow

1. Grep `docs/` for the `**Doc Status:**` marker to build the candidate list (see reference.md §1 for recognized values). Unmarked "looks old to me" files are out of scope here — route them to `/documentation-audit` or `/documentation-canonicalization` instead of guessing.
2. Per candidate, sanity-check with `git log -1` that nothing meaningful has changed since it was flagged; drop anything that has back to "needs re-review" instead of moving it.
3. Branch by marker value: `Archive Candidate`/`Legacy`/`Superseded`/`Historical` → move; `Redirect-Stub` → convert content in place at the same path; `Supporting` → leave in place, informational only.
4. For anything being moved, confirm the canonical replacement exists. If unclear or contested, stop and use `/documentation-canonicalization`.
5. Pick the matching repo pattern above (feature `history/` vs dated `_archive/` sweep) rather than inventing a new folder shape.
6. Execute with `git mv` (not delete+recreate) so history/blame is preserved; write the redirect stub (template in reference.md §2) at the old path when the location may still be navigated to.
7. Update indexes (feature `README.md`/index files, `docs/README.md`) so active docs stop pointing at legacy locations.

## Guardrails

- Do not archive the only current source of truth.
- Do not delete context that is still useful for traceability unless explicitly requested.
- Prefer short redirect docs over silent removal.
- Do not author new canonical content from inside this skill — route new-doc work to `/documentation`.
- Search only within `docs/` and the specific feature area for backlinks/indexes to update — do not grep the wider repo.
- Only act on marked files (or files the user names explicitly in the current conversation) — do not independently decide a file is stale.

## Output Contract

Always report:

- canonical destination
- legacy items touched
- redirect/archive actions
- remaining cleanup still needed
