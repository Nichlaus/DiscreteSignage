import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { createProvisioning } from '../src/provisioning.js';
import { createTeam } from '../src/team.js';

let app, auth, store, service;
const clock = Date.parse('2026-10-20T00:00:00Z');
const input = { businessName: 'Test Cafe', locationName: 'Main', timezone: 'Australia/Sydney' };
const request = (uid, data = input, token = {}) => ({
  auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000), ...token } },
  app: { appId: 'local-test-app' }, data,
});
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
let provisioned;
let team, teamBusiness, invitation;

before(async () => {
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST']) {
    if (!process.env[key]?.startsWith('127.0.0.1:')) throw Error(`Local emulator required: ${key}`);
  }
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'provisioning-tests');
  auth = getAuth(app);
  store = getFirestore(app);
  service = createProvisioning({ firestore: store, auth, now: () => clock });
  team = createTeam({ firestore: store, auth, now: () => clock });
  for (const uid of ['founder', 'another-founder', 'staff', 'disabled', 'unverified', 'display', 'revoked-session']) {
    await auth.createUser({
      uid, email: `${uid}@example.test`, emailVerified: uid !== 'unverified',
      disabled: uid === 'disabled',
    });
  }
  await auth.revokeRefreshTokens('revoked-session');
});
after(async () => { await store?.terminate(); if (app) await deleteApp(app); });

test('reject unauthenticated, unattested, disabled, unverified, device and anonymous callers', async () => {
  await rejects(service.provisionBusiness({ data: input }), 'unauthenticated');
  await rejects(service.provisionBusiness({ ...request('founder'), app: undefined }), 'failed-precondition');
  for (const uid of ['disabled', 'unverified']) {
    await rejects(service.provisionBusiness(request(uid)), 'permission-denied');
  }
  await rejects(service.provisionBusiness(request('display', input, { device: true })), 'permission-denied');
  await rejects(service.provisionBusiness(request('founder', input, {
    firebase: { sign_in_provider: 'anonymous' },
  })), 'permission-denied');
  await rejects(service.provisionBusiness(request('missing-user')), 'unauthenticated');
  await rejects(service.provisionBusiness(request('founder', input, { auth_time: 0 })), 'unauthenticated');
  await rejects(service.provisionBusiness(request('revoked-session', input, { auth_time: 1 })), 'unauthenticated');
});
test('strict validation rejects injected authority and invalid names/timezones', async () => {
  for (const data of [
    { ...input, trialEndsAt: '2099-01-01' }, { ...input, role: 'owner' },
    { ...input, businessId: 'victim' }, { ...input, currency: 'USD' },
    { ...input, businessName: ' ' }, { ...input, locationName: 'x'.repeat(101) },
    { ...input, businessName: 'Bad\nName' }, { ...input, timezone: 'Europe/London' },
    null, [], {},
  ]) await rejects(service.provisionBusiness(request('founder', data)), 'invalid-argument');
  assert.equal((await store.collection('businesses').get()).size, 0);
});
test('concurrent provisioning creates exactly one business and one 14-day trial', async () => {
  const results = await Promise.all(Array.from({ length: 4 },
    () => service.provisionBusiness(request('founder'))));
  assert.equal(results.filter(value => value.created).length, 1);
  assert.equal(new Set(results.map(value => value.businessId)).size, 1);
  provisioned = results[0];
  const business = store.doc(`businesses/${provisioned.businessId}`);
  const data = (await business.get()).data();
  assert.equal(data.country, 'AU');
  assert.equal(data.currency, 'AUD');
  assert.equal(data.locationCount, 1);
  const member = (await business.collection('members').doc('founder').get()).data();
  assert.equal(member.role, 'owner');
  assert.equal(member.active, true);
  assert.equal((await business.collection('locations').get()).size, 1);
  const trial = (await business.collection('entitlements').doc('current').get()).data();
  assert.equal(trial.trialStartedAt.toMillis(), clock);
  assert.equal(trial.trialEndsAt.toMillis(), clock + 14 * 86400000);
  assert.equal(trial.paymentMethodRequired, false);
  assert.equal(trial.trialModules.length, 5);
  assert.equal((await business.collection('audit').get()).size, 1);
});
test('retry cannot reset trial and changed details cannot silently overwrite business', async () => {
  const later = createProvisioning({ firestore: store, auth, now: () => clock + 86400000 });
  assert.equal((await later.provisionBusiness(request('founder'))).created, false);
  await rejects(later.provisionBusiness(request('founder', { ...input, businessName: 'Changed' })), 'already-exists');
  const trial = (await store.doc(`businesses/${provisioned.businessId}/entitlements/current`).get()).data();
  assert.equal(trial.trialStartedAt.toMillis(), clock);
  const other = await service.provisionBusiness(request('another-founder'));
  assert.notEqual(other.businessId, provisioned.businessId);
});
test('only active owners can add a location; idempotency survives concurrent retries', async () => {
  const data = { businessId: provisioned.businessId, requestId: 'location-request-1',
    name: 'Second location', timezone: 'Australia/Perth' };
  const business = store.doc(`businesses/${provisioned.businessId}`);
  await business.collection('members').doc('staff').set({ active: true, role: 'manager', locations: {} });
  for (const uid of ['another-founder', 'staff']) {
    await rejects(service.createLocation(request(uid, data)), 'permission-denied');
  }
  const result = await Promise.all(Array.from({ length: 3 },
    () => service.createLocation(request('founder', data))));
  assert.equal(result.filter(value => value.created).length, 1);
  assert.equal((await business.get()).data().locationCount, 2);
  assert.equal((await business.collection('locations').get()).size, 2);
  await rejects(service.createLocation(request('founder', { ...data, name: 'Different' })), 'already-exists');
  await rejects(service.createLocation(request('founder', { ...data, businessId: '../other' })), 'invalid-argument');
  await rejects(service.createLocation(request('founder', { ...data, paid: true })), 'invalid-argument');
});
test('location cap is enforced without partial writes', async () => {
  const business = store.doc(`businesses/${provisioned.businessId}`);
  await business.update({ locationCount: 100 });
  await rejects(service.createLocation(request('founder', {
    businessId: provisioned.businessId, requestId: 'over-cap', name: 'Over cap',
    timezone: 'Australia/Sydney',
  })), 'resource-exhausted');
  assert.equal((await business.collection('locations').get()).size, 2);
});
test('revoked owner cannot retry provisioning or create locations', async () => {
  await store.doc(`businesses/${provisioned.businessId}/members/founder`).update({ active: false });
  await rejects(service.provisionBusiness(request('founder')), 'permission-denied');
  await rejects(service.createLocation(request('founder', {
    businessId: provisioned.businessId, requestId: 'revoked', name: 'Revoked',
    timezone: 'Australia/Sydney',
  })), 'permission-denied');
});

