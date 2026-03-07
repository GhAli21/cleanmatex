# Cancel Order and Return Order

This module documents the **Cancel Order** and **Return Order (Customer Return)** flows in CleanMateX.

## Overview

| Flow | When | Items with customer? | Payment handling |
|------|------|----------------------|------------------|
| **Cancel Order** | Before customer receives items | No | Cancel linked payments |
| **Return Order** | After customer received items (brings them back) | Yes | Refund linked payments |

## Documentation

| Document | Description |
|----------|-------------|
| [cancel_return_prd.md](./cancel_return_prd.md) | Product requirements and business rules |
| [cancel_return_implementation.md](./cancel_return_implementation.md) | Implementation status and checklist |
| [cancel_return_api.md](./cancel_return_api.md) | API endpoints and integration |
| [cancel_return_developer_guide.md](./cancel_return_developer_guide.md) | Developer guide — architecture, components, debugging |
| [cancel_return_user_guide.md](./cancel_return_user_guide.md) | User guide — how to cancel and process returns |
| [cancel_return_test_guide.md](./cancel_return_test_guide.md) | Test guide — unit, E2E, and manual scenarios |

## Quick Reference

- **Cancel:** `screen: 'canceling'` — draft through out_for_delivery → cancelled
- **Return:** `screen: 'returning'` — delivered/closed → cancelled + refund
- **Permissions:** `orders:cancel`, `orders:return`
- **DB functions:** `cmx_ord_canceling_transition`, `cmx_ord_returning_transition`
