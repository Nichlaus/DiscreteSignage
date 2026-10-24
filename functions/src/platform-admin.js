import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';

export function createPlatformAdmin({ firestore: db, auth, now = () => Date.now() }) {
  async function identity(request) {
    const user = await authorize(auth, request);
    if (!request.auth.token.firebase?.sign_in_second_factor) {
      throw new HttpsError('permission-denied', 'Sign in with multi-factor authentication for platform access.');
    }
    return user;
  }
  async function permission(tx, uid) {
    const admin = (await tx.get(db.doc(`platformAdmins/${uid}`))).data();
    if (admin?.active !== true || !Array.isArray(admin.permissions) || !admin.permissions.includes('business.read')) {
      throw new HttpsError('permission-denied', 'Platform diagnostics access is required.');
    }
  }
  async function listPlatformBusinesses(request) {
    const user = await identity(request);
    fields(request.data, ['after']);
    const after = request.data.after === null ? null : identifier(request.data.after);
    const audit = db.collection('platformAudit').doc();
    return db.runTransaction(async tx => {
      await permission(tx, user.uid);
      let query = db.collection('businesses').orderBy('name').limit(21);
      if (after) {
        const cursor = await tx.get(db.doc(`businesses/${after}`));
        if (!cursor.exists || typeof cursor.data().name !== 'string') {
          throw new HttpsError('failed-precondition', 'Business list changed. Start again from the first page.');
        }
        query = query.startAfter(cursor);
      }
      const docs = await tx.get(query);
      const businesses = docs.docs.slice(0, 20).map(doc => ({ id: doc.id, name: doc.data().name,
        country: doc.data().country ?? null, currency: doc.data().currency ?? null }));
      tx.create(audit, { type: 'platform.business.list', actorUid: user.uid,
        businessIds: businesses.map(b => b.id), createdAt: Timestamp.fromMillis(now()) });
      return { businesses, next: docs.size > 20 ? businesses.at(-1).id : null };
    });
  }
  async function getPlatformBusiness(request) {
    const user = await identity(request);
    fields(request.data, ['businessId']);
    const businessId = identifier(request.data.businessId);
    const business = db.doc(`businesses/${businessId}`);
    const audit = db.collection('platformAudit').doc();
    return db.runTransaction(async tx => {
      await permission(tx, user.uid);
      const [meta, entitlement] = await tx.getAll(business, business.collection('entitlements').doc('current'));
      if (!meta.exists) throw new HttpsError('not-found', 'Business not found.');
      const locationDocs = await tx.get(business.collection('locations').orderBy('__name__').limit(11));
      const mediaDocs = await tx.get(business.collection('media').orderBy('__name__').limit(51));
      const locations = [];
      for (const location of locationDocs.docs.slice(0, 10)) {
        const screens = await tx.get(location.ref.collection('screens').orderBy('__name__').limit(21));
        const entries = [];
        for (const screen of screens.docs.slice(0, 20)) {
          const s = screen.data();
          const status = s.deviceId ? (await tx.get(business.collection('deviceStatus').doc(identifier(s.deviceId)))).data() : null;
          entries.push({ id: screen.id, name: s.name ?? screen.id, active: s.active === true,
            version: s.version ?? null, appliedVersion: status?.appliedVersion ?? null,
            state: status?.state ?? null, reportedAt: status?.reportedAt?.toMillis() ?? null });
        }
        locations.push({ id: location.id, name: location.data().name ?? location.id,
          timezone: location.data().timezone ?? null, screens: entries, screensTruncated: screens.size > 20 });
      }
      const t = entitlement.data(), b = meta.data();
      const checkedAt = now();
      tx.create(audit, { type: 'platform.business.read', actorUid: user.uid, businessId,
        createdAt: Timestamp.fromMillis(checkedAt) });
      return { id: businessId, name: b.name ?? businessId, market: b.market ?? 'general', country: b.country ?? null,
        currency: b.currency ?? null, checkedAt, trialEndsAt: t?.trialEndsAt?.toMillis() ?? null,
        entitlementSource: t?.source ?? null, locations, locationsTruncated: locationDocs.size > 10,
        media: mediaDocs.docs.slice(0, 50).map(doc => ({ id: doc.id, name: doc.data().name ?? doc.id,
          status: doc.data().status ?? 'unknown', contentType: doc.data().contentType ?? null,
          size: doc.data().size ?? null })), mediaTruncated: mediaDocs.size > 50 };
    });
  }
  return { getPlatformBusiness, listPlatformBusinesses };
}
