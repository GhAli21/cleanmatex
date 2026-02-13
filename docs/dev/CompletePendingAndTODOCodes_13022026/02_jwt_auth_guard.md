# 02 - JWT Auth Guard (cmx-api)

## Summary

Replaced placeholder JWT guard with proper signature verification using `jsonwebtoken`. Invalid or expired tokens are now rejected.

## File(s) Affected

- `cmx-api/src/common/guards/jwt-auth.guard.ts`
- `cmx-api/package.json` (added jsonwebtoken, @types/jsonwebtoken)

## Issue

The guard decoded JWT payload without verifying the signature, allowing any Bearer token to pass. This is a critical security vulnerability.

## Code Before

```typescript
    // TODO: verify JWT with Supabase or JWT_SECRET and decode tenant_org_id, sub, role
    try {
      const payload = this.decodeJwtPayload(token);
      request.tenantOrgId = (payload.tenant_org_id ?? payload.tenantOrgId) as string | undefined;
      // ...
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private decodeJwtPayload(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid JWT');
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  }
```

## Code After

```typescript
import * as jwt from 'jsonwebtoken';

    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT secret not configured');
    }
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as Record<string, unknown>;
      request.tenantOrgId = (payload.tenant_org_id ?? payload.tenantOrgId) as string | undefined;
      request.userId = (payload.sub ?? payload.user_id) as string | undefined;
      request.roles = Array.isArray(payload.role) ? (payload.role as string[]) : payload.role ? [payload.role as string] : [];
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
```

## Effects and Dependencies

- **Environment variables:** `SUPABASE_JWT_SECRET` or `JWT_SECRET` (required for production)
- **Dependencies:** `jsonwebtoken@^9.0.2`, `@types/jsonwebtoken@^9.0.5`
- **Behavior:** Verifies signature and expiration; rejects invalid/expired tokens

## Testing

1. Set `SUPABASE_JWT_SECRET` or `JWT_SECRET` in cmx-api .env
2. Request with valid Supabase JWT: should pass
3. Request with invalid/expired token: should return 401
4. Request without secret configured: should return 401 "JWT secret not configured"

## Production Checklist

- [x] Signature verification enabled
- [x] Expiration checked
- [x] Secret from env (no hardcoded)
- [ ] Add SUPABASE_JWT_SECRET to deployment config
