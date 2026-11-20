// Compare public responses with the files from the Pages build being audited.
// Usage: node tests/pages-delivery.mjs <deployed-checkout> <project-url>
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const [root, project] = process.argv.slice(2);
assert(root && project?.endsWith('/'), 'Supply a checkout and a project URL ending in /');
const base = new URL(project);
const pending = new Map([['', 'index.html'], ...['index.html', 'game.html', 'reviews.html', 'flagged.html', '404.html'].map(f => [f, f])]);

// This is a delivery check, not an external-link crawler. Follow local document
// links and resources; fail if relative resolution escapes the project prefix.
for (const [route, file] of pending) {
  const bytes = await readFile(path.join(root, file));
  const url = new URL(route, base);
  if (file.endsWith('.html')) {
    for (const [, ref] of bytes.toString().matchAll(/<(?:a|script|img|link)\b[^>]*?\s(?:src|href)="([^"<>]+)"/gi)) {
      if (/^(?:#|[a-z]+:|\/\/)/i.test(ref)) continue;
      const target = new URL(ref, url);
      assert(target.pathname.startsWith(base.pathname), `${file}: ${ref} leaves project`);
      const name = decodeURIComponent(target.pathname.slice(base.pathname.length));
      pending.set(name, name || 'index.html');
    }
  }
  await compare(url, bytes, 200);
}
await compare(new URL('missing/deep/pages-delivery-test', base), await readFile(path.join(root, '404.html')), 404);

async function compare(url, bytes, status) {
  for (let attempt = 1; ; attempt++) {
    url.searchParams.set('delivery-check', `${Date.now()}-${attempt}`);
    try {
      const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, status, `expected HTTP ${status}, received ${response.status}`);
      assert(bytes.equals(Buffer.from(await response.arrayBuffer())), 'response differs from checked-out file');
      console.log(`${status} ${url.origin}${url.pathname}: byte match`);
      return;
    } catch (error) {
      console.error(`${url.pathname}: ${error.message}`);
      if (attempt >= 3) throw error;
      await delay(attempt * 5000); // Allow a newly published CDN object to propagate.
    }
  }
}
