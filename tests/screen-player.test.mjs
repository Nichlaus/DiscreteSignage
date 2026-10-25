import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createScreenPlayer } from '../web/screen-player.js';

test('lease cutoff clears media without exposing connection UI; explicit stop still exposes it', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1000 });
  const element = () => ({ children: [], dataset: {}, style: { setProperty() {} },
    append(child) { this.children.push(child); }, replaceChildren() { this.children = []; } });
  const originalDocument = globalThis.document, originalImage = globalThis.Image;
  globalThis.document = { createElement: element };
  globalThis.Image = class { decode() { return Promise.resolve(); } };
  t.after(() => { globalThis.document = originalDocument; globalThis.Image = originalImage; });
  const stage = element(), visibility = [], states = [];
  let response = { version: 1, expiresAt: 11000, items: [{ asset: { id: 'advert', url: '/advert' }, duration: 22 }] };
  const player = createScreenPlayer({ stage, visibility: value => visibility.push(value),
    state: value => states.push(value), getManifest: async () => response });
  t.after(() => player.stop());
  const flush = () => new Promise(resolve => setImmediate(resolve));
  player.configure({ version: 1, orientation: 'landscape', scaleType: 'fit', transition: 'none' });
  await flush();
  assert.equal(stage.children[0].children.length, 1);
  visibility.length = 0;
  response = { version: 1, expiresAt: 71000, items: [] };
  t.mock.timers.tick(10000);
  assert.equal(stage.children[0].children.length, 0);
  assert.equal(states.at(-1), 'error');
  assert.deepEqual(visibility, []);
  await flush();
  assert.equal(states.at(-1), 'ready');
  assert.ok(visibility.every(Boolean));
  player.stop();
  assert.equal(visibility.at(-1), false);
});
