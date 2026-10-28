import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { validateMenu } from './menus.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const transitions = { new: ['preparing', 'cancelled'], preparing: ['ready', 'cancelled'], ready: ['completed', 'cancelled'], completed: [], cancelled: [] };

function access(member, locationId) {
  const data = member.data();
  if (data?.active !== true || !['owner', 'manager', 'staff'].includes(data.role)
    || (data.role !== 'owner' && data.locations?.[locationId] !== true)) {
    fail('permission-denied', 'Active access to this location is required.');
  }
}
function activeTrial(record, time) {
  const data = record.data();
  if (data?.source !== 'trial' || !data.trialModules?.includes('orders')
    || !(data.trialStartedAt?.toMillis() <= time) || !(data.trialEndsAt?.toMillis() > time)) {
    fail('failed-precondition', 'Active ordering access is required.');
  }
}
function lines(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 30) fail('invalid-argument', 'Choose 1 to 30 items.');
  const ids = new Set();
  return input.map(line => {
    fields(line, ['itemId', 'quantity']);
    const itemId = identifier(line.itemId);
    if (ids.has(itemId) || !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 99)
      fail('invalid-argument', 'Use a unique item and a quantity from 1 to 99.');
    ids.add(itemId);
    return { itemId, quantity: line.quantity };
  });
}
function menuFrom(record) {
  const data = record.data();
  if (!data || !Number.isSafeInteger(data.version) || data.version < 0 || data.currency !== 'AUD')
    fail('failed-precondition', 'A valid saved menu is required.');
  return { ...validateMenu({ categories: data.categories, items: data.items }), version: data.version };
}

