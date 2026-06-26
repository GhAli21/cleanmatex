import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { ingestAccessContractsTs } from './ingest-access-contracts-ts';

function extractPageBlock(contractBlock: string, fileContent: string): string | null {
  const inline = contractBlock.match(/page:\s*\{([\s\S]*?)\}/);
  if (inline) return inline[1] ?? '';

  const ref = contractBlock.match(/page:\s*([A-Z][A-Z0-9_]*)/);
  if (!ref?.[1]) return null;

  const constRe = new RegExp(`const ${ref[1]}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`);
  const match = fileContent.match(constRe);
  return match?.[1] ?? null;
}

function testEmptyPageObject(): void {
  const block = `routePattern: '/dashboard/help',
    label: 'Help',
    page: {},
    actions: {`;
  const page = extractPageBlock(block, '');
  assert.equal(page, '');
}

function testHelpIngestCount(): void {
  const { accessContracts } = ingestAccessContractsTs();
  const help = accessContracts.filter((c) => c.routePattern.startsWith('/dashboard/help'));
  assert.equal(help.length, 2, `expected 2 help contracts, got ${help.length}: ${help.map((h) => h.routePattern)}`);
  assert.ok(accessContracts.length >= 140, `expected ~144 contracts, got ${accessContracts.length}`);
}

testEmptyPageObject();
testHelpIngestCount();
console.log('extract-page-block.test.ts: all passed');
