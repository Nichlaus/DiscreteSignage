import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';

export function createScreens({ firestore: db, auth, now = () => Date.now() }) {
  async function updateScreenSettings(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'locationId', 'screenId', 'expectedVersion', 'orientation', 'scaleType',
      ...(Object.hasOwn(request.data ?? {}, 'mediaId') ? ['mediaId'] : [])]);
    const { expectedVersion, orientation, scaleType } = request.data;
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1 || expectedVersion >= Number.MAX_SAFE_INTEGER
      || !['landscape', 'portrait', 'landscape-flipped', 'portrait-flipped'].includes(orientation)
      || !['fit', 'fill', 'stretch'].includes(scaleType)) {
      throw new HttpsError('invalid-argument', 'Choose a supported orientation, scale type and settings version.');
    }
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const locationId = identifier(request.data.locationId);
    const screenId = identifier(request.data.screenId);
    const screen = business.collection('locations').doc(locationId).collection('screens').doc(screenId);
    return db.runTransaction(async tx => {
      const [member, current, trial] = await tx.getAll(business.collection('members').doc(user.uid),
        screen, business.collection('entitlements').doc('current'));
      if (member.data()?.active !== true || member.data()?.role !== 'owner') {
        throw new HttpsError('permission-denied', 'Active business ownership is required.');
      }
      const value = current.data();
      if (!value?.active) throw new HttpsError('failed-precondition', 'This screen is unavailable or revoked.');
      const entitlement = trial.data();
      if (entitlement?.source !== 'trial' || !entitlement.trialModules?.includes('screens')
        || !(entitlement.trialStartedAt?.toMillis() <= now()) || !(entitlement.trialEndsAt?.toMillis() > now())) {
        throw new HttpsError('failed-precondition', 'An active screens trial is required. Contact support.');
      }
      const device = await tx.get(business.collection('devices').doc(value.deviceId));
      if (device.data()?.active !== true || device.data().screenId !== screenId || device.data().locationId !== locationId) {
        throw new HttpsError('failed-precondition', 'Screen registration is unavailable.');
      }
      const mediaId = request.data.mediaId === undefined ? (value.mediaId ?? null)
        : request.data.mediaId === null ? null : identifier(request.data.mediaId);
      if (mediaId) {
        const media = await tx.get(business.collection('media').doc(mediaId));
        if (media.data()?.status !== 'ready' || !['image-v1', 'video-v1'].includes(media.data()?.playback?.policy)) {
          throw new HttpsError('failed-precondition', 'Choose validated media from this business.');
        }
      }
      const same = value.orientation === orientation && value.scaleType === scaleType && (value.mediaId ?? null) === mediaId;
      // Recover a lost response without overwriting a later configuration.
      if (same && (value.version === expectedVersion || value.version === expectedVersion + 1)) {
        return { version: value.version, changed: false };
      }
      if (value.version !== expectedVersion) {
        throw new HttpsError('failed-precondition', 'Settings changed elsewhere. Refresh the screen list and try again.');
      }
      const version = value.version + 1;
      const updatedAt = Timestamp.fromMillis(now());
      tx.update(screen, { orientation, scaleType, mediaId, version, updatedAt });
      tx.create(business.collection('audit').doc(`settings-${screenId}-${version}`), {
        type: 'screen.settings.updated', actorUid: user.uid, screenId, locationId, version,
        before: { orientation: value.orientation, scaleType: value.scaleType, mediaId: value.mediaId ?? null },
        after: { orientation, scaleType, mediaId }, createdAt: updatedAt,
      });
      return { version, changed: true };
    });
  }
  return { updateScreenSettings };
}
