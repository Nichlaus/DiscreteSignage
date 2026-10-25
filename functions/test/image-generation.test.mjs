import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createImageGeneration, openAIImageGenerator } from '../src/image-generation.js';
let app, db, business, jpeg;
const now = Date.now(), data = { businessId: 'image-ai-test', prompt: 'Warm coffee advert', copy: 'Coffee time', orientation: 'landscape' };
const auth = { getUser: async uid => ({ uid, email: `${uid}@example.test`, emailVerified: uid !== 'unverified', disabled: false }) };
const request = (body = data, uid = 'owner') => ({ data: body, app: { appId: 'test' }, auth: { uid, token: { auth_time: Math.floor(now / 1000) } } });
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'image-ai-tests'); db = getFirestore(app);
  business = db.doc(`businesses/${data.businessId}`);
  await business.set({ mediaCount: 0, mediaReservedBytes: 0 });
  await business.collection('members').doc('owner').set({ role: 'owner', active: true });
  await business.collection('entitlements').doc('current').set({ source: 'trial', trialModules: ['screens', 'aiStudio'],
    trialStartedAt: Timestamp.fromMillis(now - 1000), trialEndsAt: Timestamp.fromMillis(now + 86400000) });
  jpeg = await sharp({ create: { width: 1536, height: 864, channels: 3, background: '#356744' } }).jpeg().toBuffer();
});
after(async () => { await db.recursiveDelete(business); await db.terminate(); await deleteApp(app); });
const make = (generate = async () => jpeg, reserve = async () => ({ usage: { remainingToday: 2 }, finish: async () => {} })) =>
  createImageGeneration({ firestore: db, auth, generate, reserve, now: () => now });

test('image creation rejects unauthorized, cross-business, invalid input and missing AI entitlement before spending', async () => {
  let reserved = 0;
  const run = make(undefined, async () => { reserved++; throw Error('Must not reserve'); });
  for (const req of [{ data }, { ...request(), app: undefined }, request(data, 'outsider'), request(data, 'unverified'),
    request({ ...data, businessId: 'another-business' }), request({ ...data, orientation: 'auto' }),
    request({ ...data, model: 'injected' }), request({ ...data, prompt: 'a'.repeat(2001) })]) await assert.rejects(run(req));
  await business.collection('entitlements').doc('current').update({ trialModules: ['screens'] });
  await assert.rejects(run(request()), e => e.code === 'failed-precondition');
  await business.collection('entitlements').doc('current').update({ trialModules: ['screens', 'aiStudio'] });
  assert.equal(reserved, 0);
});
test('generated preview is sanitized, scoped and does not create library files; revoked access prevents delivery', async () => {
  const preview = await make(async input => {
    assert.deepEqual(Object.keys(input).sort(), ['copy', 'orientation', 'prompt', 'safetyId']);
    assert.match(input.safetyId, /^[a-f0-9]{64}$/); return jpeg;
  })(request());
  assert.equal(preview.contentType, 'image/webp'); assert.equal(preview.width, 1536);
  assert.equal((await business.collection('media').get()).size, 0);
  assert.equal((await business.get()).data().mediaCount, 0);
  const metadata = await sharp(Buffer.from(preview.base64, 'base64')).metadata();
  assert.equal(metadata.exif, undefined);
  try {
    await assert.rejects(make(async () => { await business.collection('members').doc('owner').update({ active: false }); return jpeg; })(request()), e => e.code === 'permission-denied');
  } finally { await business.collection('members').doc('owner').update({ active: true }); }
});
test('bad provider bytes and errors fail safely and release the generation lease', async () => {
  let finished = 0;
  for (const generate of [async () => Buffer.from('not an image'), async () => { throw Error('secret-key'); }]) {
    await assert.rejects(make(generate, async () => ({ finish: async () => { finished++; } }))(request()),
      e => e.code === 'unavailable' && !e.message.includes('secret-key'));
  }
  assert.equal(finished, 2);
});
test('image adapter fixes model, quality, count and dimensions and accepts only bounded base64 bytes', async () => {
  const generate = openAIImageGenerator({ apiKey: 'test-only', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/images/generations');
    const body = JSON.parse(options.body);
    assert.equal(body.n, 1); assert.equal(body.size, '1536x864'); assert.equal(body.moderation, 'auto');
    assert.equal(body.quality, 'medium'); assert.equal(body.model, 'gpt-image-2.5-flare');
    return new Response(JSON.stringify({ data: [{ b64_json: jpeg.toString('base64') }] }));
  } });
  assert.deepEqual(await generate({ ...data, safetyId: 'hashed' }), jpeg);
  for (const body of [{ data: [{ url: 'https://untrusted.example/image' }] }, { data: [{ b64_json: 'bad!' }] }]) {
    await assert.rejects(openAIImageGenerator({ apiKey: 'test', fetchImpl: async () => new Response(JSON.stringify(body)) })(data));
  }
  await assert.rejects(openAIImageGenerator({ apiKey: 'test', fetchImpl: async () => new Response('x'.repeat(12 * 1024 * 1024 + 1)) })(data));
});
