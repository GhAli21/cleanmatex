/** @jest-environment node */

import { NextRequest } from 'next/server';
import { resolveWorkflowCommandChannel } from '@/lib/api/workflow-command-channel';

describe('resolveWorkflowCommandChannel', () => {
  it('assigns staff_web to cookie-session requests', () => {
    const request = new NextRequest('http://localhost/api/v1/orders/id/actions', {
      method: 'POST',
    });

    expect(resolveWorkflowCommandChannel(request)).toBe('staff_web');
  });

  it('assigns mobile to bearer JWT requests and never trusts a channel header', () => {
    const request = new NextRequest('http://localhost/api/v1/orders/id/actions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer mobile-access-token',
        'X-Workflow-Channel': 'staff_web',
      },
    });

    expect(resolveWorkflowCommandChannel(request)).toBe('mobile');
  });
});
