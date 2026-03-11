
-- This List Maybe Old so you can query the database to get the latest
-- Query to get all current tables list

SELECT
    c.relname AS table_name,
    CASE c.relkind
        WHEN 'r' THEN 'table'
        WHEN 'i' THEN 'index'
        WHEN 'S' THEN 'sequence'
        WHEN 'v' THEN 'view'
        WHEN 'm' THEN 'materialized view'
        WHEN 'c' THEN 'composite type'
        WHEN 't' THEN 'toast table'
        WHEN 'f' THEN 'foreign table'
        WHEN 'p' THEN 'partitioned table'
        WHEN 'I' THEN 'partitioned index'
        ELSE c.relkind::text
    END AS type,
    COALESCE(d.description, '') AS table_comment
FROM pg_class c
LEFT JOIN pg_description d
    ON d.objoid = c.oid AND d.objsubid = 0
WHERE c.relkind in( 'r', 'v', 'm', 'c', 't', 'p' ) 
and c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY c.relkind, c.relname;

/*
SELECT
    c.relname AS table_name,
    COALESCE(d.description, '') AS table_comment
FROM pg_class c
LEFT JOIN pg_description d
    ON d.objoid = c.oid AND d.objsubid = 0  -- only table-level comments
WHERE c.relkind = 'r'  -- ordinary tables only
  AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY c.relname;
*/

see schema_06.sql