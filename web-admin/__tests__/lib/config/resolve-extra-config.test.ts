import {
  resolveExtraConfig,
  validateExtraConfigValue,
} from '@/lib/config/resolve-extra-config';
import {
  DEFAULT_RESOLVED_EXTRA_CONFIG,
  EXTRA_CONFIG_KEYS,
} from '@/lib/constants/tenant-extra-config';
import type {
  OrgExtraConfigOverride,
  SysExtraConfigRow,
} from '@/lib/types/tenant-extra-config';

const CATALOG_FIXTURE: SysExtraConfigRow[] = [
  {
    config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT,
    category_code: 'NUMBERS_AND_DATES',
    name: 'Currency & Number Digits',
    name2: 'أرقام العملة والمبالغ',
    description: null,
    description2: null,
    value_type: 'SELECT',
    default_value: 'LATN',
    allowed_values_json: [
      { value: 'LATN', label: 'Western 123', label2: 'لاتينية 123' },
      { value: 'ARAB', label: 'Eastern Arabic', label2: 'مشرقية ١٢٣' },
    ],
    validation_regex: null,
    min_num: null,
    max_num: null,
    is_editable_by_tenant: true,
    plan_flag_key: null,
    rec_order: 10,
    rec_status: 1,
    is_active: true,
  },
  {
    config_key: EXTRA_CONFIG_KEYS.BDI_ISOLATION_ENABLED,
    category_code: 'ACCESSIBILITY',
    name: 'BiDi Isolation',
    name2: 'عزل الاتجاه',
    description: null,
    description2: null,
    value_type: 'BOOLEAN',
    default_value: 'TRUE',
    allowed_values_json: [
      { value: 'TRUE', label: 'Enabled', label2: 'مفعّل' },
      { value: 'FALSE', label: 'Disabled', label2: 'معطّل' },
    ],
    validation_regex: null,
    min_num: null,
    max_num: null,
    is_editable_by_tenant: true,
    plan_flag_key: null,
    rec_order: 10,
    rec_status: 1,
    is_active: true,
  },
  {
    config_key: EXTRA_CONFIG_KEYS.DEFAULT_TABLE_PAGE_SIZE,
    category_code: 'TABLES_AND_DENSITY',
    name: 'Page Size',
    name2: 'حجم الصفحة',
    description: null,
    description2: null,
    value_type: 'SELECT',
    default_value: '10',
    allowed_values_json: [
      { value: '10', label: '10', label2: '10' },
      { value: '20', label: '20', label2: '20' },
      { value: '50', label: '50', label2: '50' },
    ],
    validation_regex: null,
    min_num: null,
    max_num: null,
    is_editable_by_tenant: true,
    plan_flag_key: 'custom_branding',
    rec_order: 10,
    rec_status: 1,
    is_active: true,
  },
  {
    config_key: 'CUSTOM_THRESHOLD',
    category_code: 'POS_ERGONOMICS',
    name: 'Numeric Threshold',
    name2: null,
    description: null,
    description2: null,
    value_type: 'NUMBER',
    default_value: '5',
    allowed_values_json: null,
    validation_regex: null,
    min_num: 1,
    max_num: 10,
    is_editable_by_tenant: false,
    plan_flag_key: null,
    rec_order: 20,
    rec_status: 1,
    is_active: true,
  },
];

describe('validateExtraConfigValue', () => {
  it('accepts valid allowlisted SELECT option and rejects unknown options', () => {
    expect(validateExtraConfigValue(CATALOG_FIXTURE[0], 'ARAB')).toEqual({
      valid: true,
      normalizedValue: 'ARAB',
    });
    const invalid = validateExtraConfigValue(CATALOG_FIXTURE[0], 'DEVANAGARI');
    expect(invalid.valid).toBe(false);
    if (!invalid.valid) expect(invalid.code).toBe('INVALID_OPTION');
  });

  it('normalizes lowercase booleans to TRUE/FALSE and rejects invalid boolean input', () => {
    expect(validateExtraConfigValue(CATALOG_FIXTURE[1], 'false')).toEqual({
      valid: true,
      normalizedValue: 'FALSE',
    });
    const bad = validateExtraConfigValue(CATALOG_FIXTURE[1], 'YES');
    expect(bad.valid).toBe(false);
  });

  it('enforces NUMBER min_num and max_num bounds', () => {
    expect(validateExtraConfigValue(CATALOG_FIXTURE[3], '7')).toEqual({
      valid: true,
      normalizedValue: '7',
    });
    const outLow = validateExtraConfigValue(CATALOG_FIXTURE[3], '0');
    expect(outLow.valid).toBe(false);
    if (!outLow.valid) expect(outLow.code).toBe('OUT_OF_RANGE');
  });
});

describe('resolveExtraConfig', () => {
  it('falls back gracefully to GCC-first defaults when org overrides are empty', () => {
    const { resolved, items } = resolveExtraConfig(CATALOG_FIXTURE, [], {});
    expect(resolved.numberScript).toBe(DEFAULT_RESOLVED_EXTRA_CONFIG.numberScript);
    expect(resolved.bdiIsolationEnabled).toBe(true);
    expect(resolved.defaultTablePageSize).toBe(10);
    expect(items.every((i) => !i.is_overridden && i.source === 'SYSTEM')).toBe(true);
  });

  it('applies valid tenant override when plan flag allows it and blocks when plan disallows', () => {
    const overrides: OrgExtraConfigOverride[] = [
      {
        id: '1',
        tenant_org_id: 't1',
        config_key: EXTRA_CONFIG_KEYS.NUMBER_SCRIPT,
        config_value: 'ARAB',
        rec_status: 1,
        is_active: true,
      },
      {
        id: '2',
        tenant_org_id: 't1',
        config_key: EXTRA_CONFIG_KEYS.DEFAULT_TABLE_PAGE_SIZE,
        config_value: '50',
        rec_status: 1,
        is_active: true,
      },
      {
        id: '3',
        tenant_org_id: 't1',
        config_key: 'CUSTOM_THRESHOLD',
        config_value: '9',
        rec_status: 1,
        is_active: true,
      },
    ];

    const blockedPlan = resolveExtraConfig(CATALOG_FIXTURE, overrides, {
      custom_branding: false,
    });
    expect(blockedPlan.resolved.numberScript).toBe('ARAB');
    expect(blockedPlan.resolved.defaultTablePageSize).toBe(10);
    expect(blockedPlan.resolved.valuesByKey.CUSTOM_THRESHOLD).toBe('5');

    const allowedPlan = resolveExtraConfig(CATALOG_FIXTURE, overrides, {
      custom_branding: true,
    });
    expect(allowedPlan.resolved.defaultTablePageSize).toBe(50);
  });
});
