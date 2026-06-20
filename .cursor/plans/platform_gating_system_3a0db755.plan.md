---
name: Platform Gating System
overview: "Phased delivery of /rebuild-platform-info-inventories — all phases in scope; after each phase update this plan's status and pause for your review before continuing."
todos:
  - id: phase-1-bootstrap
    content: "Phase 1 — Bootstrap: schema, ingest adapters (JSON + *-access.ts + navigation.ts), bootstrap missing extracts, first platform-info-inventory.json"
    status: completed
  - id: phase-2-orchestrator
    content: "Phase 2 — Orchestrator: rebuild script (ingest/extract-delta/full/validate), extend extractors multi-surface, GENERATED_GATE_MATRIX + DRIFT_REPORT"
    status: completed
  - id: phase-3-reconcile-ci
    content: "Phase 3 — Reconcile + CI: KNOWN_EXCEPTIONS seed, delta-only validate, Jest tests, root npm scripts, CI warn then fail-on-new-drift"
    status: completed
  - id: phase-4-skill-docs
    content: "Phase 4 — Skill + docs: /rebuild-platform-info-inventories skill suite, CLAUDE/AGENTS invoke section, cross-skill blocks, Cursor rule, docs hub"
    status: completed
  - id: phase-5-views-help
    content: "Phase 5 — Views + Help UI: all GENERATED_*.md slices, Help API route + /dashboard/help/platform-inventories, shield link"
    status: completed
  - id: phase-6-hardening
    content: "Phase 6 — Hardening: first rebuild-all repair pass, shrink allowlist, implementation_requirements template, PR template"
    status: completed
isProject: false
---

# Rebuild Platform Info Inventories — Phased Plan (All Phases Now)

## Execution protocol (mandatory during implementation)

Every phase follows the same gate:

```text
1. Implement phase scope only
2. Run phase validation commands
3. Update THIS plan file — set phase todo status + Phase Status table below
4. STOP — ask you: "Review Phase N output, or continue to Phase N+1?"
5. Continue only after you approve
```

**Do not skip review gates.** Do not start the next phase in the same turn unless you explicitly say **continue**.

---

## Phase status (updated during implementation)

| Phase | Name | Status | Validated | Review gate |
|-------|------|--------|-----------|-------------|
| 1 | Bootstrap ingest + schema | `completed` | `npm run docs:ingest-platform-info` — 79 contracts, 231 perms, 290 flags catalog | 2026-06-19 |
| 2 | Orchestrator + extractors | `completed` | `npm run rebuild:platform-info-inventories` — 235 perms (216 API), 74 flag usages, GENERATED_GATE_MATRIX.md | 2026-06-20 |
| 3 | Reconcile + CI + Jest | `completed` | `npm run check:platform-info-inventories` — 9 known drift, 139 contracts, 0 new drift | 2026-06-20 |
| 4 | Skill + documentation wiring | `completed` | Skill suite + CLAUDE/AGENTS invoke section + 6 cross-skill blocks + Cursor rule | 2026-06-20 |
| 5 | Generated views + Help UI | `completed` | `rebuild:platform-info-inventories` — 6 GENERATED slices; Help UI + API; `check:platform-info-inventories` pass | 2026-06-20 |
| 6 | Hardening + first repair pass | `completed` | Drift 9→5; strict CI validate; registry ordering fixed; PR template + maintenance runbook | 2026-06-20 |

---

## North star

**One skill + smart scripts** rebuild **platform info inventories** from real code and data already collected — for Help review, docs, and one-place inspection. **No dashboard layout blocker.**

**Authority ladder (single source hierarchy):**

1. **Runtime truth** — code (API, nav, services enforce)
2. **Declarative** — `*-access.ts`, `navigation.ts`, DB seeds, `FLAG_CATALOG`
3. **Merged inventory** — `docs/platform/inventories/platform-info-inventory.json` (**commit to git**)
4. **Human views** — `GENERATED_*.md` (script-only; never hand-edit)
5. **Legacy docs** — link to GENERATED; header: *maintained by rebuild script*

