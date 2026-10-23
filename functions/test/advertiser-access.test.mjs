import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createAdvertisers } from '../src/advertisers.js';
let app, db, service, clock = Date.now();
const businessId = 'advertiser-access-fixture';
const req = (data, uid = 'owner') => ({ data, app: { appId: 'test' }, auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } } });
const deny = (promise, code) => assert.rejects(promise, e => e.code === code);
const scope = advertiserId => ({ businessId, advertiserId });
const invite = (advertiserId, requestId = 'first', email = 'client@example.test') => ({ ...scope(advertiserId), requestId, email });
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'advertiser-access-tests'); db = getFirestore(app);
  service = createAdvertisers({ firestore: db, now: () => clock, auth: { getUser: async uid => ({
    uid, email: `${uid}@example.test`, emailVerified: uid !== 'unverified', disabled: uid === 'disabled',
  }) } });
  await db.doc(`businesses/${businessId}`).set({ name: 'Operator' });
  await db.doc(`businesses/${businessId}/members/owner`).set({ active: true, role: 'owner' });
  await db.doc(`businesses/${businessId}/entitlements/current`).set({ source: 'trial', trialModules: ['screens'],
    trialStartedAt: Timestamp.fromMillis(clock - 1000), trialEndsAt: Timestamp.fromMillis(clock + 14 * 86400000) });
  for (const id of ['one', 'two', 'three', 'four']) await db.doc(`businesses/${businessId}/advertisers/${id}`).set({ name: id, active: true, version: 1 });
});
after(async () => { await db.recursiveDelete(db.doc(`businesses/${businessId}`)); await db.terminate(); await deleteApp(app); });

test('invitation creation rejects non-owners, missing verification and injected authority', async () => {
  for (const uid of ['client', 'outsider', 'unverified', 'disabled']) await deny(service.inviteAdvertiser(req(invite('one'), uid)), 'permission-denied');
  await deny(service.inviteAdvertiser({ ...req(invite('one')), app: undefined }), 'failed-precondition');
  const device = req(invite('one')); device.auth.token.device = true;
  await deny(service.inviteAdvertiser(device), 'permission-denied');
  await deny(service.inviteAdvertiser(req({ ...invite('one'), role: 'owner' })), 'invalid-argument');
  await deny(service.inviteAdvertiser(req(invite('one', 'first', 'invalid'))), 'invalid-argument');
});
test('verified email acceptance is concurrent retry-safe and grants only the named client workspace', async () => {
  const issued = await service.inviteAdvertiser(req(invite('one')));
  assert.deepEqual(await service.inviteAdvertiser(req(invite('one'))), issued);
  const data = { ...scope('one'), invitationId: issued.invitationId };
  for (const uid of ['outsider', 'unverified', 'disabled']) await deny(service.acceptAdvertiserInvitation(req(data, uid)), 'permission-denied');
  await deny(service.acceptAdvertiserInvitation(req({ ...data, advertiserId: 'two' }, 'client')), 'permission-denied');
  await Promise.all([service.acceptAdvertiserInvitation(req(data, 'client')), service.acceptAdvertiserInvitation(req(data, 'client'))]);
  assert.deepEqual(await service.getAdvertiserWorkspace(req(scope('one'), 'client')), { advertiserId: 'one', name: 'one' });
  await deny(service.getAdvertiserWorkspace(req(scope('two'), 'client')), 'permission-denied');
  await deny(service.getAdvertiserWorkspace(req({ businessId: 'foreign', advertiserId: 'one' }, 'client')), 'permission-denied');
  await deny(service.listAdvertisers(req({ businessId }, 'client')), 'permission-denied');
  assert.equal((await db.doc(`businesses/${businessId}/members/client`).get()).exists, false);
  assert.equal((await db.collection(`businesses/${businessId}/audit`).where('type', '==', 'advertiser.invitationAccepted').get()).size, 1);
});
test('archive invalidates accepted access and pending links even after restoration', async () => {
  const issued = await service.inviteAdvertiser(req(invite('two')));
  for (const advertiserId of ['one', 'two']) {
    await service.setAdvertiserActive(req({ ...scope(advertiserId), expectedVersion: 1, active: false }));
    await deny(service.getAdvertiserWorkspace(req(scope(advertiserId), 'client')), 'permission-denied');
    await service.setAdvertiserActive(req({ ...scope(advertiserId), expectedVersion: 2, active: true }));
  }
  await deny(service.getAdvertiserWorkspace(req(scope('one'), 'client')), 'permission-denied');
  await deny(service.acceptAdvertiserInvitation(req({ ...scope('two'), invitationId: issued.invitationId }, 'client')), 'permission-denied');
  await deny(service.inviteAdvertiser(req(invite('two'))), 'already-exists');
});
test('replacement invalidates old links and request replay cannot restore them', async () => {
  const first = await service.inviteAdvertiser(req(invite('three')));
  await deny(service.inviteAdvertiser(req(invite('three', 'second'))), 'resource-exhausted');
  clock += 61000;
  const second = await service.inviteAdvertiser(req(invite('three', 'second')));
  await deny(service.inviteAdvertiser(req(invite('three'))), 'already-exists');
  await deny(service.acceptAdvertiserInvitation(req({ ...scope('three'), invitationId: first.invitationId }, 'client')), 'permission-denied');
  await service.acceptAdvertiserInvitation(req({ ...scope('three'), invitationId: second.invitationId }, 'client'));
  clock += 61000;
  const replacement = await service.inviteAdvertiser(req(invite('three', 'third', 'other@example.test')));
  await service.acceptAdvertiserInvitation(req({ ...scope('three'), invitationId: replacement.invitationId }, 'other'));
  await deny(service.getAdvertiserWorkspace(req(scope('three'), 'client')), 'permission-denied');
  assert.equal((await service.getAdvertiserWorkspace(req(scope('three'), 'other'))).name, 'three');
});
test('revoked issuers, expired invitations and expired trials cannot grant or retain access', async () => {
  const issued = await service.inviteAdvertiser(req(invite('four')));
  const accept = () => service.acceptAdvertiserInvitation(req({ ...scope('four'), invitationId: issued.invitationId }, 'client'));
  await db.doc(`businesses/${businessId}/members/owner`).update({ active: false });
  await deny(accept(), 'permission-denied');
  await db.doc(`businesses/${businessId}/members/owner`).update({ active: true });
  clock += 7 * 86400000;
  await deny(accept(), 'permission-denied');
  clock += 7 * 86400000;
  await deny(service.getAdvertiserWorkspace(req(scope('three'), 'other')), 'failed-precondition');
  await deny(service.inviteAdvertiser(req(invite('four', 'expired-trial'))), 'failed-precondition');
});
