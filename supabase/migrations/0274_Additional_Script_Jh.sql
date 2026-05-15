
-- F:\jhapp\cleanmatex\supabase\migrations\0274_Additional_Script_Jh.sql

BEGIN;

------------------------------------------------------------

UPDATE sys_components_cd
SET label = 'ERP-Lite- ' || regexp_replace(label, '^(ERP-Lite- *)+', '')
, label2 = 'ERP-Lite- ' || regexp_replace(label2, '^(ERP-Lite- *)+', '')
WHERE comp_code like 'erp_lite%';


UPDATE sys_components_cd
SET label = 'ERP-Lite'
, label2 = 'ERP-Lite'
WHERE comp_code = 'erp_lite';

------------------------------------------------------------

COMMIT;
