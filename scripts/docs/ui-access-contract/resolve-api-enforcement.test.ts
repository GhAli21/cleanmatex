import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  inferApiEnforcement,
  normalizeApiDependencyPath,
  parseApiDependencyEntry,
  routeContentSatisfiesEnforcement,
} from './resolve-api-enforcement';

describe('resolve-api-enforcement', () => {
  it('strips query strings from API paths', () => {
    assert.equal(normalizeApiDependencyPath('/api/v1/customers?type=b2b'), '/api/v1/customers');
  });

  it('infers auth_only from notes', () => {
    assert.equal(
      inferApiEnforcement({
        path: '/api/v1/tenants/me',
        notes: ['Auth-only tenant route.'],
      }),
      'auth_only'
    );
  });

  it('defaults to auth_only when no requirement.permissions', () => {
    assert.equal(
      inferApiEnforcement({
        path: '/api/v1/categories',
      }),
      'auth_only'
    );
  });

  it('infers permission when requirement.permissions present', () => {
    assert.equal(
      inferApiEnforcement({
        path: '/api/v1/customers',
        permissions: ['customers:read'],
      }),
      'permission'
    );
  });

  it('infers external for tenant-api paths', () => {
    assert.equal(
      inferApiEnforcement({ path: '/tenant-api/roles' }),
      'external'
    );
  });

  it('honors explicit enforcement field', () => {
    assert.equal(
      inferApiEnforcement({
        path: '/api/v1/subscriptions/plans',
        enforcement: 'auth_only',
        permissions: ['should:not:win'],
      }),
      'auth_only'
    );
  });

  it('detects getTenantIdFromSession as auth_only', () => {
    const sample = `
      const tenantId = await getTenantIdFromSession();
      if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    `;
    assert.equal(routeContentSatisfiesEnforcement(sample, 'auth_only'), true);
  });

  it('detects session auth in route content', () => {
    const sample = `
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    `;
    assert.equal(routeContentSatisfiesEnforcement(sample, 'auth_only'), true);
  });

  it('parses dependency entry with enforcement', () => {
    const entry = `{
      label: 'Plans',
      method: 'GET',
      path: '/api/v1/subscriptions/plans',
      enforcement: 'auth_only',
    }`;
    const parsed = parseApiDependencyEntry(entry);
    assert.ok(parsed);
    assert.equal(parsed.enforcement, 'auth_only');
  });
});
