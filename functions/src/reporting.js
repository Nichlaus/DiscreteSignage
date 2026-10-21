import { HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { authorize } from './identity.js';
import { fields, identifier } from './provisioning.js';
import { screenPlaylist } from './playlist.js';
import { screenLayout } from './layout.js';
import { scheduledRegions } from './schedule.js';

const fail = (code, message) => { throw new HttpsError(code, message); };
const dateKey = (time, timezone) => new Intl.DateTimeFormat('en-CA', { timeZone: timezone,
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);

export function createReporting({ firestore: db, auth, now = () => Date.now() }) {
  async function reportPlayback(request) {
    fields(request.data, ['events']);
    if (!request.app || request.auth?.token?.device !== true) fail('permission-denied', 'Verified display required.');
    const user = await auth.getUser(request.auth.uid);
    const claims = request.auth.token;
    if (user.disabled || !Number.isFinite(claims.auth_time) || claims.auth_time <= 0
      || claims.auth_time * 1000 < Date.parse(user.tokensValidAfterTime || '1970-01-01')) fail('permission-denied', 'Display access ended.');
    const received = now(), events = request.data.events;
    if (!Array.isArray(events) || !events.length || events.length > 20) fail('invalid-argument', 'Send 1–20 play starts.');
    for (const e of events) {
      fields(e, ['id', 'mediaId', 'region', 'version', 'startedAt']); identifier(e.mediaId);
      if (!/^[a-f0-9-]{36}$/.test(e.id) || ![0, 1].includes(e.region)
        || !Number.isSafeInteger(e.version) || !Number.isSafeInteger(e.startedAt)
        || e.startedAt < received - 120000 || e.startedAt > received + 5000) fail('invalid-argument', 'Invalid or expired play start.');
    }
    const business = db.doc(`businesses/${identifier(claims.businessId)}`);
    return db.runTransaction(async tx => {
      const deviceRef = business.collection('devices').doc(user.uid);
      const stateRef = business.collection('playbackReports').doc(user.uid);
      const [device, trial, state] = await tx.getAll(deviceRef, business.collection('entitlements').doc('current'), stateRef);
      const d = device.data(), t = trial.data();
      if (!d?.active || t?.source !== 'trial' || !t.trialModules?.includes('screens')
        || !(t.trialStartedAt?.toMillis() <= received) || !(t.trialEndsAt?.toMillis() > received)) fail('permission-denied', 'Display reporting unavailable.');
      const location = business.collection('locations').doc(identifier(d.locationId));
      const [place, screen] = await tx.getAll(location, location.collection('screens').doc(identifier(d.screenId)));
      const s = screen.data();
      if (!s?.active || s.deviceId !== user.uid || !place.data()?.timezone) fail('permission-denied', 'Screen unavailable.');
      const design = screenLayout(s), regions = [screenPlaylist(s)];
      if (design.layout !== 'single') regions.push(design.secondaryPlaylist);
      const previous = state.data() ?? {};
      const recent = (previous.recent ?? []).filter(e => e.received > received - 125000);
      const ids = new Set(recent.map(e => e.id)), fresh = [];
      for (const e of events) {
        if (ids.has(e.id)) continue;
        if (e.startedAt < t.trialStartedAt.toMillis() || e.startedAt >= t.trialEndsAt.toMillis()
          || e.version !== s.version || !scheduledRegions(regions, place.data().timezone, e.startedAt)
          .regions[e.region]?.some(item => item.mediaId === e.mediaId)) fail('permission-denied', 'Play start does not match the screen schedule.');
        ids.add(e.id); fresh.push(e);
      }
      const minute = Math.floor(received / 60000);
      const count = (previous.minute === minute ? previous.count : 0) + fresh.length;
      if (count > 120 || recent.length + fresh.length > 512) fail('resource-exhausted', 'Reporting limit reached.');
      const media = await Promise.all([...new Set(fresh.map(e => e.mediaId))].map(id => tx.get(business.collection('media').doc(id))));
      if (media.some(m => m.data()?.status !== 'ready')) fail('failed-precondition', 'Media unavailable.');
      for (const e of fresh) {
        const update = { starts: FieldValue.increment(1), lastReportedAt: received };
        tx.set(location.collection('playbackTotals').doc(e.mediaId), update, { merge: true });
        tx.set(location.collection('playbackDays').doc(dateKey(e.startedAt, place.data().timezone)).collection('media').doc(e.mediaId), update, { merge: true });
        recent.push({ id: e.id, received });
      }
      tx.set(stateRef, { minute, count, recent });
      return { accepted: fresh.length };
    });
  }

  async function getMediaReport(request) {
    const user = await authorize(auth, request);
    fields(request.data, ['businessId', 'locationId', 'mediaId']);
    const business = db.doc(`businesses/${identifier(request.data.businessId)}`);
    const member = (await business.collection('members').doc(user.uid).get()).data();
    if (!member?.active || member.role !== 'owner') fail('permission-denied', 'Active ownership required.');
    const location = business.collection('locations').doc(identifier(request.data.locationId));
    const mediaId = identifier(request.data.mediaId);
    const [place, media] = await db.getAll(location, business.collection('media').doc(mediaId));
    if (!place.exists || !media.exists) fail('not-found', 'Choose media and a location from this business.');
    const timezone = place.data().timezone, today = dateKey(now(), timezone);
    // Calendar arithmetic is performed on date labels, independent of DST-length days.
    const dates = Array.from({ length: 7 }, (_, i) => new Date(Date.parse(`${today}T12:00:00Z`) - i * 86400000).toISOString().slice(0, 10));
    const [total, ...daily] = await db.getAll(location.collection('playbackTotals').doc(mediaId),
      ...dates.map(day => location.collection('playbackDays').doc(day).collection('media').doc(mediaId)));
    const days = daily.map((doc, i) => ({ date: dates[i], starts: doc.data()?.starts ?? 0 }));
    return { mediaName: media.data().name ?? mediaId, locationName: place.data().name, timezone,
      total: total.data()?.starts ?? 0, today: days[0].starts,
      last7Days: days.reduce((sum, day) => sum + day.starts, 0), lastReportedAt: total.data()?.lastReportedAt ?? null, days };
  }
  return { reportPlayback, getMediaReport };
}
