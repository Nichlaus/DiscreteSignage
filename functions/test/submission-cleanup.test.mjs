import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { createSubmissionCleanup } from '../src/submission-cleanup.js';
import { createSubmissions } from '../src/submissions.js';
import { cleanupGraceMs } from '../src/media.js';

let app, db, business, service, submissions, clock = Date.now(), onDelete;
const objects = new Map(), deleted = [];
const req = (submissionId, extra = {}, uid = 'owner') => ({ data: { businessId: 'cleanup-fixture', submissionId, expectedVersion: 1, ...extra },
  app: { appId: 'test' }, auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } } });
const deny = (p, code) => assert.rejects(p, e => e.code === code);
const ref = id => business.collection('submissions').doc(id);
const remove = id => service.cleanupSubmission(req(id));
async function seed(id, status = 'rejected', extra = {}) {
  const path = `${business.path}/submissions/${id}/original`;
  await ref(id).set({ advertiserId: 'client', clientVersion: 1, createdBy: 'client',
    name: 'test.png', size: 12, contentType: 'image/png', path, status,
    expiresAt: Timestamp.fromMillis(clock - cleanupGraceMs), ...extra });
  objects.set(path, '7');
}
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'cleanup-tests'); db = getFirestore(app);
  business = db.doc('businesses/cleanup-fixture');
  const deps = { firestore: db, now: () => clock,
    auth: { getUser: async uid => ({ uid, email: `${uid}@example.test`, emailVerified: true }) },
    bucket: () => ({ file: (path, options) => ({
      getMetadata: async () => {
        if (!objects.has(path)) throw Object.assign(Error('Missing'), { code: 404 });
        return [{ generation: objects.get(path) }];
      },
      delete: async opts => {
        await onDelete?.(path);
        if (!objects.has(path)) throw Object.assign(Error('Missing'), { code: 404 });
        assert.equal(options.generation, opts.ifGenerationMatch);
        if (objects.get(path) !== opts.ifGenerationMatch) throw Object.assign(Error('Generation changed'), { code: 412 });
        deleted.push(path); objects.delete(path);
      },
    }) }) };
  service = createSubmissionCleanup(deps); submissions = createSubmissions(deps);
});
beforeEach(async () => {
  await db.recursiveDelete(business); objects.clear(); deleted.length = 0; onDelete = undefined;
  await business.set({ submissionCount: 1, submissionBytes: 12, mediaCount: 3, mediaReservedBytes: 100 });
  await business.collection('members').doc('owner').set({ role: 'owner', active: true });
  await business.collection('members').doc('staff').set({ role: 'staff', active: true });
  await business.collection('advertisers').doc('client').set({ submissionCount: 1, active: true, version: 1 });
  await business.collection('advertisers').doc('client').collection('access').doc('member').set({ uid: 'client', email: 'client@example.test', clientVersion: 1 });
  await business.collection('entitlements').doc('current').set({ source: 'trial', trialModules: ['screens'],
    trialStartedAt: Timestamp.fromMillis(clock - 1000), trialEndsAt: Timestamp.fromMillis(clock + 86400000) });
});
after(async () => { await db.recursiveDelete(business); await db.terminate(); await deleteApp(app); });

test('cleanup enforces owner, attestation, tenant and exact version before storage operations', async () => {
  await seed('access');
  await deny(service.cleanupSubmission({ ...req('access'), app: undefined }), 'failed-precondition');
  for (const uid of ['client', 'staff', 'outsider']) await deny(service.cleanupSubmission(req('access', {}, uid)), 'permission-denied');
  await deny(service.cleanupSubmission(req('access', { businessId: 'foreign' })), 'permission-denied');
  await deny(service.cleanupSubmission(req('access', { path: '/injected' })), 'invalid-argument');
  await deny(service.cleanupSubmission(req('access', { expectedVersion: 2 })), 'failed-precondition');
  assert.equal(deleted.length, 0);
});

test('upload safety boundary and pending/shared library content are protected', async () => {
  await seed('young', 'uploading', { expiresAt: Timestamp.fromMillis(clock - cleanupGraceMs + 1) });
  await deny(remove('young'), 'failed-precondition');
  for (const status of ['submitted', 'validating', 'review', 'approved', 'withdrawn']) {
    await seed(status, status); await deny(remove(status), 'failed-precondition');
  }
  await seed('promoted'); await business.collection('media').doc('submission_promoted').set({ status: 'withdrawn' });
  await deny(remove('promoted'), 'failed-precondition');
  await seed('lease', 'validation-failed', { leaseUntil: Timestamp.fromMillis(clock) });
  await deny(remove('lease'), 'failed-precondition');
  await seed('path', 'rejected', { path: 'businesses/foreign/submissions/file/original' });
  await deny(remove('path'), 'failed-precondition');
  assert.equal(deleted.length, 0);
  assert.equal((await remove('young').catch(e => e)).code, 'failed-precondition');
  clock++; assert.equal((await remove('young')).removed, true);
});

