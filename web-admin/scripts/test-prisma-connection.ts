/**
 * Prisma Connection Test Script
 *
 * Run this script to verify Prisma can connect to your database:
 * npx tsx scripts/test-prisma-connection.ts
 *
 * Requirements:
 * 1. DATABASE_URL configured in .env.local
 * 2. Prisma schema generated (npx prisma db pull)
 * 3. Prisma client generated (npx prisma generate)
 */

import { PrismaClient } from '@prisma/client'

async function testConnection() {
  console.log('🔍 Testing Prisma connection to Supabase...\n')

  const prisma = new PrismaClient({
    log: ['query', 'error', 'warn'],
  })

  try {
    // Test 1: Basic connection
    console.log('✅ Test 1: Basic connection')
    await prisma.$connect()
    console.log('   Connected successfully!\n')

    // Test 2: Query system tables (no tenant filter needed)
    console.log('✅ Test 2: Query global sys_* tables')
    const orderTypes = await prisma.$queryRaw`
      SELECT COUNT(*) as count FROM sys_order_type_cd
    `
    console.log('   Found sys_order_type_cd records:', orderTypes)

    // Test 3: Query tenant tables
    console.log('\n✅ Test 3: Query org_* tables')
    const tenants = await prisma.$queryRaw`
      SELECT id, name, slug, email FROM org_tenants_mst LIMIT 5
    `
    console.log('   Sample tenants:', tenants)

    // Test 4: Check table existence
    console.log('\n✅ Test 4: Verify key tables exist')
    const tables = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND (table_name LIKE 'sys_%' OR table_name LIKE 'org_%')
      ORDER BY table_name
      LIMIT 10
    `
    console.log('   Sample tables:', tables)

    console.log('\n✨ All tests passed! Prisma is configured correctly.')
    console.log('\n📝 Next steps:')
    console.log('   1. Run: npx prisma db pull (if not done yet)')
    console.log('   2. Run: npx prisma generate')
    console.log('   3. Start using type-safe queries in your app!')

  } catch (error: any) {
    console.error('\n❌ Connection test failed!')
    console.error('\nError details:', error.message)

    if (error.message.includes('Can\'t reach database')) {
      console.error('\n💡 Troubleshooting:')
      console.error('   1. Check DATABASE_URL in .env.local')
      console.error('   2. Replace [YOUR-DB-PASSWORD] with actual password')
      console.error('   3. Verify Supabase project is active')
      console.error('   4. Check connection pooling is enabled in Supabase')
    }

    if (error.message.includes('authentication failed')) {
      console.error('\n💡 Authentication issue:')
      console.error('   - Verify database password is correct')
      console.error('   - Get password from: Supabase Dashboard > Settings > Database')
    }

    process.exit(1)
  } finally {
    await prisma.$disconnect()
    console.log('\n🔌 Disconnected from database')
  }
}

// Run the test
testConnection().catch((error) => {
  console.error('Unexpected error:', error)
  process.exit(1)
})
