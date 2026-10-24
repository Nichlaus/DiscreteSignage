import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPublicSite } from '../scripts/check-public-site.mjs';

const titles = { '/index.html': 'Your business, connected', '/display.html': 'Discrete Signage · Display',
  '/admin.html': 'Developer diagnostics', '/client.html': 'Client workspace' };
function response(path) {
  const page = titles[path];
  return new Response(page ? `<title>${page}</title><script src="/assets/app-test.js"></script>` : 'export {};', {
    headers: { 'content-type': page ? 'text/html' : 'application/javascript',
      'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer', 'cache-control': 'no-cache' },
  });
}

test('checks all pages and deduplicates shared assets without credentials', async () => {
  const calls = [];
  const result = await checkPublicSite(async (url, options) => {
    assert.equal(new URL(url).origin, 'https://discretesignage.web.app');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal);
    assert.equal(options.headers, undefined);
    calls.push(url);
    return response(new URL(url).pathname);
  });
  assert.equal(result.pages, 4); assert.equal(result.assets, 1); assert.equal(calls.length, 5);
});

test('rejects Hosting HTML fallback for missing admin page or JavaScript', async () => {
  for (const missing of ['/admin.html', '/assets/app-test.js']) {
    await assert.rejects(checkPublicSite(async url => response(new URL(url).pathname === missing
      ? '/index.html' : new URL(url).pathname)), /wrong page title|wrong asset type/);
  }
});

test('reports network failures, bad status and missing security headers', async () => {
  await assert.rejects(checkPublicSite(async () => { throw new Error('network unavailable'); }), /network unavailable/);
  await assert.rejects(checkPublicSite(async () => new Response('', { status: 503 })), /HTTP 503/);
  await assert.rejects(checkPublicSite(async url => {
    const result = response(new URL(url).pathname); result.headers.delete('x-frame-options'); return result;
  }), /missing frame protection/);
});
