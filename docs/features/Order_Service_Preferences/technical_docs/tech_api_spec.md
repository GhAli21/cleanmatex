---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Service Preferences — API Specification

## Catalog APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/catalog/service-preferences | Fetch service prefs with tenant overrides |
| GET | /api/v1/catalog/packing-preferences | Fetch packing prefs |
| GET | /api/v1/catalog/preference-bundles | Fetch Care packages (?includeInactive=true for admin) |
| POST | /api/v1/catalog/preference-bundles | Create bundle (requires config:preferences_manage) |
| PATCH | /api/v1/catalog/preference-bundles/[id] | Update bundle |
| DELETE | /api/v1/catalog/preference-bundles/[id] | Soft delete bundle (?hard=true for hard delete) |

## Order Item APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/orders/[id]/items/[itemId]/service-prefs | List item service prefs |
| POST | /api/v1/orders/[id]/items/[itemId]/service-prefs | Add service pref |
| DELETE | /api/v1/orders/[id]/items/[itemId]/service-prefs | Remove service pref |
| PATCH | /api/v1/orders/[id]/items/[itemId]/packing-pref | Update packing pref |

## Piece-Level APIs (Enterprise)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs | List piece prefs |
| POST | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs | Add piece pref |
| DELETE | /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs | Remove piece pref |

## Order Item APIs (Additional)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/v1/orders/[id]/items/[itemId]/apply-bundle/[bundleCode] | Apply Care package to item |

## Preference Resolution APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/preferences/resolve | Resolve prefs (customer + product defaults) |
| GET | /api/v1/preferences/last-order | Get last order prefs for Repeat Last Order |
| GET | /api/v1/preferences/suggest | Suggest prefs from customer history |

## Customer APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/customers/[id]/service-prefs | List customer standing prefs |
| POST | /api/v1/customers/[id]/service-prefs | Add standing pref |
| DELETE | /api/v1/customers/[id]/service-prefs?prefId=... | Remove standing pref |
