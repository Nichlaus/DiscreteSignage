import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';

const types = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
export const cleanupGraceMs = 8 * 86400000;
const fail = (code, message) => { throw new HttpsError(code, message); };
function owner(member) {
  if (member.data()?.active !== true || member.data()?.role !== 'owner') fail('permission-denied', 'Active business ownership is required.');
}
function trial(snapshot, now) {
  const value = snapshot.data();
  if (value?.source !== 'trial' || !value.trialModules?.includes('screens')
    || !(value.trialStartedAt?.toMillis() <= now) || !(value.trialEndsAt?.toMillis() > now)) {
    fail('failed-precondition', 'An active screens trial is required.');
  }
}
export function matchesSignature(type, bytes) {
  const ascii = (start, end) => bytes.subarray(start, end).toString('ascii');
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/webp') return ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP';
  if (type === 'video/mp4') return bytes.length >= 16 && ascii(4, 8) === 'ftyp';
  if (type === 'video/webm') return bytes.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  return false;
}
export async function stripDownloadToken(file) {
  const [metadata] = await file.getMetadata();
  if (metadata.metadata?.firebaseStorageDownloadTokens) {
    await file.setMetadata({ metadata: { firebaseStorageDownloadTokens: null } },
      { ifMetagenerationMatch: metadata.metageneration });
  }
  return metadata;
}

