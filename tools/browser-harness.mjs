import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { once } from 'node:events';
import { brotliDecompressSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { chromium as playwright } from 'playwright-core';
import chromium from '@sparticuz/chromium';
import { root } from './test-context.mjs';
export async function harness() {
  const folder = path.join(root, '_site');
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://local.test').pathname); } catch (_) { res.writeHead(400); res.end(); return; }
    const name = pathname.startsWith('/LIVPBP/') ? pathname.slice('/LIVPBP/'.length) || 'index.html' : '';
    const file = path.resolve(folder, name);
    const exists = Boolean(name) && file.startsWith(folder + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile();
    const body = fs.readFileSync(exists ? file : path.join(folder, '404.html'));
    const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };
    res.writeHead(exists ? 200 : 404, { 'Content-Type': types[path.extname(exists ? file : '404.html')] ?? 'text/plain' });
    res.end(req.method === 'HEAD' ? undefined : body);
  });
  server.listen(0, '0.0.0.0'); await once(server, 'listening');
  // The locked Chromium package also ships NSS libraries for minimal Linux sandboxes.
  const libraries = path.join(root, '.cache/chromium-libs');
  if (process.platform === 'linux' && !fs.existsSync(path.join(libraries, 'lib/libnss3.so'))) {
    fs.mkdirSync(libraries, { recursive: true });
    const archive = brotliDecompressSync(fs.readFileSync(path.join(root, 'node_modules/@sparticuz/chromium/bin/al2023.tar.br')));
    execFileSync('tar', ['-xf', '-', '-C', libraries], { input: archive });
  }
  // Do not let serverless defaults disable CORS/web security: the real-network test must exercise it.
  const args = chromium.args.filter(arg => !['--disable-web-security', '--allow-running-insecure-content', '--single-process'].includes(arg));
  let browser;
  try {
    browser = await playwright.launch({ executablePath: await chromium.executablePath(), args, headless: true,
      env: { ...process.env, LD_LIBRARY_PATH: [path.join(libraries, 'lib'), process.env.LD_LIBRARY_PATH].filter(Boolean).join(':') } });
  } catch (error) { server.closeAllConnections(); server.close(); throw error; }
  return { browser, base: `http://127.0.0.1:${server.address().port}/LIVPBP/`, async close() { await browser.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
export async function sourceRows(page) {
  const bad = await page.locator('table tr').evaluateAll(rows => rows.filter(row => ![...row.querySelectorAll('a[href]')].some(link => /https:\/\/(statsapi\.mlb\.com|www\.mlb\.com|github\.com|api\.github\.com|docs\.github\.com)\//.test(link.href))).map(row => row.textContent));
  if (bad.length) throw new Error(`Table rows missing official sources: ${JSON.stringify(bad)}`);
}
export async function noOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (overflow) throw new Error(`Horizontal page overflow at ${page.url()}`);
}
