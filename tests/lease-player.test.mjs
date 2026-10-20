import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeasePlayer } from '../web/lease-player.js';
const flush = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
  let clock = 1000, id = 0;
  const timers = new Map(), visible = [], reports = [];
  let manifest = { version: 1, expiresAt: 61000, asset: { id: 'image', generation: '7' } };
  let loader = async asset => asset.id;
  let failure;
  const player = createLeasePlayer({
    getManifest: async () => { if (failure) throw failure; return manifest; },
    loadAsset: asset => loader(asset), show: asset => visible.push(asset), clear: () => visible.push(null),
    state: (...args) => reports.push(args), now: () => clock,
    setTimer: (fn, ms) => { timers.set(++id, { fn, at: clock + ms }); return id; },
    cancelTimer: id => timers.delete(id),
  });
  return { player, visible, reports,
    load: fn => { loader = fn; }, fail: error => { failure = error; },
    manifest: value => { manifest = value; },
    async advance(ms) {
      clock += ms;
      for (const [key, timer] of [...timers]) {
        if (timer.at <= clock) { timers.delete(key); timer.fn(); await flush(); }
      }
    },
  };
}
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
