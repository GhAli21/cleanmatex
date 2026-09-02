import type { NextRequest } from 'next/server';

/**
 * Credential-derived channels that generic and stage adapters may assign.
 * POS and public_web stay on dedicated adapters with their own proof of identity.
 */
export type DerivedWorkflowAdapterChannel = 'staff_web' | 'mobile';

/**
 * Resolves the workflow command channel from the request credential.
 *
 * Bearer JWT means the mobile adapter. Cookie session means staff_web.
 * Clients cannot send a channel field to escalate (POS, public_web, staff_web).
 *
 * @param request Incoming App Router request
 * @returns Channel bound to the verified credential type
 */
export function resolveWorkflowCommandChannel(
  request: NextRequest,
): DerivedWorkflowAdapterChannel {
  return request.headers.has('authorization') ? 'mobile' : 'staff_web';
}
