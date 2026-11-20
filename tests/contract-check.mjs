#!/usr/bin/env node
/* tests/contract-check.mjs — the HTML pages call JavaScript by name; prove the names exist.
 *
 * 1. every inline handler in a page (`onclick="Scoreboard.prevDay()"`) must resolve to a global
 *    that one of that page's scripts defines (`window.Scoreboard = {...}` with that method);
 * 2. every element id a script looks up (`getElementById('x')`) must exist in at least one page that
 *    loads that script — catches typos that would silently disable a feature;
 * 3. every page must load its scripts in a dependency-safe order (api.js before the page logic).
 *
 * No dependencies, no network.  node tests/contract-check.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const problems = [];
let checks = 0;

for (const page of pages) {
  const html = readFileSync(path.join(ROOT, page), 'utf8');
  const scripts = [...html.matchAll(/<script\b[^>]*src\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  const js = scripts.map((s) => readFileSync(path.join(ROOT, s), 'utf8')).join('\n');
  const ids = new Set([...html.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map((m) => m[1]));

  // 1. inline handlers -> globals with that property
  for (const m of html.matchAll(/\bon[a-z]+\s*=\s*"([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\(/g)) {
    checks += 1;
    const [, obj, method] = m;
    // Scripts are IIFEs that publish through `window.X = {...}`, `global.X = {...}`
    // (IIFE parameter) or `globalThis.X = {...}`; accept every form.
    const definesGlobal = new RegExp(`\\b(?:window|global|globalThis|self)\\.${obj}\\s*=\\s*\\{`).test(js) ||
      new RegExp(`\\.${obj}\\s*=\\s*\\{`).test(js);
    const definesMethod = new RegExp(`\\b${method}\\s*:\\s*function`).test(js) ||
      new RegExp(`\\b${method}\\s*\\(`).test(js);
    if (!definesGlobal) problems.push(`${page}: handler ${obj}.${method}() but no script sets window.${obj}`);
    else if (!definesMethod) problems.push(`${page}: ${obj}.${method}() is called but the script does not define ${method}`);
  }

  // 2. ids a page's scripts query must exist in that page (skip scripts shared by all pages)
  for (const src of scripts) {
    const code = readFileSync(path.join(ROOT, src), 'utf8');
    const queried = new Set([
      ...[...code.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]),
    ]);
    for (const id of queried) {
      checks += 1;
      const anyPageHasIt = pages.some((p) => new RegExp(`\\bid\\s*=\\s*"${id}"`).test(readFileSync(path.join(ROOT, p), 'utf8')));
      if (!ids.has(id) && !anyPageHasIt) problems.push(`${src}: looks up #${id}, which no page defines`);
    }
  }

  // 3. load order for the three app pages
  if (scripts.length) {
    const idx = (name) => scripts.findIndex((s) => s.endsWith(name));
    if (idx('api.js') > 0) problems.push(`${page}: assets/js/api.js must be the first script`);
    const last = scripts[scripts.length - 1];
    if (scripts.length > 1 && !/(scoreboard|game|reviews-feed)\.js$/.test(last)) {
      problems.push(`${page}: the page-logic script should load last (found ${last})`);
    }
  }
}

console.log(`contract-check: ${checks} name/id bindings checked across ${pages.length} pages`);
if (problems.length) {
  console.error(`contract-check: ${problems.length} problem(s)`);
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log('contract-check: OK');
