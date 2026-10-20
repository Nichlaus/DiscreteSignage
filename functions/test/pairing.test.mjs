import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createPairing } from '../src/pairing.js';

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
