import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const root = path.resolve(import.meta.dirname, '..');
const pages = ['index.html', 'game.html', 'reviews.html', 'flagged-for-review.html', '404.html'];
let links = 0;
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), 'utf8');
  assert.match(html, /<html lang="en">/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /flagged-for-review\.html/);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(ids.length, new Set(ids).size, `${page}: duplicate ID`);
  for (const [, attribute, raw] of html.matchAll(/\b(href|src)="([^"]+)"/g)) {
    if (/^(https?:|data:|#)/.test(raw)) continue;
    const name = raw.split(/[?#]/)[0].replace(/^\/LIVPBP\//, '') || 'index.html';
    assert.ok(name && fs.existsSync(path.join(root, name)), `${page}: missing ${attribute} ${raw}`);
    links++;
    const hash = raw.split('#')[1];
    if (hash && name.endsWith('.html')) assert.ok(fs.readFileSync(path.join(root, name), 'utf8').includes(`id="${hash}"`), `${page}: missing anchor ${raw}`);
  }
  for (const match of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)) {
    assert.match(match[1], /https:\/\/(?:statsapi\.mlb\.com|www\.mlb\.com|github\.com|api\.github\.com|docs\.github\.com)\//, `${page}: static table row has no official source`);
  }
}
const js = fs.readdirSync(path.join(root, 'assets/js')).filter(file => file.endsWith('.js'));
for (const file of [...js.map(name => `assets/js/${name}`), 'server.mjs', ...fs.readdirSync(path.join(root, 'tools')).filter(name => name.endsWith('.mjs')).map(name => `tools/${name}`)]) {
  execFileSync(process.execPath, ['--check', file], { cwd: root });
}
console.log(`Checked ${pages.length} HTML pages, ${links} local links/assets, ${js.length} browser scripts, and tool/server syntax.`);
