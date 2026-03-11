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
| GET | /api/v1/catalog/preference-bundles | Fetch Care packages |

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

## Customer APIs

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /api/v1/customers/[id]/service-prefs | List customer standing prefs |
| POST | /api/v1/customers/[id]/service-prefs | Add standing pref |
| DELETE | /api/v1/customers/[id]/service-prefs?prefId=... | Remove standing pref |
