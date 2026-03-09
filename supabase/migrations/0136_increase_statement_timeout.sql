-- Increase statement timeout for API roles to avoid
-- "canceling statement due to statement timeout" on complex queries (e.g. orders list)
-- Default Supabase Cloud timeout is ~8s which is too low for queries with joins + search

ALTER ROLE authenticator SET statement_timeout = '60s';
ALTER ROLE anon SET statement_timeout = '60s';
ALTER ROLE authenticated SET statement_timeout = '60s';
