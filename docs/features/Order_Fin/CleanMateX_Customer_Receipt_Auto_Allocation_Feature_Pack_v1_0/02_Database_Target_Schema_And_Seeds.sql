-- CleanMateX Customer Receipt Auto Allocation — Target Schema + Seeds v1.0
-- IMPORTANT: Reference only. AI assistant must inspect current schema and generate the proper migration.

create table if not exists public.org_customer_receipt_allocation_policy_cf (
  id uuid not null default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid null,
  policy_code varchar(80) not null,
  name text not null,
  name2 text null,
  description text null,
  description2 text null,
  is_default boolean not null default false,
  is_active boolean not null default true,
  allocation_mode varchar(50) not null default 'AUTO_OLDEST_DUE',
  include_ar_invoices boolean not null default true,
  include_b2b_statements boolean not null default true,
  include_pay_on_collection_orders boolean not null default true,
  include_open_order_balances boolean not null default true,
  priority_ar_invoices int not null default 10,
  priority_b2b_statements int not null default 20,
  priority_pay_on_collection_orders int not null default 30,
  priority_open_order_balances int not null default 40,
  allow_partial_last_target boolean not null default true,
  require_same_currency boolean not null default true,
  allow_cross_branch_allocation boolean not null default false,
  allow_cross_contract_allocation boolean not null default false,
  fallback_destination varchar(80) not null default 'CUSTOMER_ADVANCE',
  require_confirmation_before_posting boolean not null default true,
  max_targets_per_allocation int not null default 100,
  metadata jsonb not null default '{}'::jsonb,
  rec_status smallint not null default 1,
  created_at timestamptz not null default now(),
  created_by varchar(120) null,
  updated_at timestamptz null,
  updated_by varchar(120) null,
  constraint pk_org_customer_receipt_allocation_policy_cf primary key (id, tenant_org_id),
  constraint uq_org_customer_receipt_allocation_policy_code unique (tenant_org_id, branch_id, policy_code),
  constraint chk_customer_receipt_allocation_mode check (allocation_mode in ('AUTO_OLDEST_DUE','AUTO_OLDEST_DOCUMENT','AUTO_PRIORITY_THEN_OLDEST','MANUAL_ONLY')),
  constraint chk_customer_receipt_fallback_destination check (fallback_destination in ('CUSTOMER_ADVANCE','WALLET_TOPUP','CUSTOMER_CREDIT','RETURN_CHANGE','BLOCK_AND_REQUIRE_MANUAL_ACTION')),
  constraint chk_customer_receipt_max_targets check (max_targets_per_allocation > 0)
);

comment on table public.org_customer_receipt_allocation_policy_cf is 'Tenant/branch policy for auto allocation of excess customer receipt amounts across open customer balances.';
comment on column public.org_customer_receipt_allocation_policy_cf.allocation_mode is 'Auto-allocation mode: oldest due, oldest document, priority then oldest, or manual only.';
comment on column public.org_customer_receipt_allocation_policy_cf.fallback_destination is 'Where remaining excess goes after eligible open balances are paid. Recommended default is CUSTOMER_ADVANCE.';
comment on column public.org_customer_receipt_allocation_policy_cf.allow_partial_last_target is 'When true, system may partially pay the last eligible target with remaining amount.';
comment on column public.org_customer_receipt_allocation_policy_cf.require_same_currency is 'When true, allocation targets must match receipt currency. Cross-currency allocation requires future FX policy.';

create index if not exists idx_receipt_alloc_policy_tenant_branch_active on public.org_customer_receipt_allocation_policy_cf (tenant_org_id, branch_id, is_active, is_default);

