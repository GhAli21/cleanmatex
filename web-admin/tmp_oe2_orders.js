const fs = require('fs');
const text = fs.readFileSync('.env.dbcloudjh', 'utf8');
const pick = (k) => { const m = text.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : null; };
const url = pick('DATABASE_URL') || pick('DIRECT_URL') || pick('POSTGRES_URL');
(async () => {
  const { Client } = require('pg');
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const orders = await c.query(`
    SELECT o.id::text, o.order_no, o.current_status, o.total_amount, o.currency_code,
           (SELECT COUNT(*) FROM org_order_items_dtl i WHERE i.order_id = o.id AND i.rec_status = 1) AS item_lines,
           (SELECT COALESCE(SUM(i.qty),0) FROM org_order_items_dtl i WHERE i.order_id = o.id AND i.rec_status = 1) AS qty_sum
    FROM org_orders_mst o
    WHERE o.tenant_org_id = '11111111-1111-1111-1111-111111111111' AND o.rec_status = 1
    ORDER BY o.order_no DESC LIMIT 10`);
  console.log('ORDERS=' + orders.rows.length);
  for (const r of orders.rows) console.log(JSON.stringify(r));
  const items = await c.query(`
    SELECT i.order_id::text, i.product_name, i.service_name, i.qty, i.unit_price, i.line_total, i.pieces_count
    FROM org_order_items_dtl i
    JOIN org_orders_mst o ON o.id = i.order_id
    WHERE o.tenant_org_id = '11111111-1111-1111-1111-111111111111'
      AND o.id = '10012a76-ca6d-4fd5-ac2c-014a7723d311' AND i.rec_status = 1`);
  console.log('ITEMS_0001=' + items.rows.length);
  for (const r of items.rows) console.log(JSON.stringify(r));
  const pol = await c.query(`
    SELECT p.id::text, p.policy_code, p.lifecycle_status, p.policy_revision, p.workflow_profile_version_id::text
    FROM sys_wf_edit_policy_mst p
    WHERE p.lifecycle_status IN ('PILOT','PUBLISHED') AND p.is_active AND p.rec_status=1`);
  console.log('POLICIES=' + pol.rows.length);
  for (const r of pol.rows) console.log(JSON.stringify(r));
  await c.end();
})().catch(e => { console.log('ERR=' + e.message); });
