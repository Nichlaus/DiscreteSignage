import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import sharp from 'sharp';
import { createSubmissionReview } from '../src/submission-review.js';
import { createPlayback } from '../src/playback.js';
import { decodeImage } from '../src/image-validation.js';

let app, db, business, service, playback, signed, onDecode;
const clock = Date.now(), objects = new Map();
const auth = { getUser: async uid => ({ uid, email: `${uid}@example.test`, emailVerified: true }) };
const req = (submissionId, extra = {}, uid = 'owner') => ({ data: { businessId: 'review-fixture', submissionId, ...extra },
  app: { appId: 'test' }, auth: { uid, token: { auth_time: Math.floor(Date.now() / 1000) } } });
const deny = (p, code) => assert.rejects(p, e => e.code === code);
const record = id => business.collection('submissions').doc(id);
const decide = (id, version, decision = 'approve', reason = '') => service.reviewSubmission(req(id, { expectedVersion: version, decision, reason }));
async function seed(id, corrupt = false) {
  const bytes = corrupt ? Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0])
    : await sharp({ create: { width: 4, height: 3, channels: 3, background: '#aabbcc' } }).png().toBuffer();
  const path = `businesses/${business.id}/submissions/${id}/original`;
  objects.set(path, { bytes, meta: { size: String(bytes.length), contentType: 'image/png', generation: '7' } });
  await record(id).set({ advertiserId: 'client', clientVersion: 1, createdBy: 'client', name: `${id}.png`,
    path, generation: '7', size: bytes.length, contentType: 'image/png', status: 'submitted' });
}
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST?.startsWith('127.0.0.1:')) throw Error('Local emulator required');
  app = initializeApp({ projectId: 'demo-discretesignage' }, 'review-tests'); db = getFirestore(app);
  business = db.doc('businesses/review-fixture');
  await business.set({ name: 'Review fixture' });
  await business.collection('members').doc('owner').set({ active: true, role: 'owner' });
  await business.collection('members').doc('staff').set({ active: true, role: 'staff' });
  await business.collection('advertisers').doc('client').set({ active: true, version: 1 });
  await business.collection('entitlements').doc('current').set({ source: 'trial', trialModules: ['screens'],
    trialStartedAt: Timestamp.fromMillis(clock - 1000), trialEndsAt: Timestamp.fromMillis(clock + 86400000) });
  const bucket = () => ({ file: (path, options) => ({
    getMetadata: async () => [objects.get(path).meta],
    download: async () => { assert.equal(options.generation, '7'); return [objects.get(path).bytes]; },
    save: async (bytes, opts) => {
      assert.equal(opts.preconditionOpts.ifGenerationMatch, 0);
      if (objects.has(path)) throw Object.assign(Error('exists'), { code: 412 });
      objects.set(path, { bytes, meta: { ...opts.metadata, size: String(bytes.length), generation: '8' } });
    },
    getSignedUrl: async opts => { signed = { path, opts }; return ['https://storage.googleapis.com/synthetic']; },
  }) });
  service = createSubmissionReview({ firestore: db, auth, bucket, now: () => clock,
    decode: async (...args) => { await onDecode?.(); return decodeImage(...args); } });
  playback = createPlayback({ firestore: db, auth, bucket, now: () => clock });
});
after(async () => { await db.recursiveDelete(business); await db.terminate(); await deleteApp(app); });

test('review and previews require attestation and current ownership, never client access', async () => {
  await seed('secure');
  for (const method of ['validateSubmission', 'previewSubmission', 'reviewSubmission']) {
    const extra = method === 'reviewSubmission' ? { expectedVersion: 1, decision: 'approve', reason: '' } : {};
    await deny(service[method]({ ...req('secure', extra), app: undefined }), 'failed-precondition');
    for (const uid of ['client', 'staff', 'outsider']) await deny(service[method](req('secure', extra, uid)), 'permission-denied');
    await deny(service[method](req('secure', { ...extra, businessId: 'foreign' })), 'permission-denied');
  }
  await deny(service.previewSubmission(req('secure')), 'failed-precondition');
  await deny(decide('secure', 1), 'failed-precondition');
  await deny(service.validateSubmission(req('secure', { playback: {} })), 'invalid-argument');
});

