---
version: v1.0.0
last_updated: 2026-11-12
author: CleanMateX Team
---

# ERP Lite — Module Rules

Single home for standing rules specific to the ERP Lite module (naming, governance, posting, scope boundaries, etc.). Add new ERP-Lite-only rules here as a new dated entry instead of scattering them across chat history or one-off docs. Rules that apply repo-wide (not ERP-Lite-specific) still belong in the root `CLAUDE.md`/`AGENTS.md`, not here.

This file is reference material, not a duplicate source of truth: where a rule also lives in a skill or `CLAUDE.md`, this entry links to it and states only the ERP-Lite-specific delta.

---

## 1. Database & identifier naming — `erplt` marker

**Status:** Active · **Since:** 2026-11-12

Every **new** identifier owned by ERP Lite must carry the literal token `erplt`, so it reads as ERP Lite at a glance and is never confused with unrelated same-named concepts elsewhere in the codebase (e.g. Order Fin's own `fin` usage).

- **DB objects:** `{scope}_erplt_{sub_feature}_{object_name}_{suffix}`, e.g. `org_erplt_fin_acct_mst`, `org_erplt_exp_petty_cash_mst`, `org_erplt_ap_supplier_mst`, `org_erplt_fin_calculate_total()`, `org_erplt_fin_active_journals_vw`. Sub-feature abbreviations: `fin` (COA/journals/posting/GL), `exp` (expenses), `pty` (petty cash), `bank` (bank core & reconciliation), `sup` (supplier master), `ap` (AP docs/PO/AP payments), `cst` (cost allocation/runs).
- **Non-DB identifiers:** permission codes (`erplt_fin:read`, not bare `fin_vouchers:create`), feature flag keys (`ERPLT_FIN_ENABLED`), route segments/folder names, i18n namespaces, TS constant files.
- **Not retroactive:** existing objects/identifiers created before this rule are grandfathered and are **not** bulk-renamed — only rename one if you're already touching it for another reason, as its own reviewed change. Known grandfathered examples: DB objects from migrations `0175`–`0203` (e.g. `org_fin_acct_mst`), the `fin_vouchers:*` permission codes, the `erp_lite` nav key, the `erpLiteGovernance` i18n namespace (HQ side).
- **Authoritative source:** `cleanmatex` repo — `.claude/skills/database/conventions.md` → "ERP Lite Module Marker", `.claude/skills/database/feature-abbreviations.md` → "ERP Lite" entry; mirrored in `CLAUDE.md`, `AGENTS.md`, and the `.codex`/`.agents`/`.cursor` copies of those same files. HQ (`cleanmatexsaas`) mirrors this for platform-side identifiers in its own `CLAUDE.md`/`AGENTS.md` (Critical Rule #15) and must still mirror DB-origin values from this repo exactly.

---

## How to add a new rule here

1. Add a new `##` section, most recent at the bottom (or re-order by topic if the list grows — keep it scannable either way).
2. Give it a **Status** (`Active` / `Superseded` / `Deprecated`) and **Since** date.
3. State the rule, the reason, and what's grandfathered/excluded if it isn't fully retroactive.
4. Link to the authoritative skill/CLAUDE.md section rather than re-stating the full rule text if it already lives there — keep this file as the ERP-Lite-specific index, not a second copy that can drift.
