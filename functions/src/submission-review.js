import { randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { InvalidMedia } from './image-validation.js';
import { videoWorkerConfigured } from './video-validation.js';
import { decodeMedia, mediaDerivative } from './media-derivative.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
export function createSubmissionReview({ firestore: db, auth, bucket, now = () => Date.now(), decode = decodeMedia }) {
  function refs(data) {
    const business = db.doc(`businesses/${identifier(data.businessId)}`);
    return { business, ref: business.collection('submissions').doc(identifier(data.submissionId)) };
  }
  async function access(tx, business, ref, user, active = true) {
    const [owner, trial, record] = await tx.getAll(business.collection('members').doc(user.uid),
      business.collection('entitlements').doc('current'), ref);
    if (owner.data()?.active !== true || owner.data()?.role !== 'owner') fail('permission-denied', 'Active business ownership is required.');
    const value = record.data(), t = trial.data();
    if (!value) fail('not-found', 'Submission unavailable.');
    if (active) {
      if (t?.source !== 'trial' || !t.trialModules?.includes('screens') || !(t.trialStartedAt?.toMillis() <= now())
        || !(t.trialEndsAt?.toMillis() > now())) fail('failed-precondition', 'An active screens trial is required.');
      const client = await tx.get(business.collection('advertisers').doc(value.advertiserId));
      if (client.data()?.active !== true || client.data()?.version !== value.clientVersion) fail('failed-precondition', 'This submission belongs to an inactive or changed client.');
    }
    return { value, trialEndsAt: t?.trialEndsAt?.toMillis() };
  }
  async function validateSubmission(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'submissionId']);
    const { business, ref } = refs(request.data), lease = randomUUID();
    const value = await db.runTransaction(async tx => {
      const { value } = await access(tx, business, ref, user);
      if (['review', 'approved'].includes(value.status)) return null;
      if (value.status !== 'submitted' && !(value.status === 'validating' && value.leaseUntil?.toMillis() <= now())) fail('failed-precondition', 'Submission is unavailable or already being checked.');
      if ((value.validationAttempts ?? 0) >= 3) fail('resource-exhausted', 'Validation retry limit reached.');
      if (value.contentType.startsWith('video/') && decode === decodeMedia && !videoWorkerConfigured()) fail('failed-precondition', 'Video processing is not configured.');
      tx.update(ref, { status: 'validating', version: (value.version ?? 1) + 1, validationLease: lease,
        leaseUntil: Timestamp.fromMillis(now() + 210000), validationAttempts: (value.validationAttempts ?? 0) + 1 });
      return value;
    });
    if (!value) return { validated: true };
    try {
      const path = `businesses/${business.id}/submissions/${ref.id}/validated-v1.${value.contentType.startsWith('video/') ? 'mp4' : 'webp'}`;
      const playback = await mediaDerivative(bucket(), value, path, decode);
      await db.runTransaction(async tx => {
        const { value: current } = await access(tx, business, ref, user);
        if (current.status !== 'validating' || current.validationLease !== lease) fail('aborted', 'Validation was superseded.');
        tx.update(ref, { status: 'review', playback, version: current.version + 1, validationError: null });
        tx.create(business.collection('audit').doc(`submission-validated-${ref.id}`), {
          type: 'submission.validated', submissionId: ref.id, actorUid: user.uid, createdAt: Timestamp.fromMillis(now()),
        });
      });
      return { validated: true };
    } catch (error) {
      await db.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        if (current?.status === 'validating' && current.validationLease === lease) tx.update(ref, {
          status: error instanceof InvalidMedia ? 'validation-failed' : 'submitted', version: current.version + 1,
          validationError: error instanceof InvalidMedia ? error.message : 'Validation interrupted. Retry or contact support.',
        });
      });
      if (error instanceof InvalidMedia) return { validated: false };
      throw error;
    }
  }
  async function previewSubmission(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'submissionId']);
    const { business, ref } = refs(request.data);
    const { value, trialEndsAt } = await db.runTransaction(tx => access(tx, business, ref, user));
    if (!['review', 'approved'].includes(value.status) || !['image-v1', 'video-v1'].includes(value.playback?.policy)) fail('failed-precondition', 'Validate this submission before previewing it.');
    const p = value.playback, expiresAt = Math.min(now() + 60000, trialEndsAt);
    const [url] = await bucket().file(p.path).getSignedUrl({ version: 'v4', action: 'read', expires: expiresAt,
      queryParams: { generation: p.generation }, responseType: p.contentType });
    return { url, contentType: p.contentType, expiresAt, version: value.version };
  }
  async function reviewSubmission(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'submissionId', 'expectedVersion', 'decision', 'reason']);
    const { decision, reason, expectedVersion } = request.data;
    if (!['approve', 'reject', 'withdraw'].includes(decision) || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1
      || typeof reason !== 'string' || reason.length > 300 || /[\u0000-\u001f\u007f]/u.test(reason)
      || (decision !== 'approve' && !reason.trim())) fail('invalid-argument', 'Choose a decision and give a short reason for rejection or withdrawal.');
    const { business, ref } = refs(request.data), mediaId = `submission_${ref.id}`;
    const media = business.collection('media').doc(mediaId);
    return db.runTransaction(async tx => {
      const { value } = await access(tx, business, ref, user, decision === 'approve');
      const target = { approve: 'approved', reject: 'declined', withdraw: 'withdrawn' }[decision];
      if (value.status === target && value.version === expectedVersion + 1 && value.reviewReason === reason.trim()) return { status: target, mediaId: value.mediaId ?? null };
      if ((value.version ?? 1) !== expectedVersion) fail('failed-precondition', 'This submission changed. Refresh before reviewing it.');
      if (decision === 'withdraw' ? value.status !== 'approved' : value.status !== 'review') fail('failed-precondition', 'This decision is not available for the submission.');
      const [meta, existing] = await tx.getAll(business, media);
      const version = expectedVersion + 1;
      if (decision === 'approve') {
        if (!['image-v1', 'video-v1'].includes(value.playback?.policy) || existing.exists) fail('failed-precondition', 'Validated media is unavailable.');
        const count = meta.data()?.mediaCount ?? 0, bytes = meta.data()?.mediaReservedBytes ?? 0;
        if (!Number.isSafeInteger(count) || count < 0 || count >= 100 || !Number.isSafeInteger(bytes) || bytes < 0 || bytes + value.size > 1024 ** 3) fail('resource-exhausted', 'Media allowance reached.');
        tx.create(media, { name: value.name, contentType: value.contentType, size: value.size,
          path: value.path, generation: value.generation, playback: value.playback, status: 'ready',
          sourceSubmissionId: ref.id, advertiserId: value.advertiserId, createdBy: value.createdBy,
          createdAt: Timestamp.fromMillis(now()), approvedBy: user.uid });
        tx.update(business, { mediaCount: count + 1, mediaReservedBytes: bytes + value.size });
      }
      if (decision === 'withdraw') {
        if (existing.data()?.sourceSubmissionId !== ref.id) fail('failed-precondition', 'Approved media needs administrator review.');
        tx.update(media, { status: 'withdrawn' });
      }
      tx.update(ref, { status: target, version, reviewReason: reason.trim(), ...(decision === 'approve' ? { mediaId } : {}) });
      tx.create(business.collection('audit').doc(`submission-review-${ref.id}-${version}`), {
        type: `submission.${target}`, submissionId: ref.id, actorUid: user.uid, createdAt: Timestamp.fromMillis(now()),
      });
      return { status: target, mediaId: decision === 'approve' ? mediaId : value.mediaId ?? null };
    });
  }
  return { validateSubmission, previewSubmission, reviewSubmission };
}
