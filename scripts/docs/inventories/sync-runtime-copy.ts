import * as fs from 'fs';
import * as path from 'path';
import { INVENTORY_OUTPUT, WEB_ADMIN_INVENTORY_RUNTIME } from './paths';

/**
 * Copy merged inventory JSON into web-admin so production deploys can read it.
 * Canonical source remains docs/platform/inventories/platform-info-inventory.json.
 */
export function syncWebAdminInventoryRuntimeCopy(sourcePath = INVENTORY_OUTPUT): string {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Cannot sync runtime copy — source inventory missing: ${sourcePath}`);
  }

  fs.mkdirSync(path.dirname(WEB_ADMIN_INVENTORY_RUNTIME), { recursive: true });
  fs.copyFileSync(sourcePath, WEB_ADMIN_INVENTORY_RUNTIME);
  return WEB_ADMIN_INVENTORY_RUNTIME;
}
