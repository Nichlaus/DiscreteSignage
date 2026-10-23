import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { requireAdvertiser } from './advertisers.js';
import { matchesSignature, stripDownloadToken } from './media.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
const types = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
export function createSubmissions({ firestore: db, auth, bucket, now = () => Date.now() }) {
  const businessRef = data => db.doc(`businesses/${identifier(data.businessId)}`);
  async function reservation(tx, data, user) {
    const business = businessRef(data);
    const access = await requireAdvertiser(tx, business, data.advertiserId, user, now());
    const ref = business.collection('submissions').doc(identifier(data.submissionId));
    const entry = await tx.get(ref), value = entry.data();
    if (!value || value.advertiserId !== data.advertiserId || value.createdBy !== user.uid
      || value.clientVersion !== access.value.version) fail('permission-denied', 'Submission unavailable.');
    return { business, ref, value, access };
  }
  async function beginClientSubmission(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'advertiserId', 'requestId', 'name', 'contentType', 'size']);
    const { name, contentType, size, advertiserId } = request.data;
    if (typeof name !== 'string' || !name.trim() || name.length > 150 || /[\u0000-\u001f\u007f]/u.test(name)
      || !types.includes(contentType) || !Number.isSafeInteger(size) || size < 12 || size > 20 * 1024 ** 2) {
      fail('invalid-argument', 'Choose a JPG, PNG, WebP, MP4 or WebM file up to 20 MiB.');
    }
    const business = businessRef(request.data);
    const id = createHash('sha256').update(`${user.uid}:${identifier(advertiserId)}:${identifier(request.data.requestId)}`).digest('hex');
    const ref = business.collection('submissions').doc(id);
    return db.runTransaction(async tx => {
      const access = await requireAdvertiser(tx, business, advertiserId, user, now());
      const [meta, existing] = await tx.getAll(business, ref);
      if (!meta.exists) fail('not-found', 'Business unavailable.');
      const old = existing.data();
      if (old) {
        if (old.name !== name.trim() || old.size !== size || old.contentType !== contentType) fail('already-exists', 'This upload request was used for another file.');
        if (old.clientVersion !== access.value.version || old.status !== 'uploading' || old.expiresAt.toMillis() <= now()) fail('failed-precondition', 'This reservation is no longer available.');
        return { submissionId: id };
      }
      const count = meta.data().submissionCount ?? 0, bytes = meta.data().submissionBytes ?? 0;
      const clientCount = access.value.submissionCount ?? 0;
      if (!Number.isSafeInteger(count) || count < 0 || count >= 100 || !Number.isSafeInteger(bytes) || bytes < 0
        || bytes + size > 1024 ** 3 || !Number.isSafeInteger(clientCount) || clientCount < 0 || clientCount >= 20) {
        fail('resource-exhausted', 'Submission allowance reached. Contact the business.');
      }
      const expiresAt = Timestamp.fromMillis(Math.min(now() + 30 * 60000, access.trialEndsAt));
      tx.create(ref, { advertiserId, createdBy: user.uid, clientVersion: access.value.version,
        name: name.trim(), size, contentType, status: 'uploading', createdAt: Timestamp.fromMillis(now()), expiresAt,
        path: `businesses/${business.id}/submissions/${id}/original` });
      tx.update(business, { submissionCount: count + 1, submissionBytes: bytes + size });
      tx.update(access.client, { submissionCount: clientCount + 1 });
      return { submissionId: id };
    });
  }
  async function authorizeClientSubmission(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'advertiserId', 'submissionId']);
    const { value, access } = await db.runTransaction(tx => reservation(tx, request.data, user));
    const expiresAt = Math.min(now() + 5 * 60000, value.expiresAt.toMillis(), access.trialEndsAt);
    if (value.status !== 'uploading' || expiresAt <= now()) fail('failed-precondition', 'Upload reservation expired.');
    const headers = { 'Content-Type': value.contentType, 'x-goog-content-length-range': `${value.size},${value.size}`,
      'x-goog-if-generation-match': '0', 'x-goog-meta-reservation': request.data.submissionId };
    const [url] = await bucket().file(value.path).getSignedUrl({ version: 'v4', action: 'write', expires: expiresAt,
      contentType: value.contentType, extensionHeaders: Object.fromEntries(Object.entries(headers).filter(([k]) => k.startsWith('x-goog-'))) });
    return { url, headers, expiresAt };
  }
  async function completeClientSubmission(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'advertiserId', 'submissionId']);
    const first = await db.runTransaction(tx => reservation(tx, request.data, user));
    if (first.value.status !== 'uploading') return { status: first.value.status };
    if (first.value.expiresAt.toMillis() <= now()) fail('failed-precondition', 'Upload reservation expired.');
    let metadata, bytes;
    try {
      [metadata] = await bucket().file(first.value.path).getMetadata();
      const file = bucket().file(first.value.path, { generation: metadata.generation });
      await stripDownloadToken(file);
      [bytes] = await file.download({ start: 0, end: 31 });
    } catch (e) {
      if (Number(e.code) === 404) fail('failed-precondition', 'Upload the file before confirming it.');
      throw e;
    }
    const status = Number(metadata.size) === first.value.size && metadata.contentType === first.value.contentType
      && matchesSignature(first.value.contentType, bytes) ? 'submitted' : 'rejected';
    return db.runTransaction(async tx => {
      const { value, ref, business } = await reservation(tx, request.data, user);
      if (value.status !== 'uploading') return { status: value.status };
      if (value.expiresAt.toMillis() <= now()) fail('failed-precondition', 'Upload reservation expired.');
      tx.update(ref, { status, generation: String(metadata.generation), completedAt: Timestamp.fromMillis(now()) });
      tx.create(business.collection('audit').doc(`submission-${ref.id}`), { type: `submission.${status}`,
        advertiserId: value.advertiserId, submissionId: ref.id, actorUid: user.uid, createdAt: Timestamp.fromMillis(now()) });
      return { status };
    });
  }
  function items(snapshot) {
    return snapshot.docs.map(d => { const v = d.data(); return { id: d.id, advertiserId: v.advertiserId,
      name: v.name, size: v.size, contentType: v.contentType,
      version: v.version ?? 1, reason: v.reviewReason || v.validationError || '',
      canValidate: (v.validationAttempts ?? 0) < 3 && (v.status === 'submitted'
        || (v.status === 'validating' && v.leaseUntil?.toMillis() <= now())),
      status: v.status === 'uploading' && v.expiresAt.toMillis() <= now() ? 'expired' : v.status }; });
  }
  async function listClientSubmissions(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'advertiserId']);
    const business = businessRef(request.data);
    return db.runTransaction(async tx => {
      await requireAdvertiser(tx, business, request.data.advertiserId, user, now());
      return { items: items(await tx.get(business.collection('submissions').where('advertiserId', '==', request.data.advertiserId).limit(20))) };
    });
  }
  async function listAdvertiserSubmissions(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId']);
    const business = businessRef(request.data);
    return db.runTransaction(async tx => {
      const member = await tx.get(business.collection('members').doc(user.uid));
      if (member.data()?.active !== true || member.data()?.role !== 'owner') fail('permission-denied', 'Active business ownership is required.');
      return { items: items(await tx.get(business.collection('submissions').limit(100))) };
    });
  }
  return { beginClientSubmission, authorizeClientSubmission, completeClientSubmission, listClientSubmissions, listAdvertiserSubmissions };
}
