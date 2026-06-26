import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  defaultAccessFilePathForRoute,
  resolveAccessFileForRoute,
} from './access-contract-files';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ADMIN = path.join(__dirname, '..', '..', '..', 'web-admin');

function expectFeatureFolder(route: string, feature: string) {
  const resolved = resolveAccessFileForRoute(route);
  assert.ok(resolved?.replace(/\\/g, '/').includes(`/features/${feature}/access/`));

  const defaultPath = defaultAccessFilePathForRoute(route).replace(/\\/g, '/');
  assert.equal(
    defaultPath,
    `${WEB_ADMIN.replace(/\\/g, '/')}/src/features/${feature}/access/${feature}-access.ts`,
  );
}

describe('access-contract-files route resolver', () => {
  it('maps /dashboard to dashboard-access (not core)', () => {
    expectFeatureFolder('/dashboard', 'dashboard');
  });

  it('maps help routes to help-access (not core)', () => {
    expectFeatureFolder('/dashboard/help', 'help');
    expectFeatureFolder('/dashboard/help/platform-inventories', 'help');
  });

  it('maps tenant-admin subscription to tenant-admin-access', () => {
    expectFeatureFolder('/dashboard/tenant-admin/subscription', 'tenant-admin');
  });

  it('maps legacy subscription segment to tenant-admin-access', () => {
    expectFeatureFolder('/dashboard/subscription', 'tenant-admin');
  });

  it('keeps jhtestui on core-access', () => {
    const resolved = resolveAccessFileForRoute('/dashboard/jhtestui');
    assert.ok(resolved?.replace(/\\/g, '/').includes('/features/core/access/'));
  });
});
