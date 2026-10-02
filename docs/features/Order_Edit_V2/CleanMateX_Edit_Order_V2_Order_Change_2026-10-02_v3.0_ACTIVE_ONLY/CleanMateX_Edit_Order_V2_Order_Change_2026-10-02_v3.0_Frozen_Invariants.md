# Frozen Invariants

1. Post-commit commercial mutation uses one governed Order Change boundary.
2. Create Order remains separate from Order Change.
3. Commitment is irreversible.
4. committed_at is the commitment source of truth.
5. Workflow and commercial versions are independent.
6. One successful Change increments edit_state_version exactly once.
7. Preview never mutates.
8. Apply is atomic.
9. Apply is idempotent.
10. Existing committed item IDs remain stable.
11. Existing committed piece IDs remain stable.
12. Existing preference IDs remain stable.
13. Product ID is not order-line identity.
14. Piece sequence is not piece identity.
15. No product replacement operation exists.
16. Adding a piece increases quantity.
17. Removing a piece decreases quantity.
18. All configurable preference kinds use generic preference operations.
19. PIECE preferences retain order -> item -> piece hierarchy.
20. Server is authoritative for money.
21. Existing pricing/tax/discount engines are reused.
22. Existing financial aggregation/snapshot logic is reused.
23. Historical payment/voucher facts are immutable.
24. Commercial delta is not a payment/refund instruction.
25. Overpayment is derived from financial state.
26. Additional collection may use Payment Modal V4.
27. Overpayment uses a focused Financial Resolution capability.
28. Issued fiscal facts are not rewritten.
29. Current semantic workflow engine is reused, not duplicated.
30. Hard-coded whole-order editability is not V2 authority.
31. Tenant isolation is enforced server-side.
32. External calls are outside the core Change transaction.
33. org_order_edit_history is legacy/compatibility only for V2.
34. New Order must remain working through every migration phase.
35. Customer identity is immutable post-commit in V1.
36. Branch change is prohibited/deferred in V1; no V1 setting or override enables reassignment.
37. Cancellation/Return/Issue/Stop remain separate business workflows.

## Configuration invariants added in v2.1

36. No monolithic Edit policy table in V1.
37. No duplicate Pricing, Tax, Finance, Delivery, Notification or RBAC configuration is created for Edit Order.
38. Workflow commercial-operation policy replaces hard-coded editable-status arrays as V2 authority.
39. Per-order Edit blocking is order state, not tenant configuration.
40. Missing sensitive commercial-operation policy fails closed.
41. `orders:edit` and `orders:edit_override` are separate permissions.
42. Price override reuses `pricing:override`.
43. Additional-due policy remains Finance-owned.
44. Overpayment disposition remains Finance-owned.
45. Issued fiscal-document behavior remains Tax/Fiscal-owned.
46. Customer identity reassignment is not configurable in V1; it is denied.
47. Branch reassignment is not configurable in V1; it is denied/deferred.
48. Generic maker/checker or amount-threshold Edit approval is deferred.
49. Edit V2 uses its own rollout flag and never repurposes B12 `order_fin_governed_amendments`.
50. UI consumes server-resolved capabilities and never becomes the policy authority.
51. Apply revalidates material policy/calculation inputs and requires re-review on material drift.


## v3.0 completeness invariants

- Every persisted business behavior must trace to DB/API/service/UI/test or an explicit non-UI owner.
- Missing required configuration fails closed or uses only a documented frozen default.
- Open decision gates are release blockers for dependent modes, not permission for developer guessing.
- Enabled cohorts cannot retain an ungoverned committed commercial write bypass.


## Verification references

The Requirement Traceability Matrix maps all 57 frozen statements to unit, actual service/API, DB integration, concurrency, RLS/security, migration and Playwright/EN-AR-RTL-a11y proof. To disambiguate the inherited duplicate 36/37 numbering, references are B01–B37 for the original section, C36–C51 for configuration, and V3A–V3D for completeness. No invariant is marked satisfied merely because an existing mock suite is green. The branch-change wording above is constrained by CFG-028 and C47: V1 branch reassignment remains denied/deferred; it is not an available override.
