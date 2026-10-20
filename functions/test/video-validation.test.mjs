import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeVideo } from '../src/video-validation.js';
import { InvalidMedia } from '../src/image-validation.js';
const bytes = Buffer.alloc(20); bytes.write('ftyp', 4);
const options = (response) => ({
  endpoint: 'https://discrete-video-123.australia-southeast1.run.app',
  getHeaders: async () => new Headers({ Authorization: 'Bearer test-only' }),
  fetcher: async (url, config) => {
    assert.ok(url.endsWith('/validate')); assert.equal(config.redirect, 'error');
    assert.equal(config.headers.get('authorization'), 'Bearer test-only');
    return response;
  },
});
const headers = { 'Content-Type': 'video/mp4', 'Content-Length': '20',
  'X-Video-Width': '320', 'X-Video-Height': '180', 'X-Video-Duration': '1' };
test('private worker transport validates identity destination and bounds its output', async () => {
  const result = await decodeVideo(bytes, 'video/mp4', options(new Response(bytes, { headers })));
  assert.equal(result.duration, 1); assert.deepEqual(result.bytes, bytes);
  await assert.rejects(decodeVideo(bytes, 'video/mp4', { endpoint: 'https://example.com' }), /not configured/);
  for (const response of [
    new Response(bytes, { headers: { ...headers, 'Content-Length': '999999999' } }),
    new Response(bytes, { headers: { ...headers, 'Content-Length': '12' } }),
    new Response(bytes, { headers: { ...headers, 'X-Video-Duration': '90' } }),
    new Response(bytes.subarray(0, 12), { headers }),
  ]) await assert.rejects(decodeVideo(bytes, 'video/mp4', options(response)));
  await assert.rejects(decodeVideo(bytes, 'video/mp4', options(new Response('bad', { status: 422 }))), InvalidMedia);
  await assert.rejects(decodeVideo(bytes, 'video/mp4', options(new Response('private', { status: 503 }))),
    error => error.code === 'unavailable' && !error.message.includes('private'));
});
