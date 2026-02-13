# Plan: Settings Pages API Wiring (General and Branding)

## Overview

Two settings pages have TODO placeholders for API calls:
- **General:** Load/save business info, hours, locale
- **Branding:** Load/save logo, colors

Both need backend APIs and wiring to tenant settings storage.

## Current State

### General Settings (`app/dashboard/settings/general/page.tsx`)

- **loadSettings:** TODO - replace with fetch from API
- **handleSave:** TODO - replace with PUT to API
- **Data:** businessName, businessNameAr, email, phone, address, city, country, timezone, currency, defaultLanguage, businessHours

### Branding Settings (`app/dashboard/settings/branding/page.tsx`)

- **handleSave:** TODO - API call (currently simulated delay)
- **Data:** logo (URL or base64), primaryColor, secondaryColor, accentColor

## Prerequisites

- Tenant settings storage: `org_tenants_mst` or `sys_stng_*` tables
- Settings schema for general/branding (key-value or structured)
- Auth: settings pages require tenant context

## Implementation Steps

### Part A: General Settings

#### 1. Define settings schema

- Map form fields to DB columns or settings keys
- org_tenants_mst likely has: name, name2, email, phone, address, city, country, timezone, currency
- Business hours: JSON in tenant settings or dedicated table

#### 2. Create API routes

- `GET /api/v1/settings/general` - return current tenant settings
- `PUT /api/v1/settings/general` - update settings (validate, upsert)
- Use getTenantIdFromSession for tenant scope

#### 3. Wire GeneralSettingsPage

- loadSettings: fetch GET, setSettings(response)
- handleSave: fetch PUT with settings JSON
- Show success/error feedback (already has saved state)

### Part B: Branding Settings

#### 1. Logo storage

- Option A: Upload to MinIO, store URL in settings
- Option B: Base64 in settings (not ideal for large images)
- Use existing upload-photo or create dedicated logo upload API

#### 2. Create API routes

- `GET /api/v1/settings/branding` - return logo URL, colors
- `PUT /api/v1/settings/branding` - update (logo URL, primary_color, etc.)

#### 3. Wire BrandingSettingsPage

- loadSettings: fetch GET (add useEffect if not present)
- handleSave: fetch PUT
- handleLogoUpload: upload first, then save URL in PUT

### Part C: Settings Service (optional)

- Centralize in `lib/services/tenant-settings.service.ts` or similar
- Methods: getGeneralSettings(tenantId), updateGeneralSettings(tenantId, data)
- API routes call service

## Acceptance Criteria

- [ ] General settings load and save correctly
- [ ] Branding settings load and save correctly
- [ ] Logo upload works (or document manual URL input)
- [ ] Tenant isolation enforced
- [ ] Build passes

## Production Checklist

- [ ] RLS or auth ensures tenant can only edit own settings
- [ ] Validation on required fields (business name, etc.)
- [ ] i18n for success/error messages
- [ ] .env.example if new env vars (e.g. logo storage)

## References

- web-admin/app/dashboard/settings/general/page.tsx
- web-admin/app/dashboard/settings/branding/page.tsx
- web-admin/lib/services/tenant-settings.service.ts
- org_tenants_mst, sys_stng_* schema
