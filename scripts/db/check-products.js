#!/usr/bin/env node

/**
 * Quick script to check if products exist in database
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'http://127.0.0.1:54321';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

async function checkProducts() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  console.log('🔍 Checking products in database...\n');

  // Check products for Demo Tenant #1
  const { data: products1, error: error1 } = await supabase
    .from('org_product_data_mst')
    .select('*')
    .eq('tenant_org_id', '11111111-1111-1111-1111-111111111111');

  if (error1) {
    console.error('❌ Error fetching products:', error1);
    return;
  }

  console.log(`📦 Demo Laundry LLC: ${products1?.length || 0} products`);
  if (products1 && products1.length > 0) {
    products1.forEach(p => {
      console.log(`   - ${p.product_code}: ${p.product_name} (${p.product_unit}) - ${p.default_sell_price} OMR - Active: ${p.is_active}`);
    });
  }

  console.log('');

  // Check products for Demo Tenant #2
  const { data: products2, error: error2 } = await supabase
    .from('org_product_data_mst')
    .select('*')
    .eq('tenant_org_id', '20000002-2222-2222-2222-222222222221');

  if (error2) {
    console.error('❌ Error fetching products:', error2);
    return;
  }

  console.log(`📦 BlueWave Laundry Co.: ${products2?.length || 0} products`);
  if (products2 && products2.length > 0) {
    products2.forEach(p => {
      console.log(`   - ${p.product_code}: ${p.product_name} (${p.product_unit}) - ${p.default_sell_price} OMR - Active: ${p.is_active}`);
    });
  }

  // Check enabled categories
  console.log('\n🏷️  Checking enabled categories...\n');

  const { data: categories1 } = await supabase
    .from('org_service_category_cf')
    .select('service_category_code')
    .eq('tenant_org_id', '11111111-1111-1111-1111-111111111111');

  console.log(`Demo Laundry LLC: ${categories1?.length || 0} categories enabled`);
  console.log(`   Categories: ${categories1?.map(c => c.service_category_code).join(', ')}`);

  const { data: categories2 } = await supabase
    .from('org_service_category_cf')
    .select('service_category_code')
    .eq('tenant_org_id', '20000002-2222-2222-2222-222222222221');

  console.log(`\nBlueWave Laundry Co.: ${categories2?.length || 0} categories enabled`);
  console.log(`   Categories: ${categories2?.map(c => c.service_category_code).join(', ')}`);
}

checkProducts().catch(console.error);