---

## Skill: `/rebuild-platform-info-inventories`

**Not** in mandatory preload table. **Conditional invoke** with mode + scope (see Phase 4).

**Agent-facing modes (3 top-level + scope details):**

| Mode | Use | Scope examples |
|------|-----|----------------|
| `refresh` | Scoped rebuild | `surface=page\|api\|service\|…`, route, path, flagKey, permissionCode |
| `repair` | Fix drift then re-run | items from DRIFT_REPORT |
| `rebuild-all` | Full pipeline | optional reason |
| `validate-only` | CI / pre-push | — |

Detailed surface scopes (`page`, `api`, `service`, `server_action`, `navigation`, `feature-flag`, `permission`, `plan-limit`, `plan-constraint`, `settings`) live in `references/invoke-protocol.md` as **Scope fields**, not separate agent modes.

**RBAC:** new permission codes → **`/create-update-rbac-permission`** only (not `/update-rbac-role`).

---

# Phase 1 — Bootstrap ingest + schema

**Goal:** First usable `platform-info-inventory.json` without full code rescan when extracts exist.

### Deliverables

- [`docs/platform/inventories/`](docs/platform/inventories/) folder + `README.md` stub
- JSON schema v1 in [`scripts/docs/inventories/schema.ts`](scripts/docs/inventories/schema.ts) (or shared types file)
- [`scripts/docs/ingest/`](scripts/docs/ingest/):
  - `ingest-extracted-json.ts` — permissions, settings, feature-flags JSON
  - `ingest-access-contracts-ts.ts` — parse `src/features/*/access/*.ts` (**primary declarative source**)
  - `ingest-navigation-ts.ts` — parse `config/navigation.ts`
  - `ingest-catalog-constants.ts` — `FLAG_CATALOG`, `plan-flags.ts`
  - `normalize.ts` + `index.ts`
- **Bootstrap step:** if `extracted-*.json` missing → auto-run existing `npm run docs:extract-*` before ingest
- Output: [`platform-info-inventory.json`](docs/platform/inventories/platform-info-inventory.json) with `schemaVersion`, `generatedAt`, `gitSha`, `sources[]`, `provenance` per row
- **Defer to Phase 2:** markdown table parse of `all_contract-aligned_UI_Permissions.md` (brittle); use TS contracts instead

### Phase 1 validation

```bash
npm run docs:extract-permissions
npm run docs:extract-feature-flags
npm run docs:extract-settings
tsx scripts/docs/ingest/index.ts
# Assert platform-info-inventory.json exists and has non-empty permissions + accessContracts
```

### Phase 1 review gate

Update Phase Status table → ask: **Review Phase 1 JSON output, or continue to Phase 2?**

---

# Phase 2 — Orchestrator + multi-surface extractors

**Goal:** Single command runs full pipeline; permissions/flags tagged by surface (screen, api, service, server_action, navigation, hook, workflow, middleware).

### Deliverables

- [`scripts/docs/rebuild-platform-info-inventories.ts`](scripts/docs/rebuild-platform-info-inventories.ts) subcommands:
  - `ingest`, `extract-delta`, `reconcile`, `generate-views`, `full`, `validate`
- Extend [`extract-permissions.ts`](scripts/docs/extract-permissions.ts), [`extract-feature-flags.ts`](scripts/docs/extract-feature-flags.ts):
  - Surface tagging; patterns: `RequireFeature`, `FLAG_KEYS`, `useFeature`, `usePlanFlags`, `requireFeature`, `canAccess`
  - Still write legacy JSON paths for backward compat
- New: [`extract-plan-limits-usage.ts`](scripts/docs/extract-plan-limits-usage.ts)
- [`generate-inventory-views.ts`](scripts/docs/generate-inventory-views.ts) — v1: `GENERATED_GATE_MATRIX.md` only
- Root [`package.json`](package.json): `"rebuild:platform-info-inventories": "tsx scripts/docs/rebuild-platform-info-inventories.ts full"`

### Phase 2 validation

