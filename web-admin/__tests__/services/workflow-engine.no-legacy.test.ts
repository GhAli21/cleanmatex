import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('semantic snapshot execution isolation', () => {
  it('does not import the pinned-graph loader from the workflow engine', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/services/workflow/workflow-engine.service.ts'),
      'utf8',
    );
    expect(source).not.toContain('pinned-workflow-graph');
    expect(source).toContain('loadSemanticActionTransitions');
    expect(source).toContain("resolved.kind === 'semantic'");
  });
});
