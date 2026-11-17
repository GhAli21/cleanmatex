# 09 — Customers, Users and Identity

| # | Item | Priority | Evidence | What to do |
|---|---|---|---|---|
| U1 | **Staff users (global user, many organizations)** are built: sign-in by user code or email, a password shared across organizations, the session registry and auth config. Manual QA (Phases 0–5, §6 password flows 6.1–6.21, HQ H.1–H.8) has not been done. | Blocker | `User_Session_Lifecycle/REMAINING_WORK.md` §1 | file 12 |
| U2 | `Tenants_Users/PLAN.md`: the code is done, but the documentation pack is not generated. | After launch | PLAN last open box | `/documentation` |
| U3 | **Customer identity ("one person, many Tenants")** is a discussion draft only, not approved. Today each Tenant has its own customer records. | After launch (product decision) | `Tenants_Customers/PLAN.md` "Progress: Not started" | Decide whether it is needed for launch. It is not required for a single-Tenant customer. |
| U4 | Customer data protection: export and delete on request (PDPL right of access and erasure). No "delete or anonymize this customer" flow was found in the docs reviewed. | Before public launch | — | Check the customers module. Add an anonymize action that keeps order and finance records. |
| U5 | **B2B** (contracts, statements, credit limit, dunning) is implemented per `B2B_Feature/current_status.md` (v1.1.0, 2026-03-14). The status doc is old and was not re-verified for this report. | Before public launch if pilots use B2B | — | Run one B2B scenario (contract → orders → statement → payment). |
| U6 | MFA, password expiry, per-role forced change: deliberately later. | Later | User Session §3 | — |
| U7 | Plan downgrade does not clear tenant auth overrides automatically; HQ has a manual button. | After launch | User Session §2 (decided) | Wire it in when billing is automated (file 01, B2). |
