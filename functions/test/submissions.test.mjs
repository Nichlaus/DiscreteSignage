import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createSubmissions } from '../src/submissions.js';
let app, db, service, signed, onDownload, clock = Date.now();
let bytes = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]);
const businessId = 'submission-fixture', advertiserId = 'client-one';
const scope = { businessId, advertiserId };
const req = (data, uid = 'client') => ({ data, app: { appId: 'test' }, auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } } });
const deny = (p, code) => assert.rejects(p, e => e.code === code);
const input = requestId => ({ ...scope, requestId, name: 'advert.png', size: 12, contentType: 'image/png' });
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'submission-tests'); db = getFirestore(app);
  service = createSubmissions({ firestore: db, now: () => clock,
    auth: { getUser: async uid => ({ uid, email: `${uid}@example.test`, emailVerified: true }) },
    bucket: () => ({ file: (path, options) => ({
      getSignedUrl: async opts => { signed = { path, opts }; return ['https://storage.googleapis.com/synthetic']; },
      getMetadata: async () => [{ size: '12', contentType: 'image/png', generation: '7' }],
      download: async () => { assert.equal(options.generation, '7'); await onDownload?.(); return [bytes]; },
    }) }) });
  await db.doc(`businesses/${businessId}`).set({ name: 'Operator' });
  await db.doc(`businesses/${businessId}/members/owner`).set({ active: true, role: 'owner' });
  await db.doc(`businesses/${businessId}/entitlements/current`).set({ source: 'trial', trialModules: ['screens'], trialStartedAt: Timestamp.fromMillis(clock - 1000), trialEndsAt: Timestamp.fromMillis(clock + 86400000) });
  await db.doc(`businesses/${businessId}/advertisers/${advertiserId}`).set({ name: 'Client', active: true, version: 1 });
  await db.doc(`businesses/${businessId}/advertisers/${advertiserId}/access/member`).set({ uid: 'client', email: 'client@example.test', clientVersion: 1 });
});
after(async () => { await db.recursiveDelete(db.doc(`businesses/${businessId}`)); await db.terminate(); await deleteApp(app); });
test('client intake rejects missing attestation, foreign users, injected approval and oversize files', async () => {
  await deny(service.beginClientSubmission({ ...req(input('a')), app: undefined }), 'failed-precondition');
  for (const uid of ['owner', 'stranger']) await deny(service.beginClientSubmission(req(input('a'), uid)), 'permission-denied');
  await deny(service.beginClientSubmission(req({ ...input('a'), advertiserId: 'other' })), 'permission-denied');
  await deny(service.beginClientSubmission(req({ ...input('a'), businessId: 'foreign' })), 'permission-denied');
  await deny(service.beginClientSubmission(req({ ...input('a'), approved: true })), 'invalid-argument');
  await deny(service.beginClientSubmission(req({ ...input('a'), size: 20 * 1024 ** 2 + 1 })), 'invalid-argument');
});
test('concurrent reservations count once and write grants bind immutable private submission paths', async () => {
  const [a,b] = await Promise.all([service.beginClientSubmission(req(input('one'))),service.beginClientSubmission(req(input('one')))]);
  assert.equal(a.submissionId,b.submissionId);
  assert.equal((await db.doc(`businesses/${businessId}`).get()).data().submissionCount,1);
  await deny(service.beginClientSubmission(req({ ...input('one'), name: 'changed.png' })), 'already-exists');
  const grant = await service.authorizeClientSubmission(req({ ...scope, ...a }));
  assert.equal(grant.headers['x-goog-if-generation-match'],'0');
  assert.equal(grant.headers['x-goog-content-length-range'],'12,12');
  assert.equal(signed.path, `businesses/${businessId}/submissions/${a.submissionId}/original`);
  assert.ok(grant.expiresAt <= clock + 300000);
  await deny(service.authorizeClientSubmission(req({ ...scope, ...a, advertiserId:'other' })), 'permission-denied');
  await service.completeClientSubmission(req({ ...scope,...a }));
  await service.completeClientSubmission(req({ ...scope,...a }));
  assert.equal((await db.collection(`businesses/${businessId}/media`).get()).size,0);
  const listed = await service.listClientSubmissions(req(scope));
  assert.equal(listed.items[0].status,'submitted');
  assert.equal(Object.hasOwn(listed.items[0],'path'),false);
  await deny(service.listAdvertiserSubmissions(req({businessId})), 'permission-denied');
  assert.equal((await service.listAdvertiserSubmissions(req({businessId},'owner'))).items.length,1);
});
test('spoofed files are rejected and revocation during inspection prevents completion', async () => {
  const rejected = await service.beginClientSubmission(req(input('bad')));
  bytes = Buffer.alloc(12);
  assert.equal((await service.completeClientSubmission(req({...scope,...rejected}))).status,'rejected');
  const revoked = await service.beginClientSubmission(req(input('revoked')));
  onDownload = () => db.doc(`businesses/${businessId}/advertisers/${advertiserId}`).update({ active:false,version:2 });
  await deny(service.completeClientSubmission(req({...scope,...revoked})), 'permission-denied');
  onDownload = undefined;
  await deny(service.listClientSubmissions(req(scope)), 'permission-denied');
  await db.doc(`businesses/${businessId}/advertisers/${advertiserId}`).update({ active:true,version:3 });
  await db.doc(`businesses/${businessId}/advertisers/${advertiserId}/access/member`).update({ clientVersion:3 });
  await deny(service.authorizeClientSubmission(req({...scope,...revoked})), 'permission-denied');
  assert.equal((await db.doc(`businesses/${businessId}/submissions/${revoked.submissionId}`).get()).data().status,'uploading');
});
test('client/business quotas and reservation/trial expiry fail closed', async () => {
  const pending=await service.beginClientSubmission(req(input('expires')));
  clock += 31 * 60000;
  await deny(service.authorizeClientSubmission(req({...scope,...pending})), 'failed-precondition');
  await deny(service.completeClientSubmission(req({...scope,...pending})), 'failed-precondition');
  await db.doc(`businesses/${businessId}/advertisers/${advertiserId}`).update({ submissionCount:20 });
  await deny(service.beginClientSubmission(req(input('quota'))), 'resource-exhausted');
  await db.doc(`businesses/${businessId}/advertisers/${advertiserId}`).update({ submissionCount:4 });
  await db.doc(`businesses/${businessId}`).update({ submissionBytes:1024 ** 3 });
  await deny(service.beginClientSubmission(req(input('bytes'))), 'resource-exhausted');
  clock += 86400000;
  await deny(service.listClientSubmissions(req(scope)), 'failed-precondition');
});
