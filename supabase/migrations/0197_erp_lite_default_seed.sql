-- ==================================================================
-- Migration: 0197_erp_lite_default_seed.sql
-- Purpose: Seed default ERP-Lite tenant COA, usage mappings, periods,
--          and petty-cash cashbox for existing and future tenants
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Seeds missing defaults only; never overwrites tenant custom data
--   - Adds an AFTER INSERT trigger so new tenants get the same baseline
--   - Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.seed_tenant_erp_lite_defaults(
  p_tenant_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_inserted INTEGER := 0;
  v_accounts_inserted INTEGER := 0;
  v_maps_inserted INTEGER := 0;
  v_periods_inserted INTEGER := 0;
  v_cashboxes_inserted INTEGER := 0;
  v_last_inserted INTEGER := 0;
  v_base_year INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.org_tenants_mst t
    WHERE t.id = p_tenant_id
      AND COALESCE(t.is_active, true) = true
      AND COALESCE(t.rec_status, 1) = 1
  ) THEN
    RAISE EXCEPTION 'Tenant % not found or inactive', p_tenant_id;
  END IF;

  -- ----------------------------------------------------------------
  -- 1. Seed hierarchical tenant chart of accounts
  -- ----------------------------------------------------------------
  INSERT INTO public.org_fin_acct_mst (
    tenant_org_id,
    parent_account_id,
    branch_id,
    acc_type_id,
    acc_group_id,
    account_code,
    name,
    name2,
    description,
    description2,
    is_postable,
    is_control_account,
    is_system_linked,
    manual_post_allowed,
    created_by,
    created_info,
    rec_status,
    rec_order,
    is_active
  )
  SELECT
    p_tenant_id,
    NULL,
    NULL,
    t.acc_type_id,
    g.acc_group_id,
    seed.account_code,
    seed.name,
    seed.name2,
    seed.description,
    seed.description2,
    false,
    false,
    false,
    false,
    'system_seed',
    'Migration 0197 - ERP-Lite default account headers',
    1,
    seed.rec_order,
    true
  FROM (
    VALUES
      ('1000', 'ASSET', 'ASSET_CURRENT', 'Current Assets', 'الأصول المتداولة', 'Default ERP-Lite header for current assets.', 'رأس افتراضي ERP-Lite للأصول المتداولة.', 1000),
      ('2000', 'LIABILITY', 'LIAB_CURRENT', 'Current Liabilities', 'الالتزامات المتداولة', 'Default ERP-Lite header for current liabilities.', 'رأس افتراضي ERP-Lite للالتزامات المتداولة.', 2000),
      ('3000', 'EQUITY', NULL, 'Equity', 'حقوق الملكية', 'Default ERP-Lite equity header.', 'رأس افتراضي ERP-Lite لحقوق الملكية.', 3000),
      ('4000', 'REVENUE', 'REV_OPERATING', 'Operating Revenue', 'الإيرادات التشغيلية', 'Default ERP-Lite header for operating revenue.', 'رأس افتراضي ERP-Lite للإيرادات التشغيلية.', 4000),
      ('5000', 'EXPENSE', 'EXP_OPERATING', 'Operating Expenses', 'المصروفات التشغيلية', 'Default ERP-Lite header for operating expenses.', 'رأس افتراضي ERP-Lite للمصروفات التشغيلية.', 5000)
  ) AS seed(account_code, acc_type_code, acc_group_code, name, name2, description, description2, rec_order)
  JOIN public.sys_fin_acc_type_cd t
    ON t.acc_type_code = seed.acc_type_code
   AND t.is_active = true
   AND t.rec_status = 1
  LEFT JOIN public.sys_fin_acc_group_cd g
    ON g.acc_group_code = seed.acc_group_code
   AND g.is_active = true
   AND g.rec_status = 1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.org_fin_acct_mst a
    WHERE a.tenant_org_id = p_tenant_id
      AND a.account_code = seed.account_code
  );

  GET DIAGNOSTICS v_accounts_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_accounts_inserted;

  INSERT INTO public.org_fin_acct_mst (
    tenant_org_id,
    parent_account_id,
    branch_id,
    acc_type_id,
    acc_group_id,
    account_code,
    name,
    name2,
    description,
    description2,
    is_postable,
    is_control_account,
    is_system_linked,
    manual_post_allowed,
    created_by,
    created_info,
    rec_status,
    rec_order,
    is_active
  )
  SELECT
    p_tenant_id,
    parent.id,
    NULL,
    t.acc_type_id,
    g.acc_group_id,
    seed.account_code,
    seed.name,
    seed.name2,
    seed.description,
    seed.description2,
    seed.is_postable,
    seed.is_control_account,
    seed.is_system_linked,
    seed.manual_post_allowed,
    'system_seed',
    'Migration 0197 - ERP-Lite default accounts',
    1,
    seed.rec_order,
    true
  FROM (
    VALUES
      ('1100', '1000', 'ASSET', 'ASSET_RECEIVABLE', 'Accounts Receivable', 'الذمم المدينة', 'Default ERP-Lite receivable control account.', 'حساب رقابي افتراضي ERP-Lite للذمم المدينة.', true, true, true, false, 1100),
      ('1110', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Cash Main', 'الصندوق الرئيسي', 'Default ERP-Lite main cash account.', 'حساب الصندوق الرئيسي الافتراضي لـ ERP-Lite.', true, false, true, false, 1110),
      ('1120', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Card Clearing', 'تسوية بطاقات البنك', 'Default ERP-Lite card settlement clearing account.', 'حساب افتراضي لتسوية بطاقات البنك في ERP-Lite.', true, false, true, false, 1120),
      ('1130', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Petty Cash Main', 'العهدة النقدية الرئيسية', 'Default ERP-Lite petty cash account.', 'حساب العهدة النقدية الافتراضي لـ ERP-Lite.', true, false, true, false, 1130),
      ('1140', '1000', 'ASSET', 'ASSET_TAX_INPUT', 'Input VAT Recoverable', 'ضريبة المدخلات القابلة للاسترداد', 'Default ERP-Lite recoverable input VAT account.', 'حساب افتراضي ERP-Lite لضريبة المدخلات القابلة للاسترداد.', true, false, true, false, 1140),
      ('1150', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Main Operating', 'البنك التشغيلي الرئيسي', 'Default operating bank asset account for AP and treasury flows.', 'حساب أصل بنكي تشغيلي افتراضي لتدفقات الخزينة والدائنين.', true, false, false, true, 1150),
      ('1160', '1000', 'ASSET', 'ASSET_CURRENT', 'Prepaid Expenses', 'مصروفات مقدمة', 'Default prepaid expense asset account.', 'حساب أصل افتراضي للمصروفات المقدمة.', true, false, false, true, 1160),
      ('2100', '2000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'Output VAT Payable', 'ضريبة المخرجات المستحقة', 'Default ERP-Lite output VAT payable account.', 'حساب افتراضي ERP-Lite لضريبة المخرجات المستحقة.', true, false, true, false, 2100),
      ('2110', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Wallet Clearing', 'تسوية المحفظة', 'Default customer wallet clearing liability account.', 'حساب التزام افتراضي لتسوية محفظة العميل.', true, false, true, false, 2110),
      ('2120', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Refund Payable', 'استردادات مستحقة', 'Default refund payable liability account.', 'حساب التزام افتراضي للاستردادات المستحقة.', true, false, true, false, 2120),
      ('2130', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Accounts Payable Control', 'الذمم الدائنة الرقابية', 'Default ERP-Lite AP control account for v2 readiness.', 'حساب رقابي افتراضي ERP-Lite للذمم الدائنة استعداداً للمرحلة الثانية.', true, true, false, true, 2130),
      ('2140', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Customer Advances', 'دفعات العملاء المقدمة', 'Default liability account for customer advances and deposits.', 'حساب التزام افتراضي لدفعات العملاء المقدمة والودائع.', true, false, false, true, 2140),
      ('3100', '3000', 'EQUITY', NULL, 'Owner Capital', 'رأس المال', 'Default owner capital equity account.', 'حساب حقوق ملكية افتراضي لرأس المال.', true, false, false, true, 3100),
      ('3200', '3000', 'EQUITY', NULL, 'Retained Earnings', 'الأرباح المحتجزة', 'Default retained earnings equity account.', 'حساب حقوق ملكية افتراضي للأرباح المحتجزة.', true, false, false, true, 3200),
      ('4100', '4000', 'REVENUE', 'REV_OPERATING', 'Laundry Service Revenue', 'إيراد خدمات المغسلة', 'Default ERP-Lite primary sales revenue account.', 'حساب الإيراد الأساسي الافتراضي لـ ERP-Lite لخدمات المغسلة.', true, false, true, false, 4100),
      ('4110', '4000', 'REVENUE', 'REV_OPERATING', 'Delivery Revenue', 'إيراد التوصيل', 'Default delivery revenue account for v2 readiness.', 'حساب إيراد افتراضي للتوصيل استعداداً للمرحلة الثانية.', true, false, false, true, 4110),
      ('4120', '4000', 'REVENUE', 'REV_OPERATING', 'Service Fee Revenue', 'إيراد رسوم الخدمة', 'Default service fee revenue account for future packages.', 'حساب إيراد افتراضي لرسوم الخدمة للحزم المستقبلية.', true, false, false, true, 4120),
      ('4130', '4000', 'REVENUE', 'REV_OPERATING', 'Subscription Revenue', 'إيراد الاشتراكات', 'Default subscription revenue account for v3 readiness.', 'حساب إيراد افتراضي للاشتراكات استعداداً للمرحلة الثالثة.', true, false, false, true, 4130),
      ('4140', '4000', 'REVENUE', 'REV_OPERATING', 'Rounding Gain', 'ربح فروقات التقريب', 'Default rounding gain revenue account.', 'حساب إيراد افتراضي لأرباح فروقات التقريب.', true, false, false, true, 4140),
      ('5100', '5000', 'EXPENSE', 'EXP_OPERATING', 'General Operating Expense', 'مصروف تشغيلي عام', 'Default ERP-Lite general expense account.', 'حساب مصروف افتراضي ERP-Lite للمصروفات التشغيلية العامة.', true, false, true, false, 5100),
      ('5110', '5000', 'EXPENSE', 'EXP_OPERATING', 'Petty Cash Expense', 'مصروف العهدة النقدية', 'Default petty cash expense account.', 'حساب مصروف افتراضي لمصروفات العهدة النقدية.', true, false, true, false, 5110),
      ('5120', '5000', 'EXPENSE', 'EXP_OPERATING', 'Discount Expense', 'مصروف الخصومات', 'Default discount expense account for v2 readiness.', 'حساب مصروف افتراضي للخصومات استعداداً للمرحلة الثانية.', true, false, false, true, 5120),
      ('5130', '5000', 'EXPENSE', 'EXP_OPERATING', 'Cost of Sales', 'تكلفة المبيعات', 'Default cost-of-sales account for v3 readiness.', 'حساب مصروف افتراضي لتكلفة المبيعات استعداداً للمرحلة الثالثة.', true, false, false, true, 5130),
      ('5140', '5000', 'EXPENSE', 'EXP_OPERATING', 'Rounding Loss', 'خسارة فروقات التقريب', 'Default rounding loss expense account.', 'حساب مصروف افتراضي لخسائر فروقات التقريب.', true, false, false, true, 5140)
  ) AS seed(account_code, parent_code, acc_type_code, acc_group_code, name, name2, description, description2, is_postable, is_control_account, is_system_linked, manual_post_allowed, rec_order)
  JOIN public.org_fin_acct_mst parent
    ON parent.tenant_org_id = p_tenant_id
   AND parent.account_code = seed.parent_code
   AND parent.is_active = true
   AND parent.rec_status = 1
  JOIN public.sys_fin_acc_type_cd t
    ON t.acc_type_code = seed.acc_type_code
   AND t.is_active = true
   AND t.rec_status = 1
  LEFT JOIN public.sys_fin_acc_group_cd g
    ON g.acc_group_code = seed.acc_group_code
   AND g.is_active = true
   AND g.rec_status = 1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.org_fin_acct_mst a
    WHERE a.tenant_org_id = p_tenant_id
      AND a.account_code = seed.account_code
  );

  GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
  v_accounts_inserted := v_accounts_inserted + v_last_inserted;
  v_total_inserted := v_total_inserted + v_last_inserted;

  -- ----------------------------------------------------------------
  -- 2. Seed active usage mappings where no active global mapping exists
  -- ----------------------------------------------------------------
  INSERT INTO public.org_fin_usage_map_mst (
    tenant_org_id,
    branch_id,
    usage_code_id,
    account_id,
    status_code,
    effective_from,
    created_by,
    created_info,
    rec_status,
    rec_order,
    is_active
  )
  SELECT
    p_tenant_id,
    NULL,
    uc.usage_code_id,
    acct.id,
    'ACTIVE',
    CURRENT_DATE,
    'system_seed',
    'Migration 0197 - ERP-Lite default usage mappings',
    1,
    seed.rec_order,
    true
  FROM (
    VALUES
      ('SALES_REVENUE', '4100', 10),
      ('VAT_OUTPUT', '2100', 20),
      ('VAT_INPUT', '1140', 30),
      ('ACCOUNTS_RECEIVABLE', '1100', 40),
      ('CASH_MAIN', '1110', 50),
      ('BANK_CARD_CLEARING', '1120', 60),
      ('PETTY_CASH_MAIN', '1130', 70),
      ('WALLET_CLEARING', '2110', 80),
      ('REFUND_PAYABLE', '2120', 90),
      ('EXPENSE_GENERAL', '5100', 100),
      ('PETTY_CASH_EXPENSE', '5110', 110),
      ('ROUNDING_ADJUSTMENT', '5140', 120)
  ) AS seed(usage_code, account_code, rec_order)
  JOIN public.sys_fin_usage_code_cd uc
    ON uc.usage_code = seed.usage_code
   AND uc.is_active = true
   AND uc.rec_status = 1
  JOIN public.org_fin_acct_mst acct
    ON acct.tenant_org_id = p_tenant_id
   AND acct.account_code = seed.account_code
   AND acct.is_active = true
   AND acct.rec_status = 1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.org_fin_usage_map_mst m
    WHERE m.tenant_org_id = p_tenant_id
      AND m.branch_id IS NULL
      AND m.usage_code_id = uc.usage_code_id
      AND m.status_code = 'ACTIVE'
      AND m.is_active = true
      AND m.rec_status = 1
  );

  GET DIAGNOSTICS v_maps_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_maps_inserted;

  -- ----------------------------------------------------------------
  -- 3. Seed current and next-year accounting periods
  -- ----------------------------------------------------------------
  v_base_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

  INSERT INTO public.org_fin_period_mst (
    tenant_org_id,
    period_code,
    name,
    name2,
    description,
    description2,
    start_date,
    end_date,
    status_code,
    created_by,
    created_info,
    rec_status,
    rec_order,
    is_active
  )
  SELECT
    p_tenant_id,
    TO_CHAR(gs.period_start, 'YYYY-MM') AS period_code,
    TO_CHAR(gs.period_start, 'Mon YYYY') AS name,
    TO_CHAR(gs.period_start, 'YYYY/MM') AS name2,
    'Default ERP-Lite accounting period',
    'فترة محاسبية افتراضية لـ ERP-Lite',
    gs.period_start,
    (gs.period_start + INTERVAL '1 month - 1 day')::date,
    'OPEN',
    'system_seed',
    'Migration 0197 - ERP-Lite default periods',
    1,
    ROW_NUMBER() OVER (ORDER BY gs.period_start),
    true
  FROM generate_series(
    make_date(v_base_year, 1, 1),
    make_date(v_base_year + 1, 12, 1),
    INTERVAL '1 month'
  ) AS gs(period_start)
  ON CONFLICT (tenant_org_id, period_code) DO NOTHING;

  GET DIAGNOSTICS v_periods_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_periods_inserted;

  -- ----------------------------------------------------------------
  -- 4. Seed a default petty-cash cashbox when currency is known
  -- ----------------------------------------------------------------
  INSERT INTO public.org_fin_cashbox_mst (
    tenant_org_id,
    branch_id,
    account_id,
    cashbox_code,
    name,
    name2,
    description,
    description2,
    currency_code,
    opening_date,
    opening_balance,
    is_default,
    created_by,
    created_info,
    rec_status,
    rec_order,
    is_active
  )
  SELECT
    t.id,
    NULL,
    acct.id,
    'PETTY-MAIN',
    'Main Petty Cash',
    'العهدة النقدية الرئيسية',
    'Default ERP-Lite petty cash box linked to the main petty cash account.',
    'صندوق عهدة نقدية افتراضي ERP-Lite مرتبط بحساب العهدة النقدية الرئيسي.',
    t.currency,
    CURRENT_DATE,
    0,
    true,
    'system_seed',
    'Migration 0197 - ERP-Lite default petty cash box',
    1,
    10,
    true
  FROM public.org_tenants_mst t
  JOIN public.org_fin_acct_mst acct
    ON acct.tenant_org_id = t.id
   AND acct.account_code = '1130'
   AND acct.is_active = true
   AND acct.rec_status = 1
  WHERE t.id = p_tenant_id
    AND t.currency IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.org_fin_cashbox_mst c
      WHERE c.tenant_org_id = p_tenant_id
        AND c.is_default = true
        AND c.is_active = true
        AND c.rec_status = 1
    );

  GET DIAGNOSTICS v_cashboxes_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_cashboxes_inserted;

  RETURN v_total_inserted;
END;
$$;

COMMENT ON FUNCTION public.seed_tenant_erp_lite_defaults(UUID) IS
  'Seeds missing ERP-Lite tenant defaults: ideal COA, usage mappings, current/next-year periods, and default petty-cash cashbox.';

GRANT EXECUTE ON FUNCTION public.seed_tenant_erp_lite_defaults(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.fn_seed_erp_lite_tenant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_active, true) = true
     AND COALESCE(NEW.rec_status, 1) = 1 THEN
    PERFORM public.seed_tenant_erp_lite_defaults(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_seed_erp_lite_tenant() IS
  'After-insert tenant trigger that seeds ERP-Lite defaults for active tenants.';

DROP TRIGGER IF EXISTS trg_seed_erp_lite_tnt ON public.org_tenants_mst;

CREATE TRIGGER trg_seed_erp_lite_tnt
  AFTER INSERT ON public.org_tenants_mst
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_seed_erp_lite_tenant();

DO $$
DECLARE
  v_tenant RECORD;
BEGIN
  FOR v_tenant IN
    SELECT id
    FROM public.org_tenants_mst
    WHERE COALESCE(is_active, true) = true
      AND COALESCE(rec_status, 1) = 1
  LOOP
    PERFORM public.seed_tenant_erp_lite_defaults(v_tenant.id);
  END LOOP;
END;
$$;

COMMIT;
