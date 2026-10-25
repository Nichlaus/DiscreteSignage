import { readFileSync } from 'node:fs';
import { before, after, test } from 'node:test';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getMetadata } from 'firebase/storage';
import { ref as databaseRef, set, get } from 'firebase/database';

const projectId = 'demo-discretesignage';
let env;
const path = suffix => `businesses/a/${suffix}`;
const context = (uid, claims = {}) => env.authenticatedContext(uid, claims);
const db = (uid, claims) => context(uid, claims).firestore();
const deviceClaims = { device: true, businessId: 'a' };
const status = () => ({ state: 'ready', appliedVersion: 1, reportedAt: serverTimestamp() });

test('assistant usage and enablement cannot be read or modified by client SDKs', async () => {
  for (const store of [env.unauthenticatedContext().firestore(), db('owner'), db('staff'), db('player', deviceClaims)]) {
    for (const target of ['platformConfig/assistant', 'platformUsage/assistant', path('assistantUsage/current')]) {
      await assertFails(getDoc(doc(store, target)));
      await assertFails(setDoc(doc(store, target), { enabled: true, daily: 0 }));
    }
  }
});

test('advertiser records cannot be read or written directly by owners, staff, clients or devices', async () => {
  for (const store of [env.unauthenticatedContext().firestore(), db('owner'), db('staff'), db('advertiser'), db('player', deviceClaims)]) {
    await assertFails(getDoc(doc(store, path('advertisers/client'))));
    await assertFails(setDoc(doc(store, path('advertisers/client')), { name: 'Injected', active: true }));
    await assertFails(getDoc(doc(store, path('submissions/file'))));
    await assertFails(setDoc(doc(store, path('submissions/file')), { status: 'ready', approved: true }));
    for (const record of ['invitation', 'member']) {
      await assertFails(getDoc(doc(store, path(`advertisers/client/access/${record}`))));
      await assertFails(setDoc(doc(store, path(`advertisers/client/access/${record}`)), { uid: 'advertiser' }));
    }
  }
});

before(async () => {
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_DATABASE_EMULATOR_HOST',
    'FIREBASE_STORAGE_EMULATOR_HOST']) {
    if (!process.env[key]?.startsWith('127.0.0.1:')) {
      throw new Error(`Refusing rules tests without local emulator: ${key}`);
    }
  }
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
    database: { rules: readFileSync('database.rules.json', 'utf8') },
    storage: { rules: readFileSync('storage.rules', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    const fixtures = {
      'businesses/a': { name: 'A' },
      'businesses/b': { name: 'B' },
      [path('members/owner')]: { active: true, role: 'owner', locations: {} },
      [path('members/staff')]: { active: true, role: 'staff', locations: { north: true } },
      [path('members/manager')]: { active: true, role: 'manager', locations: { north: true } },
      [path('members/revoked')]: { active: false, role: 'owner', locations: {} },
      [path('members/invalid-role')]: { active: true, role: 'superuser', locations: { north: true } },
      [path('members/no-locations')]: { active: true, role: 'staff', locations: {} },
      'businesses/b/members/outsider': { active: true, role: 'owner', locations: {} },
      [path('locations/north')]: { name: 'North' },
      [path('locations/south')]: { name: 'South' },
      [path('locations/north/screens/one')]: { version: 1, orientation: 'landscape' },
      [path('locations/north/screens/two')]: { version: 1, orientation: 'portrait' },
      [path('locations/south/screens/three')]: { version: 1, orientation: 'landscape' },
      [path('devices/player')]: { active: true, locationId: 'north', screenId: 'one' },
      [path('devices/revoked-player')]: { active: false, locationId: 'north', screenId: 'one' },
      [path('deviceStatus/player')]: { state: 'ready', appliedVersion: 0, reportedAt: new Date() },
    };
    await Promise.all(Object.entries(fixtures).map(([key, value]) => setDoc(doc(store, key), value)));
  });
});
after(async () => { await env?.cleanup(); });

