import { screenLayout } from './layout.js';
import { scheduledRegions } from './schedule.js';
import { screenPlaylist } from './playlist.js';
import { randomUUID, createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { decodeImage, InvalidMedia } from './image-validation.js';
import { decodeVideo, videoWorkerConfigured } from './video-validation.js';

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
const decodeMedia = (bytes, type) => type.startsWith('video/') ? decodeVideo(bytes, type) : decodeImage(bytes, type);
export function createPlayback({ firestore: db, auth, bucket, now = () => Date.now(), decode = decodeMedia }) {
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
      if (!['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'].includes(value.contentType)) {
        fail('failed-precondition', 'Unsupported media type.');
      }
      if (value.size > 20 * 1024 * 1024) fail('failed-precondition', 'Playback validation supports files up to 20 MiB.');
      if (value.contentType.startsWith('video/') && decode === decodeMedia && !videoWorkerConfigured()) {
        fail('failed-precondition', 'Video processing is not configured yet.');
      }
      if (value.status !== 'uploaded' && !(value.status === 'validating' && value.leaseUntil.toMillis() <= now())) {
        fail('failed-precondition', 'Media is unavailable or validation is already running.');
      }
      if ((value.validationAttempts ?? 0) >= 3) fail('resource-exhausted', 'Validation retry limit reached. Contact support.');
      tx.update(ref, { status: 'validating', validationLease: lease, validationError: null,
        leaseUntil: Timestamp.fromMillis(now() + 210000), validationAttempts: (value.validationAttempts ?? 0) + 1 });
      return value;
    });
    if (!value) return { status: 'ready' };
    try {
      const original = bucket().file(value.path, { generation: value.generation });
      const [metadata] = await original.getMetadata();
      if (Number(metadata.size) !== value.size || value.size > 20 * 1024 * 1024
        || metadata.contentType !== value.contentType) throw new InvalidMedia('Original metadata mismatch.');
      const [bytes] = await original.download({ start: 0, end: value.size - 1 });
      if (bytes.length !== value.size) throw new InvalidMedia('Incomplete media.');
      const result = await decode(bytes, value.contentType);
      const video = value.contentType.startsWith('video/');
      const policy = video ? 'video-v1' : 'image-v1';
      const hash = createHash('sha256').update(result.bytes).digest('hex');
      const path = `businesses/${business.id}/media/${ref.id}/playback-v1.${video ? 'mp4' : 'webp'}`;
      const derived = bucket().file(path);
      try {
        await derived.save(result.bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
          metadata: { contentType: result.contentType, cacheControl: 'private, no-store',
            metadata: { sha256: hash, validationPolicy: policy } } });
      } catch (error) {
        if (Number(error.code) !== 412) throw error; // A prior attempt may have saved before losing its response.
      }
      const [saved] = await derived.getMetadata();
      if (saved.metadata?.sha256 !== hash || saved.metadata?.validationPolicy !== policy
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
          policy, ...(video ? { duration: result.duration } : {}) }, validatedAt: Timestamp.fromMillis(now()) });
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
      const design = screenLayout(value);
      let definitions = [screenPlaylist(value)];
      if (design.layout !== 'single') definitions.push(design.secondaryPlaylist);
      const location = definitions.flat().some(item => item.schedule)
        ? (await tx.get(business.collection('locations').doc(registration.locationId))).data() : null;
      const scheduled = scheduledRegions(definitions, location?.timezone, now());
      definitions = scheduled.regions;
      const expiresAt = Math.min(scheduled.expiresAt, trial.data().trialEndsAt.toMillis());
      const assets = new Map();
      for (const id of new Set([...definitions.flat(), ...(design.logo ? [design.logo] : [])].map(item => item.mediaId))) {
        const media = (await tx.get(business.collection('media').doc(id))).data();
        if (media?.status !== 'ready' || !['image-v1', 'video-v1'].includes(media.playback?.policy)
          || (id === design.logo?.mediaId && media.playback.policy !== 'image-v1')) {
          fail('failed-precondition', 'Assigned media is not ready.');
        }
        assets.set(id, { id, ...media.playback });
      }
      const regions = definitions.map(items => items.map(item => ({
        duration: assets.get(item.mediaId).contentType === 'video/mp4' ? assets.get(item.mediaId).duration : item.duration,
        asset: assets.get(item.mediaId),
      })));
      return { version: value.version, expiresAt, regions, logo: design.logo ? assets.get(design.logo.mediaId) : null };
    });
    const signed = new Map();
    const sign = asset => {
      if (!signed.has(asset.id)) signed.set(asset.id, (async () => {
        const { path, generation, ...publicAsset } = asset;
        const [url] = await bucket().file(path).getSignedUrl({ version: 'v4', action: 'read',
          expires: manifest.expiresAt, queryParams: { generation } });
        return { ...publicAsset, generation, url };
      })());
      return signed.get(asset.id);
    };
    const regions = await Promise.all(manifest.regions.map(items => Promise.all(items.map(async item =>
      ({ duration: item.duration, asset: await sign(item.asset) })))));
    const logo = manifest.logo ? await sign(manifest.logo) : null;
    // Preserve the first region for older players during rollout.
    return { version: manifest.version, expiresAt: manifest.expiresAt, regions, logo,
      items: regions[0], asset: regions[0][0]?.asset ?? null };
  }
  return { validateMedia, getScreenPlayback };
}
