import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';

/** Request fields set by the staff auth guards. The organization is not one of the token claims. */
export interface StaffAuthRequest extends Request {
  userId?: string;
  tenantOrgId?: string;
  roles?: string[];
  accessToken?: string;
}

/**
 * Verifies the bearer token and records who the caller is.
 * A tenant_org_id claim on the token is ignored. TenantGuard reads the open session row.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const auth = request.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    const token = auth.slice(7);
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT secret not configured');
    }
    try {
      const payload = jwt.verify(token, secret, {
        algorithms: ['HS256'],
      }) as Record<string, unknown>;
      const userId = (payload.sub ?? payload.user_id) as string | undefined;
      if (!userId) {
        throw new UnauthorizedException('Invalid or expired token');
      }
      request.userId = userId;
      request.accessToken = token;
      request.roles = Array.isArray(payload.role)
        ? (payload.role as string[])
        : payload.role
          ? [payload.role as string]
          : [];
      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
