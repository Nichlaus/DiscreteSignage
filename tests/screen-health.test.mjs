import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenOffline, createScreenHealth, OFFLINE_AFTER_MS, SCAN_METRIC } from '../functions/src/screen-health.js';
import { screenPolicies } from '../scripts/screen-monitoring-config.mjs';

const now = 1800000000000;
const time = value => ({ toMillis: () => value });
function fixture() {
  return { deviceId: 'd1', device: { active: true, createdAt: time(now - 3600000), locationId: 'l1', screenId: 'd1' },
    screen: { active: true, deviceId: 'd1' }, status: { reportedAt: time(now - 60000) },
    trial: { source: 'trial', trialModules: ['screens'], trialStartedAt: time(now - 86400000), trialEndsAt: time(now + 86400000) } };
}

test('heartbeat grace boundary, outage and reconnection', () => {
  const f = fixture();
  assert.equal(screenOffline(f, now), false);
  f.status.reportedAt = time(now - OFFLINE_AFTER_MS + 1);
  assert.equal(screenOffline(f, now), false);
  f.status.reportedAt = time(now - OFFLINE_AFTER_MS);
  assert.equal(screenOffline(f, now), true);
  f.status.reportedAt = time(now);
  assert.equal(screenOffline(f, now), false);
});

test('never-connected device gets pairing grace; invalid timestamps do not hide outages', () => {
  const f = fixture(); f.status = undefined;
  f.device.createdAt = time(now - OFFLINE_AFTER_MS + 1);
  assert.equal(screenOffline(f, now), false);
  f.device.createdAt = time(now - OFFLINE_AFTER_MS);
  assert.equal(screenOffline(f, now), true);
  delete f.device.createdAt;
  assert.equal(screenOffline(f, now), true);
  f.status = { reportedAt: time(now + 60001) };
  assert.equal(screenOffline(f, now), true);
  f.status.reportedAt = time(now + 1);
  assert.equal(screenOffline(f, now), false);
});

test('revoked, replaced, missing-screen and expired or unavailable entitlements are suppressed', () => {
  const changes = [f => f.device.active = false, f => f.screen.active = false,
    f => f.screen.deviceId = 'other', f => f.screen = undefined,
    f => f.trial = undefined, f => f.trial.trialEndsAt = time(now),
    f => f.trial.trialStartedAt = time(now + 1), f => f.trial.trialModules = [],
    f => f.trial.source = 'unsupported'];
  for (const change of changes) {
    const f = fixture(); f.status.reportedAt = time(now - 3600000); change(f);
    assert.equal(screenOffline(f, now), false);
  }
});

function database(count = 1, { failReads = false, businesses = 1 } = {}) {
  const f = fixture(); f.status.reportedAt = time(now - 3600000);
  const ref = path => ({ path, collection: key => ref(`${path}/${key}`), doc: key => ref(`${path}/${key}`),
    limit: size => ({ get: async () => {
      const docs = path === 'businesses'
        ? Array.from({ length: Math.min(size, businesses) }, (_, i) => ({ id: `b${i}`, ref: ref(`businesses/b${i}`) }))
        : Array.from({ length: Math.min(size, count) }, (_, i) => ({ id: `d${i}`, data: () => ({ ...f.device, screenId: `d${i}` }) }));
      return { docs, size: docs.length };
    } }), get: async () => ({ data: () => f.trial }) });
  return { collection: key => ref(key), getAll: async (screen, status) => {
    if (failReads) throw Error('read failed');
    assert.equal(screen.path.split('/')[1], status.path.split('/')[1]);
    return [{ data: () => ({ ...f.screen, deviceId: screen.path.split('/').at(-1) }) }, { data: () => f.status }];
  } };
}

test('scan preserves tenant/device identity, batches at 200 and writes completion last', async () => {
  const writes = [];
  const result = await createScreenHealth({ firestore: database(201), now: () => now, publish: async points => writes.push(points) })();
  assert.equal(result.screens, 201);
  assert.deepEqual(writes.map(batch => batch.length), [200, 1, 1]);
  assert.deepEqual(writes[0][0].metric.labels, { business_id: 'b0', location_id: 'l1', screen_id: 'd0', device_id: 'd0' });
  assert.equal(writes[0][0].points[0].value.doubleValue, 1);
  assert.equal(writes[2][0].metric.type, SCAN_METRIC);
});

test('read failures and capacity limits publish no misleading completion', async () => {
  for (const db of [database(1, { failReads: true }), database(2001), database(0, { businesses: 201 })]) {
    const writes = [];
    await assert.rejects(createScreenHealth({ firestore: db, now: () => now, publish: async points => writes.push(points) }));
    assert.equal(writes.length, 0);
  }
});

test('metric write failure prevents completion and fails the invocation', async () => {
  const writes = [];
  await assert.rejects(createScreenHealth({ firestore: database(201), now: () => now, publish: async points => {
    writes.push(points); if (writes.length === 2) throw Error('metric write failed');
  } }));
  assert.equal(writes.length, 2);
  assert.ok(writes.flat().every(point => point.metric.type !== SCAN_METRIC));
});

test('empty fleet still emits scanner health; policies keep device series separate', async () => {
  const writes = [];
  await createScreenHealth({ firestore: database(0), now: () => now, publish: async points => writes.push(points) })();
  assert.equal(writes.length, 1);
  assert.equal(writes[0][0].metric.type, SCAN_METRIC);
  const [offline, stalled] = screenPolicies('channel');
  assert.equal(offline.conditions[0].conditionThreshold.aggregations[0].crossSeriesReducer, undefined);
  assert.deepEqual(offline.notificationChannels, ['channel']);
  assert.equal(stalled.conditions[0].conditionAbsent.duration, '1800s');
});
