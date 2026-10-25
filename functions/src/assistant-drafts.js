import { HttpsError } from 'firebase-functions/v2/https';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { playlist, screenPlaylist, transition } from './playlist.js';
import { screenLayout } from './layout.js';
import { guidedTiming } from './assistant-schedule.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max
    || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) fail('invalid-argument', 'Check the assistant request.');
  return value.trim();
}

// The planner has no credentials or mutation tools. Its output is untrusted data.
export function validateDraft(output, context) {
  if (output?.kind === 'clarification') {
    fields(output, ['kind', 'message']);
    return { kind: 'clarification', message: text(output.message, 600) };
  }
  fields(output, ['kind', 'playlist']);
  if (output.kind !== 'playlist') fail('invalid-argument', 'Unsupported assistant action.');
  const items = playlist(output.playlist);
  if (!items.length) fail('invalid-argument', 'The assistant cannot clear a playlist.');
  const allowed = new Set(context.media.map(m => m.id));
  if (items.some(item => !allowed.has(item.mediaId))) fail('invalid-argument', 'The assistant chose media outside your selection.');
  return { kind: 'playlist', playlist: items };
}

export function createAssistantDrafts({ firestore: db, auth, planner, reserve, now = () => Date.now() }) {
  async function preparePlaylistDraft(request) {
    const user = await authorize(auth, request);
    const guided = request.data != null && Object.hasOwn(request.data, 'guided');
    fields(request.data, ['businessId', 'locationId', 'screenId', 'mediaIds', guided ? 'guided' : 'prompt']);
    const timing = guided ? guidedTiming(request.data.guided) : null;
    const { mediaIds } = request.data, prompt = guided ? null : text(request.data.prompt, 2000);
    if (!Array.isArray(mediaIds) || !mediaIds.length || mediaIds.length > 20
      || new Set(mediaIds).size !== mediaIds.length) fail('invalid-argument', 'Select 1–20 different media files.');
    mediaIds.forEach(identifier);
    const businessId = identifier(request.data.businessId), locationId = identifier(request.data.locationId);
    const screenId = identifier(request.data.screenId), business = db.doc(`businesses/${businessId}`);
    const location = business.collection('locations').doc(locationId), screenRef = location.collection('screens').doc(screenId);
    async function read() {
      return db.runTransaction(async tx => {
        const [member, trial, branch, stored] = await tx.getAll(business.collection('members').doc(user.uid),
          business.collection('entitlements').doc('current'), location, screenRef);
        if (member.data()?.active !== true || member.data()?.role !== 'owner') fail('permission-denied', 'Active business ownership is required.');
        const t = trial.data(), screen = stored.data();
        if (t?.source !== 'trial' || !t.trialModules?.includes('screens') || !t.trialModules?.includes('aiStudio')
          || !(t.trialStartedAt?.toMillis() <= now()) || !(t.trialEndsAt?.toMillis() > now())) {
          fail('failed-precondition', 'Active signage and portal AI trial access is required.');
        }
        if (!branch.exists || !screen?.active || !Number.isSafeInteger(screen.version)) fail('failed-precondition', 'Choose an active screen.');
        const device = await tx.get(business.collection('devices').doc(identifier(screen.deviceId)));
        if (device.data()?.active !== true || device.data().screenId !== screenId || device.data().locationId !== locationId) {
          fail('failed-precondition', 'Screen registration is unavailable.');
        }
        const media = await tx.getAll(...mediaIds.map(id => business.collection('media').doc(id)));
        if (media.some(m => m.data()?.status !== 'ready' || !['image-v1', 'video-v1'].includes(m.data()?.playback?.policy))) {
          fail('failed-precondition', 'Select validated media from this business.');
        }
        const timezone = branch.data().timezone;
        try { new Intl.DateTimeFormat('en', { timeZone: timezone }).format(now()); }
        catch { fail('failed-precondition', 'Set a valid location time zone first.'); }
        if (!timezone) fail('failed-precondition', 'Set a location time zone first.');
        return { screen, timezone, media: media.map(m => ({ id: m.id,
          name: String(m.data().name ?? '').slice(0, 160), type: m.data().playback.policy === 'image-v1' ? 'image' : 'video' })) };
      });
    }
    const before = await read();
    if (!guided && typeof planner !== 'function') fail('failed-precondition', 'The AI provider is not configured yet.');
    // Exclude business/user/device IDs, URLs, tokens, file bytes and unrelated media.
    const context = { timezone: before.timezone, media: before.media,
      currentPlaylist: screenPlaylist(before.screen).filter(item => mediaIds.includes(item.mediaId)), currentDate: new Intl.DateTimeFormat('en-CA',
        { timeZone: before.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now()) };
    let proposed;
    const reservation = reserve ? await reserve(businessId) : null;
    try { proposed = guided
      ? { kind: 'playlist', playlist: context.media.map(media => ({ mediaId: media.id, ...timing })) }
      : await planner({ prompt, context }); }
    catch { fail('unavailable', 'The assistant could not prepare a draft. Try again later.'); }
    finally { if (reservation) await reservation.finish(); }
    const output = validateDraft(proposed, context);
    // Access or settings may have changed while the model was responding.
    const fresh = await read();
    if (fresh.screen.version !== before.screen.version || fresh.timezone !== before.timezone) {
      fail('failed-precondition', 'Screen settings changed. Prepare a new draft.');
    }
    if (output.kind === 'clarification') return { ...output, ...(reservation ? { usage: reservation.usage } : {}) };
    const design = screenLayout(fresh.screen);
    return { kind: 'playlist', ...(reservation ? { usage: reservation.usage } : {}), screenName: String(fresh.screen.name ?? '').slice(0, 160),
      timezone: fresh.timezone, media: fresh.media, before: screenPlaylist(fresh.screen),
      settings: { businessId, locationId, screenId, expectedVersion: fresh.screen.version,
        orientation: fresh.screen.orientation, scaleType: fresh.screen.scaleType,
        transition: transition(fresh.screen.transition), ...design, playlist: output.playlist } };
  }
  return { preparePlaylistDraft };
}
