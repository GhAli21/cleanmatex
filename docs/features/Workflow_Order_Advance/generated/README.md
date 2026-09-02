# Generated workflow policy issue catalog

These files are a **pinned copy** of the HQ catalog. Do not edit them by hand.

| File | Role |
|------|------|
| `wf-policy-issue-catalog.json` | Machine contract for tenant seed CI |
| `GENERATED_WF_POLICY_ISSUE_CATALOG.md` | Human table of emitted + planned codes |

**Writer:** `cleanmatexsaas/platform-api` → `npm run catalog:generate`  
**Canonical TypeScript:** `cleanmatexsaas/platform-api/src/modules/workflow-engine-config/catalog/`  
**Maintain:** in HQ, load `/manage-wf-policy-issues-catalog` before any add/update/promote/demote/retire. Do not hand-edit these generated files.  
**Check:** `npm run check:wf-policy-issue-catalog` in this tenant repo

Narrative situations stay in `../future_work_in_wf/01_HQ_STUDIO_VALIDATION_GAPS.md`.  
Planned-code discussion stays in `../future_work_in_wf/02_HQ_STUDIO_ISSUE_CODE_SPEC.md` (not the emit registry).
