import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { cleanupGraceMs } from './media.js';

export const cleanupStates = ['uploading', 'rejected', 'validation-failed', 'declined', 'retiring'];
export const listedSubmissionStates = ['uploading', 'submitted', 'rejected', 'validating',
  'validation-failed', 'review', 'approved', 'declined', 'withdrawn', 'retiring'];
export function cleanupAfter(value) {
  const expiry = value.expiresAt?.toMillis();
  return cleanupStates.includes(value.status) && Number.isFinite(expiry) && !value.mediaId
    ? Math.max(expiry + cleanupGraceMs, (value.leaseUntil?.toMillis() ?? 0) + 60000) : null;
}
const fail = message => { throw new HttpsError('failed-precondition', message); };
function owner(member) {
  if (member.data()?.active !== true || member.data()?.role !== 'owner') {
    throw new HttpsError('permission-denied', 'Active business ownership is required.');
  }
}
function accounting(meta, client, size) {
  if (!Number.isSafeInteger(size) || size < 12 || size > 20 * 1024 ** 2
    || !Number.isSafeInteger(meta?.submissionCount) || meta.submissionCount < 1
    || !Number.isSafeInteger(meta?.submissionBytes) || meta.submissionBytes < size
    || !Number.isSafeInteger(client?.submissionCount) || client.submissionCount < 1) {
    fail('Submission accounting needs administrator review. No allowance was released.');
  }
}

export function createSubmissionCleanup({ firestore: db, auth, bucket, now = () => Date.now() }) {
  async function cleanupSubmission(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'submissionId', 'expectedVersion']);
    const { expectedVersion } = request.data;
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) throw new HttpsError('invalid-argument', 'Refresh the submission before cleaning it.');
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const ref = business.collection('submissions').doc(identifier(request.data.submissionId));
    const promoted = business.collection('media').doc(`submission_${ref.id}`);
    const member = business.collection('members').doc(user.uid);
    const value = await db.runTransaction(async tx => {
      const [membership, entry, media, meta] = await tx.getAll(member, ref, promoted, business);
      owner(membership);
      const v = entry.data();
      if (!v) fail('Submission unavailable.');
      if (v.status === 'deleted') return null;
      if (v.status === 'retiring' ? v.cleanupVersion !== expectedVersion : (v.version ?? 1) !== expectedVersion) {
        fail('This submission changed. Refresh before cleaning it.');
      }
      const eligible = cleanupAfter(v);
      if (eligible === null || eligible > now() || media.exists) fail('This file is not eligible for cleanup. Approved or withdrawn library media is retained.');
      const client = await tx.get(business.collection('advertisers').doc(identifier(v.advertiserId)));
      accounting(meta.data(), client.data(), v.size);
      // Derive paths rather than trusting stored paths; never delete outside this reservation.
      const prefix = `businesses/${business.id}/submissions/${ref.id}`;
      if (v.path !== `${prefix}/original` || (v.playback && ![
        `${prefix}/validated-v1.webp`, `${prefix}/validated-v1.mp4`,
      ].includes(v.playback.path))) fail('Submission storage needs administrator review.');
      if (v.status !== 'retiring') tx.update(ref, { status: 'retiring', cleanupVersion: expectedVersion,
        version: expectedVersion + 1, cleanupStartedAt: Timestamp.fromMillis(now()), cleanupFrom: v.status });
      return { ...v, prefix };
    });
    if (!value) return { removed: false, alreadyCleaned: true };
    // Eight days outlast signed PUTs and resumable upload sessions. Include orphaned
    // decoder output from an interrupted validation, without listing unrelated objects.
    for (const suffix of ['original', 'validated-v1.webp', 'validated-v1.mp4']) {
      owner(await member.get());
      const path = `${value.prefix}/${suffix}`;
      try {
        const [meta] = await bucket().file(path).getMetadata();
        await bucket().file(path, { generation: meta.generation }).delete({ ifGenerationMatch: meta.generation });
      } catch (error) { if (Number(error.code) !== 404) throw error; }
    }
    return db.runTransaction(async tx => {
      const clientRef = business.collection('advertisers').doc(value.advertiserId);
      const [membership, entry, meta, client, media] = await tx.getAll(member, ref, business, clientRef, promoted);
      owner(membership);
      const v = entry.data();
      if (v?.status === 'deleted') return { removed: false, alreadyCleaned: true };
      if (v?.status !== 'retiring' || v.cleanupVersion !== expectedVersion || media.exists) fail('Cleanup changed. Refresh and retry.');
      accounting(meta.data(), client.data(), v.size);
      tx.update(business, { submissionCount: meta.data().submissionCount - 1, submissionBytes: meta.data().submissionBytes - v.size });
      tx.update(clientRef, { submissionCount: client.data().submissionCount - 1 });
      // Keep the reservation tombstone: reusing a previous request must never reopen uploads.
      tx.update(ref, { status: 'deleted', version: v.version + 1, cleanedAt: Timestamp.fromMillis(now()) });
      tx.create(business.collection('audit').doc(`submission-cleaned-${ref.id}`), {
        type: 'submission.cleaned', submissionId: ref.id, advertiserId: value.advertiserId,
        actorUid: user.uid, bytesReleased: v.size, createdAt: Timestamp.fromMillis(now()),
      });
      return { removed: true, bytesReleased: v.size };
    });
  }
  return { cleanupSubmission };
}
