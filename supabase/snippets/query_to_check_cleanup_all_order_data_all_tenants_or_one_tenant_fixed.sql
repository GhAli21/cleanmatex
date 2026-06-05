do $$
declare
  r record;
  v_sql text;
  v_count bigint;
begin
  create temp table if not exists cleanup_verification_result (
    table_name text,
    status text,
    remaining_rows bigint
  ) on commit drop;

  delete from cleanup_verification_result;

  for r in
    select unnest(array[
      'org_orders_mst',
      'org_order_items_dtl',
      'org_order_item_pieces_dtl',
      'org_order_preferences_dtl',
      'org_order_charges_dtl',
      'org_order_discounts_dtl',
      'org_order_taxes_dtl',
      'org_order_payments_dtl',
      'org_order_refunds_dtl',
      'org_order_adjustments_dtl',
      'org_order_credit_apps_dtl',
      'org_invoice_mst',
      'org_invoice_lines_dtl',
      'org_invoice_payments_dtl',
      'org_invoice_orders_dtl',
      'org_fin_vouchers_mst',
      'org_fin_voucher_trx_lines_dtl',
      'org_payments_dtl_tr',
      'org_wallet_txn_dtl',
      'org_gift_card_txn_dtl',
      'org_advance_txn_dtl',
      'org_credit_note_txn_dtl',
      'org_loyalty_txn_dtl',
      'org_domain_events_outbox'
    ]) as table_name
  loop
    if to_regclass(format('public.%I', r.table_name)) is null then
      insert into cleanup_verification_result(table_name, status, remaining_rows)
      values (r.table_name, 'TABLE_NOT_FOUND', null);
    else
      v_sql := format('select count(*) from public.%I', r.table_name);
      execute v_sql into v_count;

      insert into cleanup_verification_result(table_name, status, remaining_rows)
      values (
        r.table_name,
        case when v_count = 0 then 'OK_EMPTY' else 'HAS_ROWS' end,
        v_count
      );
    end if;
  end loop;
end $$;

select *
from cleanup_verification_result
order by
  case status
    when 'HAS_ROWS' then 1
    when 'OK_EMPTY' then 2
    when 'TABLE_NOT_FOUND' then 3
    else 4
  end,
  table_name
;

--

select 'org_order_items_dtl' as table_name, count(*) as orphan_rows
from public.org_order_items_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where o.id is null

union all

select 'org_order_charges_dtl', count(*)
from public.org_order_charges_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where o.id is null

union all

select 'org_order_discounts_dtl', count(*)
from public.org_order_discounts_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where o.id is null

union all

select 'org_order_taxes_dtl', count(*)
from public.org_order_taxes_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where o.id is null

union all

select 'org_order_payments_dtl', count(*)
from public.org_order_payments_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where o.id is null

union all

select 'org_order_refunds_dtl', count(*)
from public.org_order_refunds_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where o.id is null

union all

select 'org_order_adjustments_dtl', count(*)
from public.org_order_adjustments_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where o.id is null

union all

select 'org_order_preferences_dtl', count(*)
from public.org_order_preferences_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where o.id is null

order by table_name
;

--

select
  count(*) as orphan_payment_order_rows
from public.org_payments_dtl_tr x
left join public.org_orders_mst o on o.id = x.order_id
where x.order_id is not null
  and o.id is null
;

--

select
  count(*) as orphan_voucher_order_lines
from public.org_fin_voucher_trx_lines_dtl x
left join public.org_orders_mst o on o.id = x.order_id
where x.order_id is not null
  and o.id is null
;

--

select
  'orders_remaining' as check_name,
  count(*) as result_count
from public.org_orders_mst

union all

select
  'order_items_remaining',
  count(*)
from public.org_order_items_dtl

union all

select
  'order_payments_remaining',
  count(*)
from public.org_order_payments_dtl

union all

select
  'voucher_lines_with_order_id_remaining',
  count(*)
from public.org_fin_voucher_trx_lines_dtl
where order_id is not null

union all

select
  'payments_with_order_id_remaining',
  count(*)
from public.org_payments_dtl_tr
where order_id is not null

union all

select
  'invoices_with_order_id_remaining',
  count(*)
from public.org_invoice_mst
where order_id is not null
;


--
commit;