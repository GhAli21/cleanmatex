/**
 * @jest-environment node
 */
/**
 * S6 (T57, review row 46): every screen endpoint in technical_docs/api-clock-inventory.md
 * builds the `clock` block. Static check of the source files named in the table.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..', '..', '..', '..');
const INVENTORY = join(REPO, 'docs', 'features', 'Time_and_Timezone', 'technical_docs', 'api-clock-inventory.md');

function rows(): { endpoint: string; block: string; source: string }[] {
  return readFileSync(INVENTORY, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('| `GET') || l.startsWith('| `POST'))
    .map((l) => l.split('|').map((c) => c.trim()))
    .map((c) => ({ endpoint: c[1], block: c[4], source: c[5].replace(/`/g, '') }));
}

describe('api clock inventory', () => {
  const list = rows();

  it('lists the screen endpoints', () => {
    expect(list.length).toBeGreaterThanOrEqual(10);
  });

  it.each(list.map((r) => [r.endpoint, r]))('%s builds the clock block', (_name, r) => {
    const file = join(REPO, r.source);
    expect(existsSync(file)).toBe(true);
    const text = readFileSync(file, 'utf8');
    if (r.block === 'public') {
      expect(text).toMatch(/\b(publicScreenClock|getPublicClockBlock)\(/);
    } else {
      expect(text).toMatch(/\bscreenClock\(/);
    }
  });
});