test('playback reports and aggregates cannot be read or forged through client rules', async () => {
  for (const store of [env.unauthenticatedContext().firestore(), db('owner'), db('staff'), db('player', deviceClaims)]) {
    for (const suffix of ['playbackReports/player', 'locations/north/playbackTotals/image', 'locations/north/playbackDays/2026-10-21/media/image']) {
      await assertFails(setDoc(doc(store, path(suffix)), { starts: 999 }));
      await assertFails(getDoc(doc(store, path(suffix))));
    }
  }
});

test('platform grants and audit logs remain inaccessible to every client role', async () => {
  for (const store of [env.unauthenticatedContext().firestore(), db('owner'), db('player', deviceClaims), db('owner', { platformAdmin: true })]) {
    for (const target of ['platformAdmins/owner', 'platformAudit/entry']) {
      await assertFails(getDoc(doc(store, target)));
      await assertFails(setDoc(doc(store, target), { active: true, permissions: ['business.read'] }));
    }
  }
});

test('anonymous users and other businesses cannot access a business', async () => {
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'businesses/a')));
  await assertFails(getDoc(doc(db('outsider'), 'businesses/a')));
  await assertFails(getDocs(collection(db('owner'), 'businesses')));
  await assertSucceeds(getDoc(doc(db('owner'), 'businesses/a')));
});
test('revoked, malformed, and missing memberships deny access', async () => {
  for (const uid of ['revoked', 'invalid-role', 'missing']) {
    await assertFails(getDoc(doc(db(uid), 'businesses/a')));
  }
});
test('staff and managers are restricted to assigned locations', async () => {
  for (const uid of ['staff', 'manager']) {
    await assertSucceeds(getDoc(doc(db(uid), path('locations/north'))));
    await assertFails(getDoc(doc(db(uid), path('locations/south'))));
    await assertFails(getDocs(collection(db(uid), path('locations'))));
    await assertSucceeds(getDocs(collection(db(uid), path('locations/north/screens'))));
  }
  await assertFails(getDoc(doc(db('no-locations'), path('locations/north'))));
  await assertSucceeds(getDocs(collection(db('owner'), path('locations'))));
});
test('membership reads protect other staff; only owners can list', async () => {
  await assertSucceeds(getDoc(doc(db('staff'), path('members/staff'))));
  await assertFails(getDoc(doc(db('staff'), path('members/owner'))));
  await assertFails(getDocs(collection(db('manager'), path('members'))));
  await assertSucceeds(getDocs(collection(db('owner'), path('members'))));
});
test('all clients are barred from role escalation and protected state writes', async () => {
  for (const uid of ['staff', 'owner', 'outsider']) {
    for (const suffix of ['members/staff', 'entitlements/current', 'orders/order1',
      'payments/payment1', 'audit/event1', 'locations/north/screens/one']) {
      await assertFails(setDoc(doc(db(uid), path(suffix)), { role: 'owner', paid: true }));
    }
    await assertFails(deleteDoc(doc(db(uid), path('members/staff'))));
    await assertFails(setDoc(doc(db(uid), 'businesses/new'), { name: 'Forged' }));
  }
});
test('devices read only assigned screen and own registry entry', async () => {
  const store = db('player', deviceClaims);
  await assertSucceeds(getDoc(doc(store, path('devices/player'))));
  await assertSucceeds(getDoc(doc(store, path('locations/north/screens/one'))));
  for (const suffix of ['devices/revoked-player', 'members/owner',
    'locations/north/screens/two', 'locations/south/screens/three']) {
    await assertFails(getDoc(doc(store, path(suffix))));
  }
  await assertFails(getDocs(collection(store, path('locations/north/screens'))));
  await assertFails(getDoc(doc(store, 'businesses/b/locations/north/screens/one')));
});
test('device claims alone do not grant access and revocation is immediate', async () => {
  for (const [uid, claims] of [
    ['player', {}], ['player', { ...deviceClaims, businessId: 'b' }],
    ['unregistered', deviceClaims], ['revoked-player', deviceClaims],
  ]) {
    await assertFails(getDoc(doc(db(uid, claims), path('locations/north/screens/one'))));
    await assertFails(setDoc(doc(db(uid, claims), path(`deviceStatus/${uid}`)), status()));
  }
});
test('device can create and update its own validated status', async () => {
  const store = db('player', deviceClaims);
  await assertSucceeds(setDoc(doc(store, path('deviceStatus/player')), status()));
  await assertSucceeds(getDoc(doc(store, path('deviceStatus/player'))));
  await assertSucceeds(updateDoc(doc(store, path('deviceStatus/player')),
    { state: 'downloading', reportedAt: serverTimestamp() }));
  await env.withSecurityRulesDisabled(ctx => deleteDoc(doc(ctx.firestore(), path('deviceStatus/player'))));
  await assertSucceeds(setDoc(doc(store, path('deviceStatus/player')), status()));
});
test('device status rejects unexpected, missing, and invalid fields', async () => {
  const target = doc(db('player', deviceClaims), path('deviceStatus/player'));
  for (const payload of [
    { ...status(), role: 'owner' },
    { ...status(), appliedVersion: -1 },
    { ...status(), appliedVersion: '1' },
    { ...status(), appliedVersion: 1.5 },
    { ...status(), state: 'paid' },
    { ...status(), reportedAt: new Date(0) },
    { state: 'ready', reportedAt: serverTimestamp() },
  ]) {
    await assertFails(setDoc(target, payload));
  }
  await assertFails(deleteDoc(target));
});
test('devices cannot alter registry or another device status; staff cannot forge status', async () => {
  const store = db('player', deviceClaims);
  await assertFails(setDoc(doc(store, path('deviceStatus/other')), status()));
  await assertFails(updateDoc(doc(store, path('devices/player')), { active: true, screenId: 'two' }));
  await assertFails(setDoc(doc(db('owner'), path('deviceStatus/player')), status()));
  await assertSucceeds(getDoc(doc(db('staff'), path('deviceStatus/player'))));
  await assertFails(getDoc(doc(db('outsider'), path('deviceStatus/player'))));
});
test('revoking an active membership invalidates the existing client session', async () => {
  const store = db('manager');
  await assertSucceeds(getDoc(doc(store, path('locations/north'))));
  await env.withSecurityRulesDisabled(ctx =>
    updateDoc(doc(ctx.firestore(), path('members/manager')), { active: false }));
  await assertFails(getDoc(doc(store, path('locations/north'))));
});
test('revoking an active device invalidates reads and status writes', async () => {
  const store = db('player', deviceClaims);
  await assertSucceeds(getDoc(doc(store, path('locations/north/screens/one'))));
  await env.withSecurityRulesDisabled(ctx =>
    updateDoc(doc(ctx.firestore(), path('devices/player')), { active: false }));
  await assertFails(getDoc(doc(store, path('locations/north/screens/one'))));
  await assertFails(setDoc(doc(store, path('deviceStatus/player')), status()));
});
test('Storage stays locked for anonymous, staff, owner, and device clients', async () => {
  for (const ctx of [env.unauthenticatedContext(), context('staff'), context('owner'),
    context('player', deviceClaims)]) {
    const target = storageRef(ctx.storage(), 'businesses/a/media/example.png');
    await assertFails(uploadBytes(target, new Uint8Array([1, 2]), { contentType: 'image/png' }));
    await assertFails(getMetadata(target));
  }
});
test('Firebase uploads stay denied even with a valid owner reservation; quarantined objects stay unreadable', async () => {
  await env.withSecurityRulesDisabled(async ctx => {
    const store = ctx.firestore();
    await setDoc(doc(store, path('media/reserved')), {
      createdBy: 'owner', status: 'uploading', size: 12, contentType: 'image/png',
      expiresAt: new Date(Date.now() + 60000),
    });
    await setDoc(doc(store, path('media/expired')), {
      createdBy: 'owner', status: 'uploading', size: 12, contentType: 'image/png',
      expiresAt: new Date(Date.now() - 60000),
    });
  });
  const metadata = { contentType: 'image/png', customMetadata: { reservation: 'reserved' } };
  const objectPath = path('media/reserved/original');
  for (const ctx of [env.unauthenticatedContext(), context('owner'), context('staff', { email_verified: true }),
    context('outsider', { email_verified: true }), context('player', { ...deviceClaims, email_verified: true })]) {
    await assertFails(uploadBytes(storageRef(ctx.storage(), objectPath), new Uint8Array(12), metadata));
  }
  const storage = context('owner', { email_verified: true }).storage();
  const target = storageRef(storage, objectPath);
  await assertFails(uploadBytes(target, new Uint8Array(13), metadata));
  await assertFails(uploadBytes(target, new Uint8Array(12), { ...metadata, contentType: 'text/html' }));
  await assertFails(uploadBytes(target, new Uint8Array(12), { ...metadata, customMetadata: { reservation: 'reserved', extra: 'injected' } }));
  await assertFails(uploadBytes(storageRef(storage, path('media/expired/original')), new Uint8Array(12),
    { ...metadata, customMetadata: { reservation: 'expired' } }));
  await assertFails(uploadBytes(storageRef(storage, path('media/missing/original')), new Uint8Array(12), metadata));
  await assertFails(uploadBytes(target, new Uint8Array(12), metadata));
  await env.withSecurityRulesDisabled(async ctx => {
    await uploadBytes(storageRef(ctx.storage(), objectPath), new Uint8Array(12), metadata);
  });
  await assertFails(getMetadata(target));
  await assertFails(uploadBytes(target, new Uint8Array(12), metadata));
  await env.withSecurityRulesDisabled(async ctx => {
    await setDoc(doc(ctx.firestore(), path('media/after-revoke')), {
      createdBy: 'owner', status: 'uploading', size: 12, contentType: 'image/png',
      expiresAt: new Date(Date.now() + 60000),
    });
    await updateDoc(doc(ctx.firestore(), path('members/owner')), { active: false });
  });
  await assertFails(uploadBytes(storageRef(storage, path('media/after-revoke/original')), new Uint8Array(12),
    { ...metadata, customMetadata: { reservation: 'after-revoke' } }));
});
test('pairing sessions and rate limits are inaccessible directly even to owners and devices', async () => {
  for (const ctx of [env.unauthenticatedContext(), context('owner'), context('player', deviceClaims)]) {
    for (const key of ['pairingSessions/ABCDEF1234', 'pairingLimits/example']) {
      const target = doc(ctx.firestore(), key);
      await assertFails(getDoc(target));
      await assertFails(setDoc(target, { status: 'claimed', businessId: 'a' }));
    }
  }
});
test('Realtime Database stays locked at root, tenant, and device paths', async () => {
  for (const ctx of [env.unauthenticatedContext(), context('owner'), context('player', deviceClaims)]) {
    for (const key of ['/', 'businesses/a', 'presence/a/player']) {
      const target = databaseRef(ctx.database(), key);
      await assertFails(set(target, { online: true }));
      await assertFails(get(target));
    }
  }
});

test('menu documents deny direct client reads and writes even for the owner', async () => {
  for (const ctx of [env.unauthenticatedContext(), context('owner'), context('player', deviceClaims)]) {
    const target = doc(ctx.firestore(), 'businesses/a/locations/main/menus/current');
    await assertFails(getDoc(target));
    await assertFails(setDoc(target, { currency: 'AUD', categories: [], items: [], version: 1 }));
  }
});