test('concurrent cleanup deletes orphan derivatives and releases both submission counters exactly once', async () => {
  await seed('orphan', 'validation-failed');
  objects.set(`${business.path}/submissions/orphan/validated-v1.webp`, '8');
  await business.collection('advertisers').doc('client').update({ active: false });
  await business.collection('entitlements').doc('current').update({ trialEndsAt: Timestamp.fromMillis(clock - 1) });
  const results = await Promise.all([remove('orphan'), remove('orphan')]);
  assert.equal(results.filter(r => r.removed).length, 1);
  assert.equal(objects.size, 0);
  const meta = (await business.get()).data();
  assert.equal(meta.submissionCount, 0); assert.equal(meta.submissionBytes, 0);
  assert.equal(meta.mediaCount, 3); assert.equal(meta.mediaReservedBytes, 100);
  assert.equal((await business.collection('advertisers').doc('client').get()).data().submissionCount, 0);
  assert.equal((await business.collection('audit').get()).size, 1);
  assert.equal((await ref('orphan').get()).data().status, 'deleted');
});

test('partial deletion failure keeps quota reserved and retry completes missing objects safely', async () => {
  await seed('partial', 'declined');
  const derivative = `${business.path}/submissions/partial/validated-v1.webp`;
  objects.set(derivative, '8');
  onDelete = async path => { if (path === derivative) throw Object.assign(Error('storage unavailable'), { code: 503 }); };
  await assert.rejects(remove('partial'), /storage unavailable/);
  assert.equal((await ref('partial').get()).data().status, 'retiring');
  assert.equal((await business.get()).data().submissionCount, 1);
  const list = await submissions.listAdvertiserSubmissions({ ...req('partial'), data: { businessId: business.id } });
  assert.equal(list.items[0].version, 1); assert.equal(list.items[0].canCleanup, true);
  onDelete = undefined; await remove('partial');
  assert.equal(objects.size, 0); assert.equal((await business.get()).data().submissionCount, 0);
});

test('generation changes and invalid counters fail closed without freeing quota', async () => {
  await seed('changed');
  onDelete = async path => { objects.set(path, '9'); };
  await assert.rejects(remove('changed'), e => e.code === 412);
  assert.equal((await business.get()).data().submissionBytes, 12);
  onDelete = undefined;
  await business.update({ submissionBytes: 0 });
  await deny(remove('changed'), 'failed-precondition');
  assert.equal(objects.size, 1);
});

test('owner revocation after deletion prevents release until an authorized retry', async () => {
  await seed('revoke');
  onDelete = () => business.collection('members').doc('owner').update({ active: false });
  await deny(remove('revoke'), 'permission-denied');
  assert.equal((await business.get()).data().submissionCount, 1);
  await business.collection('members').doc('owner').update({ active: true });
  onDelete = undefined; await remove('revoke');
  assert.equal((await business.get()).data().submissionCount, 0);
});

test('tombstones prevent reservation reuse and do not crowd recovered slots out of lists', async () => {
  const id = createHash('sha256').update('client:client:request-one').digest('hex');
  await seed(id, 'uploading'); objects.clear(); await remove(id);
  const scope = { businessId: business.id, advertiserId: 'client' };
  const request = data => ({ ...req(id, {}, 'client'), data });
  await deny(submissions.beginClientSubmission(request({ ...scope, requestId: 'request-one', name: 'test.png', size: 12, contentType: 'image/png' })), 'failed-precondition');
  const batch = db.batch();
  for (let i = 0; i < 105; i++) batch.set(ref(`tombstone-${i}`), { status: 'deleted', advertiserId: 'client' });
  await batch.commit();
  await submissions.beginClientSubmission(request({ ...scope, requestId: 'request-two', name: 'new.png', size: 12, contentType: 'image/png' }));
  const listed = await submissions.listClientSubmissions(request(scope));
  assert.equal(listed.items.length, 1); assert.equal(listed.items[0].name, 'new.png');
  assert.equal((await business.get()).data().submissionCount, 1);
});
