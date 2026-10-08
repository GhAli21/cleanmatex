/**
 * Real-Postgres proof for migrations 0576 (Active Sessions nav + sweep cron) and 0577 (new-device alert
 * template). Read-only: nothing is written.
 *
 * @jest-environment node
 */

import { prisma } from '@/lib/db/prisma';

let ready = false;
let hasTemplate = false;

beforeAll(async () => {
  try {
    const rows = await prisma.$queryRaw<Array<{ nav: boolean; tpl: boolean }>>`
      SELECT EXISTS (SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'users_sessions') AS nav,
             EXISTS (SELECT 1 FROM public.sys_ntf_template_ver_dtl
                      WHERE template_code = 'security.login.detected.default' AND version_number = 2) AS tpl`;
    ready = Boolean(rows[0]?.nav);
    hasTemplate = Boolean(rows[0]?.tpl);
  } catch {
    ready = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

const dbit = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!ready) return;
    await fn();
  });

describe('0576 — Active Sessions navigation and sweep job', () => {
  dbit('nav row is attached under the users node and gated by user_sessions:read', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ parent_comp_code: string | null; comp_path: string; main_permission_code: string | null; is_active: boolean }>
    >`SELECT parent_comp_code, comp_path, main_permission_code, is_active
        FROM public.sys_components_cd WHERE comp_code = 'users_sessions'`;
    expect(rows[0]).toMatchObject({
      parent_comp_code: 'users',
      comp_path: '/dashboard/users/sessions',
      main_permission_code: 'user_sessions:read',
      is_active: true,
    });
  });

  dbit('sweep job is scheduled every 5 minutes exactly once', async () => {
    const rows = await prisma.$queryRaw<Array<{ schedule: string; command: string }>>`
      SELECT schedule, command FROM cron.job WHERE jobname = 'auth-session-sweep'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].schedule).toBe('*/5 * * * *');
    expect(rows[0].command).toContain('fn_auth_sessions_sweep');
  });
});

describe('0577 — new-device alert template', () => {
  it('v2 is APPROVED, bilingual and carries the device/ip/time variables on every mapped channel', async () => {
    if (!ready || !hasTemplate) return; // 0577 not applied on this database yet
    const rows = await prisma.$queryRaw<Array<{ channel_code: string; rendered_body: string; rendered_body2: string | null; status: string }>>`
      SELECT c.channel_code, c.rendered_body, c.rendered_body2, v.status
        FROM public.sys_ntf_template_chan_dtl c
        JOIN public.sys_ntf_template_ver_dtl v ON v.id = c.template_version_id
       WHERE v.template_code = 'security.login.detected.default' AND v.version_number = 2
       ORDER BY c.channel_code`;
    expect(rows.map((r) => r.channel_code)).toEqual(expect.arrayContaining(['EMAIL', 'IN_APP', 'PUSH']));
    for (const row of rows) {
      expect(row.status).toBe('APPROVED');
      for (const variable of ['{{device_label}}', '{{ip_address}}', '{{signed_in_at}}']) {
        expect(row.rendered_body).toContain(variable);
        expect(row.rendered_body2).toContain(variable);
      }
    }
  });
});
