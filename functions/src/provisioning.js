import { authorize } from './identity.js';
import { markets } from './markets.js';
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';

const fail = (code, message) => { throw new HttpsError(code, message); };
const hash = value => createHash('sha256').update(value).digest('hex');
const modules = ['screens', 'orders', 'aiStudio', 'customerAi', 'businessManagement'];
const trialMs = 14 * 24 * 60 * 60 * 1000;

export function fields(data, allowed) {
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || Object.keys(data).some(key => !allowed.includes(key))
    || allowed.some(key => !Object.hasOwn(data, key))) {
    fail('invalid-argument', 'Supply exactly the documented fields.');
  }
}
function name(value) {
  if (typeof value !== 'string' || value.trim().length < 2
    || value.trim().length > 100 || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail('invalid-argument', 'Names must contain 2–100 characters without control characters.');
  }
  return value.trim();
}
export function identifier(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value)) {
    fail('invalid-argument', 'Invalid identifier.');
  }
  return value;
}
function timezone(value) {
  const zones = ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane',
    'Australia/Adelaide', 'Australia/Perth', 'Australia/Darwin', 'Australia/Hobart',
    'Australia/Lord_Howe', 'Australia/Broken_Hill', 'Australia/Eucla', 'Australia/Lindeman'];
  if (!zones.includes(value)) fail('invalid-argument', 'Choose an Australian timezone.');
  return value;
}

export function createProvisioning({ firestore, auth, now = () => Date.now() }) {
  const principal = async request => (await authorize(auth, request)).uid;
  function owner(snapshot, uid) {
    const data = snapshot.data();
    if (!snapshot.exists || data.active !== true || data.role !== 'owner') {
      fail('permission-denied', 'Active business ownership is required.');
    }
    return uid;
  }

  async function provisionBusiness(request) {
    const uid = await principal(request);
    fields(request.data, ['businessName', 'locationName', 'timezone']);
    const input = {
      businessName: name(request.data.businessName),
      locationName: name(request.data.locationName),
      timezone: timezone(request.data.timezone),
    };
    const accountKey = hash(uid);
    const businessId = `b_${accountKey}`;
    const locationId = 'main';
    const index = firestore.doc(`onboardingUsers/${accountKey}`);
    const business = firestore.doc(`businesses/${businessId}`);
    const membership = business.collection('members').doc(uid);
    const fingerprint = hash(JSON.stringify(input));
    return firestore.runTransaction(async tx => {
      const [existing, member] = await tx.getAll(index, membership);
      if (existing.exists) {
        owner(member, uid);
        if (existing.data().fingerprint !== fingerprint) {
          fail('already-exists', 'This account already provisioned a business. Use business settings.');
        }
        return { businessId, locationId, created: false };
      }
      const startedAt = Timestamp.fromMillis(now());
      const endsAt = Timestamp.fromMillis(startedAt.toMillis() + trialMs);
      tx.create(index, { businessId, locationId, fingerprint, createdAt: startedAt });
      tx.create(business, {
        name: input.businessName, country: 'AU', currency: 'AUD',
        createdBy: uid, createdAt: startedAt, locationCount: 1,
      });
      tx.create(membership, { active: true, role: 'owner', locations: {}, createdAt: startedAt });
      tx.create(firestore.doc(`userAccess/${accountKey}/businesses/${businessId}`), { businessId });
      tx.create(business.collection('locations').doc(locationId), {
        name: input.locationName, timezone: input.timezone, createdAt: startedAt,
      });
      tx.create(business.collection('entitlements').doc('current'), {
        trialStartedAt: startedAt, trialEndsAt: endsAt,
        trialModules: modules, source: 'trial', paymentMethodRequired: false,
      });
      tx.create(business.collection('audit').doc('business-provisioned'), {
        type: 'business.provisioned', actorUid: uid, createdAt: startedAt,
      });
      return { businessId, locationId, created: true };
    });
  }

  async function createLocation(request) {
    const uid = await principal(request);
    fields(request.data, ['businessId', 'requestId', 'name', 'timezone']);
    const businessId = identifier(request.data.businessId);
    const requestId = identifier(request.data.requestId);
    const input = { name: name(request.data.name), timezone: timezone(request.data.timezone) };
    const business = firestore.doc(`businesses/${businessId}`);
    const locationId = `l_${hash(`${uid}:${requestId}`)}`;
    const location = business.collection('locations').doc(locationId);
    const fingerprint = hash(JSON.stringify(input));
    return firestore.runTransaction(async tx => {
      const [member, businessDoc, previous] = await tx.getAll(
        business.collection('members').doc(uid), business, location);
      owner(member, uid);
      if (!businessDoc.exists) fail('not-found', 'Business unavailable.');
      if (previous.exists) {
        if (previous.data().fingerprint !== fingerprint) {
          fail('already-exists', 'Request ID already used for different location details.');
        }
        return { locationId, created: false };
      }
      // Initial abuse cap; commercial limits will be enforced by entitlements later.
      const count = businessDoc.data().locationCount;
      if (!Number.isInteger(count) || count < 1 || count >= 100) {
        fail('resource-exhausted', 'Location limit reached. Contact support.');
      }
      const createdAt = Timestamp.fromMillis(now());
      tx.create(location, { ...input, fingerprint, createdAt });
      tx.update(business, { locationCount: count + 1 });
      tx.create(business.collection('audit').doc(`location-${locationId}`), {
        type: 'location.created', actorUid: uid, locationId, createdAt,
      });
      return { locationId, created: true };
    });
  }
  async function updateBusinessMarket(request) {
    const uid = await principal(request);
    fields(request.data, ['businessId', 'market']);
    const businessId = identifier(request.data.businessId);
    const market = request.data.market;
    if (!markets.some(item => item.id === market)) fail('invalid-argument', 'Choose a business type from the list.');
    const business = firestore.doc(`businesses/${businessId}`);
    return firestore.runTransaction(async tx => {
      const [member, meta] = await tx.getAll(business.collection('members').doc(uid), business);
      owner(member, uid);
      if (!meta.exists) fail('not-found', 'Business unavailable.');
      if (meta.data().market === market) return { market };
      const createdAt = Timestamp.fromMillis(now());
      tx.update(business, { market });
      tx.create(business.collection('audit').doc(), {
        type: 'business.market.updated', actorUid: uid,
        previousMarket: meta.data().market ?? 'general', market, createdAt,
      });
      return { market };
    });
  }
  return { provisionBusiness, createLocation, updateBusinessMarket };
}
