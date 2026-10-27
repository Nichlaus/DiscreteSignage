import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createPairing } from '../src/pairing.js';
import { createScreens } from '../src/screens.js';
import { createMedia, stripDownloadToken, cleanupGraceMs } from '../src/media.js';

let app, db, auth, service, clock = Date.now(), serial = 0;
const request = (data, uid = 'pair-owner') => ({
  data, app: { appId: 'test' }, rawRequest: { ip: `test-address-${serial++}` },
  auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } },
});
const input = code => ({ businessId: 'pair-business', locationId: 'main', name: 'Counter', code });
const rejects = (promise, code) => assert.rejects(promise, e => e.code === code);
const begin = () => service.beginPairing(request({}));
const complete = session => service.completePairing(request({ code: session.code, secret: session.secret }));
before(async () => {
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!process.env[key]?.startsWith('127.0.0.1:')) throw Error('Local emulators required');
  }
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'pairing-tests');
  db = getFirestore(app); auth = getAuth(app);
  service = createPairing({ firestore: db, auth, now: () => clock });
  for (const uid of ['pair-owner', 'pair-staff', 'pair-outsider']) {
    await auth.createUser({ uid, email: `${uid}@example.test`, emailVerified: true });
  }
  const business = db.doc('businesses/pair-business');
  await business.set({ name: 'Pairing tests' });
  await business.collection('members').doc('pair-owner').set({ active: true, role: 'owner' });
  await business.collection('members').doc('pair-staff').set({ active: true, role: 'staff', locations: { main: true } });
  await business.collection('locations').doc('main').set({ name: 'Main' });
  await business.collection('entitlements').doc('current').set({
    source: 'trial', trialModules: ['screens'],
    trialStartedAt: Timestamp.fromMillis(clock - 1000), trialEndsAt: Timestamp.fromMillis(clock + 86400000),
  });
});
after(async () => {
  // Remove this suite's isolated business so provisioning tests can assert an empty tenant collection.
  if (db) await db.recursiveDelete(db.doc('businesses/pair-business'));
  await db?.terminate(); if (app) await deleteApp(app);
});

