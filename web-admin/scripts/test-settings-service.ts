import { tenantSettingsService } from '../lib/services/tenant-settings.service';

async function testSettingsService() {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  console.log('Testing TenantSettingsService...\n');

  // Test individual setting check
  const trackByPiece = await tenantSettingsService.checkIfSettingAllowed(
    tenantId,
    'USE_TRACK_BY_PIECE'
  );
  console.log('USE_TRACK_BY_PIECE:', trackByPiece);

  const splitOrder = await tenantSettingsService.checkIfSettingAllowed(
    tenantId,
    'USING_SPLIT_ORDER'
  );
  console.log('USING_SPLIT_ORDER:', splitOrder);

  const rejectToSolve = await tenantSettingsService.checkIfSettingAllowed(
    tenantId,
    'USE_REJECT_TO_SOLVE'
  );
  console.log('USE_REJECT_TO_SOLVE:', rejectToSolve);

  // Test get all processing settings
  console.log('\nFetching all processing settings...');
  const settings = await tenantSettingsService.getProcessingSettings(tenantId);
  console.log('Settings:', JSON.stringify(settings, null, 2));
}

testSettingsService().catch(console.error);