```bash
npm run rebuild:platform-info-inventories
# Assert GENERATED_GATE_MATRIX.md created
```

### Phase 2 review gate

Update Phase Status table → ask: **Review orchestrator + gate matrix, or continue to Phase 3?**

---

# Phase 3 — Reconcile + CI + Jest

**Goal:** Drift visible; CI does not block entire repo on legacy gaps — only **new** drift.

### Deliverables

- [`scripts/docs/reconcile-platform-info-inventories.ts`](scripts/docs/reconcile-platform-info-inventories.ts):
  - Compare declarative (`*-access.ts`, nav) vs code scans
  - Emit [`DRIFT_REPORT.md`](docs/platform/inventories/DRIFT_REPORT.md), `GENERATED_UNDOCUMENTED.md`, `GENERATED_ORPHANS.md`
- [`KNOWN_EXCEPTIONS.json`](docs/platform/inventories/KNOWN_EXCEPTIONS.json) — seeded from **first full reconcile** (campaigns flag, voucher matrix, etc.)
- Validate: **fail on new drift** not in allowlist (store baseline hash or compare to committed DRIFT_REPORT)
- [`web-admin/__tests__/auth/platform-inventories.test.ts`](web-admin/__tests__/auth/platform-inventories.test.ts):
  - Route coverage (extend existing)
  - No duplicate `routePattern`
  - Static-before-dynamic routes
  - Optional: nav↔contract parity (warn in test name until allowlist clean)
- [`package.json`](package.json): `"check:platform-info-inventories": "tsx scripts/docs/rebuild-platform-info-inventories.ts validate && npm run check:access-contracts --workspace=web-admin"`
- [`.github/workflows/ci.yml`](.github/workflows/ci.yml): add `check:platform-info-inventories` (Phase 3: **warn** on drift count; Phase 6: **fail** on new drift)

### Phase 3 validation

```bash
npm run rebuild:platform-info-inventories
npm run check:platform-info-inventories
```

### Phase 3 review gate

Update Phase Status table → ask: **Review DRIFT_REPORT + allowlist, or continue to Phase 4?**

---

# Phase 4 — Skill suite + documentation wiring

**Goal:** Agents and humans know **when** to invoke (not preload); scripts remain source of truth.

### Deliverables

- [`.claude/skills/rebuild-platform-info-inventories/`](.claude/skills/rebuild-platform-info-inventories/) + [`.codex/skills/rebuild-platform-info-inventories/`](.codex/skills/rebuild-platform-info-inventories/)
  - `SKILL.md`, `references/*`, `checklists/*`, `invoke-protocol.md`, `script-orchestrator.md`
- Deprecate aliases in old [`rebuild-ui-access-contract/SKILL.md`](.codex/skills/rebuild-ui-access-contract/SKILL.md) → pointer to new skill
- [`CLAUDE.md`](CLAUDE.md) + [`AGENTS.md`](AGENTS.md): section **Platform info inventories — when to invoke** (trigger table + mode/scope format)
- Cross-skill blocks in: `/frontend`, `/implementation`, `/backend`, `/navigation`, `/database`, `/create-update-rbac-permission`
- [`.cursor/rules/rebuild-platform-info-inventories.mdc`](.cursor/rules/rebuild-platform-info-inventories.mdc) — conditional triggers only
- Update [`docs/platform/README.md`](docs/platform/README.md), [`Extract_Details.md`](docs/platform/Extract_Details.md)
- [`docs/platform/inventories/README.md`](docs/platform/inventories/README.md) — authority ladder + file index

### Phase 4 validation

- Skill files present; CLAUDE section readable; no duplicate mandatory preload row

### Phase 4 review gate

Update Phase Status table → ask: **Review skill + CLAUDE wiring, or continue to Phase 5?**

---

# Phase 5 — Full generated views + Help UI

**Goal:** One-place runtime review under Help; shield links to Help viewer.

### Deliverables

