import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createFeaturedProducts, validateProduct } from '../src/featured-products.js';
let app, db, service;
const now = Date.now(), businessId = 'product-fixture';
const auth = { getUser: async uid => ({ uid, email: `${uid}@example.test`, emailVerified: uid !== 'unverified', disabled: uid === 'disabled' }) };
const request = (data, uid = 'owner') => ({ data, auth: { uid, token: { auth_time: Math.floor(now / 1000) } }, app: { appId: 'test' } });
const base = { businessId, locationId: 'main' };
const product = { name: 'Everyday tote', description: 'Cotton bag', priceCents: 1250, available: true };
const deny = (p, code) => assert.rejects(p, e => e.code === code);
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'product-tests'); db = getFirestore(app);
  service = createFeaturedProducts({ firestore: db, auth, now: () => now });
  const business = db.doc(`businesses/${businessId}`);
  await business.set({ name: 'Product test' });
  await business.collection('members').doc('owner').set({ active: true, role: 'owner' });
  await business.collection('members').doc('manager').set({ active: true, role: 'manager' });
  await business.collection('members').doc('revoked').set({ active: false, role: 'owner' });
  await business.collection('locations').doc('main').set({ name: 'Main' });
  await business.collection('locations').doc('second').set({ name: 'Second' });
  await business.collection('entitlements').doc('current').set({ source: 'trial', trialModules: ['screens'],
    trialStartedAt: Timestamp.fromMillis(now - 1000), trialEndsAt: Timestamp.fromMillis(now + 86400000) });
});
after(async () => {
  if (db) { await db.recursiveDelete(db.doc(`businesses/${businessId}`)); await db.terminate(); }
  if (app) await deleteApp(app);
});
test('featured products reject unauthenticated, unattested, unverified, disabled, revoked and non-owner access', async () => {
  await deny(service.getFeaturedProduct({ data: base }), 'unauthenticated');
  await deny(service.getFeaturedProduct({ ...request(base), app: undefined }), 'failed-precondition');
  for (const uid of ['unverified', 'disabled', 'revoked', 'manager', 'outsider']) {
    await deny(service.getFeaturedProduct(request(base, uid)), 'permission-denied');
    await deny(service.saveFeaturedProduct(request({ ...base, expectedVersion: 0, product }, uid)), 'permission-denied');
  }
  const device = request(base); device.auth.token.device = true;
  await deny(service.getFeaturedProduct(device), 'permission-denied');
  await deny(service.getFeaturedProduct(request({ ...base, businessId: 'another-business' })), 'permission-denied');
  await deny(service.getFeaturedProduct(request({ ...base, locationId: 'missing' })), 'not-found');
});
test('product validation rejects invalid facts and injected authority', () => {
  for (const patch of [{priceCents:-1},{priceCents:1.5},{priceCents:'1250'},{priceCents:1000000},
    {available:'false'},{name:''},{name:'x'.repeat(101)},{description:'bad\ntext'},{role:'owner'},{currency:'USD'}]) {
    assert.throws(() => validateProduct({...product,...patch}));
  }
  assert.deepEqual(validateProduct({...product,name:' Tote '}), {...product,name:'Tote'});
});
test('save, retry, sold-out edits and location isolation preserve exact cents and trial', async () => {
  assert.equal((await service.getFeaturedProduct(request(base))).version, 0);
  const trialRef = db.doc(`businesses/${businessId}/entitlements/current`);
  const trial = (await trialRef.get()).data();
  const payload = { ...base, expectedVersion: 0, product };
  const results = await Promise.all([service.saveFeaturedProduct(request(payload)), service.saveFeaturedProduct(request(payload))]);
  assert.deepEqual(results, [{ version: 1 }, { version: 1 }]);
  assert.equal((await db.collection(`businesses/${businessId}/audit`).get()).size, 1);
  const changed = { ...product, available: false, priceCents: 1099 };
  await deny(service.saveFeaturedProduct(request({ ...payload, product: changed })), 'failed-precondition');
  await service.saveFeaturedProduct(request({ ...payload, expectedVersion: 1, product: changed }));
  const read = await service.getFeaturedProduct(request(base));
  assert.deepEqual(read, { product: changed, version: 2, currency: 'AUD' });
  assert.equal((await service.getFeaturedProduct(request({ ...base, locationId: 'second' }))).product, null);
  assert.deepEqual((await trialRef.get()).data(), trial);
  const expired = createFeaturedProducts({ firestore: db, auth, now: () => now + 86400001 });
  assert.equal((await expired.getFeaturedProduct(request(base))).version, 2);
  await deny(expired.saveFeaturedProduct(request({ ...payload, expectedVersion: 2 })), 'failed-precondition');
});
