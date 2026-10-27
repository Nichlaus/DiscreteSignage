import { HttpsError } from 'firebase-functions/v2/https';
import { fields, identifier } from './provisioning.js';
import { validateProduct } from './featured-products.js';

const fail = (code, message) => { throw new HttpsError(code, message); };

export function createInteractiveDelivery({ firestore: db, auth, now = () => Date.now() }) {
  return async request => {
    fields(request.data, []);
    if (!request.app) fail('failed-precondition', 'App verification required.');
    const claims = request.auth?.token;
    if (!request.auth?.uid || claims?.device !== true) fail('permission-denied', 'Display identity required.');
    const businessId = identifier(claims.businessId);
    const user = await auth.getUser(request.auth.uid).catch(() => fail('permission-denied', 'Display unavailable.'));
    if (user.disabled || !Number.isFinite(claims.auth_time) || claims.auth_time <= 0
      || claims.auth_time * 1000 < Date.parse(user.tokensValidAfterTime || '1970-01-01')) {
      fail('permission-denied', 'Display access ended.');
    }
    const business = db.doc(`businesses/${businessId}`);
    return db.runTransaction(async tx => {
      const [device, entitlement] = await tx.getAll(business.collection('devices').doc(user.uid),
        business.collection('entitlements').doc('current'));
      const registration = device.data(), trial = entitlement.data();
      if (registration?.active !== true) fail('permission-denied', 'Display revoked.');
      const location = business.collection('locations').doc(identifier(registration.locationId));
      const [branch, screen, stored] = await tx.getAll(location,
        location.collection('screens').doc(identifier(registration.screenId)),
        location.collection('settings').doc('featuredProduct'));
      const assigned = screen.data();
      if (!branch.exists || assigned?.active !== true || assigned.deviceId !== user.uid) {
        fail('permission-denied', 'Display assignment unavailable.');
      }
      const issuedAt = now();
      const empty = { product: null, serverNow: issuedAt, expiresAt: issuedAt };
      // Product preparation is not activation. Legacy/missing settings stay off.
      if (assigned.interactive?.enabled !== true || trial?.source !== 'trial'
        || !trial.trialModules?.includes('screens') || !trial.trialModules?.includes('customerAi')
        || !(trial.trialStartedAt?.toMillis() <= issuedAt) || !(trial.trialEndsAt?.toMillis() > issuedAt)) return empty;
      const card = stored.data();
      if (card?.currency !== 'AUD' || !Number.isSafeInteger(card.version) || card.version < 1
        || card.product?.available !== true) return empty;
      let product;
      try { product = validateProduct(card.product); } catch { return empty; }
      // Offers have a short lease separate from the 24-hour offline media lease.
      return { product, currency: 'AUD', version: card.version, serverNow: issuedAt,
        expiresAt: Math.min(issuedAt + 60000, trial.trialEndsAt.toMillis()) };
    });
  };
}