export function createFoodOrders({ firestore: db, auth, now = () => Date.now() }) {
  async function setup(request, allowed) {
    const user = await authorize(auth, request);
    fields(request.data, allowed);
    const businessId = identifier(request.data.businessId), locationId = identifier(request.data.locationId);
    const business = db.doc(`businesses/${businessId}`), location = business.collection('locations').doc(locationId);
    return { user, business, location, locationId };
  }
  async function getPosMenu(request) {
    const { user, business, location, locationId } = await setup(request, ['businessId', 'locationId']);
    return db.runTransaction(async tx => {
      const [member, meta, branch, entitlement, menu] = await tx.getAll(business.collection('members').doc(user.uid), business,
        location, business.collection('entitlements').doc('current'), location.collection('menus').doc('current'));
      access(member, locationId);
      if (!meta.exists || !branch.exists) fail('not-found', 'Location unavailable.');
      activeTrial(entitlement, now());
      return { ...menuFrom(menu), currency: 'AUD' };
    });
  }
  async function createOrder(request) {
    const { user, business, location, locationId } = await setup(request, ['businessId', 'locationId', 'requestId', 'menuVersion', 'items']);
    const requestId = identifier(request.data.requestId), selected = lines(request.data.items);
    if (!Number.isSafeInteger(request.data.menuVersion) || request.data.menuVersion < 0) fail('invalid-argument', 'Invalid menu version.');
    const fingerprint = hash(JSON.stringify({ menuVersion: request.data.menuVersion, items: selected }));
    const order = location.collection('foodOrders').doc(hash(`${user.uid}:${requestId}`));
    return db.runTransaction(async tx => {
      const [member, meta, branch, entitlement, menu, existing] = await tx.getAll(business.collection('members').doc(user.uid), business,
        location, business.collection('entitlements').doc('current'), location.collection('menus').doc('current'), order);
      access(member, locationId);
      if (!meta.exists || !branch.exists) fail('not-found', 'Location unavailable.');
      if (existing.exists) {
        if (existing.data().fingerprint !== fingerprint) fail('already-exists', 'Request ID already used.');
        if (existing.data().abandoned === true) fail('failed-precondition', 'This order request was closed. Start a new order.');
        return { orderId: order.id, ...existing.data(), created: false };
      }
      activeTrial(entitlement, now());
      const saved = menuFrom(menu);
      if (saved.version !== request.data.menuVersion) fail('failed-precondition', 'The menu changed. Reload it before creating the order.');
      const items = selected.map(line => {
        const item = saved.items.find(candidate => candidate.id === line.itemId);
        if (!item || !item.available) fail('failed-precondition', 'An item is unavailable. Reload the menu.');
        return { itemId: item.id, name: item.name, quantity: line.quantity, unitPriceCents: item.priceCents };
      });
      const totalCents = items.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0);
      const timestamp = Timestamp.fromMillis(now());
      const data = { fingerprint, items, totalCents, currency: 'AUD', menuVersion: saved.version,
        status: 'new', paymentStatus: 'unpaid', version: 1, createdBy: user.uid, createdAt: timestamp, updatedAt: timestamp };
      tx.create(order, data);
      tx.create(business.collection('audit').doc(), { type: 'foodOrder.created', actorUid: user.uid, locationId,
        orderId: order.id, createdAt: timestamp });
      return { orderId: order.id, ...data, created: true };
    });
  }
  async function resolveOrderRequest(request) {
    const { user, business, location, locationId } = await setup(request, ['businessId', 'locationId', 'requestId', 'menuVersion', 'items']);
    const requestId = identifier(request.data.requestId), selected = lines(request.data.items);
    if (!Number.isSafeInteger(request.data.menuVersion) || request.data.menuVersion < 0) fail('invalid-argument', 'Invalid menu version.');
    const fingerprint = hash(JSON.stringify({ menuVersion: request.data.menuVersion, items: selected }));
    const order = location.collection('foodOrders').doc(hash(`${user.uid}:${requestId}`));
    return db.runTransaction(async tx => {
      const [member, meta, branch, existing] = await tx.getAll(business.collection('members').doc(user.uid), business, location, order);
      access(member, locationId);
      if (!meta.exists || !branch.exists) fail('not-found', 'Location unavailable.');
      if (existing.exists) {
        if (existing.data().fingerprint !== fingerprint) fail('already-exists', 'Request ID already used.');
        return { state: existing.data().abandoned === true ? 'not-created' : 'created', orderId: order.id };
      }
      // A tombstone makes a racing or delayed create fail rather than create a duplicate.
      tx.create(order, { fingerprint, abandoned: true });
      tx.create(business.collection('audit').doc(), { type: 'foodOrder.requestClosed', actorUid: user.uid,
        locationId, orderId: order.id, createdAt: Timestamp.fromMillis(now()) });
      return { state: 'not-created', orderId: order.id };
    });
  }
  async function setOrderStatus(request) {
    const { user, business, location, locationId } = await setup(request, ['businessId', 'locationId', 'orderId', 'expectedVersion', 'status']);
    const order = location.collection('foodOrders').doc(identifier(request.data.orderId));
    if (!Number.isSafeInteger(request.data.expectedVersion) || request.data.expectedVersion < 1
      || !['preparing', 'ready', 'completed', 'cancelled'].includes(request.data.status)) fail('invalid-argument', 'Choose a valid order status and version.');
    return db.runTransaction(async tx => {
      const [member, meta, branch, stored] = await tx.getAll(business.collection('members').doc(user.uid), business, location, order);
      access(member, locationId);
      if (!meta.exists || !branch.exists || !stored.exists) fail('not-found', 'Order unavailable.');
      // Existing orders can progress after trial expiry so customers are not stranded.
      const value = stored.data();
      if (value.status === request.data.status && value.version === request.data.expectedVersion + 1) return { version: value.version, status: value.status };
      if (value.version !== request.data.expectedVersion) fail('failed-precondition', 'Order changed. Reload before updating.');
      if (!transitions[value.status]?.includes(request.data.status)) fail('failed-precondition', 'That status change is not allowed.');
      const version = value.version + 1, timestamp = Timestamp.fromMillis(now());
      tx.update(order, { status: request.data.status, version, updatedAt: timestamp });
      tx.create(business.collection('audit').doc(), { type: 'foodOrder.status', actorUid: user.uid, locationId,
        orderId: order.id, from: value.status, to: request.data.status, createdAt: timestamp });
      return { version, status: request.data.status };
    });
  }
  async function listOrders(request) {
    const { user, business, location, locationId } = await setup(request, ['businessId', 'locationId', 'cursor']);
    const cursor = request.data.cursor === '' ? '' : identifier(request.data.cursor);
    return db.runTransaction(async tx => {
      const [member, meta, branch] = await tx.getAll(business.collection('members').doc(user.uid), business, location);
      access(member, locationId);
      if (!meta.exists || !branch.exists) fail('not-found', 'Location unavailable.');
      const orders = location.collection('foodOrders');
      let query = orders.orderBy('createdAt', 'desc').limit(26);
      if (cursor) {
        const previous = await tx.get(orders.doc(cursor));
        if (!previous.exists || !previous.data().createdAt) fail('invalid-argument', 'Refresh the order list.');
        query = query.startAfter(previous);
      }
      const page = await tx.get(query);
      const visible = page.docs.slice(0, 25);
      return { orders: visible.map(doc => {
        const data = doc.data();
        return { orderId: doc.id, items: data.items, totalCents: data.totalCents, currency: data.currency,
          status: data.status, paymentStatus: data.paymentStatus, version: data.version,
          createdAt: data.createdAt.toMillis() };
      }), nextCursor: page.docs.length > 25 ? visible.at(-1).id : '' };
    });
  }
  return { getPosMenu, createOrder, setOrderStatus, listOrders, resolveOrderRequest };
}
