/**
 * Exercises the applied Edit Policy resolver and activation guards on local
 * PostgreSQL. Every fixture lives in one rolled-back transaction; existing proof
 * orders and assignments are never changed or deleted.
 */
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { resolveOrderChangePolicyBindings } from '@/lib/services/order-change/order-change-edit-policy-resolver.service';

const ROLLBACK_FIXTURES = 'EDIT_POLICY_FIXTURE_ROLLBACK';

/** Runs a rejected statement behind a savepoint so later cases retain their fixtures. */
async function expectConstraintRejection(tx: Prisma.TransactionClient, write: () => Promise<unknown>, expectedMessage: string): Promise<void> {
  await tx.$executeRaw`SAVEPOINT edit_policy_rejection`;
  let rejection: unknown;
  try {
    await write();
  } catch (error) {
    rejection = error;
  } finally {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT edit_policy_rejection`;
    await tx.$executeRaw`RELEASE SAVEPOINT edit_policy_rejection`;
  }
  expect(rejection).toBeInstanceOf(Error);
  expect((rejection as Error).message).toContain(expectedMessage);
}

beforeAll(async () => {
  // A developer's remote DATABASE_URL must never turn these fixtures into a
  // remote write, even though all successful fixture work is rolled back.
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) || databaseUrl.port !== '54322') {
    throw new Error('Edit Policy DB proof requires local Supabase on port 54322');
  }
  await prisma.$queryRaw`SELECT 1`;
});

afterAll(async () => { await prisma.$disconnect(); });

describe('applied Edit Policy scopes and defaults', () => {
  it('proves organization > profile > version default, profile moves, status holes and activation guards', async () => {
    const organizations = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst
      WHERE name ILIKE '%test%' OR name ILIKE '%demo%' OR name ILIKE '%sandbox%'
      ORDER BY id LIMIT 1
    `;
    const actors = await prisma.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.hq_users ORDER BY id LIMIT 1`;
    const tenantId = organizations[0]?.id;
    const actorId = actors[0]?.id;
    if (!tenantId || !actorId) throw new Error('Edit Policy proof requires an existing test/demo organization and HQ actor');
    const versions = await prisma.$queryRaw<Array<{ version_id: string; profile_id: string; live_status_count: bigint }>>`
      SELECT version.version_id, version.profile_id,
             COUNT(DISTINCT membership.status_code) FILTER(WHERE membership.rec_status = 1 AND membership.is_active = true) AS live_status_count
      FROM public.sys_wf_profile_ver_mst AS version
      LEFT JOIN public.sys_wf_prof_ver_mod_st_cf AS membership ON membership.version_id = version.version_id
      WHERE version.rec_status = 1 AND version.is_active = true AND version.version_status IN ('PILOT', 'PUBLISHED')
      GROUP BY version.version_id, version.profile_id ORDER BY live_status_count, version.version_id
    `;
    const first = versions.find((version) => Number(version.live_status_count) > 0
      && versions.some((other) => other.profile_id === version.profile_id && other.version_id !== version.version_id));
    const second = versions.find((version) => Number(version.live_status_count) > 0 && version.profile_id !== first?.profile_id);
    const earlier = versions.find((version) => version.profile_id === first?.profile_id && version.version_id !== first?.version_id);
    if (!first || !second || !earlier) throw new Error('Proof requires two live workflow families and two versions of one family');
    const profileA = first.profile_id;
    const profileB = second.profile_id;
    const versionA = first.version_id;
    const versionA2 = earlier.version_id;
    const versionB = second.version_id;
    const strictPolicy = randomUUID();
    const permissivePolicy = randomUUID();
    const pilotPolicy = randomUUID();
    const organizationOverride = randomUUID();
    const profileOverride = randomUUID();
    const codeSuffix = randomUUID().replaceAll('-', '');

    await expect(prisma.$transaction(async (tx) => {
      const occupied = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_wf_edit_policy_asg_cf
        WHERE tenant_org_id = ${tenantId}::uuid AND scope = 'ORGANIZATION'
          AND rec_status = 1 AND is_active = true
      `;
      if (occupied.length) throw new Error('Test organization already has a live organization override; no existing authority was changed');
      // Reuse existing valid workflow definitions without changing them. Their
      // live-child guards correctly require complete workflow configuration.
      const statuses = await tx.$queryRaw<Array<{ status_code: string }>>`
        SELECT DISTINCT first_status.status_code
        FROM public.sys_wf_prof_ver_mod_st_cf AS first_status
        JOIN public.sys_wf_prof_ver_mod_st_cf AS second_status ON second_status.status_code = first_status.status_code
        WHERE first_status.version_id = ${versionA}::uuid AND first_status.rec_status = 1 AND first_status.is_active = true
          AND second_status.version_id = ${versionB}::uuid AND second_status.rec_status = 1 AND second_status.is_active = true
        ORDER BY first_status.status_code LIMIT 1
      `;
      const fixture = statuses[0];
      if (!fixture) throw new Error('The two fixture workflow versions must share an active status');
      await tx.$executeRaw`
        INSERT INTO public.org_wf_profile_assign_cf(tenant_org_id, wf_profile_id, wf_version_no)
        VALUES (${tenantId}::uuid, ${profileA}::uuid, NULL), (${tenantId}::uuid, ${profileB}::uuid, NULL)
      `;
      for (const [id, label, decision] of [
        [strictPolicy, 'STRICT', 'DENY'], [permissivePolicy, 'ALLOW', 'ALLOW'], [pilotPolicy, 'PILOT', 'DENY'],
      ]) {
        await tx.$executeRaw`
          INSERT INTO public.sys_wf_edit_policy_mst(id, policy_code, name, name2)
          VALUES (${id}::uuid, ${`${label}_${codeSuffix}`}, ${`Edit Policy proof ${label}`}, ${`Edit Policy proof ${label}`})
        `;
        await tx.$executeRaw`
          INSERT INTO public.sys_wf_edit_policy_rule_dtl
            (edit_policy_id, workflow_status, operation_code, target_type, decision, reason_code, message_key)
          SELECT DISTINCT ${id}::uuid, membership.status_code, pair.operation_code, pair.target_type,
                 ${decision}, 'EDIT_POLICY_PROOF', 'orders.edit.policyInfo.title'
          FROM public.sys_wf_order_edit_op_tgt_cd AS pair
          CROSS JOIN public.sys_wf_prof_ver_mod_st_cf AS membership
          WHERE pair.rec_status = 1 AND pair.is_active = true
            AND membership.version_id IN (${versionA}::uuid, ${versionB}::uuid)
            AND membership.rec_status = 1 AND membership.is_active = true
            AND (${id}::uuid <> ${pilotPolicy}::uuid OR pair.operation_code = 'ADD_ITEM')
        `;
        await tx.$executeRaw`
          UPDATE public.sys_wf_edit_policy_mst
          SET lifecycle_status = 'PILOT', policy_revision = policy_revision + 1,
              pilot_started_at = now(), pilot_started_by = ${actorId}::uuid
          WHERE id = ${id}::uuid
        `;
        if (id !== pilotPolicy) {
          await tx.$executeRaw`
            UPDATE public.sys_wf_edit_policy_mst
            SET lifecycle_status = 'PUBLISHED', policy_revision = policy_revision + 1,
                published_at = now(), published_by = ${actorId}::uuid
            WHERE id = ${id}::uuid
          `;
        }
      }
      await expectConstraintRejection(tx, () => tx.$executeRaw`
        INSERT INTO public.sys_wf_edit_policy_def_cf(workflow_profile_version_id, edit_policy_id)
        VALUES (${versionA2}::uuid, ${pilotPolicy}::uuid)
      `, 'default requires an active PUBLISHED Edit Policy');
      await tx.$executeRaw`
        INSERT INTO public.sys_wf_edit_policy_def_cf(workflow_profile_version_id, edit_policy_id)
        VALUES (${versionA}::uuid, ${strictPolicy}::uuid), (${versionB}::uuid, ${strictPolicy}::uuid)
      `;
      const resolve = (profileId: string | null, profileVersionId: string | null, workflowStatus = fixture.status_code) =>
        resolveOrderChangePolicyBindings(tx, { tenantId, profileId, profileVersionId, workflowStatus });
      // Case A: no overrides, published version default wins.
      expect(await resolve(profileA, versionA)).toMatchObject({ resolutionLevel: 'VERSION_DEFAULT', editPolicyId: strictPolicy, denyReason: 'NONE' });
      await expectConstraintRejection(tx, () => tx.$executeRaw`
        INSERT INTO public.sys_wf_edit_policy_def_cf(workflow_profile_version_id, edit_policy_id)
        VALUES (${versionA}::uuid, ${permissivePolicy}::uuid)
      `, '23505');
      await tx.$executeRaw`
        INSERT INTO public.org_wf_edit_policy_asg_cf(id, tenant_org_id, scope, workflow_profile_id, edit_policy_id)
        VALUES (${profileOverride}::uuid, ${tenantId}::uuid, 'PROFILE', ${profileA}::uuid, ${permissivePolicy}::uuid)
      `;
      // Case C: the profile override covers both versions of its family.
      for (const version of [versionA, versionA2]) {
        const resolution = await resolve(profileA, version);
        expect(resolution).toMatchObject({ resolutionLevel: 'PROFILE', editPolicyId: permissivePolicy });
        expect(resolution.bindings.find((binding) => binding.operationCode === 'ADD_ITEM')?.decision).toBe('ALLOW');
      }
      // Case D: a different stamped profile uses its own default.
      expect(await resolve(profileB, versionB)).toMatchObject({ resolutionLevel: 'VERSION_DEFAULT', editPolicyId: strictPolicy });
      await expectConstraintRejection(tx, () => tx.$executeRaw`
        INSERT INTO public.org_wf_edit_policy_asg_cf(tenant_org_id, scope, edit_policy_id)
        VALUES (${tenantId}::uuid, 'ORGANIZATION', ${strictPolicy}::uuid)
      `, 'gap acknowledgement');
      await tx.$executeRaw`
        INSERT INTO public.org_wf_edit_policy_asg_cf(id, tenant_org_id, scope, edit_policy_id, gap_acknowledged)
        VALUES (${organizationOverride}::uuid, ${tenantId}::uuid, 'ORGANIZATION', ${strictPolicy}::uuid, true)
      `;
      // Case B: broad authority shadows both the profile override and defaults.
      for (const [profile, version] of [[profileA, versionA], [profileB, versionB], [null, null]]) {
        const resolution = await resolve(profile, version);
        expect(resolution).toMatchObject({ resolutionLevel: 'ORGANIZATION', editPolicyId: strictPolicy });
        expect(resolution.bindings.find((binding) => binding.operationCode === 'ADD_ITEM')?.decision).toBe('DENY');
      }
      await expectConstraintRejection(tx, () => tx.$executeRaw`
        INSERT INTO public.org_wf_edit_policy_asg_cf(tenant_org_id, scope, edit_policy_id, gap_acknowledged)
        VALUES (${tenantId}::uuid, 'ORGANIZATION', ${permissivePolicy}::uuid, true)
      `, '23505');
      expect(await resolve(profileA, versionA, 'fixture_missing_status')).toMatchObject({
        resolutionLevel: 'ORGANIZATION', denyReason: 'STATUS_NOT_COVERED', editPolicyId: strictPolicy, bindings: [],
      });
      await tx.$executeRaw`
        UPDATE public.org_wf_edit_policy_asg_cf SET is_active = false
        WHERE tenant_org_id = ${tenantId}::uuid AND id = ${organizationOverride}::uuid
      `;
      expect(await resolve(profileA, versionA)).toMatchObject({ resolutionLevel: 'PROFILE', editPolicyId: permissivePolicy });
      await tx.$executeRaw`
        UPDATE public.org_wf_edit_policy_asg_cf SET is_active = false
        WHERE tenant_org_id = ${tenantId}::uuid AND id = ${profileOverride}::uuid
      `;
      expect(await resolve(profileA, versionA)).toMatchObject({ resolutionLevel: 'VERSION_DEFAULT', editPolicyId: strictPolicy });
      expect(await resolve(profileA, versionA2)).toMatchObject({ resolutionLevel: 'DENY', denyReason: 'NO_AUTHORITY', bindings: [] });
      // A partial reusable policy may publish, but cannot become a version
      // default: full coverage is enforced at binding rather than promotion.
      await tx.$executeRaw`
        UPDATE public.sys_wf_edit_policy_mst SET lifecycle_status = 'PUBLISHED',
          policy_revision = policy_revision + 1, published_at = now(), published_by = ${actorId}::uuid
        WHERE id = ${pilotPolicy}::uuid
      `;
      await expectConstraintRejection(tx, () => tx.$executeRaw`
        INSERT INTO public.sys_wf_edit_policy_def_cf(workflow_profile_version_id, edit_policy_id)
        VALUES (${versionB}::uuid, ${pilotPolicy}::uuid)
      `, 'missing live status/operation/target decisions');
      await tx.$executeRaw`
        UPDATE public.org_wf_edit_policy_asg_cf SET is_active = true
        WHERE tenant_org_id = ${tenantId}::uuid AND id IN (${organizationOverride}::uuid, ${profileOverride}::uuid)
      `;
      await expectConstraintRejection(tx, () => tx.$executeRaw`
        INSERT INTO public.org_wf_edit_policy_asg_cf(tenant_org_id, scope, workflow_profile_id, edit_policy_id)
        VALUES (${tenantId}::uuid, 'PROFILE', ${profileA}::uuid, ${strictPolicy}::uuid)
      `, '23505');
      // Case G: an unusable broad link blocks the usable narrower override.
      await tx.$executeRaw`
        UPDATE public.sys_wf_edit_policy_mst SET lifecycle_status = 'RETIRED', retired_at = now(), retired_by = ${actorId}::uuid
        WHERE id = ${strictPolicy}::uuid
      `;
      expect(await resolve(profileA, versionA)).toMatchObject({ resolutionLevel: 'DENY', denyReason: 'POLICY_NOT_USABLE', editPolicyId: null, bindings: [] });
      await tx.$executeRaw`
        UPDATE public.org_wf_edit_policy_asg_cf SET is_active = false
        WHERE tenant_org_id = ${tenantId}::uuid AND id = ${organizationOverride}::uuid
      `;
      expect(await resolve(profileA, versionA)).toMatchObject({ resolutionLevel: 'PROFILE', editPolicyId: permissivePolicy });
      await tx.$executeRaw`
        UPDATE public.org_wf_edit_policy_asg_cf SET is_active = false
        WHERE tenant_org_id = ${tenantId}::uuid AND id = ${profileOverride}::uuid
      `;
      throw new Error(ROLLBACK_FIXTURES);
    }, { timeout: 30000 })).rejects.toThrow(ROLLBACK_FIXTURES);

    // A rollback failure would leave a new catalog policy behind. Never delete
    // such evidence automatically; fail visibly instead.
    const leftover = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.sys_wf_edit_policy_mst WHERE id IN (${strictPolicy}::uuid, ${permissivePolicy}::uuid, ${pilotPolicy}::uuid)
    `;
    expect(leftover).toEqual([]);
  });
});
