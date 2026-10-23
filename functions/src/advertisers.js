import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
export function createAdvertisers({ firestore: db, auth, now = () => Date.now() }) {
  async function access(tx, business, uid, write) {
    const [member, meta, entitlement] = await tx.getAll(business.collection('members').doc(uid), business,
      business.collection('entitlements').doc('current'));
    if (member.data()?.active !== true || member.data()?.role !== 'owner') fail('permission-denied', 'Active business ownership is required.');
    if (!meta.exists) fail('not-found', 'Business unavailable.');
    const t = entitlement.data();
    if (write && (t?.source !== 'trial' || !t.trialModules?.includes('screens')
      || !(t.trialStartedAt?.toMillis() <= now()) || !(t.trialEndsAt?.toMillis() > now()))) {
      fail('failed-precondition', 'An active screens trial is required.');
    }
    return meta;
  }
  async function createAdvertiser(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'requestId', 'name']);
    const { name } = request.data;
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 100 || /[\u0000-\u001f\u007f]/u.test(name)) {
      fail('invalid-argument', 'Enter a client name of 2–100 characters.');
    }
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const id = createHash('sha256').update(`${user.uid}:${identifier(request.data.requestId)}`).digest('hex');
    const ref = business.collection('advertisers').doc(id);
    return db.runTransaction(async tx => {
      const meta = await access(tx, business, user.uid, true);
      const existing = await tx.get(ref);
      if (existing.exists) {
        if (existing.data().name !== name.trim()) fail('already-exists', 'This request was used for another client.');
        return { advertiserId: id, created: false };
      }
      const count = meta.data().advertiserCount ?? 0;
      if (!Number.isInteger(count) || count < 0 || count >= 100) fail('resource-exhausted', 'The 100-client allowance is full. Contact support.');
      const createdAt = Timestamp.fromMillis(now());
      tx.create(ref, { name: name.trim(), active: true, version: 1, createdAt });
      tx.update(business, { advertiserCount: count + 1 });
      tx.create(business.collection('audit').doc(`advertiser-${id}-1`), { type: 'advertiser.created', actorUid: user.uid, advertiserId: id, createdAt });
      return { advertiserId: id, created: true };
    });
  }
  async function listAdvertisers(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    return db.runTransaction(async tx => {
      await access(tx, business, user.uid, false);
      const docs = await tx.get(business.collection('advertisers').orderBy('name').limit(101));
      return { items: docs.docs.slice(0, 100).map(doc => ({ id: doc.id, name: doc.data().name,
        active: doc.data().active === true, version: doc.data().version })), truncated: docs.size > 100 };
    });
  }
  async function setAdvertiserActive(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'advertiserId', 'active', 'expectedVersion']);
    const { active, expectedVersion } = request.data;
    if (typeof active !== 'boolean' || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) fail('invalid-argument', 'Invalid client update.');
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const ref = business.collection('advertisers').doc(identifier(request.data.advertiserId));
    return db.runTransaction(async tx => {
      // Archiving remains available after trial expiry; restoring requires an active trial.
      await access(tx, business, user.uid, active);
      const client = await tx.get(ref);
      if (!client.exists) fail('not-found', 'Client unavailable.');
      const old = client.data();
      if (old.version !== expectedVersion) fail('failed-precondition', 'This client changed. Refresh the client list and try again.');
      if (old.active === active) return { version: old.version };
      const version = old.version + 1;
      tx.update(ref, { active, version });
      tx.create(business.collection('audit').doc(`advertiser-${ref.id}-${version}`), {
        type: active ? 'advertiser.restored' : 'advertiser.archived', actorUid: user.uid,
        advertiserId: ref.id, before: old.active, after: active, createdAt: Timestamp.fromMillis(now()),
      });
      return { version };
    });
  }
  return { createAdvertiser, listAdvertisers, setAdvertiserActive };
}