create table if not exists public.org_customer_receipt_allocation_preview_tr (
  id uuid not null default gen_random_uuid(),
  tenant_org_id uuid not null,
  branch_id uuid null,
  customer_id uuid not null,
  source_type varchar(80) not null,
  source_order_id uuid null,
  policy_id uuid null,
  receipt_amount numeric(19,4) not null,
  current_order_allocation_amount numeric(19,4) not null default 0,
  excess_amount numeric(19,4) not null default 0,
  amount_allocated numeric(19,4) not null default 0,
  remaining_unallocated_amount numeric(19,4) not null default 0,
  currency_code varchar(3) not null,
  currency_ex_rate numeric(22,10) null,
  allocation_mode varchar(50) not null,
  fallback_destination varchar(80) null,
  preview_status varchar(50) not null default 'DRAFT',
  preview_payload jsonb not null default '{}'::jsonb,
  warning_payload jsonb not null default '[]'::jsonb,
  idempotency_key varchar(180) null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  created_by varchar(120) null,
  updated_at timestamptz null,
  updated_by varchar(120) null,
  constraint pk_org_customer_receipt_allocation_preview_tr primary key (id, tenant_org_id),
  constraint chk_customer_receipt_preview_amounts check (receipt_amount >= 0 and current_order_allocation_amount >= 0 and excess_amount >= 0 and amount_allocated >= 0 and remaining_unallocated_amount >= 0),
  constraint chk_customer_receipt_preview_status check (preview_status in ('DRAFT','CONFIRMED','POSTED','EXPIRED','CANCELLED'))
);

comment on table public.org_customer_receipt_allocation_preview_tr is 'Optional transaction table storing generated customer receipt allocation previews for audit, confirmation, and idempotency.';
comment on column public.org_customer_receipt_allocation_preview_tr.preview_payload is 'JSON snapshot of proposed allocation lines, target documents, amounts, fallback, and sorting policy used.';

create unique index if not exists uq_customer_receipt_preview_idempotency on public.org_customer_receipt_allocation_preview_tr (tenant_org_id, idempotency_key) where idempotency_key is not null;

-- Required overpayment resolution seed additions.
insert into public.sys_overpayment_resolution_cd (
  resolution_code, name, name2, description, description2,
  allowed_for_cash, allowed_for_card, allowed_for_gateway, allowed_for_bank, allowed_for_check, allowed_for_mobile, allowed_for_stored_value,
  creates_change_return, creates_payment_reduction, creates_void_or_refund,
  creates_customer_advance, creates_customer_credit, restores_stored_value,
  requires_permission, permission_code, requires_reason, requires_approval, display_order, metadata
) values
('ALLOCATE_TO_CUSTOMER_BALANCES','Manual Allocate to Customer Balances','توزيع يدوي على أرصدة العميل','Cashier manually allocates excess amount to customer open orders, AR invoices, statements, wallet, advance, or credit.','يقوم أمين الصندوق بتوزيع المبلغ الزائد يدوياً على طلبات أو فواتير أو كشوفات أو محفظة أو دفعات مقدمة أو أرصدة العميل.',true,true,true,true,true,true,false,false,false,false,false,false,false,false,null,false,false,70,'{"requires_allocation_details": true, "creates_multi_target_allocation": true}'::jsonb),
('AUTO_ALLOCATE_TO_CUSTOMER_BALANCES','Auto Allocate to Customer Balances','توزيع آلي على أرصدة العميل','System automatically allocates excess amount to oldest eligible customer balances according to tenant policy.','يقوم النظام بتوزيع المبلغ الزائد آلياً على أقدم أرصدة العميل المؤهلة حسب سياسة المنشأة.',true,true,true,true,true,true,false,false,false,false,false,false,false,false,null,false,false,80,'{"requires_allocation_details": true, "creates_multi_target_allocation": true, "uses_allocation_policy": true}'::jsonb)
on conflict (resolution_code) do update set
  name=excluded.name, name2=excluded.name2, description=excluded.description, description2=excluded.description2,
  allowed_for_cash=excluded.allowed_for_cash, allowed_for_card=excluded.allowed_for_card, allowed_for_gateway=excluded.allowed_for_gateway,
  allowed_for_bank=excluded.allowed_for_bank, allowed_for_check=excluded.allowed_for_check, allowed_for_mobile=excluded.allowed_for_mobile,
  allowed_for_stored_value=excluded.allowed_for_stored_value, creates_change_return=excluded.creates_change_return,
  creates_payment_reduction=excluded.creates_payment_reduction, creates_void_or_refund=excluded.creates_void_or_refund,
  creates_customer_advance=excluded.creates_customer_advance, creates_customer_credit=excluded.creates_customer_credit,
  restores_stored_value=excluded.restores_stored_value, requires_permission=excluded.requires_permission,
  permission_code=excluded.permission_code, requires_reason=excluded.requires_reason, requires_approval=excluded.requires_approval,
  display_order=excluded.display_order, metadata=excluded.metadata, updated_at=now();