test('owners can create restricted invitations; staff, foreign owners and invalid grants cannot', async () => {
  teamBusiness = (await service.provisionBusiness(request('another-founder'))).businessId;
  const data = { businessId: teamBusiness, requestId: 'invite-1', email: 'staff@example.test',
    role: 'staff', locationIds: ['main'] };
  invitation = await team.createInvitation(request('another-founder', data));
  assert.deepEqual(await team.createInvitation(request('another-founder', data)), invitation);
  for (const uid of ['founder', 'staff']) {
    await rejects(team.createInvitation(request(uid, data)), 'permission-denied');
  }
  for (const patch of [{ role: 'owner' }, { locationIds: [] }, { locationIds: ['missing'] },
    { locationIds: ['main', 'main'] }, { email: 'invalid' }, { expiresAt: '2099' }]) {
    await rejects(team.createInvitation(request('another-founder', { ...data, ...patch })), 'invalid-argument');
  }
});
test('acceptance requires matching verified email and assigns only invited locations/role', async () => {
  await rejects(team.acceptInvitation(request('founder', invitation)), 'permission-denied');
  await rejects(team.acceptInvitation(request('unverified', invitation)), 'permission-denied');
  const results = await Promise.all([
    team.acceptInvitation(request('staff', invitation)), team.acceptInvitation(request('staff', invitation)),
  ]);
  assert.ok(results.every(result => result.accepted));
  const member = (await store.doc(`businesses/${teamBusiness}/members/staff`).get()).data();
  assert.equal(member.role, 'staff');
  assert.deepEqual(member.locations, { main: true });
  const view = await team.getWorkspace(request('staff', { businessId: teamBusiness }));
  assert.equal(view.workspace.role, 'staff');
  assert.equal(view.workspace.locations.length, 1);
  assert.deepEqual(view.workspace.invitations, []);
  await rejects(team.getWorkspace(request('staff', { businessId: provisioned.businessId })), 'permission-denied');
});
test('invitation cannot overwrite existing membership or restore revoked access', async () => {
  const another = await team.createInvitation(request('another-founder', {
    businessId: teamBusiness, requestId: 'invite-upgrade', email: 'staff@example.test',
    role: 'manager', locationIds: ['main'],
  }));
  await rejects(team.acceptInvitation(request('staff', another)), 'already-exists');
  await store.doc(`businesses/${teamBusiness}/members/staff`).update({ active: false });
  await rejects(team.acceptInvitation(request('staff', invitation)), 'failed-precondition');
  await rejects(team.acceptInvitation(request('staff', another)), 'already-exists');
  assert.equal((await team.getWorkspace(request('staff', { businessId: '' }))).workspace, null);
});
test('revoked, expired and revoked-issuer invitations cannot grant access', async () => {
  const make = requestId => team.createInvitation(request('another-founder', {
    businessId: teamBusiness, requestId, email: 'display@example.test',
    role: 'staff', locationIds: ['main'],
  }));
  const revoked = await make('revoke');
  await rejects(team.revokeInvitation(request('founder', revoked)), 'permission-denied');
  await team.revokeInvitation(request('another-founder', revoked));
  await team.revokeInvitation(request('another-founder', revoked));
  await rejects(team.acceptInvitation(request('display', revoked)), 'failed-precondition');
  const expired = await make('expire');
  const future = createTeam({ firestore: store, auth, now: () => clock + 8 * 86400000 });
  await rejects(future.acceptInvitation(request('display', expired)), 'failed-precondition');
  const issuerRevoked = await make('issuer-revoked');
  await store.doc(`businesses/${teamBusiness}/members/another-founder`).update({ active: false });
  await rejects(team.acceptInvitation(request('display', issuerRevoked)), 'permission-denied');
});

