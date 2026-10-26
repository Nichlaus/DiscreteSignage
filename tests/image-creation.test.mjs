import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageCreationView, saveGeneratedAdvert } from '../web/image-creation.js';
test('image creation explains explicit review, private library and preview lifetime', () => {
  const html = imageCreationView();
  for (const text of ['Nothing is sent to a screen automatically', 'Words to include', '3 image requests', 'unsaved previews are lost']) assert.ok(html.includes(text));
  assert.ok(!html.includes('data-image-save'));
});

test('branding selectors escape names and include only ready images', () => {
  const html = imageCreationView([{ id: 'a', name: '<Logo>', status: 'ready', contentType: 'image/webp' },
    { id: 'b', name: 'Pending', status: 'uploaded', contentType: 'image/png' },
    { id: 'c', name: 'Video', status: 'ready', contentType: 'video/mp4' }]);
  assert.ok(html.includes('&lt;Logo&gt;')); assert.ok(!html.includes('<Logo>'));
  assert.ok(!html.includes('Pending')); assert.ok(!html.includes('Video'));
  for (const label of ['Edit an existing advert', 'Create a variation', 'Business logo', 'Brand colours', 'I agree to send these selected images']) assert.ok(html.includes(label));
});
test('library save retries a lost validation response without duplicate upload or screen mutation', async () => {
  const draft = { requestId: 'stable', name: 'Advert.webp', blob: new Blob(['fixture'], { type: 'image/webp' }) };
  let state = 'uploading', uploads = 0, reservations = 0;
  const calls = [];
  const call = async (name, data) => {
    calls.push(name);
    if (name === 'beginMediaUpload') { reservations++; assert.equal(data.requestId, 'stable'); return { mediaId: 'image' }; }
    if (name === 'listMedia') return { items: [{ id: 'image', status: state }] };
    if (name === 'authorizeMediaUpload') return {};
    if (name === 'completeMediaUpload') { state = 'uploaded'; return { status: state }; }
    if (name === 'validateMedia') { state = 'ready'; throw Error('Response lost'); }
    throw Error(`Unexpected action ${name}`);
  };
  const upload = async () => { uploads++; };
  await assert.rejects(saveGeneratedAdvert(draft, 'business', call, upload));
  assert.deepEqual(await saveGeneratedAdvert(draft, 'business', call, upload), { businessId: 'business', mediaId: 'image' });
  assert.equal(uploads, 1); assert.equal(reservations, 1); assert.ok(!calls.includes('updateScreenSettings'));
});
test('rejected library upload cannot be validated or published', async () => {
  const draft = { mediaId: 'image' };
  await assert.rejects(saveGeneratedAdvert(draft, 'business', async name => {
    assert.equal(name, 'listMedia'); return { items: [{ id: 'image', status: 'rejected' }] };
  }));
});
