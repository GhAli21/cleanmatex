import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Tenant resolution order (contract):
 * 1. JWT claim tenant_org_id (set by JwtAuthGuard)
 * 2. Header X-Tenant-Id (platform ops only)
 * 3. Reject if unresolved
 */
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { tenantOrgId?: string }>();
    let tenantId = request.tenantOrgId;
    if (!tenantId) {
      const headerTenant = request.headers['x-tenant-id'];
      tenantId = typeof headerTenant === 'string' ? headerTenant.trim() : undefined;
    }
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required (JWT tenant_org_id or X-Tenant-Id)');
    }
    request.tenantOrgId = tenantId;
    return true;
  }
}