test('market changes require verified owner access and preserve trial and business data', async () => {
  await auth.createUser({ uid: 'market-owner', email: 'market-owner@example.test', emailVerified: true });
  const { businessId } = await service.provisionBusiness(request('market-owner'));
  const business = store.doc(`businesses/${businessId}`);
  const entitlement = business.collection('entitlements').doc('current');
  const beforeTrial = (await entitlement.get()).data();
  const beforeBusiness = (await business.get()).data();
  const data = { businessId, market: 'food' };
  await rejects(service.updateBusinessMarket({ data }), 'unauthenticated');
  await rejects(service.updateBusinessMarket({ ...request('market-owner', data), app: undefined }), 'failed-precondition');
  for (const uid of ['founder', 'disabled', 'unverified', 'staff']) {
    await rejects(service.updateBusinessMarket(request(uid, data)), 'permission-denied');
  }
  await business.collection('members').doc('staff').set({ active: true, role: 'manager', locations: {} });
  await rejects(service.updateBusinessMarket(request('staff', data)), 'permission-denied');
  await rejects(service.updateBusinessMarket(request('market-owner', data, { device: true })), 'permission-denied');
  for (const invalid of [{ ...data, market: 'unknown' }, { ...data, market: null },
    { ...data, trialEndsAt: 9999999999999 }, { businessId }]) {
    await rejects(service.updateBusinessMarket(request('market-owner', invalid)), 'invalid-argument');
  }
  assert.deepEqual(await service.updateBusinessMarket(request('market-owner', data)), { market: 'food' });
  const count = (await business.collection('audit').get()).size;
  await service.updateBusinessMarket(request('market-owner', data));
  assert.equal((await business.collection('audit').get()).size, count);
  assert.deepEqual((await entitlement.get()).data(), beforeTrial);
  assert.deepEqual((await business.get()).data(), { ...beforeBusiness, market: 'food' });
  assert.equal((await team.getWorkspace(request('market-owner', { businessId }))).workspace.market, 'food');
  await service.updateBusinessMarket(request('market-owner', { businessId, market: 'general' }));
  assert.equal((await business.get()).data().market, 'general');
  await business.collection('members').doc('market-owner').update({ active: false });
  await rejects(service.updateBusinessMarket(request('market-owner', data)), 'permission-denied');
});
