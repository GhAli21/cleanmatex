# 07 - Tax and Preparation

## Summary

Preparation preview API now fetches tax rate from tenant settings (`TENANT_TAX_RATE`) instead of hardcoded 0.05.

## File(s) Affected

- `web-admin/app/api/v1/preparation/[id]/preview/route.ts`

## Code Before

```typescript
    const taxRate = 0.05; // TODO: fetch from tenant settings
```

## Code After

```typescript
    const tenantSettings = new TenantSettingsService();
    const taxRateRaw = await tenantSettings.getSettingValue(tenantId, 'TENANT_TAX_RATE');
    const taxRate = taxRateRaw != null ? Number(taxRateRaw) : 0.05;
    const tax = subtotal * (Number.isFinite(taxRate) ? taxRate : 0.05);
```

## Effects

- Per-tenant tax configuration
- Default 0.05 when not set
- Seed `TENANT_TAX_RATE` in org_tenant_settings_cf for tenants that need custom tax
