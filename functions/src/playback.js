import { randomUUID, createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { decodeImage, InvalidMedia } from './image-validation.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
function owner(member) {
  if (!member?.active || member.role !== 'owner') fail('permission-denied', 'Active business ownership required.');
}
function entitlement(value, now) {
  if (value?.source !== 'trial' || !value.trialModules?.includes('screens')
    || !(value.trialStartedAt?.toMillis() <= now) || !(value.trialEndsAt?.toMillis() > now)) {
    fail('failed-precondition', 'An active screens trial is required.');
  }
}
export function createPlayback({ firestore: db, auth, bucket, now = () => Date.now(), decode = decodeImage }) {
  async function validateMedia(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'mediaId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const ref = business.collection('media').doc(identifier(request.data.mediaId));
    const lease = randomUUID();
    const value = await db.runTransaction(async tx => {
      const [member, trial, media] = await tx.getAll(business.collection('members').doc(user.uid),
        business.collection('entitlements').doc('current'), ref);
      owner(member.data()); entitlement(trial.data(), now());
      const value = media.data();
      if (!value) fail('not-found', 'Media not found.');
      if (value.status === 'ready') return null;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.contentType)) {
        fail('failed-precondition', 'Video playback validation is not available yet.');
      }
      if (value.status !== 'uploaded' && !(value.status === 'validating' && value.leaseUntil.toMillis() <= now())) {
        fail('failed-precondition', 'Media is unavailable or validation is already running.');
      }
      if ((value.validationAttempts ?? 0) >= 3) fail('resource-exhausted', 'Validation retry limit reached. Contact support.');
      tx.update(ref, { status: 'validating', validationLease: lease, validationError: null,
        leaseUntil: Timestamp.fromMillis(now() + 120000), validationAttempts: (value.validationAttempts ?? 0) + 1 });
      return value;
    });
    if (!value) return { status: 'ready' };
    try {
      const original = bucket().file(value.path, { generation: value.generation });
      const [metadata] = await original.getMetadata();
      if (Number(metadata.size) !== value.size || value.size > 20 * 1024 * 1024
        || metadata.contentType !== value.contentType) throw new InvalidMedia('Original metadata mismatch.');
      const [bytes] = await original.download({ start: 0, end: value.size - 1 });
      if (bytes.length !== value.size) throw new InvalidMedia('Incomplete image.');
      const result = await decode(bytes, value.contentType);
      const hash = createHash('sha256').update(result.bytes).digest('hex');
      const path = `businesses/${business.id}/media/${ref.id}/playback-v1.webp`;
      const derived = bucket().file(path);
      try {
        await derived.save(result.bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
          metadata: { contentType: result.contentType, cacheControl: 'private, no-store',
            metadata: { sha256: hash, validationPolicy: 'image-v1' } } });
      } catch (error) {
        if (Number(error.code) !== 412) throw error; // A prior attempt may have saved before losing its response.
      }
      const [saved] = await derived.getMetadata();
      if (saved.metadata?.sha256 !== hash || saved.metadata?.validationPolicy !== 'image-v1'
        || Number(saved.size) !== result.bytes.length || saved.contentType !== result.contentType
        || saved.cacheControl !== 'private, no-store'
        || saved.metadata?.firebaseStorageDownloadTokens) fail('internal', 'Playback object verification failed.');
      await db.runTransaction(async tx => {
        const [member, trial, current] = await tx.getAll(business.collection('members').doc(user.uid),
          business.collection('entitlements').doc('current'), ref);
        owner(member.data()); entitlement(trial.data(), now());
        if (current.data()?.validationLease !== lease || current.data()?.status !== 'validating') {
          fail('aborted', 'Validation was superseded.');
        }
        tx.update(ref, { status: 'ready', playback: { path, generation: String(saved.generation),
          width: result.width, height: result.height, size: result.bytes.length, contentType: result.contentType,
          policy: 'image-v1' }, validatedAt: Timestamp.fromMillis(now()) });
        tx.create(business.collection('audit').doc(`validated-${ref.id}`),
          { type: 'media.validated', mediaId: ref.id, actorUid: user.uid, createdAt: Timestamp.fromMillis(now()) });
      });
      return { status: 'ready' };
    } catch (error) {
      const status = error instanceof InvalidMedia ? 'validation-failed' : 'uploaded';
      await db.runTransaction(async tx => {
        const current = await tx.get(ref);
        if (current.data()?.validationLease === lease && current.data()?.status === 'validating') {
          tx.update(ref, { status, validationError: error instanceof InvalidMedia ? error.message : 'Validation interrupted. Retry or contact support.' });
        }
      });
      if (error instanceof InvalidMedia) return { status };
      throw error;
    }
  }

  async function getScreenPlayback(request) {
    fields(request.data, []);
    if (!request.app) fail('failed-precondition', 'App verification required.');
    if (!request.auth?.uid || request.auth.token?.device !== true) fail('permission-denied', 'Display identity required.');
    const claims = request.auth.token;
    const businessId = identifier(claims.businessId);
    const user = await auth.getUser(request.auth.uid);
    if (user.disabled || !Number.isFinite(claims.auth_time) || claims.auth_time <= 0
      || claims.auth_time * 1000 < Date.parse(user.tokensValidAfterTime || '1970-01-01')) {
      fail('permission-denied', 'Display access ended.');
    }
    const business = db.doc(`businesses/${businessId}`);
    // One transaction provides a consistent assignment/entitlement snapshot.
    const manifest = await db.runTransaction(async tx => {
      const [device, trial] = await tx.getAll(business.collection('devices').doc(user.uid),
        business.collection('entitlements').doc('current'));
      entitlement(trial.data(), now());
      const registration = device.data();
      if (!registration?.active) fail('permission-denied', 'Display revoked.');
      const screen = await tx.get(business.collection('locations').doc(identifier(registration.locationId))
        .collection('screens').doc(identifier(registration.screenId)));
      const value = screen.data();
      if (!value?.active || value.deviceId !== user.uid) fail('permission-denied', 'Display assignment unavailable.');
      const expiresAt = Math.min(now() + 60000, trial.data().trialEndsAt.toMillis());
      if (!value.mediaId) return { version: value.version, expiresAt, asset: null };
      const media = (await tx.get(business.collection('media').doc(identifier(value.mediaId)))).data();
      if (media?.status !== 'ready' || media.playback?.policy !== 'image-v1') {
        fail('failed-precondition', 'Assigned media is not ready.');
      }
      return { version: value.version, expiresAt, asset: { id: value.mediaId, ...media.playback } };
    });
    if (!manifest.asset) return manifest;
    const { path, generation, ...asset } = manifest.asset;
    const [url] = await bucket().file(path).getSignedUrl({ version: 'v4', action: 'read',
      expires: manifest.expiresAt, queryParams: { generation } });
    return { ...manifest, asset: { ...asset, generation, url } };
  }
  return { validateMedia, getScreenPlayback };
}
