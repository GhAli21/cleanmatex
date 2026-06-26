import * as fs from 'fs';
import * as path from 'path';
import { WEB_ADMIN } from '../inventories/paths';

/**
 * Collect concrete dashboard page routes from app/dashboard page.tsx files.
 */
export function collectDashboardPageRoutes(): string[] {
  const routes: string[] = [];
  const dashboardDir = path.join(WEB_ADMIN, 'app', 'dashboard');

  const walk = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(full, `${prefix}/${entry.name}`);
        continue;
      }

      if (!entry.isFile() || entry.name !== 'page.tsx') continue;
      if (entry.name.endsWith('.disabled')) continue;

      routes.push(prefix || '/dashboard');
    }
  };

  walk(dashboardDir, '/dashboard');
  return [...new Set(routes)].sort();
}
