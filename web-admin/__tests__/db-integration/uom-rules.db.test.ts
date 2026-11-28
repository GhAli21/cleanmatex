/**
 * Live proof of the UoM rules from migrations 0813/0814/0817/0852: seeded units, conversion, whole-count
 * check, quantity scale, catalog seeding of the template unit and the reserved-code guard. Every case runs
 * in a transaction that is thrown away, except the service case, which commits one custom unit (the base
 * conversion rule runs at commit) and deletes it again. Run with npm run test:db-integration;
 * skips when no DB is reachable.
 */
import { prisma } from '@/lib/db/prisma';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import {
  countProductsByUnit, createConversion, createCustomUnit, deleteConversion, listConversions, listUnits, loadUomResolver, updateUnit,
} from '@/lib/services/uom.service';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
const ROLLBACK = new Error('rollback');

/** Runs fn in a transaction and always rolls back; returns fn's result. */
async function inRollback<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  let out!: T;
  await prisma.$transaction(async (tx) => { out = await fn(tx); throw ROLLBACK; }).catch((e) => { if (e !== ROLLBACK) throw e; });
  return out;
}

let dbUp = false;
let tenantId = '';

beforeAll(async () => {
  try {
    const rows = await prisma.$queryRaw<Array<{ tenant_org_id: string }>>`
      SELECT tenant_org_id FROM public.org_uom_cf WHERE uom_code = 'KG' AND is_active GROUP BY tenant_org_id LIMIT 1`;
    tenantId = rows[0]?.tenant_org_id ?? '';
    dbUp = !!tenantId;
  } catch { dbUp = false; }
});
afterAll(async () => { await prisma.$disconnect(); });

// Prisma raw errors carry the SQLSTATE (e.g. 23514 check_violation), not the RAISE text.
const rejects = (p: Promise<unknown>, code: string) => expect(p).rejects.toThrow(code);

