import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelMedia } from '../web/media-labels.js';
import { playlistEditor } from '../web/playlist-editor.js';
import { layoutEditor } from '../web/layout-editor.js';
import { mediaReportView } from '../web/media-report.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

test('identical filenames retain distinct identities and stable source labels in every media selector', () => {
  const image = { name: 'offer.webp', contentType: 'image/webp', status: 'ready' };
  const original = [{ ...image, id: 'a'.repeat(64) }, { ...image, id: `submission_${'b'.repeat(64)}` }];
  const media = labelMedia(original);
  assert.notEqual(media[0].label, media[1].label);
  assert.equal(media[0].source, 'Library upload'); assert.equal(media[1].source, 'Client advert');
  assert.equal(original[0].label, undefined);
  const views = [playlistEditor([{ mediaId: media[1].id, duration: 10 }], media, escape),
    layoutEditor({ logo: { mediaId: media[1].id } }, media, escape),
    mediaReportView([{ id: 'main', name: 'Main' }], media, null, escape)];
  for (const html of views) for (const item of media) {
    assert.ok(html.includes(escape(item.label))); assert.ok(html.includes(`value="${item.id}"`));
  }
  assert.ok(views[0].includes(`data-video="false" selected>${escape(media[1].label)}`));
  assert.ok(views[1].includes(`value="${media[1].id}" selected`));
});

test('reference collisions expand without changing asset IDs or depending on list order', () => {
  const media = [{ id: '1111deadbeef', name: 'Offer' }, { id: '2222deadbeef', name: 'Offer' }];
  const labeled = labelMedia(media);
  assert.notEqual(labeled[0].reference, labeled[1].reference);
  assert.deepEqual(labelMedia([...media].reverse()).reverse(), labeled);
  assert.deepEqual(labeled.map(m => m.id), media.map(m => m.id));
});

test('user filenames remain escaped in playlist, logo and report labels', () => {
  const media = labelMedia([{ id: 'safe', name: '<img src=x onerror=alert(1)>', contentType: 'image/png' }]);
  for (const html of [playlistEditor([{ mediaId: 'safe', duration: 10 }], media, escape),
    layoutEditor({}, media, escape), mediaReportView([], media, null, escape)]) {
    assert.ok(!html.includes('<img src=x')); assert.ok(html.includes('&lt;img'));
  }
});
