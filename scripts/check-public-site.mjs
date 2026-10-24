import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const origin = 'https://discretesignage.web.app';
const pages = {
  '/index.html': 'Your business, connected',
  '/display.html': 'Discrete Signage · Display',
  '/admin.html': 'Developer diagnostics',
  '/client.html': 'Client workspace',
};

export async function checkPublicSite(request = fetch) {
  const assets = new Set();
  async function get(path) {
    const response = await request(origin + path, {
      redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff', `${path}: missing nosniff`);
    return response;
  }
  // Small sequential requests avoid a burst against a struggling site.
  for (const [path, title] of Object.entries(pages)) {
    const response = await get(path);
    assert.match(response.headers.get('content-type') ?? '', /text\/html/i, `${path}: expected HTML`);
    assert.equal(response.headers.get('x-frame-options'), 'DENY', `${path}: missing frame protection`);
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer', `${path}: unexpected referrer policy`);
    assert.equal(response.headers.get('cache-control'), 'no-cache', `${path}: stale HTML caching risk`);
    const html = await response.text();
    assert.ok(html.match(/<title>([^<]+)<\/title>/i)?.[1].includes(title), `${path}: wrong page title`);
    const entries = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map(match => match[1]);
    assert.ok(entries.some(entry => entry.endsWith('.js')), `${path}: missing JavaScript entry`);
    for (const entry of entries) {
      assert.match(entry, /^\/assets\/[\w.-]+\.(js|css)$/, `${path}: unexpected asset path`);
      assets.add(entry);
    }
  }
  for (const path of assets) {
    const response = await get(path);
    assert.match(response.headers.get('content-type') ?? '', path.endsWith('.css')
      ? /text\/css/i : /(?:application|text)\/javascript/i, `${path}: wrong asset type (possible HTML fallback)`);
    assert.ok((await response.arrayBuffer()).byteLength > 0, `${path}: empty asset`);
  }
  return { pages: Object.keys(pages).length, assets: assets.size, checkedAt: new Date().toISOString() };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = await checkPublicSite();
    console.log(`PASS: ${result.pages} public pages and ${result.assets} entry assets; ${result.checkedAt}`);
    console.log('This checks delivery only, not sign-in, backend health or screen playback.');
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  }
}
