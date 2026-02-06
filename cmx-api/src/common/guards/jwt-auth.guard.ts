import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';

/**
 * Placeholder JWT guard. Validates presence of Authorization Bearer token
 * and attaches decoded claims to request (tenant_org_id, sub, role).
 * Replace with Passport JWT strategy or Supabase JWT validation in production.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { userId?: string; tenantOrgId?: string; roles?: string[] }>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const token = auth.slice(7);
    // TODO: verify JWT with Supabase or JWT_SECRET and decode tenant_org_id, sub, role
    // For now, allow any Bearer token and set placeholder; auth module will do real validation
    try {
      const payload = this.decodeJwtPayload(token);
      request.tenantOrgId = (payload.tenant_org_id ?? payload.tenantOrgId) as string | undefined;
      request.userId = (payload.sub ?? payload.user_id) as string | undefined;
      request.roles = Array.isArray(payload.role) ? (payload.role as string[]) : payload.role ? [payload.role as string] : [];
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
}
