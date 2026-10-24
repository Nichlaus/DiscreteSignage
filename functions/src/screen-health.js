export const OFFLINE_AFTER_MS = 15 * 60 * 1000;
export const SCREEN_HEALTH_METRIC = 'custom.googleapis.com/discrete_signage/screen_offline';
export const SCAN_METRIC = 'custom.googleapis.com/discrete_signage/screen_scan_complete';
const millis = value => value?.toMillis?.();

export function screenOffline({ device, screen, status, trial, deviceId }, now) {
  if (device?.active !== true || screen?.active !== true || screen.deviceId !== deviceId
    || trial?.source !== 'trial' || !trial.trialModules?.includes('screens')
    || !(millis(trial.trialStartedAt) <= now && millis(trial.trialEndsAt) > now)) return false;
  const last = millis(status?.reportedAt) ?? millis(device.createdAt);
  // Missing or impossible timestamps must not silently make a screen healthy.
  return !Number.isFinite(last) || last > now + 60000 || now - last >= OFFLINE_AFTER_MS;
}

export function metricPoint(type, labels, value, now) {
  return { metric: { type, labels },
    resource: { type: 'global', labels: { project_id: 'discretesignage' } },
    points: [{ interval: { endTime: new Date(now).toISOString() }, value: { doubleValue: value } }] };
}

export function createScreenHealth({ firestore: db, publish, now = () => Date.now() }) {
  return async () => {
    const checkedAt = now(), points = [];
    const businesses = await db.collection('businesses').limit(201).get();
    if (businesses.size > 200) throw Error('Screen monitoring business limit reached; expand the scanner before onboarding more businesses.');
    for (const business of businesses.docs) {
      const devices = await business.ref.collection('devices').limit(2001).get();
      if (points.length + devices.size > 2000) throw Error('Screen monitoring device limit reached; scan not published.');
      const trial = (await business.ref.collection('entitlements').doc('current').get()).data();
      for (const entry of devices.docs) {
        const device = entry.data();
        if (![device.locationId, device.screenId].every(id => typeof id === 'string' && /^[a-zA-Z0-9_-]+$/.test(id))) {
          throw Error('Invalid device routing in screen monitoring');
        }
        const [screen, status] = await db.getAll(
          business.ref.collection('locations').doc(device.locationId).collection('screens').doc(device.screenId),
          business.ref.collection('deviceStatus').doc(entry.id));
        points.push(metricPoint(SCREEN_HEALTH_METRIC, { business_id: business.id,
          location_id: device.locationId, screen_id: device.screenId, device_id: entry.id },
        Number(screenOffline({ device, screen: screen.data(), status: status.data(), trial, deviceId: entry.id }, now())), checkedAt));
      }
    }
    // Publish only after a complete read. The completion metric is last so failed
    // reads or partial API writes cannot hide a stalled scanner.
    for (let i = 0; i < points.length; i += 200) await publish(points.slice(i, i + 200));
    await publish([metricPoint(SCAN_METRIC, {}, 1, now())]);
    return { screens: points.length, checkedAt };
  };
}
