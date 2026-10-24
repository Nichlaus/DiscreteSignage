import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
function text(value, limit, optional = false) {
  if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim())
    || /[\u0000-\u001f\u007f]/u.test(value)) fail('invalid-argument', 'Check menu names and descriptions.');
  return value.trim();
}
export function validateMenu(data) {
  fields(data, ['categories', 'items']);
  if (!Array.isArray(data.categories) || data.categories.length > 20
    || !Array.isArray(data.items) || data.items.length > 100) fail('invalid-argument', 'Use up to 20 categories and 100 items per location.');
  const categoryIds = new Set(), itemIds = new Set();
  const categories = data.categories.map(c => {
    fields(c, ['id', 'name']);
    const id = identifier(c.id);
    if (categoryIds.has(id)) fail('invalid-argument', 'Category IDs must be unique.');
    categoryIds.add(id);
    return { id, name: text(c.name, 80) };
  });
  const items = data.items.map(item => {
    fields(item, ['id', 'categoryId', 'name', 'description', 'priceCents', 'available']);
    const id = identifier(item.id), categoryId = identifier(item.categoryId);
    if (itemIds.has(id) || !categoryIds.has(categoryId)) fail('invalid-argument', 'Choose a valid category for each unique item.');
    itemIds.add(id);
    if (!Number.isSafeInteger(item.priceCents) || item.priceCents < 0 || item.priceCents > 999999
      || typeof item.available !== 'boolean') fail('invalid-argument', 'Use an AUD price from 0 to 9,999.99 and a valid availability.');
    return { id, categoryId, name: text(item.name, 100), description: text(item.description, 300, true),
      priceCents: item.priceCents, available: item.available };
  });
  return { categories, items };
}

export function createMenus({ firestore: db, auth, now = () => Date.now() }) {
  async function run(request, write) {
    const user = await authorize(auth, request);
    fields(request.data, write ? ['businessId', 'locationId', 'expectedVersion', 'menu'] : ['businessId', 'locationId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const location = business.collection('locations').doc(identifier(request.data.locationId));
    const ref = location.collection('menus').doc('current');
    const menu = write ? validateMenu(request.data.menu) : null;
    if (write && (!Number.isSafeInteger(request.data.expectedVersion) || request.data.expectedVersion < 0)) fail('invalid-argument', 'Invalid menu version.');
    return db.runTransaction(async tx => {
      const [member, meta, branch, trial, stored] = await tx.getAll(business.collection('members').doc(user.uid),
        business, location, business.collection('entitlements').doc('current'), ref);
      if (member.data()?.active !== true || member.data()?.role !== 'owner') fail('permission-denied', 'Active business ownership is required.');
      if (!meta.exists || !branch.exists) fail('not-found', 'Business or location unavailable.');
      const old = stored.data() ?? { version: 0, categories: [], items: [] };
      if (!write) return { version: old.version, categories: old.categories, items: old.items, currency: 'AUD' };
      const t = trial.data();
      if (t?.source !== 'trial' || !t.trialModules?.includes('screens') || !(t.trialStartedAt?.toMillis() <= now())
        || !(t.trialEndsAt?.toMillis() > now())) fail('failed-precondition', 'An active signage trial is required to edit menus.');
      // A lost response can be retried without duplicating a save or audit event.
      if (JSON.stringify({ categories: old.categories, items: old.items }) === JSON.stringify(menu)) return { version: old.version };
      if (old.version !== request.data.expectedVersion) fail('failed-precondition', 'This menu changed elsewhere. Reload the menu before saving.');
      const version = old.version + 1, updatedAt = Timestamp.fromMillis(now());
      tx.set(ref, { ...menu, currency: 'AUD', version, updatedAt });
      tx.create(business.collection('audit').doc(), { type: 'menu.saved', actorUid: user.uid,
        locationId: location.id, version, categoryCount: menu.categories.length, itemCount: menu.items.length, createdAt: updatedAt });
      return { version };
    });
  }
  return { getFoodMenu: request => run(request, false), saveFoodMenu: request => run(request, true) };
}
