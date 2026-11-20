#!/usr/bin/env node
/* tests/run-all.mjs — run every shipped check in order and summarise.
 *
 *   node tests/run-all.mjs
 *
 * Zero dependencies except the jsdom render test, which installs nothing and
 * simply reports SKIPPED when jsdom is absent (`npm install --no-save jsdom`).
 */
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

function run(label, cmd, args) {
  process.stdout.write(`\n=== ${label} ===\n`);
  const res = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  return { label, ok: res.status === 0 };
}

const results = [];
results.push(run('syntax: assets/js/*.js', 'bash', ['-lc', 'set -e; for f in assets/js/*.js server.mjs tools/*.mjs; do node --check "$f"; done; echo "all scripts parse"']));
results.push(run('link-check', process.execPath, [path.join(HERE, 'link-check.mjs')]));
results.push(run('contract-check', process.execPath, [path.join(HERE, 'contract-check.mjs')]));
results.push(run('jsdom-render-test', process.execPath, [path.join(HERE, 'jsdom-render-test.mjs')]));

// Report, and ignore a SKIPPED jsdom run (exit 0 with a SKIPPED line).
console.log('\n========== summary ==========');
let failed = 0;
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}`);
  if (!r.ok) failed += 1;
}
const fixtures = readdirSync(path.join(HERE, 'fixtures')).length;
console.log(`fixtures used: ${fixtures} (values copied verbatim from official StatsAPI responses, 2026-11-20)`);
console.log(`docs: docs/verification-report.md · flagged items: flagged.html · board: COORDINATION.md`);
process.exit(failed ? 1 : 0);
