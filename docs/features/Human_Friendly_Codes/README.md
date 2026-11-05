# Human-Friendly Codes (HFC)

**Status:** CLOSED — `0666`–`0689` applied (`0687`–`0689` on 2026-11-01); P11 follow-ups code done, `0690` not applied yet; waiting for user apply, deploy and QA (Asia/Muscat). Version: see [`version.txt`](./version.txt).

Human-Friendly Codes replace UUIDs on screens, labels, receipts, scans and messages with short, readable, unique codes such as `ORD-20261031-0001`, `ORD-20261031-0001-S1`, piece codes `ORD-…-1-2` and store credit notes `SCN-2026-000001`. One database engine (`fn_doc_seq_next`) issues every GENERAL code; HQ manages and checks the configuration; tenant apps print, scan and show the codes.

## Start here

| You are | Read |
|---|---|
| Anyone (status) | [`current_status.md`](./current_status.md), [`progress_summary.md`](./progress_summary.md) |
| Developer | [`developer_guide.md`](./developer_guide.md), [`developer_guide_mermaid.md`](./developer_guide_mermaid.md), [`DEV_GUIDE_DOC_SEQ_ENGINE.md`](./DEV_GUIDE_DOC_SEQ_ENGINE.md) |
| Staff / admin user | [`user_guide.md`](./user_guide.md), [`user_guide_mermaid.md`](./user_guide_mermaid.md), [`USER_GUIDE_LABELS.md`](./USER_GUIDE_LABELS.md), [`SCAN_AND_PIECE_CODES.md`](./SCAN_AND_PIECE_CODES.md) |
| Whoever applies / deploys | [`deploy_guide.md`](./deploy_guide.md) → `DEV_GUIDE_DOC_SEQ_ENGINE.md` §22 APPLY_RUNBOOK |
| QA | [`testing_guide_and_scenarios.md`](./testing_guide_and_scenarios.md), [`QA_TEST_GUIDE.md`](./QA_TEST_GUIDE.md) |
| Reviewer | [`IMPLEMENTATION_REPORT.md`](./IMPLEMENTATION_REPORT.md), [`IMPLEMENTATION_PLAN_Human_Friendly_Codes.md`](./IMPLEMENTATION_PLAN_Human_Friendly_Codes.md), [`PROPOSAL_Human_Friendly_Codes.md`](./PROPOSAL_Human_Friendly_Codes.md) |

## Folder contents

- Plan and design: `IMPLEMENTATION_PLAN_Human_Friendly_Codes.md` (live status §1, decisions §20), `PROPOSAL_Human_Friendly_Codes.md`, `development_plan.md` (short phase view).
- Reports: `IMPLEMENTATION_REPORT.md` (full report), `progress_summary.md`, `current_status.md`, `CHANGELOG.md`, `version.txt`.
- Guides: `developer_guide.md`, `developer_guide_mermaid.md`, `DEV_GUIDE_DOC_SEQ_ENGINE.md`, `user_guide.md`, `user_guide_mermaid.md`, `USER_GUIDE_LABELS.md`, `SCAN_AND_PIECE_CODES.md`, `deploy_guide.md`.
- Testing: `testing_guide_and_scenarios.md`, `QA_TEST_GUIDE.md`.
- Reference: [`technical_docs/`](./technical_docs/README.md) → `INVENTORY.md`, `DOMAIN_CODES_REGISTRY.md`, `ORDER_NUMBERING.md`, `PERMISSIONS.md`.

## Related

- HQ repo pointer: `cleanmatexsaas/docs/features/human-friendly-codes/README.md`.
- Architecture decision: `cleanmatexsaas/docs/Dev/ADRs/ADR-004-human-friendly-codes-shared-doc-seq-engine-api-based-sharing-pattern.md`.
