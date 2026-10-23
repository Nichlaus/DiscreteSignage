import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createAdvertisers } from '../src/advertisers.js';
let app, db, service, clock = Date.now(), id;
const businessId = 'advertiser-fixture';
const request = (data, uid = 'ad-owner') => ({ data, app: { appId: 'test' }, auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } } });
const input = { businessId, requestId: 'request-one', name: 'Bakery' };
const deny = (p, code) => assert.rejects(p, e => e.code === code);
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'advertiser-tests'); db = getFirestore(app);
  service = createAdvertisers({ firestore: db, now: () => clock, auth: { getUser: async uid => ({ uid, email: `${uid}@example.test`, emailVerified: true }) } });
  await db.doc(`businesses/${businessId}`).set({ name: 'Operator' });
  await db.doc(`businesses/${businessId}/members/ad-owner`).set({ active: true, role: 'owner' });
  await db.doc(`businesses/${businessId}/members/ad-staff`).set({ active: true, role: 'staff' });
  await db.doc(`businesses/${businessId}/entitlements/current`).set({ source: 'trial', trialModules: ['screens'], trialStartedAt: Timestamp.fromMillis(clock - 1000), trialEndsAt: Timestamp.fromMillis(clock + 60000) });
});
after(async () => { await db.recursiveDelete(db.doc(`businesses/${businessId}`)); await db.terminate(); await deleteApp(app); });
test('advertiser records require verified ownership and reject client-injected access', async () => {
  await deny(service.createAdvertiser({ ...request(input), auth: undefined }), 'unauthenticated');
  await deny(service.createAdvertiser({ ...request(input), app: undefined }), 'failed-precondition');
  const device = request(input); device.auth.token.device = true;
  await deny(service.createAdvertiser(device), 'permission-denied');
  for (const uid of ['ad-staff', 'outsider']) {
    await deny(service.createAdvertiser(request(input, uid)), 'permission-denied');
    await deny(service.listAdvertisers(request({ businessId }, uid)), 'permission-denied');
  }
  await deny(service.createAdvertiser(request({ ...input, role: 'owner' })), 'invalid-argument');
  await deny(service.createAdvertiser(request({ ...input, name: ' ' })), 'invalid-argument');
});
test('concurrent creation is retry-safe, counted once and does not create membership', async () => {
  const results = await Promise.all([service.createAdvertiser(request(input)), service.createAdvertiser(request(input))]);
  id = results[0].advertiserId;
  assert.equal(results.filter(r => r.created).length, 1);
  assert.equal((await db.doc(`businesses/${businessId}`).get()).data().advertiserCount, 1);
  await deny(service.createAdvertiser(request({ ...input, name: 'Different' })), 'already-exists');
  const list = await service.listAdvertisers(request({ businessId }));
  assert.deepEqual(list.items, [{ id, name: 'Bakery', active: true, version: 1 }]);
  assert.equal((await db.collection(`businesses/${businessId}/members`).get()).size, 2);
});
test('archive and restore are versioned, owner-only, audited and do not release allowance', async () => {
  const update = { businessId, advertiserId: id, expectedVersion: 1, active: false };
  await deny(service.setAdvertiserActive(request(update, 'ad-staff')), 'permission-denied');
  await deny(service.setAdvertiserActive(request({ ...update, businessId: 'foreign' })), 'permission-denied');
  assert.deepEqual(await service.setAdvertiserActive(request(update)), { version: 2 });
  await deny(service.setAdvertiserActive(request({ ...update, active: true })), 'failed-precondition');
  assert.deepEqual(await service.setAdvertiserActive(request({ ...update, active: true, expectedVersion: 2 })), { version: 3 });
  const audit = await db.doc(`businesses/${businessId}/audit/advertiser-${id}-3`).get();
  assert.equal(audit.data().type, 'advertiser.restored');
  assert.equal((await db.doc(`businesses/${businessId}`).get()).data().advertiserCount, 1);
});
test('quota, expired trials and revoked ownership fail closed; expiry still permits archive and reads', async () => {
  await db.doc(`businesses/${businessId}`).update({ advertiserCount: 100 });
  await deny(service.createAdvertiser(request({ ...input, requestId: 'over-quota' })), 'resource-exhausted');
  clock += 120000;
  await deny(service.createAdvertiser(request({ ...input, requestId: 'expired' })), 'failed-precondition');
  await service.setAdvertiserActive(request({ businessId, advertiserId: id, expectedVersion: 3, active: false }));
  await deny(service.setAdvertiserActive(request({ businessId, advertiserId: id, expectedVersion: 4, active: true })), 'failed-precondition');
  assert.equal((await service.listAdvertisers(request({ businessId }))).items[0].active, false);
  await db.doc(`businesses/${businessId}/members/ad-owner`).update({ active: false });
  await deny(service.listAdvertisers(request({ businessId })), 'permission-denied');
});