export function createMedia({ firestore: db, auth, bucket, now = () => Date.now() }) {
  async function beginMediaUpload(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'requestId', 'name', 'contentType', 'size']);
    const { name, contentType, size } = request.data;
    if (typeof name !== 'string' || name.trim().length < 1 || name.length > 150
      || /[\u0000-\u001f\u007f]/u.test(name) || !types.includes(contentType)
      || !Number.isSafeInteger(size) || size < 12 || size > (contentType.startsWith('image/') ? 20 : 100) * 1024 * 1024) {
      fail('invalid-argument', 'Choose a supported image up to 20 MiB or video up to 100 MiB.');
    }
    const businessId = identifier(request.data.businessId);
    const requestId = identifier(request.data.requestId);
    const business = db.doc(`businesses/${businessId}`);
    const mediaId = createHash('sha256').update(`${user.uid}:${requestId}`).digest('hex');
    const ref = business.collection('media').doc(mediaId);
    const path = `businesses/${businessId}/media/${mediaId}/original`;
    return db.runTransaction(async tx => {
      const [member, entitlement, current, meta] = await tx.getAll(
        business.collection('members').doc(user.uid), business.collection('entitlements').doc('current'), ref, business);
      owner(member); trial(entitlement, now());
      if (!meta.exists) fail('not-found', 'Business unavailable.');
      if (current.exists) {
        const value = current.data();
        if (value.name !== name.trim() || value.size !== size || value.contentType !== contentType) fail('already-exists', 'Upload request already used for another file.');
        if (value.status !== 'uploading' || value.expiresAt.toMillis() <= now()) fail('failed-precondition', 'This upload reservation is no longer available.');
        return { mediaId, path, expiresAt: value.expiresAt.toMillis() };
      }
      const count = meta.data().mediaCount ?? 0, bytes = meta.data().mediaReservedBytes ?? 0;
      if (!Number.isSafeInteger(count) || count < 0 || count >= 100
        || !Number.isSafeInteger(bytes) || bytes < 0 || bytes + size > 1024 ** 3) {
        fail('resource-exhausted', 'Media allowance reached. Contact support.');
      }
      const expiresAt = Timestamp.fromMillis(Math.min(now() + 30 * 60000, entitlement.data().trialEndsAt.toMillis()));
      tx.create(ref, { name: name.trim(), contentType, size, path, createdBy: user.uid,
        status: 'uploading', expiresAt, createdAt: Timestamp.fromMillis(now()) });
      tx.update(business, { mediaCount: count + 1, mediaReservedBytes: bytes + size });
      return { mediaId, path, expiresAt: expiresAt.toMillis() };
    });
  }
  async function authorizeMediaUpload(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'mediaId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const mediaId = identifier(request.data.mediaId);
    const [member, entitlement, entry] = await db.getAll(
      business.collection('members').doc(user.uid), business.collection('entitlements').doc('current'),
      business.collection('media').doc(mediaId));
    owner(member); trial(entitlement, now());
    const value = entry.data();
    if (!value || value.createdBy !== user.uid) fail('permission-denied', 'Upload unavailable.');
    const expiresAt = Math.min(now() + 5 * 60000, value.expiresAt.toMillis(),
      entitlement.data().trialEndsAt.toMillis());
    if (value.status !== 'uploading' || expiresAt <= now()) fail('failed-precondition', 'Upload reservation expired.');
    // All x-goog headers must be signed: clients cannot add download-token metadata,
    // turn this PUT into a resumable session, change its size, or overwrite an object.
    const headers = {
      'Content-Type': value.contentType,
      'x-goog-content-length-range': `${value.size},${value.size}`,
      'x-goog-if-generation-match': '0',
      'x-goog-meta-reservation': mediaId,
    };
    const [url] = await bucket().file(value.path).getSignedUrl({
      version: 'v4', action: 'write', expires: expiresAt,
      contentType: value.contentType,
      extensionHeaders: Object.fromEntries(Object.entries(headers).filter(([key]) => key.startsWith('x-goog-'))),
    });
    return { url, headers, expiresAt };
  }
  async function completeMediaUpload(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'mediaId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const mediaId = identifier(request.data.mediaId);
    const ref = business.collection('media').doc(mediaId);
    const [member, entry] = await db.getAll(business.collection('members').doc(user.uid), ref);
    owner(member);
    const value = entry.data();
    if (!value || value.createdBy !== user.uid) fail('permission-denied', 'Upload unavailable.');
    if (value.status !== 'uploading') return { status: value.status };
    const file = bucket().file(value.path);
    let metadata, bytes;
    try {
      [metadata] = await file.getMetadata();
      await stripDownloadToken(bucket().file(value.path, { generation: metadata.generation }));
      // Inspect the exact immutable generation whose metadata we checked.
      [bytes] = await bucket().file(value.path, { generation: metadata.generation }).download({ start: 0, end: 31 });
    } catch (error) {
      if (Number(error.code) === 404) fail('failed-precondition', 'Upload the file before confirming it.');
      throw error;
    }
    const status = Number(metadata.size) === value.size && metadata.contentType === value.contentType
      && matchesSignature(value.contentType, bytes) ? 'uploaded' : 'rejected';
    return db.runTransaction(async tx => {
      const [freshMember, fresh, entitlement] = await tx.getAll(business.collection('members').doc(user.uid),
        ref, business.collection('entitlements').doc('current'));
      owner(freshMember); trial(entitlement, now());
      if (fresh.data()?.status !== 'uploading') return { status: fresh.data()?.status };
      tx.update(ref, { status, generation: String(metadata.generation), completedAt: Timestamp.fromMillis(now()) });
      tx.create(business.collection('audit').doc(`media-${mediaId}`), {
        type: `media.${status}`, mediaId, actorUid: user.uid, createdAt: Timestamp.fromMillis(now()),
      });
      return { status };
    });
  }
  async function listMedia(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    owner(await business.collection('members').doc(user.uid).get());
    const result = await business.collection('media').where('status', 'in',
      ['uploading', 'uploaded', 'rejected', 'retiring']).limit(100).get();
    return { items: result.docs.sort((a, b) => b.data().createdAt.toMillis() - a.data().createdAt.toMillis()).map(d => {
      const value = d.data();
      return { id: d.id, name: value.name, size: value.size, contentType: value.contentType,
        status: value.status === 'uploading' && value.expiresAt.toMillis() <= now() ? 'expired' : value.status };
    }) };
  }
  async function cleanupMedia(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    owner(await business.collection('members').doc(user.uid).get());
    // A full scan is bounded by the 100-reservation cap, avoiding a new query index.
    const entries = await business.collection('media').where('status', 'in',
      ['uploading', 'rejected', 'retiring']).limit(100).get();
    const cutoff = now() - cleanupGraceMs;
    let removed = 0;
    for (const entry of entries.docs.filter(d => d.data().expiresAt.toMillis() <= cutoff).slice(0, 25)) {
      const value = await db.runTransaction(async tx => {
        const [member, fresh] = await tx.getAll(business.collection('members').doc(user.uid), entry.ref);
        owner(member);
        const data = fresh.data();
        if (!data || !['uploading', 'rejected', 'retiring'].includes(data.status)
          || data.expiresAt.toMillis() > cutoff) return null;
        tx.update(entry.ref, { status: 'retiring' });
        return data;
      });
      if (!value) continue;
      // Upload sessions can live a week. Wait eight days after reservation expiry
      // before deleting bytes/releasing quota, so an in-flight upload cannot arrive later.
      try {
        const [metadata] = await bucket().file(value.path).getMetadata();
        await bucket().file(value.path, { generation: metadata.generation })
          .delete({ ifGenerationMatch: metadata.generation });
      } catch (error) {
        if (Number(error.code) !== 404) throw error; // Retiring state permits a safe retry.
      }
      const released = await db.runTransaction(async tx => {
        const [member, fresh, meta] = await tx.getAll(business.collection('members').doc(user.uid), entry.ref, business);
        owner(member);
        if (fresh.data()?.status !== 'retiring') return false;
        const count = meta.data()?.mediaCount, bytes = meta.data()?.mediaReservedBytes;
        if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(bytes) || bytes < value.size) {
          fail('failed-precondition', 'Media accounting needs administrator review.');
        }
        tx.update(business, { mediaCount: count - 1, mediaReservedBytes: bytes - value.size });
        tx.update(entry.ref, { status: 'deleted', cleanedAt: Timestamp.fromMillis(now()) });
        tx.create(business.collection('audit').doc(`media-cleaned-${entry.id}`), {
          type: 'media.cleaned', mediaId: entry.id, actorUid: user.uid, createdAt: Timestamp.fromMillis(now()),
        });
        return true;
      });
      if (released) removed++;
    }
    return { removed };
  }
  return { beginMediaUpload, authorizeMediaUpload, completeMediaUpload, listMedia, cleanupMedia };
}
