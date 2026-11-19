# Archive Migration Reference

## 1. Doc Status Marker — Shared Vocabulary

Any skill that judges a doc non-canonical (`/documentation-audit`, `/documentation-canonicalization`) writes one line directly under the doc's H1 title:

```markdown
**Doc Status:** <value> — <one-line reason>, flagged <YYYY-MM-DD> by <source skill>
```

Only the `**Doc Status:**` prefix has to be exact — that's what keeps discovery a single grep (`grep -rn "^\*\*Doc Status:\*\*" docs/`). The `<value>` can be whichever of these synonyms reads naturally; they're grouped below by the action this skill takes:

| `<value>` (any of these — same meaning) | Action taken |
|---|---|
| `Archive Candidate`, `Legacy`, `Superseded`, `Historical` | Move to `history/` or a dated `_archive/` sweep (§3) |
| `Redirect-Stub`, `Needs Redirect Stub` | Replace content with the redirect-stub template (§2) at the *same* path — not relocated |
| `Supporting` | Informational only — leave in place, no action |

This mirrors `/documentation-canonicalization`'s existing outcome taxonomy (`canonical` / `supporting` / `legacy` / `redirect-stub` / `archive-candidate`) one-to-one, so a canonicalization classification maps straight onto a marker value with no translation needed.

## 2. Redirect Stub Template

```markdown
# <Original Title> (Legacy)

**Status:** Replaced — do not treat as active source of truth.
**Canonical replacement:** `<path/to/canonical/doc.md>`

<One or two sentences of historical context, only if still useful for traceability.>
```

Keep it to this shape — status, canonical path, optional context. Nothing else.

## 3. Where Archived Material Goes

Two patterns already exist in this repo. Match the legacy doc to one of them — do not invent a third.

**A. Per-feature `history/` folder** — e.g. `docs/features/003_customer_management/history/`
- Use when the material is specific to one feature/domain and should stay discoverable alongside that feature's pack.
- Needs a `README.md` in the `history/` folder indexing what's there and why.
- Leave a redirect stub (template above) at the old location pointing into `history/`.

**B. Dated top-level sweep** — `docs/_archive/<YYYY-MM>/<category>/` (e.g. `docs/_archive/2026-01/old-plans/`, `.../duplicate-docs/`, `.../progress-tracking/`)
- Use for repo-wide cleanup passes touching many unrelated docs at once, not a single feature.
- Categories are freeform folder names describing the doc type being retired — check existing categories under `docs/_archive/<latest-YYYY-MM>/` before inventing a new one.
- Log the sweep in a `REORGANIZATION_SUMMARY.md` inside the dated folder: date, objective, files moved per category, counts.

## 4. Moving Files

Use `git mv` (or `git add` the new path + `git rm` the old one in the same commit) rather than delete-and-recreate, so blame/history survives the move. This is what keeps archived docs traceable.

## 5. When To Archive

Good archive candidates:

- completed session notes with no ongoing operational value
- outdated PRDs superseded by canonical feature packs
- duplicate summaries whose facts now live elsewhere

## 6. Index Hygiene

After migration:

- feature lookup files should point to the canonical docs
- `docs/README.md` and helper maps should stop advertising legacy locations as active
- Limit backlink search to `docs/` and the specific feature folder(s) involved — do not grep the wider repo for references
