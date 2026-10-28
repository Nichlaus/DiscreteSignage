import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createFoodOrders } from '../src/food-orders.js';

let app, db, service;
const time = Date.now(), businessId = 'orders-fixture';
const auth = { getUser: async uid => ({ uid, email: `${uid}@example.test`, emailVerified: uid !== 'unverified', disabled: uid === 'disabled' }) };
const request = (data, uid = 'staff') => ({ data, auth: { uid, token: { auth_time: Math.floor(time / 1000) } }, app: { appId: 'test' } });
const base = { businessId, locationId: 'main' };
const draft = { ...base, requestId: 'request1', menuVersion: 1, items: [{ itemId: 'coffee', quantity: 2 }] };
const deny = (promise, code) => assert.rejects(promise, error => error.code === code);
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'food-orders-tests'); db = getFirestore(app);
  service = createFoodOrders({ firestore: db, auth, now: () => time });
  const business = db.doc(`businesses/${businessId}`);
  await business.set({ name: 'Fixture' });
  await business.collection('members').doc('owner').set({ active: true, role: 'owner' });
  await business.collection('members').doc('staff').set({ active: true, role: 'staff', locations: { main: true } });
  await business.collection('members').doc('other').set({ active: true, role: 'staff', locations: { other: true } });
  await business.collection('members').doc('revoked').set({ active: false, role: 'owner' });
  await business.collection('locations').doc('main').set({ name: 'Main' });
  await business.collection('locations').doc('other').set({ name: 'Other' });
  await business.collection('entitlements').doc('current').set({ source: 'trial', trialModules: ['orders'],
    trialStartedAt: Timestamp.fromMillis(time - 1000), trialEndsAt: Timestamp.fromMillis(time + 1000) });
  await business.collection('locations').doc('main').collection('menus').doc('current').set({ version: 1, currency: 'AUD', categories: [{ id: 'drinks', name: 'Drinks' }],
    items: [{ id: 'coffee', categoryId: 'drinks', name: 'Coffee', description: '', priceCents: 525, available: true },
      { id: 'sold', categoryId: 'drinks', name: 'Sold out', description: '', priceCents: 100, available: false }] });
});
after(async () => { if (db) { await db.recursiveDelete(db.doc(`businesses/${businessId}`)); await db.terminate(); } if (app) await deleteApp(app); });

test('POS menu and creation require attestation, verified membership and location scope', async () => {
  await deny(service.getPosMenu({ data: base }), 'unauthenticated');
  await deny(service.getPosMenu({ ...request(base), app: undefined }), 'failed-precondition');
  for (const uid of ['unverified', 'disabled', 'other', 'revoked', 'missing']) {
    await deny(service.getPosMenu(request(base, uid)), 'permission-denied');
    await deny(service.createOrder(request(draft, uid)), 'permission-denied');
  }
  const device = request(base); device.auth.token.device = true;
  await deny(service.getPosMenu(device), 'permission-denied');
  await deny(service.getPosMenu(request({ ...base, businessId: 'other-business' })), 'permission-denied');
  assert.equal((await service.getPosMenu(request(base))).items[0].priceCents, 525);
  assert.equal((await service.getPosMenu(request(base, 'owner'))).currency, 'AUD');
});

test('orders use current catalogue prices, reject spoofed prices, stale menus and unavailable items', async () => {
  await deny(service.createOrder(request({ ...draft, items: [{ itemId: 'coffee', quantity: 2, priceCents: 1 }] })), 'invalid-argument');
  await deny(service.createOrder(request({ ...draft, paymentStatus: 'paid' })), 'invalid-argument');
  await deny(service.createOrder(request({ ...draft, menuVersion: 0 })), 'failed-precondition');
  await deny(service.createOrder(request({ ...draft, items: [{ itemId: 'sold', quantity: 1 }] })), 'failed-precondition');
  await deny(service.createOrder(request({ ...draft, items: [{ itemId: 'coffee', quantity: 0 }] })), 'invalid-argument');
  await deny(service.createOrder(request({ ...draft, items: [draft.items[0], draft.items[0]] })), 'invalid-argument');
  const [first, retry] = await Promise.all([service.createOrder(request(draft)), service.createOrder(request(draft))]);
  assert.equal(first.orderId, retry.orderId);
  assert.deepEqual([first.created, retry.created].sort(), [false, true]);
  assert.equal(first.totalCents, 1050); assert.equal(first.paymentStatus, 'unpaid');
  await deny(service.createOrder(request({ ...draft, items: [{ itemId: 'coffee', quantity: 3 }] })), 'already-exists');
});

test('only valid versioned transitions succeed, without changing payment status', async () => {
  const order = await service.createOrder(request({ ...draft, requestId: 'status-test' }));
  const change = { ...base, orderId: order.orderId, expectedVersion: 1, status: 'preparing' };
  await deny(service.setOrderStatus(request({ ...change, status: 'completed' })), 'failed-precondition');
  await deny(service.setOrderStatus(request(change, 'other')), 'permission-denied');
  assert.deepEqual(await service.setOrderStatus(request(change)), { version: 2, status: 'preparing' });
  assert.deepEqual(await service.setOrderStatus(request(change)), { version: 2, status: 'preparing' });
  await deny(service.setOrderStatus(request({ ...change, status: 'ready' })), 'failed-precondition');
  await service.setOrderStatus(request({ ...change, expectedVersion: 2, status: 'ready' }));
  await service.setOrderStatus(request({ ...change, expectedVersion: 3, status: 'completed' }));
  const stored = (await db.doc(`businesses/${businessId}/locations/main/foodOrders/${order.orderId}`).get()).data();
  assert.equal(stored.paymentStatus, 'unpaid'); assert.equal(stored.status, 'completed');
  await deny(service.setOrderStatus(request({ ...change, expectedVersion: 4, status: 'cancelled' })), 'failed-precondition');
});

test('trial expiry blocks new orders but lets authorised staff complete existing work', async () => {
  const order = await service.createOrder(request({ ...draft, requestId: 'expiry-test' }));
  const expired = createFoodOrders({ firestore: db, auth, now: () => time + 1001 });
  await deny(expired.getPosMenu(request(base)), 'failed-precondition');
  await deny(expired.createOrder(request({ ...draft, requestId: 'expired' })), 'failed-precondition');
  assert.deepEqual(await expired.setOrderStatus(request({ ...base, orderId: order.orderId, expectedVersion: 1, status: 'preparing' })), { version: 2, status: 'preparing' });
});
