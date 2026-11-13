/** Purchase tax in a foreign currency is recorded in the organization currency. */
import { COMMERCIAL_ERROR_CODES } from '@/lib/commercial/errors';
import { toMoney } from '@/lib/commercial/money';
import type { DocFxRate } from '@/lib/services/fx/doc-fx-rate';
import { resolvePurchaseTax, writePurchaseTaxLines, type PurchaseTax } from '@/lib/services/tax/purchase-tax.service';
import type { PurchaseTaxCode } from '@/lib/tax/purchase-tax';

const usdRate: DocFxRate = {
  baseCurrencyCode: 'OMR',
  exchangeRate: '0.3846153846',
  fxRateDate: '2026-11-01',
  fxRateSource: 'HQ:CBO',
  fxRateId: 'rate-1',
  baseMinorUnit: 3,
};

const code: PurchaseTaxCode = {
  id: 'profile-1',
  taxCode: 'VAT_IN_STD',
  versionNo: 1,
  effectiveFrom: '2020-01-01',
  effectiveTo: null,
  ratePercent: '5.00',
  amountKind: 'PERCENT',
  calcLevel: 'LINE',
  categoryCode: 'STANDARD',
  exemptReasonCode: null,
  recoverablePct: '100',
};

function tax(over: Partial<PurchaseTax> = {}): PurchaseTax {
  return {
    ruleId: 'rule-1',
    taxAmount: toMoney('5'),
    parts: [{ seq: 1, code, taxable: toMoney('100'), tax: toMoney('5'), recoverable: toMoney('5') }],
    itemClass: 'PURCHASE_STANDARD',
    supplierId: null,
    branchId: null,
    date: '2026-11-13',
    currencyCode: 'USD',
    flow: 'INPUT',
    fx: usdRate,
    ...over,
  };
}

describe('writePurchaseTaxLines base currency', () => {
  it('keeps base equal to the document amount when the currencies match', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      org_tax_periods_mst: { findFirst: jest.fn().mockResolvedValue({ id: 'period-1' }) },
      org_tax_lines_tr: { createMany },
    };
    await writePurchaseTaxLines(tx as never, {
      tenantOrgId: 'tenant-1',
      docTypeCode: 'ERP_EXPENSE',
      docId: 'doc-1',
      docNo: 'EXP-1',
      lineId: 'line-1',
      userId: null,
      at: new Date('2026-11-13T00:00:00.000Z'),
      tax: tax({
        currencyCode: 'OMR',
        fx: { ...usdRate, exchangeRate: '1', fxRateDate: null, fxRateSource: null, fxRateId: null },
      }),
    });
    const row = createMany.mock.calls[0][0].data[0];
    expect(row.tenant_org_id).toBe('tenant-1');
    expect(row.base_currency_code).toBe('OMR');
    expect(row.base_taxable_amount).toBe('100.0000');
    expect(row.base_tax_amount).toBe('5.0000');
    expect(row.fx_rate).toBeNull();
    expect(row.fx_rate_date).toBeNull();
    expect(row.fx_rate_source).toBeNull();
    expect(row.fx_rate_id).toBeNull();
  });

  it('converts a USD expense into OMR and rounds to the baisa', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      org_tax_periods_mst: { findFirst: jest.fn().mockResolvedValue(null) },
      org_tax_lines_tr: { createMany },
    };
    await writePurchaseTaxLines(tx as never, {
      tenantOrgId: 'tenant-1',
      docTypeCode: 'ERP_EXPENSE',
      docId: 'doc-1',
      docNo: 'EXP-1',
      lineId: null,
      userId: 'user-1',
      at: new Date('2026-11-13T00:00:00.000Z'),
      tax: tax(),
    });
    const row = createMany.mock.calls[0][0].data[0];
    // 100 × 0.3846153846 = 38.46153846 → 38.462 OMR; 5 × rate = 1.923076923 → 1.923 OMR.
    expect(row.currency_code).toBe('USD');
    expect(row.base_currency_code).toBe('OMR');
    expect(row.base_taxable_amount).toBe('38.4620');
    expect(row.base_tax_amount).toBe('1.9230');
    expect(row.taxable_amount).toBe('100.0000');
    expect(row.tax_amount).toBe('5.0000');
    expect(row.fx_rate).toBe('0.3846153846');
    expect(row.fx_rate_source).toBe('HQ:CBO');
    expect(row.fx_rate_id).toBe('rate-1');
    expect(row.fx_rate_date).toEqual(new Date('2026-11-01'));
  });
});

describe('resolvePurchaseTax foreign currency', () => {
  it('does not refuse a foreign currency once a rate is supplied', async () => {
    const tx = {
      org_tax_config_cf: { findFirst: jest.fn().mockResolvedValue({ status: 'ACTIVE', tax_enabled: true }) },
      org_tenants_mst: { findFirst: jest.fn().mockResolvedValue({ country: 'OM', currency: 'OMR' }) },
      org_fin_supp_mst: { findFirst: jest.fn() },
      sys_currency_cd: { findUnique: jest.fn().mockResolvedValue({ minor_unit: 2 }) },
      org_tax_profiles_cf: { findMany: jest.fn().mockResolvedValue([]) },
      org_tax_item_classes_cf: { findFirst: jest.fn().mockResolvedValue({ class_code: 'PURCHASE_STANDARD' }) },
      org_tax_rules_cf: { findMany: jest.fn().mockResolvedValue([]) },
    };
    await expect(resolvePurchaseTax(tx as never, {
      tenantOrgId: 'tenant-1',
      flow: 'INPUT',
      docTypeCode: 'ERP_EXPENSE',
      date: '2026-11-13',
      branchId: null,
      supplierId: null,
      itemClass: null,
      currencyCode: 'USD',
      fx: usdRate,
      net: 100,
      enteredTax: null,
    })).rejects.toMatchObject({ code: COMMERCIAL_ERROR_CODES.NO_TAX_RULE });
  });
});
