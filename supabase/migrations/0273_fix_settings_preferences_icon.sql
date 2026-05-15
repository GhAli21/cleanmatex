/*
  Migration: Fix settings preferences navigation icon
  Purpose: Align the DB-backed navigation icon with the client icon registry
  after migration 0272 introduced the settings_preferences child page.
  Note: Review-only migration file. Do not apply from Codex.
*/

BEGIN;

UPDATE sys_components_cd
SET
  comp_icon = 'Users',
  updated_at = NOW(),
  updated_info = 'Updated by migration 0273 to use a registered sidebar icon.'
WHERE comp_code = 'settings_preferences'
  AND comp_icon = 'User';

COMMIT;
