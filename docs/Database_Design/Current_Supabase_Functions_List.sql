
-- This List Maybe Old so you can query the database to get the latest
-- Query to get all current functions list
Select 
--ROW_NUMBER() OVER (ORDER BY Name) AS row_num,
chr(10)
||'--==================================================='||chr(10)
||'-- Object Type : '||Upper(type)||chr(10)
||'-- Object Name : '||Upper(name)||chr(10)
||'-- Object Description : '||description||chr(10)
||'-- Object ID : '||id||chr(10)
||'--==================================================='||chr(10)
||' Object Source Code IS : '||chr(10)
||'--==================================================='||chr(10)||Source_Code 
||chr(10)||'--==================================================='||chr(10)
as Database_Objects_Info
, CHR(10)||'****** End Of Object Info ****** [ '|| Upper(name)||' ] '||CHR(10)||'--====================================='||chr(10)n
From(
SELECT 
        CASE p.prokind
        WHEN 'f' THEN 'function'
        WHEN 'p' THEN 'procedure'
        WHEN 'a' THEN 'aggregate'
        WHEN 'w' THEN 'window function'
    END AS type,
    p.oid id,
p.proname as Name ,
        COALESCE(d.description, '') AS description,
        pg_get_functiondef(p.oid) as Source_Code
        
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_description d ON d.objoid = p.oid
    WHERE n.nspname = 'public'
)
;

see schema_06.sql
