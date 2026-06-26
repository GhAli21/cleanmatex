import assert from 'node:assert/strict';
import {
  extractPermissionCodesFromSource,
  joinPermissionCode,
} from './extract-page-gate-permissions';

function testJoinPermissionCode(): void {
  assert.equal(joinPermissionCode('customers', 'receipt_allocate'), 'customers:receipt_allocate');
  assert.equal(joinPermissionCode('orders:read', ''), 'orders:read');
}

function testUseHasPermissionCode(): void {
  const codes = extractPermissionCodesFromSource(
    `const ok = useHasPermissionCode('customers:receipt_allocate');`
  );
  assert.ok(codes.has('customers:receipt_allocate'));
}

function testUseHasPermissionTwoArg(): void {
  const codes = extractPermissionCodesFromSource(
    `const ok = useHasPermission('invoices', 'update');`
  );
  assert.ok(codes.has('invoices:update'));
}

function testUseHasPermissionSingleArg(): void {
  const codes = extractPermissionCodesFromSource(
    `const ok = useHasPermission('customers:receipt_allocate');`
  );
  assert.ok(codes.has('customers:receipt_allocate'));
}

function testRequirePermissionJsx(): void {
  const codes = extractPermissionCodesFromSource(`
    <RequirePermission resource="orders" action="create">
      <Button />
    </RequirePermission>
  `);
  assert.ok(codes.has('orders:create'));
}

function testRequireAnyPermissionMarker(): void {
  const codes = extractPermissionCodesFromSource(
    `<RequireAnyPermission permissions={['promotions:read']} />`
  );
  assert.ok(codes.has('__has_require_any__'));
  assert.ok(codes.has('promotions:read'));
}

function run(): void {
  testJoinPermissionCode();
  testUseHasPermissionCode();
  testUseHasPermissionTwoArg();
  testUseHasPermissionSingleArg();
  testRequirePermissionJsx();
  testRequireAnyPermissionMarker();
  console.log('extract-page-gate-permissions: ok');
}

run();
