import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createWorker } from './server.mjs';
import { InvalidVideo } from './decode.mjs';
test('worker rejects bad routes/types/sizes and distinguishes invalid media from worker failure', async () => {
  let calls = 0, error;
  const server = createWorker(async () => {
    calls++; if (error) throw error;
    return { bytes: Buffer.alloc(20), width: 320, height: 180, duration: 1 };
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/validate`;
  const send = (type = 'video/mp4', body = Buffer.alloc(12)) =>
    fetch(url, { method: 'POST', headers: { 'Content-Type': type }, body });
  try {
    for (const response of [await fetch(url), await send('text/plain'), await send('video/mp4', Buffer.alloc(1))]) {
      assert.ok([400, 404].includes(response.status)); await response.arrayBuffer();
    }
    assert.equal(calls, 0);
    const success = await send(); assert.equal(success.status, 200);
    assert.equal(success.headers.get('x-video-width'), '320'); await success.arrayBuffer();
    error = new InvalidVideo('Bad video'); const invalid = await send();
    assert.equal(invalid.status, 422); await invalid.arrayBuffer();
    error = Error('private details'); const failure = await send();
    assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes('private details'));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
