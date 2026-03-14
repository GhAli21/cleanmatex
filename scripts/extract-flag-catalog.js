/**
 * Extracts feature flags from MCP execute_sql output and writes flag-catalog-db.json
 * Run: node scripts/extract-flag-catalog.js
 * Input: agent-tools output file path as first arg, or stdin
 */
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '../.cursor/projects/f-jhapp-cleanmatex/agent-tools/46538845-a406-4c19-b61a-897eea0ae1f0.txt');
const raw = fs.readFileSync(inputPath, 'utf8');

// File may be outer JSON { result: "..." } or raw text
let content = raw;
try {
  const outer = JSON.parse(raw);
  if (outer.result) content = outer.result;
} catch (_) {}

const start = content.indexOf('[');
const untrustedStart = content.indexOf('</untrusted');
const beforeUntrusted = content.substring(0, untrustedStart);
const end = beforeUntrusted.lastIndexOf(']') + 1;
const arrStr = content.substring(start, end);

let data;
try {
  data = JSON.parse(arrStr);
} catch (e) {
  console.error('Parse error:', e.message);
  process.exit(1);
}

const normalized = data.map((e) => ({
  flag_key: e.flag_key,
  flag_name: e.flag_name,
  flag_name2: e.flag_name2 || null,
  data_type: ['float', 'number'].includes(e.data_type) ? 'integer' : e.data_type,
  default_value: e.default_value,
  plan_binding_type: e.plan_binding_type,
  governance_category: e.governance_category || null,
  ui_group: e.ui_group || null,
  ui_display_order: e.ui_display_order ?? 0,
}));

const outPath = path.join(__dirname, 'flag-catalog-db.json');
fs.writeFileSync(outPath, JSON.stringify(normalized, null, 2));
console.log('Wrote', normalized.length, 'entries to', outPath);
