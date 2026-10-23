# Line-Level Money Snapshot — STATUS

**Plan:** [PLAN.md](PLAN.md) · **Discussion:** [DISCUSSION.md](DISCUSSION.md)
**Overall:** APPROVED by owner 2026-10-23 (v2.1). In execution. No migration yet.

## Execution order (approved 2026-10-23)

Both plans run as one sequence, because they change the same files.

| Step | Work | Status |
|---|---|---|
| 1 | Security first: Reusable View BF-09, BF-16 (+ mobile detail route), BF-20 | ✅ Done 2026-10-23 |
| 2 | Combined Phase 0 of both plans + ADR-060 (no code) | ✅ Done 2026-10-23: [PHASE0_FINDINGS.md](PHASE0_FINDINGS.md), [ADR-060](../ADR/ADR-060-Line-Level-Commercial-Calculation.md) |
| 2b | Hotfix: PF-01 (price override not enforced on Create) + PF-04 (exempt orders taxed) | Next |
| 3 | Characterization tests on Create (this P1 = Reusable View P1B-01) | — |
| 4 | Reusable View Phase 1 bug fixes (BF-19 moves to this P5-03) | — |
| 5 | This P2–P6, then Reusable View P1B-04…12 | — |
| 6 | Reusable View P3+ (read model, component) | — |
| 7 | This P7–P8 (incl. HQ), then the releases of both plans | — |
**Downstream dependency:** Reusable Order Fin View Phase 1B builds on this plan (owner L13).

| Phase | Title | Release | Status | Notes |
|---|---|---|---|---|
| P0 | Discovery and ADR-060 | A | ✅ Done 2026-10-23 | 20 findings (PF-01…PF-20), plan changes C1–C14 (PLAN §21), 2 owner items (PLAN §20) |
| P1 | Freeze Create (characterization tests) | A | Not started | Owns Reusable View P1B-01 |
| P2 | Configuration DB (M1–M4) | A | Not started | Stop and wait after each; next seq 0638 |
| P3 | Line-money DB (M5–M7) | A | Not started | Stop and wait |
| P4 | Domain calculator (`lib/commercial/`, pure, decimal) | A | Not started | Owns and extends Reusable View P1B-03 |
| P5 | Services + Create | A | Not started | One writer |
| P6 | Order Edit V2 write parity | A | Not started | Same release as P5 |
| P7 | Configuration UI (tenant app) + HQ card | A | Not started | Nav dual-write, permissions, access contract |
| P8 | Readers + fiscal item lines | A | Not started | `org_tax_doc_items_dtl` (owner item §20-3) |
| P9 | PIECE level enablement | B | Not started | `PIECE` disabled in HQ until P9-01 |
| P10 | Recompute, tighten (M10), drop (M11) | A / C | Not started | |
| P11 | Verification and docs (both repos) | A–C | Not started | |

## Log

- **2026-10-23 (P0 done):** Combined Phase 0 of both plans: four read-only code discovery passes with file:line evidence, remote DB reads and fiscal research.
  - **Findings:** 20 (PF-01…PF-20), including 5 high:
    - PF-01: price override not enforced on Create
    - PF-02: client line prices stored
    - PF-03: double price-list discount in Edit
    - PF-04: exempt orders still taxed
    - PF-07: Edit money model differs from Create
  - **Confirmed** EC-01/02/03/04/08 and LE-01.
  - **ADR-060** accepted.
  - **Plan changes** C1–C14 recorded in PLAN §21, including the hotfix step 2b.
  - **Owner items** Q1 (express turnaround seeding) and Q2 (bug fixes that change figures) in PLAN §20.
  - No code changed.

- **2026-10-23 (v2.1):** Owner resolved all open items.
  - **L18:** HQ is the single writer of `tax_pricing_mode` / `extra_price_pricing_mode` (tenant and branch). The tenant app goes read-only, with server rejection `403 FIELD_MANAGED_BY_HQ`. Branch overrides move to the HQ branch edit page (new §10.3, P7-05).
  - **L19:** speed rule fields are `default_speed_sell_price`, `multiplier_speed`, `turnaround_hh_speed`, chosen by `speed_price_type` (`SELL_PRICE` / `MULTIPLIER` / `FIXED_AMOUNT`).
  - **L20:** the multiplier is an added fraction (10 × 0.30 + 10 = 13). Verified that stored `multiplier_express` values are factors (1.00–2.00), so the seed converts them with `− 1`: 95 `SELL_PRICE` rules and 32 `MULTIPLIER` 0 rules, with no price change.
  - **L21:** `disc_alloc_mode` is tenant-only; fiscal item lines ship in Release A.

  No code changed.

- **2026-10-23 (v2):** Production-readiness audit of v1.2 against the code in both repos. Plan rewritten as v2, closing 17 gaps (PLAN §16):
  - module layers with a pure, domain-agnostic calculator, decimal arithmetic and a calculation version
  - DB integrity (FKs, CHECKs, NOT NULL after recompute)
  - per-line ready-by, tax profile, exemption and reason codes; the gift-card rule
  - line-discount UI, permission and limits
  - fiscal item lines on tax documents
  - missing surfaces: public booking API, custom-item modal, catalog import, bulk pricing; tax profiles are edited in the tenant app, not HQ
  - quote service (no client money math), speed-rule audit, in-use protection and a resolver panel
  - test matrix, releases, rollback and observability

  Verified: HQ reads no order lines; `cmx-api` is unaffected (auth/health only); refunds are amount-level; last ADR is 059 (so ADR-060 is next). No code changed. Three owner items open (PLAN §20).
- **2026-10-23 (v1.2):** Owner decision L17: seed every new setting to today's behaviour. Added the seed table; changed the `disc_alloc_mode` default to `DOCUMENT_LEVEL`; found `multiplier_express` unused in pricing; added P0-07 and extended P0-03. No code changed.
- **2026-10-23 (v1.1):** Owner decision L16: new tenant settings are `org_tenants_mst` columns, edited only in HQ on the Tax & Pricing tab. No code changed.
- **2026-10-23 (v1):** Plan drafted from discussion rounds 1–2 (L1–L15, N1–N3). No code changed.