-- Required voucher line roles. If already exists, update safely.
insert into public.sys_fin_voucher_line_role_cd (
  line_role, name, name2, description, description2,
  default_line_type, default_target_type, default_direction,
  creates_order_payment, creates_order_credit_application, creates_invoice_payment, creates_invoice_credit_application,
  creates_wallet_ledger, creates_gift_card_ledger, creates_customer_advance_ledger, creates_customer_credit_ledger,
  creates_supplier_payment, creates_expense_payment, creates_cash_drawer_movement, creates_refund_effect,
  requires_payment_method, requires_credit_application_type, requires_target_id, requires_source_reference, display_order
) values
('STATEMENT_PAYMENT','Statement Payment','دفع كشف حساب','Real payment collected against a B2B statement.','دفع حقيقي محصل على كشف حساب عميل شركات.','RECEIPT','B2B_STATEMENT','IN',false,false,true,false,false,false,false,false,false,false,true,false,true,false,true,false,50),
('WALLET_TOPUP','Wallet Top-up','شحن محفظة','Real payment used to increase customer wallet balance.','دفع حقيقي يستخدم لزيادة رصيد محفظة العميل.','RECEIPT','WALLET_TOPUP','IN',false,false,false,false,true,false,false,false,false,false,true,false,true,false,true,false,70),
('CUSTOMER_ADVANCE_RECEIPT','Customer Advance Receipt','قبض دفعة مقدمة','Real payment received as customer advance/deposit.','دفع حقيقي مقبوض كدفعة مقدمة أو عربون للعميل.','RECEIPT','CUSTOMER_ADVANCE','IN',false,false,false,false,false,false,true,false,false,false,true,false,true,false,true,false,90),
('CUSTOMER_CREDIT_ISSUE','Customer Credit Issue','إصدار رصيد عميل','Issue customer credit from excess receipt or adjustment.','إصدار رصيد عميل من زيادة قبض أو تسوية.','ADJUSTMENT','CUSTOMER_CREDIT','NEUTRAL',false,false,false,false,false,false,false,true,false,false,false,false,false,false,true,true,100)
on conflict (line_role) do update set
  name=excluded.name, name2=excluded.name2, description=excluded.description, description2=excluded.description2,
  default_line_type=excluded.default_line_type, default_target_type=excluded.default_target_type, default_direction=excluded.default_direction,
  creates_order_payment=excluded.creates_order_payment, creates_invoice_payment=excluded.creates_invoice_payment,
  creates_wallet_ledger=excluded.creates_wallet_ledger, creates_customer_advance_ledger=excluded.creates_customer_advance_ledger,
  creates_customer_credit_ledger=excluded.creates_customer_credit_ledger, creates_cash_drawer_movement=excluded.creates_cash_drawer_movement,
  requires_payment_method=excluded.requires_payment_method, requires_target_id=excluded.requires_target_id,
  requires_source_reference=excluded.requires_source_reference, display_order=excluded.display_order, updated_at=now();

-- Optional tenant default seed template. AI assistant must use project tenant seed convention.
-- insert into public.org_customer_receipt_allocation_policy_cf (...)
-- values (... 'DEFAULT_OLDEST_DUE', 'Default Oldest Due First', ... fallback_destination='CUSTOMER_ADVANCE' ...);
