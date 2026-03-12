---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Order Service Preferences — Testing Scenarios

## Functional Test Cases

### Catalog

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| T1 | Fetch service preferences | GET /api/v1/catalog/service-preferences | Returns tenant-enabled prefs with prices |
| T2 | Fetch packing preferences | GET /api/v1/catalog/packing-preferences | Returns tenant-enabled packing prefs |
| T3 | Fetch preference bundles | GET /api/v1/catalog/preference-bundles | Returns Care packages for tenant |
| T4 | Admin: include inactive bundles | GET ...?includeInactive=true | Returns all bundles including inactive |

### Order Item Preferences

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| T5 | Add service pref to item | POST .../items/:itemId/service-prefs | Pref added, service_pref_charge updated |
| T6 | Remove service pref | DELETE .../items/:itemId/service-prefs | Pref removed, charge recalculated |
| T7 | Update packing pref | PATCH .../items/:itemId/packing-pref | packing_pref_code updated |
| T8 | Apply bundle | POST .../items/:itemId/apply-bundle/:code | Bundle prefs applied, discount applied |

### Piece-Level (Enterprise)

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| T9 | Add piece service pref | POST .../pieces/:pieceId/service-prefs | Piece pref added, piece + item charge updated |
| T10 | Confirm piece prefs | POST .../pieces/:pieceId/service-prefs/confirm | processing_confirmed set |
| T11 | Override packing on piece | Set packing_pref_code on piece | Override badge shown in Processing |

### Customer Standing Prefs

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| T12 | List customer prefs | GET /api/v1/customers/:id/service-prefs | Returns standing prefs |
| T13 | Add standing pref | POST .../service-prefs | Pref added |
| T14 | Remove standing pref | DELETE .../service-prefs?prefId=... | Pref removed |

### Resolution

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| T15 | Resolve item prefs | GET /api/v1/preferences/resolve?tenant_org_id=...&customer_id=... | Returns resolved prefs from customer + product |
| T16 | Last order prefs | GET /api/v1/preferences/last-order | Returns last order prefs per product |
| T17 | Suggest from history | GET /api/v1/preferences/suggest | Returns suggested prefs by usage count |

### Order Creation and Totals

| ID | Scenario | Steps | Expected |
|----|----------|-------|----------|
| T18 | Create order with prefs | Create order with servicePrefs, packingPrefCode | Prefs stored, service_pref_charge set |
| T19 | Order total includes pref charge | Add item with servicePrefCharge | calculateOrderTotal = items + servicePrefCharge |
| T20 | Receipt placeholders | Generate receipt with prefs | {{preferences_summary}}, {{service_pref_charge}}, {{eco_score}} replaced |

## Edge Cases

| ID | Scenario | Expected |
|----|----------|----------|
| E1 | Incompatible prefs (enforce=true) | Blocked |
| E2 | Incompatible prefs (enforce=false) | Warning only |
| E3 | Max prefs per item exceeded | Rejected or truncated per plan |
| E4 | Piece pref when per_piece_service_prefs disabled | 403 or hidden |
| E5 | Bundle on plan without bundles_enabled | 403 or hidden |

## Acceptance Criteria

- [ ] All catalog APIs return tenant-scoped data
- [ ] service_pref_charge recalculates on add/remove pref
- [ ] Order total = sum(item totalPrice + servicePrefCharge)
- [ ] Receipt placeholders render correctly
- [ ] RLS: no cross-tenant data access
- [ ] Feature flags gate UI and API correctly