test('pairing creation requires App Check, exact fields and a rate-limited address', async () => {
  await rejects(service.beginPairing({ data: {} }), 'failed-precondition');
  await rejects(service.beginPairing(request({ businessId: 'injected' })), 'invalid-argument');
  const req = request({});
  for (let i = 0; i < 10; i++) await service.beginPairing(req);
  await rejects(service.beginPairing(req), 'resource-exhausted');
});
test('short code cannot redeem device credentials and only active owners can claim', async () => {
  const session = await begin();
  assert.deepEqual(await complete(session), { status: 'pending' });
  await rejects(complete({ ...session, secret: '0'.repeat(64) }), 'permission-denied');
  for (const uid of ['pair-staff', 'pair-outsider']) {
    await rejects(service.claimScreen(request(input(session.code), uid)), 'permission-denied');
  }
  await rejects(service.claimScreen(request({ ...input(session.code), locationId: 'missing' })), 'not-found');
});
test('concurrent owner claims create one screen; redemption is single-use with device-only claims', async () => {
  const session = await begin();
  const results = await Promise.all([1, 2, 3].map(() => service.claimScreen(request(input(session.code)))));
  assert.equal(new Set(results.map(r => r.deviceId)).size, 1);
  await rejects(service.claimScreen(request({ ...input(session.code), name: 'Changed' })), 'already-exists');
  const redeemed = await Promise.allSettled([complete(session), complete(session)]);
  assert.equal(redeemed.filter(r => r.status === 'fulfilled').length, 1);
  const result = redeemed.find(r => r.status === 'fulfilled').value;
  const payload = JSON.parse(Buffer.from(result.token.split('.')[1], 'base64url'));
  assert.equal(payload.uid, results[0].deviceId);
  assert.deepEqual(payload.claims, { device: true, businessId: 'pair-business' });
  assert.equal((await db.doc('businesses/pair-business').get()).data().screenCount, 1);
  await rejects(complete(session), 'failed-precondition');
});
test('revocation is owner-only, idempotent, and prevents redemption', async () => {
  const session = await begin();
  const device = await service.claimScreen(request(input(session.code)));
  const data = { businessId: 'pair-business', deviceId: device.deviceId };
  await rejects(service.revokeScreen(request(data, 'pair-staff')), 'permission-denied');
  await service.revokeScreen(request(data));
  await service.revokeScreen(request(data));
  assert.equal((await db.doc(`businesses/pair-business/devices/${device.deviceId}`).get()).data().active, false);
  await rejects(complete(session), 'failed-precondition');
});
test('signing failure does not consume a claimed session', async () => {
  const session = await begin();
  await service.claimScreen(request(input(session.code)));
  const failing = createPairing({ firestore: db, now: () => clock,
    auth: { createCustomToken: async () => { throw Error('Signing unavailable'); } } });
  await assert.rejects(failing.completePairing(request({ code: session.code, secret: session.secret })), /Signing unavailable/);
  assert.equal((await complete(session)).status, 'ready');
});
test('expired codes and expired trials fail closed', async () => {
  const session = await begin();
  clock += 600001;
  await rejects(service.claimScreen(request(input(session.code))), 'failed-precondition');
  await rejects(complete(session), 'failed-precondition');
  clock += 86400000;
  const fresh = await begin();
  await rejects(service.claimScreen(request(input(fresh.code))), 'failed-precondition');
});
test('settings require active ownership, trial and registered screen; stale writes cannot overwrite', async () => {
  clock = Date.now();
  const settings = createScreens({ firestore: db, auth, now: () => clock });
  const session = await begin();
  const screen = await service.claimScreen(request(input(session.code)));
  const data = { businessId: 'pair-business', locationId: 'main', screenId: screen.screenId,
    expectedVersion: 1, orientation: 'portrait', scaleType: 'stretch' };
  for (const uid of ['pair-staff', 'pair-outsider']) {
    await rejects(settings.updateScreenSettings(request(data, uid)), 'permission-denied');
  }
  for (const patch of [{ orientation: 'sideways' }, { scaleType: 'raw' }, { expectedVersion: 0 }, { active: true }]) {
    await rejects(settings.updateScreenSettings(request({ ...data, ...patch })), 'invalid-argument');
  }
  const results = await Promise.all([1, 2, 3].map(() => settings.updateScreenSettings(request(data))));
  assert.equal(results.filter(r => r.changed).length, 1);
  assert.ok(results.every(r => r.version === 2));
  await rejects(settings.updateScreenSettings(request({ ...data, orientation: 'landscape' })), 'failed-precondition');
  const audit = await db.doc(`businesses/pair-business/audit/settings-${screen.screenId}-2`).get();
  assert.deepEqual(audit.data().after, { interactive: { enabled: false }, orientation: 'portrait', scaleType: 'stretch', mediaId: null, playlist: [], transition: 'fade', layout: 'single', secondaryPlaylist: [], logo: null });
  clock += 2 * 86400000;
  await rejects(settings.updateScreenSettings(request({ ...data, expectedVersion: 2 })), 'failed-precondition');
  clock = Date.now();
  await service.revokeScreen(request({ businessId: 'pair-business', deviceId: screen.deviceId }));
  await rejects(settings.updateScreenSettings(request({ ...data, expectedVersion: 2 })), 'failed-precondition');
});
test('media reservations enforce ownership, input, idempotency, trial and aggregate quota', async () => {
  const media = createMedia({ firestore: db, auth, now: () => clock });
  const data = { businessId: 'pair-business', requestId: 'media-one', name: 'menu.png', contentType: 'image/png', size: 12 };
  for (const uid of ['pair-staff', 'pair-outsider']) {
    await rejects(media.beginMediaUpload(request(data, uid)), 'permission-denied');
    await rejects(media.listMedia(request({ businessId: 'pair-business' }, uid)), 'permission-denied');
  }
  for (const patch of [{ size: -1 }, { size: 21 * 1024 * 1024 }, { contentType: 'image/svg+xml' }, { status: 'uploaded' }]) {
    await rejects(media.beginMediaUpload(request({ ...data, ...patch })), 'invalid-argument');
  }
  const results = await Promise.all([1, 2, 3].map(() => media.beginMediaUpload(request(data))));
  assert.equal(new Set(results.map(r => r.mediaId)).size, 1);
  assert.equal((await db.doc('businesses/pair-business').get()).data().mediaReservedBytes, 12);
  await rejects(media.beginMediaUpload(request({ ...data, size: 13 })), 'already-exists');
  await db.doc('businesses/pair-business').update({ mediaReservedBytes: 1024 ** 3 });
  await rejects(media.beginMediaUpload(request({ ...data, requestId: 'over-quota' })), 'resource-exhausted');
  await db.doc('businesses/pair-business').update({ mediaReservedBytes: 12 });
  clock += 2 * 86400000;
  await rejects(media.beginMediaUpload(request({ ...data, requestId: 'expired-trial' })), 'failed-precondition');
  clock = Date.now();
});
test('upload grants bind size, type and immutable destination and require current owner and trial', async () => {
  let signed;
  const media = createMedia({ firestore: db, auth, now: () => clock, bucket: () => ({
    file: path => ({
      getSignedUrl: async options => { signed = { path, options }; return ['https://storage.googleapis.com/test-only']; },
    }),
  }) });
  const entry = await media.beginMediaUpload(request({ businessId: 'pair-business', requestId: 'media-one',
    name: 'menu.png', contentType: 'image/png', size: 12 }));
  const data = { businessId: 'pair-business', mediaId: entry.mediaId };
  for (const uid of ['pair-staff', 'pair-outsider']) {
    await rejects(media.authorizeMediaUpload(request(data, uid)), 'permission-denied');
  }
  await rejects(media.authorizeMediaUpload(request({ ...data, path: 'other' })), 'invalid-argument');
  const grant = await media.authorizeMediaUpload(request(data));
  assert.equal(signed.path, entry.path);
  assert.equal(signed.options.action, 'write');
  assert.equal(signed.options.version, 'v4');
  assert.equal(signed.options.contentType, 'image/png');
  assert.equal(grant.expiresAt, clock + 5 * 60000);
  assert.deepEqual(signed.options.extensionHeaders, {
    'x-goog-content-length-range': '12,12', 'x-goog-if-generation-match': '0',
    'x-goog-meta-reservation': entry.mediaId,
  });
  clock += 29 * 60000;
  assert.equal((await media.authorizeMediaUpload(request(data))).expiresAt, entry.expiresAt);
  clock += 2 * 60000;
  await rejects(media.authorizeMediaUpload(request(data)), 'failed-precondition');
  clock += 2 * 86400000;
  await rejects(media.authorizeMediaUpload(request(data)), 'failed-precondition');
  clock = Date.now();
});
test('media completion inspects immutable bytes, rejects disguised content and is idempotent', async () => {
  let signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
  let readGeneration;
  const media = createMedia({ firestore: db, auth, now: () => clock, bucket: () => ({
    file: (path, options) => ({
      getMetadata: async () => [{ size: '12', contentType: 'image/png', generation: '7' }],
      download: async () => { readGeneration = options.generation; return [signature]; },
    }),
  }) });
  const beginData = { businessId: 'pair-business', name: 'image.png', contentType: 'image/png', size: 12 };
  const item = await media.beginMediaUpload(request({ ...beginData, requestId: 'valid-upload' }));
  const data = { businessId: 'pair-business', mediaId: item.mediaId };
  await rejects(media.completeMediaUpload(request(data, 'pair-outsider')), 'permission-denied');
  assert.equal((await media.completeMediaUpload(request(data))).status, 'uploaded');
  assert.equal(readGeneration, '7');
  assert.equal((await media.completeMediaUpload(request(data))).status, 'uploaded');
  signature = Buffer.from('<html>attack');
  const bad = await media.beginMediaUpload(request({ ...beginData, requestId: 'disguised-upload' }));
  assert.equal((await media.completeMediaUpload(request({ ...data, mediaId: bad.mediaId }))).status, 'rejected');
  const listed = await media.listMedia(request({ businessId: 'pair-business' }));
  assert.ok(listed.items.some(i => i.id === item.mediaId && i.status === 'uploaded'));
  assert.ok(listed.items.every(i => !Object.hasOwn(i, 'path') && !Object.hasOwn(i, 'generation')));
});
test('quarantine removes bearer tokens with a metadata precondition', async () => {
  let call;
  await stripDownloadToken({
    getMetadata: async () => [{ metageneration: '4', metadata: { firebaseStorageDownloadTokens: 'secret' } }],
    setMetadata: async (...args) => { call = args; },
  });
  assert.deepEqual(call, [{ metadata: { firebaseStorageDownloadTokens: null } }, { ifMetagenerationMatch: '4' }]);
  await stripDownloadToken({
    getMetadata: async () => [{ metadata: { reservation: 'kept' } }],
    setMetadata: async () => assert.fail('Token-free objects must not be rewritten'),
  });
});
test('cleanup waits out resumable sessions, preserves uploaded files and releases quota once', async () => {
  const deleted = [];
  let failDelete = true;
  const media = createMedia({ firestore: db, auth, now: () => clock, bucket: () => ({
    file: (path, options) => ({
      getMetadata: async () => [{ generation: '11' }],
      delete: async precondition => {
        if (failDelete) throw Object.assign(Error('Temporary failure'), { code: 503 });
        assert.equal(options.generation, '11');
        assert.equal(precondition.ifGenerationMatch, '11');
        deleted.push(path);
      },
    }),
  }) });
  await rejects(media.cleanupMedia(request({ businessId: 'pair-business' }, 'pair-outsider')), 'permission-denied');
  assert.equal((await media.cleanupMedia(request({ businessId: 'pair-business' }))).removed, 0);
  const before = (await db.doc('businesses/pair-business').get()).data();
  clock += cleanupGraceMs + 31 * 60000;
  await assert.rejects(media.cleanupMedia(request({ businessId: 'pair-business' })), /Temporary failure/);
  assert.equal((await db.doc('businesses/pair-business').get()).data().mediaReservedBytes, before.mediaReservedBytes);
  failDelete = false;
  const outcomes = await Promise.all([1, 2].map(() => media.cleanupMedia(request({ businessId: 'pair-business' }))));
  assert.equal(outcomes.reduce((n, r) => n + r.removed, 0), 2);
  const after = (await db.doc('businesses/pair-business').get()).data();
  assert.equal(after.mediaCount, 1);
  assert.equal(after.mediaReservedBytes, 12);
  assert.equal((await media.cleanupMedia(request({ businessId: 'pair-business' }))).removed, 0);
  assert.equal((await media.listMedia(request({ businessId: 'pair-business' }))).items[0].status, 'uploaded');
  assert.ok(deleted.length >= 2);
});
test('cleanup releases a missing object and retains its reservation tombstone', async () => {
  clock = Date.now();
  const media = createMedia({ firestore: db, auth, now: () => clock, bucket: () => ({
    file: () => ({
      getMetadata: async () => { throw Object.assign(Error('Missing object'), { code: 404 }); },
    }),
  }) });
  const data = { businessId: 'pair-business', requestId: 'never-uploaded',
    name: 'missing.png', contentType: 'image/png', size: 12 };
  const entry = await media.beginMediaUpload(request(data));
  clock += cleanupGraceMs + 31 * 60000;
  for (const uid of ['pair-staff', 'pair-outsider']) {
    await rejects(media.cleanupMedia(request({ businessId: 'pair-business' }, uid)), 'permission-denied');
  }
  assert.equal((await media.cleanupMedia(request({ businessId: 'pair-business' }))).removed, 1);
  assert.equal((await db.doc(`businesses/pair-business/media/${entry.mediaId}`).get()).data().status, 'deleted');
  assert.equal((await db.doc('businesses/pair-business').get()).data().mediaCount, 1);
  clock = Date.now();
  await rejects(media.beginMediaUpload(request(data)), 'failed-precondition');
});