describe('UoM database rules', () => {
  it('converts kg to g and kg to kg', async () => {
    if (!dbUp) return;
    const r = await inRollback((tx) => tx.$queryRaw<Array<{ g: string; kg: string }>>`
      SELECT public.fn_uom_convert(${tenantId}::uuid, NULL, 2.5, 'KG', 'G', false)::text AS g,
             public.fn_uom_convert(${tenantId}::uuid, NULL, 1, 'KG', 'KG', false)::text AS kg`);
    expect(Number(r[0].g)).toBe(2500);
    expect(Number(r[0].kg)).toBe(1);
  });

  it('refuses a fractional result into a COUNT unit (whole check or missing conversion)', async () => {
    if (!dbUp) return;
    await rejects(
      inRollback((tx) => tx.$queryRaw`SELECT public.fn_uom_convert(${tenantId}::uuid, NULL, 1, 'KG', 'PC', true)`),
      'UOM_',
    );
  });

  it('refuses decimals on a whole-number unit and accepts them on a measured one', async () => {
    if (!dbUp) return;
    await rejects(
      inRollback((tx) => tx.$executeRaw`SELECT public.fn_uom_assert_qty_scale(${tenantId}::uuid, 'PC', 1.5, 'quantity')`),
      '23514',
    );
    await inRollback((tx) => tx.$executeRaw`SELECT public.fn_uom_assert_qty_scale(${tenantId}::uuid, 'KG', 1.5, 'quantity')`);
  });

  it('refuses a quantity in a unit the Organization does not have', async () => {
    if (!dbUp) return;
    await rejects(
      inRollback((tx) => tx.$executeRaw`SELECT public.fn_uom_assert_qty_scale(${tenantId}::uuid, 'NOPE', 1, 'quantity')`),
      '23503',
    );
  });

  it('seeds a template unit into the Organization product, and defaults an omitted unit to a piece (0852)', async () => {
    if (!dbUp) return;
    const out = await inRollback(async (tx) => {
      // No business type: every seedable template applies to this Organization.
      await tx.$executeRaw`UPDATE public.org_tenants_mst SET business_type_code = NULL WHERE id = ${tenantId}::uuid`;
      // An item / category pair that has neither a template nor a product yet.
      const [pair] = await tx.$queryRaw<Array<{ item: string; ctg: string }>>`
        SELECT i.item_code AS item, c.service_category_code AS ctg
          FROM public.sys_items_data_list_cd i
          CROSS JOIN public.org_service_category_cf c
         WHERE c.tenant_org_id = ${tenantId}::uuid AND c.service_category_code <> 'RETAIL_ITEMS'
           AND NOT EXISTS (SELECT 1 FROM public.sys_service_prod_templates_cd t
                            WHERE t.item_code = i.item_code AND t.service_category_code = c.service_category_code)
           AND NOT EXISTS (SELECT 1 FROM public.org_product_data_mst p
                            WHERE p.tenant_org_id = ${tenantId}::uuid AND p.service_category_code = c.service_category_code
                              AND p.product_code = i.item_code)
         ORDER BY 1, 2 LIMIT 1`;
      await tx.$executeRaw`
        INSERT INTO public.sys_service_prod_templates_cd (item_code, service_category_code, template_code, name, base_uom_code, is_to_seed)
        VALUES (${pair.item}, ${pair.ctg}, 'UOM_SEED_TEST', 'Unit seed test', 'KG', true)`;
      const seededUnit = () => tx.$queryRaw<Array<{ base_uom_code: string; price_type: string }>>`
        SELECT base_uom_code, price_type FROM public.org_product_data_mst
         WHERE tenant_org_id = ${tenantId}::uuid AND service_category_code = ${pair.ctg} AND product_code = ${pair.item}`;
      const dropSeeded = () => tx.$executeRaw`
        DELETE FROM public.org_product_data_mst
         WHERE tenant_org_id = ${tenantId}::uuid AND service_category_code = ${pair.ctg} AND product_code = ${pair.item}`;

      await tx.$queryRaw`SELECT public.reseed_missing_products(${tenantId}::uuid, false, true, ARRAY[${pair.item}]::varchar[])::text`;
      const [reseeded] = await seededUnit();
      await dropSeeded();
      await tx.$queryRaw`SELECT public.initialize_tenant_product_catalog(${tenantId}::uuid)::text`;
      const [initialized] = await seededUnit();

      const [omitted] = await tx.$queryRaw<Array<{ base_uom_code: string; price_type: string }>>`
        INSERT INTO public.org_product_data_mst (tenant_org_id, service_category_code, product_code, product_name)
        VALUES (${tenantId}::uuid, ${pair.ctg}, 'UOM-NO-UNIT', 'No unit given')
        RETURNING base_uom_code, price_type`;
      return { reseeded, initialized, omitted };
    });

    expect(out.reseeded).toEqual({ base_uom_code: 'KG', price_type: 'PER_UNIT' });
    expect(out.initialized).toEqual({ base_uom_code: 'KG', price_type: 'PER_UNIT' });
    expect(out.omitted).toEqual({ base_uom_code: 'PC', price_type: 'PER_UNIT' });
  }, 60_000);

  it('accepts a custom measured unit only together with its base conversion', async () => {
    if (!dbUp) return;
    // The rule is a deferred constraint (checked at commit); SET CONSTRAINTS runs it inside the rolled-back transaction.
    const addUnit = (tx: Tx) => tx.$executeRaw`
      INSERT INTO public.org_uom_cf (tenant_org_id, uom_code, name, symbol, uom_dimension, qty_decimals)
      VALUES (${tenantId}::uuid, 'BASKET_T', 'Basket', 'bsk', 'MASS', 2)`;
    await rejects(
      inRollback(async (tx) => {
        await addUnit(tx);
        await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
      }),
      '23514',
    );
    await inRollback(async (tx) => {
      await addUnit(tx);
      await tx.$executeRaw`
        INSERT INTO public.org_uom_conv_cf (tenant_org_id, from_uom_code, to_uom_code, multiply_rate, divide_rate)
        VALUES (${tenantId}::uuid, 'BASKET_T', 'KG', 5, 0.2)`;
      await tx.$executeRaw`SET CONSTRAINTS ALL IMMEDIATE`;
    });
  });

  it('the service commits a measured custom unit with its base conversion', async () => {
    if (!dbUp) return;
    const code = `T_${Date.now().toString(36).toUpperCase()}`;
    const input = { kind: 'custom' as const, code, dimension: 'MASS', name: 'Test basket', symbol: 'tb', qtyDecimals: 2, isPackaging: false, baseMultiplyRate: '5' };
    try {
      const unit = await createCustomUnit(tenantId, 'uom-db-test', input);
      expect(unit).toMatchObject({ code, dimension: 'MASS', origin: 'CUSTOM' });
      const pairs = await prisma.$queryRaw<Array<{ to_uom_code: string; m: string; d: string }>>`
        SELECT to_uom_code, multiply_rate::text AS m, divide_rate::text AS d FROM public.org_uom_conv_cf
         WHERE tenant_org_id = ${tenantId}::uuid AND from_uom_code = ${code}`;
      expect(pairs.map((p) => [p.to_uom_code, Number(p.m), Number(p.d)])).toEqual([['KG', 5, 0.2]]);
      await expect(createCustomUnit(tenantId, 'uom-db-test', { ...input, code: 'KG' })).rejects.toMatchObject({ code: 'UOM_CODE_RESERVED' });
    } finally {
      await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM public.org_uom_conv_cf WHERE tenant_org_id = ${tenantId}::uuid AND from_uom_code = ${code}`,
        prisma.$executeRaw`DELETE FROM public.org_uom_cf WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = ${code}`,
      ]);
    }
  });

  // These go through the API client, so they run only when it points at the same local stack and the
  // local API accepts its key; otherwise they say so instead of passing silently.
  const localApi = async () => {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://unset').hostname;
    const error = ['localhost', '127.0.0.1'].includes(host)
      ? (await createAdminSupabaseClient().from('sys_uom_cd').select('uom_code').limit(1)).error?.message
      : 'the API client does not point at the local stack';
    if (error) console.warn(`SKIPPED (local API unusable): ${error}`);
    return !error;
  };

  it('stores every digit of a rate, keeps product pairs apart, and deletes only own pairs', async () => {
    if (!dbUp || !(await localApi())) return;
    const [product] = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_product_data_mst WHERE tenant_org_id = ${tenantId}::uuid AND rec_status = 1 ORDER BY id LIMIT 1`;
    const rate = '1234567.123456789012';
    const input = {
      productId: product.id, fromCode: 'BOX', toCode: 'KG', multiplyRate: rate, divideRate: '0.000000810000', isActive: true,
    };
    await prisma.$executeRaw`SELECT public.fn_uom_seed_tenant(${tenantId}::uuid, ARRAY['BOX']::text[])`;
    let id = '';
    try {
      const created = await createConversion(tenantId, 'uom-db-test', input);
      id = created.id;
      expect(created.multiplyRate).toBe(rate);
      await expect(createConversion(tenantId, 'uom-db-test', { ...input, fromCode: 'KG', toCode: 'BOX', multiplyRate: '0.000000810000', divideRate: rate }))
        .rejects.toMatchObject({ code: 'UOM_CONV_EXISTS' });
      expect((await listConversions(tenantId, { productId: product.id })).map((c) => c.id)).toEqual([id]);
      expect((await listConversions(tenantId)).map((c) => c.id)).not.toContain(id);
      expect((await loadUomResolver(tenantId, product.id)).rate('BOX', 'KG', product.id)?.toString()).toBe(rate);
      expect((await loadUomResolver(tenantId)).rate('BOX', 'KG', product.id)).toBeNull();
      // Another Organization's id changes nothing.
      await expect(deleteConversion('00000000-0000-4000-8000-000000000000', id)).rejects.toMatchObject({ code: 'UOM_CONVERSION_MISSING' });
      await deleteConversion(tenantId, id);
      expect(await listConversions(tenantId, { productId: product.id })).toEqual([]);
      id = '';
      const system = (await listConversions(tenantId)).find((c) => c.isFromSystem)!;
      await expect(deleteConversion(tenantId, system.id)).rejects.toMatchObject({ code: 'UOM_CONV_SYSTEM' });
    } finally {
      if (id) await prisma.$executeRaw`DELETE FROM public.org_uom_conv_cf WHERE tenant_org_id = ${tenantId}::uuid AND id = ${id}::uuid`;
    }
  });

  it('counts products per unit, and keeps a custom unit usable (base pair and UN/ECE code)', async () => {
    if (!dbUp || !(await localApi())) return;
    const code = `U_${Date.now().toString(36).toUpperCase()}`;
    const counted = await listUnits(tenantId, { activeOnly: false, withProductCounts: true });
    const [expected] = await prisma.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM public.org_product_data_mst
       WHERE tenant_org_id = ${tenantId}::uuid AND base_uom_code = 'PC' AND COALESCE(rec_status, 1) = 1`;
    expect(counted.find((u) => u.code === 'PC')?.productCount).toBe(expected.n);
    try {
      await createCustomUnit(tenantId, 'uom-db-test', { kind: 'custom', code, dimension: 'MASS', name: 'Test sack', symbol: 'sk', qtyDecimals: 2, isPackaging: false, baseMultiplyRate: '25' });
      await expect(createCustomUnit(tenantId, 'uom-db-test', { kind: 'custom', code, dimension: 'MASS', name: 'Again', symbol: 'sk', qtyDecimals: 2, isPackaging: false, baseMultiplyRate: '25' }))
        .rejects.toMatchObject({ code: 'UOM_CODE_EXISTS' });
      expect((await updateUnit(tenantId, 'uom-db-test', code, { uneceCode: 'SA' })).uneceCode).toBe('SA');
      await expect(updateUnit(tenantId, 'uom-db-test', 'KG', { uneceCode: 'XX' })).rejects.toMatchObject({ code: 'UOM_FIELD_LOCKED' });
      const [base] = await listConversions(tenantId).then((all) => all.filter((c) => c.fromCode === code));
      await expect(deleteConversion(tenantId, base.id)).rejects.toMatchObject({ code: 'UOM_BASE_CONV_REQUIRED' });
    } finally {
      await prisma.$transaction([
        prisma.$executeRaw`DELETE FROM public.org_uom_conv_cf WHERE tenant_org_id = ${tenantId}::uuid AND from_uom_code = ${code}`,
        prisma.$executeRaw`DELETE FROM public.org_uom_cf WHERE tenant_org_id = ${tenantId}::uuid AND uom_code = ${code}`,
      ]);
    }
  });

  it('counts the live products of the Organization on each unit', async () => {
    if (!dbUp) return;
    const counts = await countProductsByUnit(tenantId);
    const rows = await prisma.$queryRaw<Array<{ code: string; n: number }>>`
      SELECT base_uom_code AS code, count(*)::int AS n FROM public.org_product_data_mst
       WHERE tenant_org_id = ${tenantId}::uuid AND COALESCE(rec_status, 1) = 1 GROUP BY base_uom_code`;
    expect(Object.fromEntries(counts)).toEqual(Object.fromEntries(rows.map((r) => [r.code, r.n])));
  });

  it('refuses a custom unit that reuses a system code', async () => {
    if (!dbUp) return;
    await rejects(
      inRollback((tx) => tx.$executeRaw`
        INSERT INTO public.org_uom_cf (tenant_org_id, uom_code, name, symbol, uom_dimension)
        VALUES (${tenantId}::uuid, 'KG', 'Mine', 'kg', 'MASS')`),
      '23505',
    );
  });
});
