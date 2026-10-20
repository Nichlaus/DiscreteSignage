import { createHash, randomBytes } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';

const hash = value => createHash('sha256').update(value).digest('hex');
const fail = (code, message) => { throw new HttpsError(code, message); };
const lifetime = 10 * 60 * 1000;
function attested(request) {
  if (!request.app) fail('failed-precondition', 'App Check is required.');
}
function owner(member) {
  if (member.data()?.active !== true || member.data()?.role !== 'owner') {
    fail('permission-denied', 'Active business ownership is required.');
  }
}
function available(session, now) {
  if (!session || session.expiresAt.toMillis() <= now || session.status === 'consumed') {
    fail('failed-precondition', 'Pairing expired or already completed. Start again on the display.');
  }
}
function entitled(snapshot, now) {
  const value = snapshot.data();
  if (value?.source !== 'trial' || !value.trialModules?.includes('screens')
    || value.trialStartedAt?.toMillis() > now || !(value.trialEndsAt?.toMillis() > now)) {
    fail('failed-precondition', 'An active screens trial is required. Contact support.');
  }
}

export function createPairing({ firestore: db, auth, now = () => Date.now() }) {
  async function limit(key, maximum) {
    const window = Math.floor(now() / lifetime);
    const ref = db.doc(`pairingLimits/${hash(`${key}:${window}`)}`);
    await db.runTransaction(async tx => {
      const previous = await tx.get(ref);
      const count = previous.data()?.count ?? 0;
      if (count >= maximum) fail('resource-exhausted', 'Too many pairing attempts. Try again in ten minutes.');
      tx.set(ref, { count: count + 1, expiresAt: Timestamp.fromMillis((window + 2) * lifetime) });
    });
  }
  async function beginPairing(request) {
    attested(request);
    fields(request.data, []);
    // Use the platform address, never a caller-supplied forwarded-IP header.
    const ip = request.rawRequest?.ip;
    if (!ip) fail('failed-precondition', 'Pairing requires a network address.');
    await limit(`start:${request.app.appId}:${ip}`, 10);
    const code = randomBytes(5).toString('hex').toUpperCase();
    const secret = randomBytes(32).toString('hex');
    const expiresAt = now() + lifetime;
    await db.doc(`pairingSessions/${code}`).create({
      secretHash: hash(secret), status: 'pending', expiresAt: Timestamp.fromMillis(expiresAt),
    });
    return { code, secret, expiresAt };
  }
  async function claimScreen(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'locationId', 'code', 'name']);
    const businessId = identifier(request.data.businessId);
    const locationId = identifier(request.data.locationId);
    const code = request.data.code;
    const name = request.data.name;
    if (typeof code !== 'string' || !/^[A-F0-9]{10}$/.test(code)
      || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100
      || /[\u0000-\u001f\u007f]/u.test(name)) fail('invalid-argument', 'Enter a valid pairing code and screen name.');
    await limit(`claim:${user.uid}`, 20);
    const business = db.doc(`businesses/${businessId}`);
    const sessionRef = db.doc(`pairingSessions/${code}`);
    const deviceId = `d_${randomBytes(16).toString('hex')}`;
    return db.runTransaction(async tx => {
      const [member, location, sessionDoc, trial, meta] = await tx.getAll(
        business.collection('members').doc(user.uid), business.collection('locations').doc(locationId),
        sessionRef, business.collection('entitlements').doc('current'), business);
      owner(member);
      if (!location.exists || !meta.exists) fail('not-found', 'Location unavailable.');
      const session = sessionDoc.data();
      available(session, now());
      entitled(trial, now());
      if (session.status === 'claimed') {
        if (session.businessId === businessId && session.locationId === locationId
          && session.name === name.trim() && session.claimedBy === user.uid) {
          return { deviceId: session.deviceId, screenId: session.deviceId };
        }
        fail('already-exists', 'This display has already been claimed.');
      }
      const count = meta.data().screenCount ?? 0;
      if (!Number.isInteger(count) || count < 0 || count >= 100) {
        fail('resource-exhausted', 'Screen limit reached. Contact support.');
      }
      const createdAt = Timestamp.fromMillis(now());
      tx.create(business.collection('devices').doc(deviceId),
        { active: true, locationId, screenId: deviceId, createdAt });
      tx.create(business.collection('locations').doc(locationId).collection('screens').doc(deviceId),
        { name: name.trim(), deviceId, active: true, version: 1, orientation: 'landscape', scaleType: 'fit', createdAt });
      tx.update(business, { screenCount: count + 1 });
      tx.update(sessionRef, {
        status: 'claimed', businessId, locationId, deviceId, name: name.trim(), claimedBy: user.uid,
      });
      tx.create(business.collection('audit').doc(`paired-${deviceId}`),
        { type: 'screen.paired', actorUid: user.uid, deviceId, locationId, createdAt });
      return { deviceId, screenId: deviceId };
    });
  }
  async function completePairing(request) {
    attested(request);
    fields(request.data, ['code', 'secret']);
    const { code, secret } = request.data;
    if (typeof code !== 'string' || !/^[A-F0-9]{10}$/.test(code)
      || typeof secret !== 'string' || !/^[a-f0-9]{64}$/.test(secret)) {
      fail('invalid-argument', 'Invalid pairing credentials.');
    }
    const ref = db.doc(`pairingSessions/${code}`);
    const session = (await ref.get()).data();
    if (!session || session.secretHash !== hash(secret)) fail('permission-denied', 'Pairing unavailable.');
    available(session, now());
    if (session.status === 'pending') return { status: 'pending' };
    // Signing happens before consumption, so a signing outage leaves the session retryable.
    const token = await auth.createCustomToken(session.deviceId, { device: true, businessId: session.businessId });
    await db.runTransaction(async tx => {
      const business = db.doc(`businesses/${session.businessId}`);
      const [fresh, device, trial] = await tx.getAll(ref, business.collection('devices').doc(session.deviceId),
        business.collection('entitlements').doc('current'));
      available(fresh.data(), now());
      if (fresh.data().status !== 'claimed' || device.data()?.active !== true) {
        fail('failed-precondition', 'Display access is no longer available.');
      }
      entitled(trial, now());
      tx.update(ref, { status: 'consumed' });
    });
    return { status: 'ready', token, businessId: session.businessId,
      locationId: session.locationId, screenId: session.deviceId };
  }
  async function revokeScreen(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'deviceId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const deviceId = identifier(request.data.deviceId);
    await db.runTransaction(async tx => {
      const ref = business.collection('devices').doc(deviceId);
      const [member, device] = await tx.getAll(business.collection('members').doc(user.uid), ref);
      owner(member);
      if (!device.exists) fail('not-found', 'Display unavailable.');
      if (!device.data().active) return;
      tx.update(ref, { active: false });
      tx.update(business.collection('locations').doc(device.data().locationId)
        .collection('screens').doc(device.data().screenId), { active: false });
      tx.create(business.collection('audit').doc(`revoked-${deviceId}`),
        { type: 'screen.revoked', actorUid: user.uid, deviceId, createdAt: Timestamp.fromMillis(now()) });
    });
    return { revoked: true };
  }
  return { beginPairing, claimScreen, completePairing, revokeScreen };
}
