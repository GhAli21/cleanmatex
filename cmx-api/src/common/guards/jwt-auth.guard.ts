import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/**
 * JWT guard. Validates Authorization Bearer token with Supabase JWT secret,
 * verifies signature and expiration, and attaches decoded claims to request
 * (tenant_org_id, sub, role).
 *
 * Requires SUPABASE_JWT_SECRET or JWT_SECRET env var.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<
      Request & { userId?: string; tenantOrgId?: string; roles?: string[] }
    >();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const token = auth.slice(7);
    const secret =
      process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT secret not configured');
    }
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as Record<string, unknown>;
      request.tenantOrgId = (payload.tenant_org_id ??
        payload.tenantOrgId) as string | undefined;
      request.userId = (payload.sub ?? payload.user_id) as string | undefined;
      request.roles = Array.isArray(payload.role)
        ? (payload.role as string[])
        : payload.role
          ? [payload.role as string]
          : [];
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
