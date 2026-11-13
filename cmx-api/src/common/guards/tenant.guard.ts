import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { StaffSessionService } from '../session/staff-session.service';
import { StaffAuthRequest } from './jwt-auth.guard';

/**
 * Sets the organization from the caller's ACTIVE session row.
 * A tenant claim and the X-Tenant-Id header are not staff overrides.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly sessions: StaffSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<StaffAuthRequest>();
    const accessToken = request.accessToken;
    if (!accessToken) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }
    request.tenantOrgId = await this.sessions.resolveActiveOrganization(accessToken);
    return true;
  }
}
