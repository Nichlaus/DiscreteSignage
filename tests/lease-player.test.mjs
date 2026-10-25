import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeasePlayer } from '../web/lease-player.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let clock = 1000, id = 0;
  const timers = new Map(), visible = [], reports = [], disposed = [], loads = [], starts = [];
  let manifest = { version: 1, expiresAt: 61000, asset: { id: 'image', generation: '7' } };
  let loader = async asset => asset.id;
  let presenter = asset => visible.push(asset);
  let failure;
  const player = createLeasePlayer({
    getManifest: async () => { if (failure) throw failure; return manifest; },
    loadAsset: asset => { loads.push(asset); return loader(asset); }, show: asset => presenter(asset), clear: () => visible.push(null),
    dispose: asset => disposed.push(asset),
    state: (...args) => reports.push(args), now: () => clock,
    started: event => starts.push(event),
    setTimer: (fn, ms) => { timers.set(++id, { fn, at: clock + ms }); return id; },
    cancelTimer: id => timers.delete(id),
  });
  return { player, visible, reports, disposed, loads, starts,
    load: fn => { loader = fn; }, fail: error => { failure = error; },
    show: fn => { presenter = fn; },
    manifest: value => { manifest = value; },
    async advance(ms) {
      clock += ms;
      for (const [key, timer] of [...timers]) {
        if (timer.at <= clock) { timers.delete(key); timer.fn(); await flush(); }
      }
    },
  };
}

test('continuous media starts once and renewal does not inflate play counts', async () => {
  const f = fixture(); f.player.configure({ version: 1 }); await flush();
  assert.deepEqual(f.starts, [{ mediaId: 'image', version: 1 }]);
  f.manifest({ version: 1, expiresAt: 91000, asset: { id: 'image', generation: '7' } });
  await f.advance(30000); assert.equal(f.starts.length, 1);
  f.player.stop(); await f.advance(30000); assert.equal(f.starts.length, 1);
});

test('an authorized empty schedule stays blank without loading calibration, resumes and clears again', async () => {
  const f = fixture();
  f.manifest({ version: 1, expiresAt: 61000, items: [], asset: null });
  f.player.configure({ version: 1 }); await flush();
  assert.equal(f.loads.length, 0); assert.equal(f.visible.at(-1), null);
  assert.deepEqual(f.reports.at(-1), ['ready', 1]);
  f.manifest({ version: 1, expiresAt: 91000, items: [{ asset: { id: 'image' }, duration: 22 }] });
  await f.advance(30000); assert.equal(f.visible.at(-1), 'image');
  f.manifest({ version: 1, expiresAt: 121000, items: [], asset: null });
  await f.advance(30000); assert.equal(f.visible.at(-1), null);
  assert.equal(f.loads.length, 1); assert.equal(f.starts.length, 1);
  f.fail(Error('offline')); await f.advance(60000);
  assert.deepEqual(f.reports.at(-1), ['error', 0]); f.player.stop();
});

test('playlist advances in order, wraps and uses renewed URLs without restarting the current slot', async () => {
  const f = fixture();
  const manifest = expiresAt => ({ version: 1, expiresAt, items: [
    { asset: { id: 'image', generation: '1', url: String(expiresAt) }, duration: 3 },
    { asset: { id: 'video', generation: '2', url: String(expiresAt) }, duration: 3 },
  ] });
  f.manifest(manifest(61000)); f.player.configure({ version: 1 }); await flush();
  assert.equal(f.visible.at(-1), 'image');
  await f.advance(3000); assert.equal(f.visible.at(-1), 'video');
  await f.advance(3000); assert.equal(f.visible.at(-1), 'image');
  f.manifest(manifest(91000));
  await f.advance(24000);
  assert.equal(f.visible.at(-1), 'video');
  assert.equal(f.loads.at(-1).url, '91000');
  f.fail(Error('Offline')); await f.advance(60000);
  assert.equal(f.visible.at(-1), null); f.player.stop();
});

test('a changed schedule clears the previous advert before a slow replacement loads', async () => {
  const f = fixture(); f.player.configure({ version: 1 }); await flush();
  let finish;
  f.load(() => new Promise(resolve => { finish = resolve; }));
  f.manifest({ version: 1, expiresAt: 91000, asset: { id: 'next', generation: '1' } });
  await f.advance(30000);
  assert.equal(f.visible.at(-1), null);
  finish('next'); await flush(); assert.equal(f.visible.at(-1), 'next'); f.player.stop();
});

test('revocation during a transition cannot schedule another playlist item', async () => {
  const f = fixture(); let finish;
  f.manifest({ version: 1, expiresAt: 61000, items: [
    { asset: { id: 'first', generation: '1' }, duration: 3 },
    { asset: { id: 'second', generation: '1' }, duration: 3 },
  ] });
  f.show(() => new Promise(resolve => { finish = resolve; }));
  f.player.configure({ version: 1 }); await flush();
  f.player.stop(); finish(); await flush(); await f.advance(10000);
  assert.equal(f.visible.at(-1), null);
  assert.deepEqual(f.disposed, ['first']);
});
test('playback is removed when a lease expires during network failure', async () => {
  const f = fixture(); f.player.configure({ version: 1 }); await flush();
  assert.equal(f.visible.at(-1), 'image');
  f.fail(Error('Offline')); await f.advance(30000);
  assert.equal(f.visible.at(-1), 'image');
  await f.advance(30000);
  assert.equal(f.visible.at(-1), null);
  f.player.stop();
});
test('revocation clears immediately and late image loads cannot restore revoked content', async () => {
  const f = fixture(); let finish;
  f.load(() => new Promise(resolve => { finish = resolve; }));
  f.player.configure({ version: 1 }); await flush();
  f.player.stop(); finish('late'); await flush();
  assert.equal(f.visible.at(-1), null);
  assert.ok(!f.visible.includes('late'));
  assert.deepEqual(f.disposed, ['late']);
});
test('late video downloads are disposed after lease expiry and never acknowledged ready', async () => {
  const f = fixture(); let finish;
  f.load(() => new Promise(resolve => { finish = resolve; }));
  f.player.configure({ version: 1 }); await flush();
  await f.advance(60000); finish('video blob'); await flush();
  assert.ok(!f.visible.includes('video blob'));
  assert.deepEqual(f.disposed, ['video blob']);
  assert.ok(!f.reports.some(([state]) => state === 'ready'));
  f.player.stop();
});
test('expired or stale manifests cannot display content, and permission denial clears an existing image', async () => {
  const f = fixture();
  f.manifest({ version: 0, expiresAt: 61000, asset: { id: 'wrong', generation: '1' } });
  f.player.configure({ version: 1 }); await flush();
  assert.ok(!f.visible.includes('wrong'));
  f.manifest({ version: 1, expiresAt: 61000, asset: { id: 'right', generation: '1' } });
  await f.advance(2000); assert.equal(f.visible.at(-1), 'right');
  f.fail({ code: 'functions/permission-denied' }); await f.advance(30000);
  assert.equal(f.visible.at(-1), null); f.player.stop();
});
