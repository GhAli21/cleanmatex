# Expert production decision — rename vs additive

**Date:** 2026-07-24  
**Decision:** **Additive V1.0** — do **not** execute the plan “Rename map”.

## Why (production / no-gaps)

| Approach | Risk | Verdict |
|----------|------|---------|
| Mass rename `sys_workflow_template_*`, screen contracts, settings | Breaks Enhanced RPCs, Prisma, reports, mobile; needs dual-read + coordinated deploy; blocks canary | **Reject for V1.0** |
| Additive `sys_wf_*` runtime catalogs + engine + flag | Expand-only; rollback = flag off; legacy tables remain seed sources | **Ship** |

Rename-for-prefix (`sys_workflow_template_cd` → `sys_wf_template_cd`) does not improve correctness. Runtime authority is new catalogs; templates may seed later without rename.

Optional later: expand→contract rename as hygiene after writers=0 and readers migrated — never a go-live gate.

## Production activation order

1. Review/apply `0427` + `0428`
2. Run `scripts/workflow/check_sys_wf_graph.sql` (zero rows = pass)
3. Seed HQ flag `workflow_engine_v2` (cleanmatexsaas) — catalog entry already in tenant `FLAG_CATALOG`
4. Canary: env `WORKFLOW_ENGINE_V2=true` **or** HQ tenant override
5. Client CTAs: `NEXT_PUBLIC_WORKFLOW_ENGINE_V2=true` for `WorkflowActionBar` / prep complete path
6. Sign remote discovery SQL

## UX contract locked

- Floor: **action buttons only** (`WorkflowActionBar`) — no raw `toStatus` picker
- Labels EN/AR from `sys_wf_actions_cd`
- Blocked actions show gate reasons (not silent disable)
- `cmxMessage` for success/error