- Full [`generate-inventory-views.ts`](scripts/docs/generate-inventory-views.ts) output:
  - `GENERATED_FEATURE_FLAGS.md` + BY_API / BY_SERVICE / BY_SCREEN slices
  - `GENERATED_PERMISSIONS.md`
  - All files under `docs/platform/inventories/`
- Legacy docs link to GENERATED (headers only; no duplicate tables):
  - [`FEATURE_FLAGS_USAGE.md`](docs/platform/feature_flags/FEATURE_FLAGS_USAGE.md)
  - [`PERMISSIONS_BY_SCREEN.md`](docs/platform/permissions/PERMISSIONS_BY_SCREEN.md)
- **Help UI:**
  - [`/dashboard/help`](web-admin/app/dashboard/help/page.tsx) — Platform Inventories card
  - [`/dashboard/help/platform-inventories`](web-admin/app/dashboard/help/platform-inventories/page.tsx) — tabs, search/pagination (no full JSON dump)
  - API: `GET /api/dev/platform-inventories` — reads committed JSON; dev/admin gated in v1
  - i18n: `help.platformInventories.*` en + ar
  - [`core-access.ts`](web-admin/src/features/core/access/core-access.ts) contract for help sub-route
- **Shield** ([`cmx-top-bar.tsx`](web-admin/src/ui/navigation/cmx-top-bar.tsx)):
  - Route-scoped slice from inventory
  - Link: "View full inventory in Help →"

### Phase 5 validation

```bash
npm run rebuild:platform-info-inventories
cd web-admin && npm run build
```

### Phase 5 review gate

Update Phase Status table → ask: **Review Help UI + generated views, or continue to Phase 6?**

---

# Phase 6 — Hardening + first repair pass

**Goal:** Shrink drift; CI fails on new issues; templates complete.

### Deliverables

- **Repair pass** (via skill `repair` mode): fix top drift items:
  - Campaigns: `CAMPAIGNS_ENABLED` in [`marketing-access.ts`](web-admin/src/features/marketing/access/marketing-access.ts)
  - Reconciliation: nav vs [`core-access.ts`](web-admin/src/features/core/access/core-access.ts)
  - Any other high-signal items from DRIFT_REPORT
- Shrink [`KNOWN_EXCEPTIONS.json`](docs/platform/inventories/KNOWN_EXCEPTIONS.json) where fixed
- CI: switch validate to **fail on new drift** (not warn-only)
- [`.github/pull_request_template.md`](.github/pull_request_template.md): skill mode + scope + check passed
- [`implementation_requirements.md`](docs/features/_templates/implementation_requirements.md): invoke line after gating sections
- Optional ingest: plan-flag mappings from migration seeds; workflow screens export (document gaps if not done)
- [`docs/dev/platform-inventories-maintenance.md`](docs/dev/platform-inventories-maintenance.md) — quarterly `rebuild-all` runbook

### Phase 6 validation

```bash
npm run rebuild:platform-info-inventories
npm run check:platform-info-inventories
cd web-admin && npm test
```

### Phase 6 review gate

Update Phase Status table → all phases `completed` → ask: **Final review of full system?**

---

## Out of scope (all phases)

- `/update-rbac-role` integration
- Dashboard layout runtime blocker
- Full cmx-api extract (pointer doc only)
- Big-bang migration of all inline permission literals to contract reads
- Committing generated files: **in scope** — JSON + GENERATED md **are committed** for PR diff + Help UI

---

## Success criteria (end of Phase 6)

1. `npm run rebuild:platform-info-inventories` ingests existing data then delta-scans code
2. `platform-info-inventory.json` is merged source; committed to git
3. Permissions/flags discoverable by **surface** (api, service, screen, …)
4. Help section hosts read-only inventory browser with search
5. DRIFT_REPORT + delta-only CI (new drift fails)
6. Skill orchestrates scripts; conditional invoke documented everywhere
7. Shield links to Help; route-scoped live view
8. First repair pass completed; allowlist minimal and documented

---

## How to start implementation

Say: **"go ahead — start Phase 1"**

After each phase, the agent will update the **Phase status** table in this file and wait for your **review or continue** before proceeding.
