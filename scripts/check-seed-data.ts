/**
 * Check and display current seed data in the database
 * Usage: npx tsx scripts/check-seed-data.ts
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const supabase = createClient(supabaseUrl, supabaseKey)

async function checkDatabase() {
  console.log('🔍 Checking CleanMateX database seed data...\n')

  try {
    // Check tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('org_tenants_mst')
      .select('id, name, slug, s_cureent_plan')
      .limit(10)

    if (tenantsError) {
      console.error('❌ Error fetching tenants:', tenantsError)
    } else {
      console.log(`✅ Tenants: ${tenants?.length || 0} records`)
      tenants?.forEach(t => {
        console.log(`   - ${t.name} (${t.slug}) - Plan: ${t.s_cureent_plan}`)
      })
    }

    // Check customers
    const { data: customers, error: customersError } = await supabase
      .from('sys_customers_mst')
      .select('id, first_name, last_name, phone')
      .limit(5)

    if (customersError) {
      console.error('\n❌ Error fetching customers:', customersError)
    } else {
      console.log(`\n✅ Customers: ${customers?.length || 0} records`)
      customers?.forEach(c => {
        console.log(`   - ${c.first_name} ${c.last_name} (${c.phone})`)
      })
    }

    // Check orders
    const { data: orders, error: ordersError } = await supabase
      .from('org_orders_mst')
      .select('id, order_number, order_status, total_amount')
      .limit(5)

    if (ordersError) {
      console.error('\n❌ Error fetching orders:', ordersError)
    } else {
      console.log(`\n✅ Orders: ${orders?.length || 0} records`)
      orders?.forEach(o => {
        console.log(`   - ${o.order_number} - Status: ${o.order_status} - Total: ${o.total_amount}`)
      })
    }

    // Check products/services
    const { data: products, error: productsError } = await supabase
      .from('org_product_data_mst')
      .select('id, product_name, service_category_code, base_price')
      .limit(5)

    if (productsError) {
      console.error('\n❌ Error fetching products:', productsError)
    } else {
      console.log(`\n✅ Products/Services: ${products?.length || 0} records`)
      products?.forEach(p => {
        console.log(`   - ${p.product_name} (${p.service_category_code}) - Price: ${p.base_price}`)
      })
    }

    // Summary
    console.log('\n📊 Database Status Summary:')
    console.log('================================')
    console.log(`Tenants: ${tenants?.length || 0}`)
    console.log(`Customers: ${customers?.length || 0}`)
    console.log(`Orders: ${orders?.length || 0}`)
    console.log(`Products: ${products?.length || 0}`)
    console.log('================================\n')

    if (!tenants?.length) {
      console.log('⚠️  No seed data found! Run: supabase db reset')
      console.log('   This will apply all migrations including seed data.')
    } else {
      console.log('✅ Database has seed data. Ready for testing!')
    }

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

checkDatabase()
