-- PostgreSQL Initialization Script for CleanMateX
-- This script runs automatically when the PostgreSQL container is first created
-- It sets up extensions, roles, and performance settings

-- ============================================
-- Extensions
-- ============================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- Roles and Permissions
-- ============================================

-- Create read-only role for reporting/analytics
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'cmx_readonly') THEN
    CREATE ROLE cmx_readonly;
  END IF;
END
$$;

-- Grant connection and schema access
GRANT CONNECT ON DATABASE cmx_db TO cmx_readonly;
GRANT USAGE ON SCHEMA public TO cmx_readonly;

-- Grant SELECT on all existing tables
GRANT SELECT ON ALL TABLES IN SCHEMA public TO cmx_readonly;

-- Grant SELECT on all future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO cmx_readonly;

-- ============================================
-- Performance Settings
-- ============================================

-- Shared memory for caching (adjust based on system RAM)
ALTER SYSTEM SET shared_buffers = '256MB';

-- OS cache estimation for query planner
ALTER SYSTEM SET effective_cache_size = '1GB';

-- Memory for maintenance operations (VACUUM, CREATE INDEX)
ALTER SYSTEM SET maintenance_work_mem = '64MB';

-- Checkpoint tuning for better write performance
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- Write-Ahead Log buffer
ALTER SYSTEM SET wal_buffers = '16MB';

-- Statistics for query planner
ALTER SYSTEM SET default_statistics_target = 100;

-- SSD optimization (lower value for SSDs)
ALTER SYSTEM SET random_page_cost = 1.1;

-- Connection settings
ALTER SYSTEM SET max_connections = 100;

-- ============================================
-- Logging Settings for Development
-- ============================================

-- Log slow queries (> 1 second)
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Log statement details
ALTER SYSTEM SET log_statement = 'mod'; -- log all modifications

-- Log disconnections
ALTER SYSTEM SET log_disconnections = on;

-- Log lock waits
ALTER SYSTEM SET log_lock_waits = on;

-- ============================================
-- Informational Output
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'CleanMateX PostgreSQL initialization complete!';
  RAISE NOTICE '✓ Extensions: uuid-ossp, pgcrypto';
  RAISE NOTICE '✓ Roles: cmx_readonly';
  RAISE NOTICE '✓ Performance settings applied';
  RAISE NOTICE '✓ Development logging enabled';
END $$;

