import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createPlatformAdmin } from '../src/platform-admin.js';

let app, db, service;
const businessId = 'admin-fixture', uid = 'platform-test-admin';
const account = { uid, email: 'admin@example.test', emailVerified: true, disabled: false };
const request = (data = { businessId }) => ({ data, app: { appId: 'test' },
  auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000), platformAdmin: true, firebase: { sign_in_second_factor: 'totp' } } } });
const deny = (value, code) => assert.rejects(value, error => error.code === code);
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'platform-admin-tests'); db = getFirestore(app);
  service = createPlatformAdmin({ firestore: db, auth: { getUser: async () => account } });
  await db.doc(`businesses/${businessId}`).set({ name: 'Admin fixture', country: 'AU', currency: 'AUD', createdBy: 'private-owner' });
  await db.doc(`businesses/${businessId}/members/${uid}`).set({ active: true, role: 'owner' });
});
after(async () => {
  await db.recursiveDelete(db.doc(`businesses/${businessId}`));
  await db.doc(`platformAdmins/${uid}`).delete();
  const audits = await db.collection('platformAudit').where('businessId', '==', businessId).get();
  await Promise.all(audits.docs.map(doc => doc.ref.delete()));
  await db.terminate(); await deleteApp(app);
});

test('platform access requires verified staff identity and separate current permission', async () => {
  await deny(service.getPlatformBusiness({ ...request(), auth: undefined }), 'unauthenticated');
  await deny(service.getPlatformBusiness({ ...request(), app: undefined }), 'failed-precondition');
  const device = request(); device.auth.token.device = true;
  await deny(service.getPlatformBusiness(device), 'permission-denied');
  await deny(service.getPlatformBusiness(request()), 'permission-denied'); // Business owner + token claim do not grant platform access.
  const grant = db.doc(`platformAdmins/${uid}`);
  await grant.set({ active: true, permissions: [] });
  await deny(service.getPlatformBusiness(request()), 'permission-denied');
  await grant.set({ active: true, permissions: ['business.read'] });
  const singleFactor = request(); delete singleFactor.auth.token.firebase.sign_in_second_factor;
  await deny(service.getPlatformBusiness(singleFactor), 'permission-denied');
  account.emailVerified = false;
  await deny(service.getPlatformBusiness(request()), 'permission-denied'); account.emailVerified = true;
  account.disabled = true;
  await deny(service.getPlatformBusiness(request()), 'permission-denied'); account.disabled = false;
  await deny(service.getPlatformBusiness(request({ businessId, permissions: ['business.read'] })), 'invalid-argument');
  await deny(service.getPlatformBusiness(request({ businessId: '../other' })), 'invalid-argument');
  await deny(service.getPlatformBusiness(request({ businessId: 'missing' })), 'not-found');
});

test('diagnostics are bounded, omit sensitive fields and audit successful access; revocation is immediate on next lookup', async () => {
  const base = db.doc(`businesses/${businessId}`);
  await base.collection('entitlements').doc('current').set({ source: 'trial', trialEndsAt: Timestamp.fromMillis(Date.now() + 10000), privateValue: 'never-return' });
  await Promise.all(Array.from({ length: 11 }, (_, i) => base.collection('locations').doc(`loc${String(i).padStart(2, '0')}`).set({ name: `Location ${i}`, timezone: 'Australia/Sydney' })));
  await Promise.all(Array.from({ length: 21 }, (_, i) => base.collection('locations').doc('loc00').collection('screens').doc(`screen${i}`).set({ name: 'Screen', active: true, version: 2, deviceId: 'admin-test-device', secret: 'never-return' })));
  await base.collection('deviceStatus').doc('admin-test-device').set({ state: 'ready', appliedVersion: 2, reportedAt: Timestamp.now() });
  await Promise.all(Array.from({ length: 51 }, (_, i) => base.collection('media').doc(`media${i}`).set({ name: 'Media', status: 'ready', contentType: 'image/webp', size: 100, path: 'private-path', url: 'never-return' })));
  const result = await service.getPlatformBusiness(request());
  assert.equal(result.locations.length, 10); assert.equal(result.locationsTruncated, true);
  assert.equal(result.locations[0].screens.length, 20); assert.equal(result.locations[0].screensTruncated, true);
  assert.equal(result.locations[0].screens[0].state, 'ready');
  assert.equal(result.media.length, 50); assert.equal(result.mediaTruncated, true);
  assert.ok(!JSON.stringify(result).includes('never-return'));
  assert.ok(!JSON.stringify(result).includes('private-owner'));
  assert.ok(!JSON.stringify(result).includes('private-path'));
  const audits = await db.collection('platformAudit').where('businessId', '==', businessId).get();
  assert.equal(audits.size, 1); assert.equal(audits.docs[0].data().actorUid, uid);
  await db.doc(`platformAdmins/${uid}`).update({ active: false });
  await deny(service.getPlatformBusiness(request()), 'permission-denied');
});