test('full image decoding rejects a signature-only file and never exposes or promotes it', async () => {
  await seed('corrupt', true);
  assert.equal((await service.validateSubmission(req('corrupt'))).validated, false);
  const value = (await record('corrupt').get()).data();
  assert.equal(value.status, 'validation-failed'); assert.equal(value.playback, undefined);
  await deny(service.previewSubmission(req('corrupt')), 'failed-precondition');
  await deny(decide('corrupt', value.version), 'failed-precondition');
  assert.equal((await business.collection('media').get()).size, 0);
});

test('validated previews use sanitized immutable bytes; approval is separate, versioned and idempotent', async () => {
  await service.validateSubmission(req('secure'));
  assert.equal((await business.collection('media').get()).size, 0);
  const value = (await record('secure').get()).data();
  assert.equal(value.status, 'review'); assert.equal(value.playback.policy, 'image-v1');
  const preview = await service.previewSubmission(req('secure'));
  assert.equal(preview.contentType, 'image/webp'); assert.equal(preview.expiresAt, clock + 60000);
  assert.equal(signed.path, value.playback.path); assert.equal(signed.opts.queryParams.generation, '8');
  assert.ok(!signed.path.endsWith('original'));
  await deny(decide('secure', value.version - 1), 'failed-precondition');
  await business.update({ mediaCount: 100 });
  await deny(decide('secure', value.version), 'resource-exhausted');
  await business.update({ mediaCount: 0 });
  const results = await Promise.all([decide('secure', value.version), decide('secure', value.version)]);
  assert.deepEqual(results[0], results[1]);
  assert.equal((await business.get()).data().mediaCount, 1);
  const media = (await business.collection('media').doc(results[0].mediaId).get()).data();
  assert.deepEqual(media.playback, value.playback); assert.equal(media.status, 'ready');
  assert.equal((await business.collection('locations').get()).size, 0);
});

test('archive or owner revocation during decoding prevents promotion, with bounded transient retries', async () => {
  await seed('revoked');
  onDecode = () => business.collection('advertisers').doc('client').update({ active: false });
  await deny(service.validateSubmission(req('revoked')), 'failed-precondition');
  assert.equal((await record('revoked').get()).data().status, 'submitted');
  await business.collection('advertisers').doc('client').update({ active: true });
  onDecode = () => business.collection('members').doc('owner').update({ active: false });
  await deny(service.validateSubmission(req('revoked')), 'permission-denied');
  await business.collection('members').doc('owner').update({ active: true });
  onDecode = async () => { throw Error('temporary'); };
  await assert.rejects(service.validateSubmission(req('revoked')), /temporary/);
  onDecode = undefined;
  await deny(service.validateSubmission(req('revoked')), 'resource-exhausted');
});

test('declining requires a reason and withdrawal denies new screen manifests even after trial expiry', async () => {
  await seed('decline'); await service.validateSubmission(req('decline'));
  const v = (await record('decline').get()).data().version;
  await deny(decide('decline', v, 'reject'), 'invalid-argument');
  await decide('decline', v, 'reject', 'Please update the offer.');
  assert.equal((await business.collection('media').doc('submission_decline').get()).exists, false);
  await business.collection('devices').doc('screen').set({ active: true, locationId: 'main', screenId: 'one' });
  await business.collection('locations').doc('main').collection('screens').doc('one').set({
    active: true, deviceId: 'screen', version: 1, mediaId: 'submission_secure' });
  const device = { data: {}, app: { appId: 'test' }, auth: { uid: 'screen', token: {
    device: true, businessId: business.id, auth_time: Math.floor(Date.now() / 1000) } } };
  const manifest = await playback.getScreenPlayback(device);
  assert.ok(manifest.expiresAt > clock);
  const version = (await record('secure').get()).data().version;
  await decide('secure', version, 'withdraw', 'Offer ended.');
  await deny(playback.getScreenPlayback(device), 'failed-precondition');
  assert.equal((await business.collection('media').doc('submission_secure').get()).data().status, 'withdrawn');
  await business.collection('entitlements').doc('current').update({ trialEndsAt: Timestamp.fromMillis(clock - 1) });
  await decide('secure', version, 'withdraw', 'Offer ended.');
  await deny(service.previewSubmission(req('secure')), 'failed-precondition');
});
