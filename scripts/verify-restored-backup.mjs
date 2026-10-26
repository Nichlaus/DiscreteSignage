import assert from 'node:assert/strict';
import { api, project } from './firebase-project.mjs';

const [destination] = process.argv.slice(2);
assert.match(destination ?? '', /^recovery-check-[a-z0-9][a-z0-9-]{0,40}[a-z0-9]$/);
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/${destination}`;
const database = await api(base);
assert.equal(database.locationId, 'australia-southeast1');
assert.equal(database.sourceInfo?.progress, 'COMPLETED', 'Restore is not complete');
const operation = await api(`https://firestore.googleapis.com/v1/${database.sourceInfo.operation}`);
assert.equal(operation.done, true);
assert.equal(operation.error, undefined);
assert.equal(operation.metadata.operationState, 'SUCCESSFUL');
let indexCount = 0, indexPage;
do {
  const indexes = await api(`${base}/collectionGroups/-/indexes?pageSize=100${indexPage ? `&pageToken=${encodeURIComponent(indexPage)}` : ''}`);
  for (const index of indexes.indexes ?? []) {
    assert.equal(index.state, 'READY', 'Restored index is not ready');
    indexCount++;
  }
  indexPage = indexes.nextPageToken;
} while (indexPage);

// An absent named-database release keeps Firebase clients closed by default.
try {
  await api(`https://firebaserules.googleapis.com/v1/projects/${project}/releases/cloud.firestore/${destination}`);
  throw Error('A rules release exists; review its rules separately before proceeding.');
} catch (error) {
  if (!error.message.startsWith('404:')) throw error;
}
const anonymous = await fetch(`${base}/documents/businesses`, { signal: AbortSignal.timeout(20000) });
assert.equal(anonymous.status, 403, 'Anonymous read was not denied');

function decode(value) {
  if (value.mapValue) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, v]) => [key, decode(v)]));
  if (value.arrayValue) return (value.arrayValue.values ?? []).map(decode);
  if ('integerValue' in value) return Number(value.integerValue);
  return Object.values(value)[0];
}
const records = {};
for (const collectionId of ['businesses', 'locations', 'screens', 'devices', 'entitlements', 'media']) {
  const rows = await api(`${base}/documents:runQuery`, { method: 'POST', body: {
    structuredQuery: { from: [{ collectionId, allDescendants: true }], limit: 1001 },
  } });
  const docs = rows.filter(row => row.document).map(row => row.document);
  assert.ok(docs.length <= 1000, 'Inspection bound reached; use a separately reviewed larger audit');
  records[collectionId] = new Map(docs.map(doc => [doc.name.split('/documents/')[1],
    Object.fromEntries(Object.entries(doc.fields ?? {}).map(([key, value]) => [key, decode(value)]))]));
}
assert.ok(records.businesses.size > 0 && records.screens.size > 0 && records.media.size > 0);
for (const [path, screen] of records.screens) {
  const parts = path.split('/'), business = parts.slice(0, 2).join('/');
  assert.ok(records.businesses.has(business), 'Screen business missing');
  assert.ok(records.locations.has(parts.slice(0, 4).join('/')), 'Screen location missing');
  const device = records.devices.get(`${business}/devices/${screen.deviceId}`);
  assert.ok(device, 'Screen device missing');
  assert.equal(device.screenId, parts[5]);
  assert.equal(device.locationId, parts[3]);
  for (const item of [...(screen.playlist ?? []), ...(screen.secondaryPlaylist ?? []), ...(screen.logo ? [screen.logo] : [])]) {
    assert.ok(records.media.has(`${business}/media/${item.mediaId}`), 'Playlist media missing');
  }
}
for (const trial of records.entitlements.values()) {
  assert.ok(Date.parse(trial.trialStartedAt) < Date.parse(trial.trialEndsAt), 'Trial timestamps invalid');
}
let checkedObjects = 0;
for (const [path, media] of records.media) {
  if (media.status !== 'ready' || !media.playback || checkedObjects >= 3) continue;
  const playback = media.playback;
  assert.ok(playback.path.startsWith(`${path}/`), 'Media path crosses record boundary');
  const object = await api(`https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app/o/${encodeURIComponent(playback.path)}?generation=${encodeURIComponent(playback.generation)}`);
  assert.equal(object.generation, playback.generation);
  assert.equal(Number(object.size), playback.size);
  assert.equal(object.metadata?.sha256, playback.sha256);
  checkedObjects++;
}
assert.ok(checkedObjects > 0, 'No media metadata verified');
console.log(JSON.stringify({ destination, snapshotTime: database.sourceInfo.backup.snapshotTime,
  operation: operation.metadata.operationState, anonymousRead: 'denied', rulesRelease: 'absent',
  readyCompositeIndexes: indexCount,
  inspectedCounts: Object.fromEntries(Object.entries(records).map(([key, value]) => [key, value.size])),
  revokedDevices: [...records.devices.values()].filter(device => device.active === false).length,
  mediaGenerationMetadataChecked: checkedObjects }, null, 2));
console.log('PASS: bounded relationship/timestamp and media metadata checks. No data or configuration changed.');
console.log('Not a full backup checksum, Auth restore, media-byte restore or production cutover test.');
