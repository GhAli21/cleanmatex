# Order Page Filtering - Quick Reference Card

**Version:** v1.0.0  
**Last Updated:** 2025-01-20

---

## Quick Status-to-Page Mapping

| Status | Page | Route | Filter |
|--------|------|-------|--------|
| `preparation` | ✅ Preparation | `/dashboard/preparation` | `current_status='preparation'` |
| `processing` | ✅ Processing | `/dashboard/processing` | `current_status='processing'` |
| `assembly` | ✅ Assembly | `/dashboard/assembly` | `current_status='assembly'` |
| `qa` | ✅ QA | `/dashboard/qa` | `current_status='qa'` |
| `ready` | ✅ Ready | `/dashboard/ready` | `current_status='ready'` |
| *All others* | ✅ All Orders | `/dashboard/orders` | No filter (or custom) |

---

## When Orders Disappear

| Page | Disappears When Status Changes To |
|------|-----------------------------------|
| **Ready** | `out_for_delivery`, `delivered`, `closed`, `cancelled` |
| **Processing** | Any status other than `processing` |
| **Preparation** | `sorting` or any other status |
| **Assembly** | `qa` or any other status |
| **QA** | `packing` (pass) or `washing` (fail) |

---

## API Endpoints

```bash
# Ready Page
GET /api/v1/orders?current_status=ready&page=1&limit=20

# Processing Page
GET /api/v1/orders?current_status=processing&page=1&limit=20

# Preparation Page
GET /api/v1/orders?current_status=preparation&page=1&limit=20

# Assembly Page
GET /api/v1/orders?current_status=assembly&page=1&limit=20

# QA Page
GET /api/v1/orders?current_status=qa&page=1&limit=20

# All Orders
GET /api/v1/orders?page=1&limit=20
```

---

## Status Transition Flow

```
PREPARATION → SORTING → PROCESSING → WASHING → DRYING → 
FINISHING → ASSEMBLY → QA → PACKING → READY → 
OUT_FOR_DELIVERY → DELIVERED → CLOSED
```

---

## Quick Troubleshooting

### Order Not Showing?
1. ✅ Check `current_status` matches page filter
2. ✅ Verify `tenant_org_id` matches current tenant
3. ✅ Check pagination (might be on another page)
4. ✅ Verify `is_active = true`

### Order Not Disappearing?
1. ✅ Verify status transition succeeded
2. ✅ Refresh page (if not real-time)
3. ✅ Check status value is exact match (case-sensitive)

---

**Quick Reference Version:** v1.0.0

