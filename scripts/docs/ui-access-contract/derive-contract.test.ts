import assert from 'node:assert/strict';
import {
  apiPathsEquivalent,
  buildPermissionConflictNote,
  findStaleActionKeys,
  findStaleApiPaths,
} from './derive-contract-stale';
import {
  collectServerActionFiles,
  extractPermissionsFromActionFile,
  inferServerActionDependencies,
} from './derive-source-scan';
import * as fs from 'fs';
import * as path from 'path';
import { WEB_ADMIN } from '../inventories/paths';
import { deriveRouteProposal } from './derive-contract';

function testApiPathEquivalence(): void {
  assert.ok(apiPathsEquivalent('/api/foo/[id]', '/api/foo/${orderId}'));
  assert.ok(!apiPathsEquivalent('/api/foo', '/api/bar'));
}

function testStaleActions(): void {
  const stale = findStaleActionKeys(
    [{ actionKey: 'orphan', permissions: ['orders:delete'] }],
    new Set(['orders:read']),
    new Set(['create'])
  );
  assert.deepEqual(stale, ['orphan']);
}

function testConflictNote(): void {
  const note = buildPermissionConflictNote(['a:read'], ['a:write']);
  assert.ok(note?.includes('Contract only'));
  assert.ok(note?.includes('Code only'));
}

function testGiftCardActionPermissions(): void {
  const file = path.join(WEB_ADMIN, 'app/actions/marketing/gift-card-actions.ts');
  assert.ok(fs.existsSync(file), 'gift-card-actions.ts should exist');
  const content = fs.readFileSync(file, 'utf-8');
  const perms = extractPermissionsFromActionFile(content);
  assert.ok(perms.some((p) => p.startsWith('gift_cards:')));
}

function testPromosServerActionInference(): void {
  const hookFile = path.join(WEB_ADMIN, 'src/features/marketing/hooks/use-promos.ts');
  assert.ok(fs.existsSync(hookFile));
  const actionFiles = collectServerActionFiles([hookFile]);
  assert.ok(
    actionFiles.some((f) => f.replace(/\\/g, '/').includes('app/actions/marketing/promo-actions')),
    'should resolve promo-actions import'
  );
  const deps = inferServerActionDependencies(actionFiles);
  assert.ok(deps.some((d) => d.path.includes('promo-actions')));
}

function testAccountReceiptAligned(): void {
  const proposal = deriveRouteProposal('/dashboard/customers/account-receipt');
  assert.ok(proposal.inferredPagePermissions.includes('customers:receipt_allocate'));
  assert.ok(
    proposal.applyAction === 'noop' || proposal.applyAction === 'merge_missing',
    `expected noop or merge_missing, got ${proposal.applyAction}`
  );
}

function testArInvoiceDerivesActions(): void {
  const proposal = deriveRouteProposal('/dashboard/internal_fin/invoices/[id]');
  assert.ok(proposal.inferredActions.length >= 3, 'AR invoice detail should infer multiple actions');
  const keys = proposal.inferredActions.map((a) => a.actionKey);
  assert.ok(keys.some((k) => k.includes('issue') || k.includes('update')));
}

function testStaleApiDetection(): void {
  const stale = findStaleApiPaths(
    ['/api/orders/old-endpoint'],
    ['/api/orders/new-endpoint']
  );
  assert.deepEqual(stale, ['/api/orders/old-endpoint']);
}

function run(): void {
  testApiPathEquivalence();
  testStaleActions();
  testConflictNote();
  testGiftCardActionPermissions();
  testPromosServerActionInference();
  testAccountReceiptAligned();
  testArInvoiceDerivesActions();
  testStaleApiDetection();
  console.log('derive-contract: ok');
}

run();
