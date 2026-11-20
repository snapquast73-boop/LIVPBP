#!/usr/bin/env node
/* tests/link-check.mjs — static integrity check for the GitHub Pages site.
 *
 * Fails when any page references a local stylesheet, script, image or link that
 * does not exist in the repository, when an HTML page uses a local absolute path
 * (which breaks under the /LIVPBP/ Pages prefix), or when a CSS url() target is
 * missing. No dependencies, no network.
 *
 *   node tests/link-check.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'tests']);
const problems = [];
const checked = [];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry.startsWith('.') && entry !== '.nojekyll') continue;
    if (SKIP_DIRS.has(entry)) continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function localTarget(ref) {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (/^(?:[a-z]+:|\/\/|#|data:|mailto:|javascript:)/i.test(trimmed)) return null;
  const withoutQuery = trimmed.split('#')[0].split('?')[0];
  if (!withoutQuery) return null;
  return withoutQuery;
}

function resolveLocal(from, ref) {
  const target = localTarget(ref);
  if (target === null) return null;
  if (target.startsWith('/')) return { absolute: true, path: target };
  return { absolute: false, path: path.resolve(path.dirname(from), target) };
}

for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  if (file.endsWith('.html')) {
    const html = readFileSync(file, 'utf8');
    const refs = [
      ...html.matchAll(/<link\b[^>]*href\s*=\s*"([^"]*)"/gi),
      ...html.matchAll(/<script\b[^>]*src\s*=\s*"([^"]*)"/gi),
      ...html.matchAll(/<img\b[^>]*src\s*=\s*"([^"]*)"/gi),
      ...html.matchAll(/<a\b[^>]*href\s*=\s*"([^"]*)"/gi),
    ].map((m) => m[1]);
    for (const ref of refs) {
      const resolved = resolveLocal(file, ref);
      if (!resolved) continue;
      if (resolved.absolute) {
        problems.push(`${rel}: local absolute path "${ref}" breaks on GitHub Pages sub-paths`);
        continue;
      }
      checked.push(`${rel} -> ${ref}`);
      if (!existsSync(resolved.path)) problems.push(`${rel}: missing local target "${ref}"`);
    }
    // The three app pages (scoreboard, game, replay feed) must load their scripts.
    const appPage = /class\s*=\s*"page-(scoreboard|game|reviews)"/i.test(html) ||
      /id\s*=\s*"(game-list|feed-list|plays-wrap)"/i.test(html);
    if (appPage && !/src\s*=\s*"assets\/js\//i.test(html)) {
      problems.push(`${rel}: app page does not load any assets/js script`);
    }
  }
  if (file.endsWith('.css')) {
    const css = readFileSync(file, 'utf8');
    for (const m of css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)) {
      const resolved = resolveLocal(file, m[2]);
      if (!resolved) continue;
      checked.push(`${rel} -> ${m[2]}`);
      if (resolved.absolute || !existsSync(resolved.path)) problems.push(`${rel}: missing url() target "${m[2]}"`);
    }
  }
  if (file.endsWith('.js') || file.endsWith('.mjs')) {
    // A script tag pointing at a file that does not parse is caught by syntax-check.mjs.
    if (!readFileSync(file, 'utf8').trim()) problems.push(`${rel}: empty script`);
  }
}

console.log(`link-check: ${checked.length} local references checked across the site`);
if (problems.length) {
  console.error(`link-check: ${problems.length} problem(s)`);
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log('link-check: OK');
