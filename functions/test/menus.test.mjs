import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createMenus, validateMenu } from '../src/menus.js';
let app, db, service;
const now = Date.now(), businessId = 'menu-fixture';
const auth = { getUser: async uid => ({ uid, email: `${uid}@example.test`, emailVerified: uid !== 'unverified', disabled: uid === 'disabled' }) };
const request = (data, uid = 'owner') => ({ data, auth: { uid, token: { auth_time: Math.floor(now / 1000) } }, app: { appId: 'test' } });
const base = { businessId, locationId: 'main' };
const menu = { categories: [{ id: 'food', name: 'Meals' }], items: [{ id: 'burger', categoryId: 'food', name: 'Burger', description: 'Freshly made', priceCents: 1250, available: true }] };
const deny = (p, code) => assert.rejects(p, e => e.code === code);
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'menu-tests'); db = getFirestore(app);
  service = createMenus({ firestore: db, auth, now: () => now });
  const business = db.doc(`businesses/${businessId}`);
  await business.set({ name: 'Menu test' });
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
test('menus reject unauthenticated, unattested, unverified, disabled, revoked and non-owner access', async () => {
  await deny(service.getFoodMenu({ data: base }), 'unauthenticated');
  await deny(service.getFoodMenu({ ...request(base), app: undefined }), 'failed-precondition');
  for (const uid of ['unverified', 'disabled', 'revoked', 'manager', 'outsider']) {
    await deny(service.getFoodMenu(request(base, uid)), 'permission-denied');
    await deny(service.saveFoodMenu(request({ ...base, expectedVersion: 0, menu }, uid)), 'permission-denied');
  }
  const device = request(base); device.auth.token.device = true;
  await deny(service.getFoodMenu(device), 'permission-denied');
  await deny(service.getFoodMenu(request({ ...base, businessId: 'another-business' })), 'permission-denied');
  await deny(service.getFoodMenu(request({ ...base, locationId: 'missing' })), 'not-found');
});
test('menu validation rejects malformed prices, categories, availability and injected authority', () => {
  for (const priceCents of [-1, 1.5, '1250', NaN, 1000000]) {
    assert.throws(() => validateMenu({ ...menu, items: [{ ...menu.items[0], priceCents }] }));
  }
  for (const patch of [{ categoryId: 'missing' }, { available: 'false' }, { name: '' }, { name: 'x'.repeat(101) }, { description: 'bad\ntext' }, { role: 'owner' }]) {
    assert.throws(() => validateMenu({ ...menu, items: [{ ...menu.items[0], ...patch }] }));
  }
  assert.throws(() => validateMenu({ ...menu, currency: 'USD' }));
  assert.throws(() => validateMenu({ ...menu, categories: [...menu.categories, ...menu.categories] }));
  assert.throws(() => validateMenu({ ...menu, items: [...menu.items, ...menu.items] }));
  assert.throws(() => validateMenu({ categories: Array.from({ length: 21 }, (_, i) => ({ id: `c${i}`, name: 'Category' })), items: [] }));
  assert.equal(validateMenu({ ...menu, items: [{ ...menu.items[0], priceCents: 0, available: false }] }).items[0].priceCents, 0);
});
test('save, retry, sold-out edits and location isolation preserve exact cents and trial', async () => {
  assert.equal((await service.getFoodMenu(request(base))).version, 0);
  const trialRef = db.doc(`businesses/${businessId}/entitlements/current`);
  const trial = (await trialRef.get()).data();
  const payload = { ...base, expectedVersion: 0, menu };
  const results = await Promise.all([service.saveFoodMenu(request(payload)), service.saveFoodMenu(request(payload))]);
  assert.deepEqual(results, [{ version: 1 }, { version: 1 }]);
  assert.equal((await db.collection(`businesses/${businessId}/audit`).get()).size, 1);
  const changed = { ...menu, items: [{ ...menu.items[0], available: false, priceCents: 1099 }] };
  await deny(service.saveFoodMenu(request({ ...payload, menu: changed })), 'failed-precondition');
  await service.saveFoodMenu(request({ ...payload, expectedVersion: 1, menu: changed }));
  const read = await service.getFoodMenu(request(base));
  assert.deepEqual(read, { ...changed, version: 2, currency: 'AUD' });
  assert.equal((await service.getFoodMenu(request({ ...base, locationId: 'second' }))).items.length, 0);
  assert.deepEqual((await trialRef.get()).data(), trial);
  const expired = createMenus({ firestore: db, auth, now: () => now + 86400001 });
  assert.equal((await expired.getFoodMenu(request(base))).version, 2);
  await deny(expired.saveFoodMenu(request({ ...payload, expectedVersion: 2 })), 'failed-precondition');
});
