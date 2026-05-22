# AR Invoice v1 — Implementation Status

**Feature:** AR Invoice v1  
**Location:** `cleanmatex` only  
**Primary UI area:** `web-admin/app/dashboard/internal_fin/invoices` + `web-admin/app/dashboard/internal_fin/ar/*`  
**Canonical header table:** `public.org_invoice_mst`  
**Status:** In Progress  
**Last Updated:** 2026-05-22

## Summary

This tracker records implementation progress for the AR Invoice v1 rollout. It is the operational companion to the approved docs pack in [CleanMateX_Full_AR_Invoice_Docs_Pack](./CleanMateX_Full_AR_Invoice_Docs_Pack).

Implementation rules:

- all DB work is additive only through new migrations
- migrations are created here but never applied by the assistant
- `org_invoice_mst` remains the canonical AR invoice header
- Business Voucher remains the canonical money-movement source
- every tenant-scoped read/write must enforce `tenant_org_id`
- every phase update must refresh this file and the related feature docs

## Phase Tracker

| Phase | Scope | Status | Notes | Updated |
|---|---|---|---|---|
| 1 | Data assessment and rollout design | Completed | Repo-derived current-state assessment documented in `PHASE_1_DATA_ASSESSMENT.md` and rollout decisions captured | 2026-05-22 |
| 2 | Schema, permissions, and navigation migrations | In Progress | Sequential migrations drafted as `0313`–`0316`; pending review and downstream implementation alignment | 2026-05-22 |
| 3 | Constants, types, and validation | Not Started | Canonical AR statuses/types/actions, DTOs, Zod schemas, report models | — |
| 4 | Service layer | Not Started | AR invoice, allocation, adjustment, ledger, aging, and statement services | — |
| 5 | API layer | Not Started | `/api/v1/ar/*` routes with explicit permission checks | — |
| 6 | UI and access contracts | Not Started | Expanded invoice hub, AR screens, nav updates, i18n, access contracts | — |
| 7 | Reports, statements, and notifications | Not Started | Aging, customer statement, outbox events, reminder-ready hooks | — |
| 8 | Validation and hardening | Not Started | Tests, i18n check, build, tenant isolation review, permission review | — |
| 9 | Documentation closure | Not Started | Final docs sweep using documentation standards | — |

## Current Decisions

| Decision | Chosen Value | Why |
|---|---|---|
| Route strategy | Extend `internal_fin` | Minimizes churn and reuses existing invoice pages/services |
| Overpayment policy | Store as customer credit | Needed for real AR workflows and later allocation |
| Sensitive-doc control | Controlled approval | Standard invoices direct; credit/debit/write-off/void require elevated approval |
| AR aging source | Shared finance read model | Avoids parallel AR calculation logic |
| Invoice numbering | DB sequence function | Replaces count-based issuance for new AR flows |

## Deliverables Checklist

- [x] Phase 1 assessment doc updated
- [x] Cleanup migration created
- [x] Header upgrade migration created
- [x] Supporting AR tables migration created
- [x] Permission seed migration created
- [x] Navigation seed migration created
- [ ] AR constants/types/Zod added
- [ ] AR services added
- [ ] AR API routes added
- [ ] AR UI routes/screens added
- [ ] Access contracts updated
- [ ] Permissions docs updated
- [ ] EN/AR messages updated
- [ ] Validation commands green

## Risks And Watchpoints

- existing invoice flows still use lowercase legacy statuses in code; AR v1 must avoid breaking them during migration
- current invoice numbering is count-based in legacy services and must be isolated from new sequence-based issuance
- `web-admin/messages/en.json` and `web-admin/messages/ar.json` already contain local edits and need careful merge-safe updates
- invoice pages currently have weak page-level access contracts and require explicit hardening during AR rollout
