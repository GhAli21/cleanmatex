# 04 - Tenant Currency and Settings

## Summary

Improved error handling in `getTenantCurrency` when DB lookup fails. Added structured logging for fallback to USD.

## File(s) Affected

- `web-admin/lib/services/tenant-settings.service.ts`
- `web-admin/src/features/orders/hooks/use-tenant-currency.ts` (to wire to tenant settings - see plan)

## Code Before

```typescript
    } catch (error) {//just default to USD for now jhTODO: get the default from the database
      console.error('[TenantSettingsService] Error getting currency:', error);
      return 'USD';
    }
```

## Code After

```typescript
    } catch (error) {
      console.warn(
        '[TenantSettingsService] getTenantCurrency failed, using default USD',
        { tenantId, error }
      );
      return 'USD';
    }
```

## Effects

- Clearer logging with tenantId context
- Uses `console.warn` for expected fallback cases
