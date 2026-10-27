import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
function text(value, limit, optional = false) {
  if (typeof value !== 'string' || value.length > limit || (!optional && !value.trim())
    || /[\u0000-\u001f\u007f]/u.test(value)) fail('invalid-argument', 'Check product names and descriptions.');
  return value.trim();
}
export function validateProduct(data) {
  fields(data, ['name', 'description', 'priceCents', 'available']);
  if (!Number.isSafeInteger(data.priceCents) || data.priceCents < 0 || data.priceCents > 999999
    || typeof data.available !== 'boolean') fail('invalid-argument', 'Enter a valid AUD price and availability.');
  return { name: text(data.name, 100), description: text(data.description, 300, true),
    priceCents: data.priceCents, available: data.available };
}

export function createFeaturedProducts({ firestore: db, auth, now = () => Date.now() }) {
  async function run(request, write) {
    const user = await authorize(auth, request);
    fields(request.data, write ? ['businessId', 'locationId', 'expectedVersion', 'product', ...(Object.hasOwn(request.data ?? {}, 'slot') ? ['slot'] : [])] : ['businessId', 'locationId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const location = business.collection('locations').doc(identifier(request.data.locationId));
    const ref = location.collection('settings').doc('featuredProduct');
    const slot = Object.hasOwn(request.data, 'slot') ? request.data.slot : 0;
    if (!Number.isInteger(slot) || slot < 0 || slot > 2) fail('invalid-argument', 'Choose one of the three product slots.');
    const product = write ? validateProduct(request.data.product) : null;
    if (write && (!Number.isSafeInteger(request.data.expectedVersion) || request.data.expectedVersion < 0 || request.data.expectedVersion >= Number.MAX_SAFE_INTEGER)) fail('invalid-argument', 'Invalid product version.');
    return db.runTransaction(async tx => {
      const [member, meta, branch, trial, stored] = await tx.getAll(business.collection('members').doc(user.uid),
        business, location, business.collection('entitlements').doc('current'), ref);
      if (member.data()?.active !== true || member.data()?.role !== 'owner') fail('permission-denied', 'Active business ownership is required.');
      if (!meta.exists || !branch.exists) fail('not-found', 'Business or location unavailable.');
      const old = stored.data() ?? { version: 0, product: null };
      const products = Array.isArray(old.products) ? old.products.slice(0, 3) : [old.product ?? null];
      while (products.length < 3) products.push(null);
      if (!write) return { version: old.version, product: products[0], products, currency: 'AUD' };
      const t = trial.data();
      if (t?.source !== 'trial' || !t.trialModules?.includes('screens') || !(t.trialStartedAt?.toMillis() <= now())
        || !(t.trialEndsAt?.toMillis() > now())) fail('failed-precondition', 'An active signage trial is required to save featured products.');
      // A lost response can be retried without duplicating a save or audit event.
      if (JSON.stringify(products[slot]) === JSON.stringify(product)) return { version: old.version };
      if (old.version !== request.data.expectedVersion) fail('failed-precondition', 'This product changed elsewhere. Reload the product before saving.');
      const version = old.version + 1, updatedAt = Timestamp.fromMillis(now());
      products[slot] = product;
      tx.set(ref, { product: products[0], products, currency: 'AUD', version, updatedAt });
      tx.create(business.collection('audit').doc(), { type: 'featuredProduct.saved', actorUid: user.uid,
        locationId: location.id, slot, version, available: product.available, createdAt: updatedAt });
      return { version };
    });
  }
  return { getFeaturedProduct: request => run(request, false), saveFeaturedProduct: request => run(request, true) };
}
