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
  await Promise.all(Array.from({ length: 23 }, (_, i) => db.doc(`businesses/admin-directory-${i}`).delete()));
  const audits = await db.collection('platformAudit').where('actorUid', '==', uid).get();
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

test('business directory enforces MFA and current permission, paginates duplicate names, redacts and audits each page', async () => {
  const call = data => service.listPlatformBusinesses(request(data));
  await deny(call({ after: null }), 'permission-denied'); // Previous test revoked this grant.
  await db.doc(`platformAdmins/${uid}`).set({ active: true, permissions: ['business.read'] });
  await deny(service.listPlatformBusinesses({ ...request({ after: null }), auth: undefined }), 'unauthenticated');
  await deny(service.listPlatformBusinesses({ ...request({ after: null }), app: undefined }), 'failed-precondition');
  const noMfa = request({ after: null }); delete noMfa.auth.token.firebase;
  await deny(service.listPlatformBusinesses(noMfa), 'permission-denied');
  const device = request({ after: null }); device.auth.token.device = true;
  await deny(service.listPlatformBusinesses(device), 'permission-denied');
  await deny(call({ after: null, limit: 1000 }), 'invalid-argument');
  await deny(call({ after: '../invalid' }), 'invalid-argument');
  await deny(call({ after: 'missing-directory-cursor' }), 'failed-precondition');
  await Promise.all(Array.from({ length: 23 }, (_, i) => db.doc(`businesses/admin-directory-${i}`).set({ name: 'Duplicate cafe', country: 'AU', currency: 'AUD', createdBy: 'secret-owner' })));
  let after = null, pages = 0; const seen = new Set();
  do {
    const page = await call({ after });
    assert.ok(page.businesses.length <= 20);
    for (const business of page.businesses) {
      assert.ok(!seen.has(business.id), 'Pagination must not repeat duplicate-name entries'); seen.add(business.id);
      assert.deepEqual(Object.keys(business).sort(), ['country', 'currency', 'id', 'name']);
    }
    after = page.next; pages++;
    assert.ok(pages < 20, 'Pagination must terminate');
  } while (after);
  for (let i = 0; i < 23; i++) assert.ok(seen.has(`admin-directory-${i}`));
  const audits = await db.collection('platformAudit').where('actorUid', '==', uid).get();
  const lists = audits.docs.map(d => d.data()).filter(d => d.type === 'platform.business.list');
  assert.equal(lists.length, pages); assert.ok(lists.every(a => a.businessIds.length <= 20));
  await db.doc(`platformAdmins/${uid}`).update({ permissions: [] });
  await deny(call({ after: null }), 'permission-denied');
});
