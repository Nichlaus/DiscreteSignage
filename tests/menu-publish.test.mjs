import { test } from 'node:test';
import assert from 'node:assert/strict';
import { menuDimensions, menuScreenPlan, publishMenuPages } from '../web/menu-publish.js';
import { screenLayout } from '../functions/src/layout.js';
const ad = [{ mediaId: 'advert', duration: 20, schedule: { example: true } }];
const screen = { id: 'screen', name: 'Test', locationId: 'main', active: true, version: 4,
  orientation: 'landscape', layout: 'single', playlist: ad, secondaryPlaylist: [], logo: null };
test('publishing preserves the other advert region and generates valid server layouts', () => {
  for (const placement of ['full', 'left', 'right', 'top', 'bottom']) {
    const plan = menuScreenPlan(screen, placement, ['menu']);
    // Validate layout without passing the synthetic schedule used to check preservation.
    screenLayout({ ...plan, secondaryPlaylist: plan.secondaryPlaylist.map(({ schedule, ...item }) => item) });
    assert.equal(plan.expectedVersion, 4); assert.equal(plan.scaleType, 'fit');
    if (['right', 'bottom'].includes(placement)) assert.deepEqual(plan.playlist, ad);
    if (['left', 'top'].includes(placement)) assert.deepEqual(plan.secondaryPlaylist, ad);
    if (placement === 'full') assert.deepEqual(plan.secondaryPlaylist, []);
  }
  const split = { ...screen, layout: 'columns', secondaryPlaylist: [{ mediaId: 'second', duration: 5 }] };
  assert.deepEqual(menuScreenPlan(split, 'left', ['menu']).secondaryPlaylist, split.secondaryPlaylist);
  assert.throws(() => menuScreenPlan({ ...screen, active: false }, 'full', ['menu']));
  assert.throws(() => menuScreenPlan(screen, 'full', Array(21).fill('menu')));
  assert.deepEqual(menuDimensions(screen, 'right'), { width: 960, height: 1080 });
  assert.deepEqual(menuDimensions({ ...screen, orientation: 'portrait' }, 'top'), { width: 1080, height: 960 });
});
test('all pages validate before assignment; retry reuses uploaded pages after a lost validation response', async () => {
  const calls = []; let lost = true, uploads = 0;
  const pages = [{ blob: new Blob(['png']), requestId: 'request' }];
  const call = async (name, data) => {
    calls.push(name);
    if (name === 'beginMediaUpload') return { mediaId: 'page' };
    if (name === 'authorizeMediaUpload') return { url: 'synthetic' };
    if (name === 'completeMediaUpload') return { status: 'uploaded' };
    if (name === 'validateMedia') { if (lost) { lost = false; throw Error('Lost response'); } return { status: 'ready' }; }
    assert.equal(name, 'updateScreenSettings'); assert.equal(data.businessId, 'business');
    assert.equal(data.secondaryPlaylist[0].mediaId, 'page'); return { version: 5 };
  };
  const args = { businessId: 'business', screen, placement: 'right', menu: { version: 2 }, pages, call,
    upload: async () => { uploads++; }, progress: () => {} };
  await assert.rejects(publishMenuPages(args));
  assert.ok(!calls.includes('updateScreenSettings'));
  assert.deepEqual(await publishMenuPages(args), { version: 5 });
  assert.equal(uploads, 1); assert.equal(calls.filter(n => n === 'beginMediaUpload').length, 1);
});
test('failed validation never assigns a partial menu', async () => {
  const call = async name => {
    if (name === 'beginMediaUpload') return { mediaId: 'page' };
    if (name === 'authorizeMediaUpload') return {};
    if (name === 'completeMediaUpload') return { status: 'uploaded' };
    if (name === 'validateMedia') return { status: 'validation-failed' };
    assert.fail('Screen must not change');
  };
  await assert.rejects(publishMenuPages({ businessId: 'b', screen, placement: 'full', menu: { version: 1 },
    pages: [{ blob: new Blob(['png']), requestId: 'r' }], call, upload: async () => {}, progress: () => {} }), /validation/);
});
