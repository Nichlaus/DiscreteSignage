import { screenLayout } from './layout.js';
import { Timestamp } from 'firebase-admin/firestore';
import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { playlist, screenPlaylist, transition } from './playlist.js';
import { fields, identifier } from './provisioning.js';

export function createScreens({ firestore: db, auth, now = () => Date.now() }) {
  async function updateScreenSettings(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'locationId', 'screenId', 'expectedVersion', 'orientation', 'scaleType',
      ...['mediaId', 'playlist', 'transition', 'layout', 'secondaryPlaylist', 'logo', 'interactiveEnabled'].filter(key => Object.hasOwn(request.data ?? {}, key))]);
    if (request.data.interactiveEnabled !== undefined && typeof request.data.interactiveEnabled !== 'boolean') throw new HttpsError('invalid-argument', 'Choose whether interactive products are enabled.');
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
      const interactive = { enabled: request.data.interactiveEnabled ?? (value.interactive?.enabled === true) };
      if (request.data.interactiveEnabled === true && !entitlement.trialModules?.includes('customerAi')) throw new HttpsError('failed-precondition', 'Interactive AI access is required.');
      const device = await tx.get(business.collection('devices').doc(value.deviceId));
      if (device.data()?.active !== true || device.data().screenId !== screenId || device.data().locationId !== locationId) {
        throw new HttpsError('failed-precondition', 'Screen registration is unavailable.');
      }
      if (request.data.playlist !== undefined && request.data.mediaId !== undefined) {
        throw new HttpsError('invalid-argument', 'Choose either a playlist or legacy media assignment.');
      }
      const items = request.data.playlist !== undefined ? playlist(request.data.playlist)
        : request.data.mediaId !== undefined ? playlist(request.data.mediaId === null ? []
          : [{ mediaId: request.data.mediaId, duration: 10 }]) : screenPlaylist(value);
      const previousLayout = screenLayout(value);
      const design = screenLayout({ ...previousLayout, ...Object.fromEntries(
        ['layout', 'secondaryPlaylist', 'logo'].filter(key => Object.hasOwn(request.data, key)).map(key => [key, request.data[key]])) });
      const effect = transition(request.data.transition ?? value.transition);
      for (const id of new Set([...items, ...design.secondaryPlaylist, ...(design.logo ? [design.logo] : [])].map(item => item.mediaId))) {
        const media = await tx.get(business.collection('media').doc(id));
        if (media.data()?.status !== 'ready' || !['image-v1', 'video-v1'].includes(media.data()?.playback?.policy)) {
          throw new HttpsError('failed-precondition', 'Choose validated media from this business.');
        }
        if (id === design.logo?.mediaId && media.data().playback.policy !== 'image-v1') {
          throw new HttpsError('failed-precondition', 'Choose a validated image for the logo.');
        }
      }
      const mediaId = items[0]?.mediaId ?? null;
      const same = (value.interactive?.enabled === true) === interactive.enabled && value.orientation === orientation && value.scaleType === scaleType
        && JSON.stringify(previousLayout) === JSON.stringify(design)
        && JSON.stringify(screenPlaylist(value)) === JSON.stringify(items) && transition(value.transition) === effect;
      // Recover a lost response without overwriting a later configuration.
      if (same && (value.version === expectedVersion || value.version === expectedVersion + 1)) {
        return { version: value.version, changed: false };
      }
      if (value.version !== expectedVersion) {
        throw new HttpsError('failed-precondition', 'Settings changed elsewhere. Refresh the screen list and try again.');
      }
      const version = value.version + 1;
      const updatedAt = Timestamp.fromMillis(now());
      tx.update(screen, { orientation, scaleType, mediaId, playlist: items, transition: effect, ...design, interactive, version, updatedAt });
      tx.create(business.collection('audit').doc(`settings-${screenId}-${version}`), {
        type: 'screen.settings.updated', actorUid: user.uid, screenId, locationId, version,
        before: { interactive: { enabled: value.interactive?.enabled === true }, orientation: value.orientation, scaleType: value.scaleType, mediaId: value.mediaId ?? null, playlist: screenPlaylist(value), transition: transition(value.transition), ...previousLayout },
        after: { interactive, orientation, scaleType, mediaId, playlist: items, transition: effect, ...design }, createdAt: updatedAt,
      });
      return { version, changed: true };
    });
  }
  return { updateScreenSettings };
}
