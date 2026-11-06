/**
 * DB harness env defaults. next/jest skips .env.local under NODE_ENV=test, but some
 * services build a Supabase client when their module loads. These suites only use
 * Prisma, so local-stack placeholders are enough; a test that really calls Supabase
 * fails loudly instead of the whole suite failing to load.
 */
process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://127.0.0.1:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'db-integration-placeholder-anon-key';
