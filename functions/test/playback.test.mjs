import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createPlayback } from '../src/playback.js';
import { createScreens } from '../src/screens.js';
import { InvalidMedia } from '../src/image-validation.js';

let app, db, auth, business, playback, settings, clock = Date.now(), decodeCalls = 0;
const objects = new Map(), signed = [];
const bytes = Buffer.alloc(12, 1);
let decode = async () => ({ bytes: Buffer.from('sanitized webp'), width: 4, height: 3, contentType: 'image/webp' });
const request = (data, uid = 'play-owner', device = false) => ({
  data, app: { appId: 'test' }, auth: { uid, token: {
    auth_time: Math.floor(Date.now() / 1000), ...(device ? { device: true, businessId: 'play-business' } : {}),
  } },
});
const deny = (promise, code) => assert.rejects(promise, error => error.code === code);
const validate = id => playback.validateMedia(request({ businessId: business.id, mediaId: id }));
async function seed(id, contentType = 'image/png') {
  const path = `businesses/${business.id}/media/${id}/original`;
  objects.set(path, { data: bytes, metadata: { size: '12', contentType, generation: '1' } });
  await business.collection('media').doc(id).set({
    status: 'uploaded', contentType, size: 12, path, generation: '1', createdAt: Timestamp.fromMillis(clock),
  });
}
before(async () => {
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!process.env[key]?.startsWith('127.0.0.1:')) throw Error('Local emulators required');
  }
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'playback-tests');
  db = getFirestore(app); auth = getAuth(app);
  for (const uid of ['play-owner', 'play-staff', 'play-outsider', 'play-device']) {
    await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
  }
  business = db.doc('businesses/play-business');
  await business.set({ name: 'Playback tests' });
  await business.collection('members').doc('play-owner').set({ active: true, role: 'owner' });
  await business.collection('members').doc('play-staff').set({ active: true, role: 'staff' });
  await business.collection('entitlements').doc('current').set({
    source: 'trial', trialModules: ['screens'],
    trialStartedAt: Timestamp.fromMillis(clock - 1000), trialEndsAt: Timestamp.fromMillis(clock + 86400000),
  });
  await business.collection('devices').doc('play-device').set({ active: true, locationId: 'main', screenId: 'counter' });
  await business.collection('locations').doc('main').collection('screens').doc('counter').set({
    active: true, deviceId: 'play-device', version: 1, orientation: 'landscape', scaleType: 'fit',
  });
  playback = createPlayback({ firestore: db, auth, now: () => clock,
    decode: async (...args) => { decodeCalls++; return decode(...args); },
    bucket: () => ({ file: (path, options) => ({
      getMetadata: async () => {
        const value = objects.get(path);
        if (!value) throw Object.assign(Error('Missing'), { code: 404 });
        return [value.metadata];
      },
      download: async () => { assert.equal(options.generation, '1'); return [objects.get(path).data]; },
      save: async (data, options) => {
        assert.equal(options.preconditionOpts.ifGenerationMatch, 0);
        assert.equal(options.metadata.cacheControl, 'private, no-store');
        if (objects.has(path)) throw Object.assign(Error('Already exists'), { code: 412 });
        objects.set(path, { data, metadata: { ...options.metadata, generation: '2', size: String(data.length) } });
      },
      getSignedUrl: async options => { signed.push({ path, options }); return ['https://storage.googleapis.com/test-only']; },
    }) }),
  });
  settings = createScreens({ firestore: db, auth, now: () => clock });
});
after(async () => {
  await db?.recursiveDelete(business); await db?.terminate(); if (app) await deleteApp(app);
});
test('validation requires active ownership and rejects video until its decoder is available', async () => {
  await seed('image'); await seed('video', 'video/mp4');
  for (const uid of ['play-staff', 'play-outsider', 'play-device']) {
    await deny(playback.validateMedia(request({ businessId: business.id, mediaId: 'image' }, uid, uid === 'play-device')), 'permission-denied');
  }
  await deny(validate('video'), 'failed-precondition');
  assert.equal(decodeCalls, 0);
  await deny(playback.validateMedia(request({ businessId: business.id, mediaId: 'image', status: 'ready' })), 'invalid-argument');
});
test('validation is idempotent, preserves originals and publishes only verified derivatives', async () => {
  const original = objects.get(`businesses/${business.id}/media/image/original`);
  assert.equal((await validate('image')).status, 'ready');
  assert.equal((await validate('image')).status, 'ready');
  assert.equal(decodeCalls, 1);
  assert.equal(objects.get(`businesses/${business.id}/media/image/original`), original);
  const entry = (await business.collection('media').doc('image').get()).data();
  assert.equal(entry.playback.policy, 'image-v1'); assert.equal(entry.playback.generation, '2');
  assert.equal((await business.collection('audit').doc('validated-image').get()).exists, true);
});
test('invalid data is never made ready and transient retries are bounded', async () => {
  const success = decode;
  await seed('broken');
  decode = async () => { throw new InvalidMedia('Corrupt pixels'); };
  assert.equal((await validate('broken')).status, 'validation-failed');
  assert.equal((await business.collection('media').doc('broken').get()).data().playback, undefined);
  await seed('transient');
  decode = async () => { throw Error('Storage interrupted'); };
  for (let i = 0; i < 3; i++) await assert.rejects(validate('transient'), /Storage interrupted/);
  await deny(validate('transient'), 'resource-exhausted');
  decode = success;
});
test('owner revocation during decoding prevents publication; retry recovers an existing derivative', async () => {
  await seed('revoked-during-validation');
  const success = decode; let finish, started;
  const entered = new Promise(resolve => { started = resolve; });
  decode = async () => { started(); await new Promise(resolve => { finish = resolve; }); return success(); };
  const pending = validate('revoked-during-validation');
  await entered;
  await business.collection('members').doc('play-owner').update({ active: false });
  finish(); await deny(pending, 'permission-denied');
  assert.equal((await business.collection('media').doc('revoked-during-validation').get()).data().status, 'uploaded');
  await business.collection('members').doc('play-owner').update({ active: true });
  decode = success;
  assert.equal((await validate('revoked-during-validation')).status, 'ready');
});
test('validation leases prevent concurrent decoding and recover after worker interruption', async () => {
  await seed('lease');
  await business.collection('media').doc('lease').update({
    status: 'validating', validationLease: 'old', leaseUntil: Timestamp.fromMillis(clock + 1000),
    validationAttempts: 1, validationError: 'Prior interruption',
  });
  await deny(validate('lease'), 'failed-precondition');
  clock += 1001;
  assert.equal((await validate('lease')).status, 'ready');
  const value = (await business.collection('media').doc('lease').get()).data();
  assert.equal(value.validationAttempts, 2); assert.equal(value.validationError, null);
});
test('screen assignment rejects unvalidated/cross-tenant media and playback is bound to the registered device', async () => {
  const input = { businessId: business.id, locationId: 'main', screenId: 'counter',
    expectedVersion: 1, orientation: 'portrait', scaleType: 'fit' };
  for (const mediaId of ['broken', 'video', 'other-business-image']) {
    await deny(settings.updateScreenSettings(request({ ...input, mediaId })), 'failed-precondition');
  }
  await settings.updateScreenSettings(request({ ...input, mediaId: 'image' }));
  await deny(playback.getScreenPlayback(request({})), 'permission-denied');
  const deviceRequest = request({}, 'play-device', true);
  await deny(playback.getScreenPlayback({ ...deviceRequest, app: undefined }), 'failed-precondition');
  await deny(playback.getScreenPlayback({ ...deviceRequest, data: { mediaId: 'other' } }), 'invalid-argument');
  const manifest = await playback.getScreenPlayback(deviceRequest);
  assert.equal(manifest.version, 2); assert.equal(manifest.expiresAt, clock + 60000);
  assert.equal(manifest.asset.id, 'image'); assert.equal(manifest.asset.path, undefined);
  assert.equal(signed.at(-1).options.queryParams.generation, '2');
  assert.equal(signed.at(-1).options.action, 'read');
  await business.collection('devices').doc('play-device').update({ active: false });
  await deny(playback.getScreenPlayback(deviceRequest), 'permission-denied');
  await business.collection('devices').doc('play-device').update({ active: true });
  await auth.updateUser('play-device', { disabled: true });
  await deny(playback.getScreenPlayback(deviceRequest), 'permission-denied');
  await auth.updateUser('play-device', { disabled: false });
  await business.collection('entitlements').doc('current').update({ trialEndsAt: Timestamp.fromMillis(clock + 10000) });
  assert.equal((await playback.getScreenPlayback(deviceRequest)).expiresAt, clock + 10000);
  clock += 2 * 86400000;
  await deny(playback.getScreenPlayback(deviceRequest), 'failed-precondition');
});
