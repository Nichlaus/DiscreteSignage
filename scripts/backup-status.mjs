import { api, project } from './firebase-project.mjs';
const base = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`;
const [db, schedules, bucket] = await Promise.all([
  api(base), api(`${base}/backupSchedules`),
  api(`https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app`),
]);
console.log(JSON.stringify({ database: db.name, location: db.locationId,
  deleteProtection: db.deleteProtectionState, pointInTimeRecovery: db.pointInTimeRecoveryEnablement,
  backupSchedules: schedules.backupSchedules ?? [], storage: { name: bucket.name,
    softDeletePolicy: bucket.softDeletePolicy, versioning: bucket.versioning ?? { enabled: false } } }, null, 2));
const backups = []; let pageToken = '';
do {
  const result = await api(`https://firestore.googleapis.com/v1/projects/${project}/locations/${db.locationId}/backups${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''}`);
  backups.push(...(result.backups ?? [])); pageToken = result.nextPageToken ?? '';
} while (pageToken);
const matching = backups.filter(backup => backup.database === db.name && backup.databaseUid === db.uid)
  .sort((a, b) => Date.parse(b.snapshotTime) - Date.parse(a.snapshotTime));
console.log('Source database backups:', JSON.stringify(matching.map(b => ({ name: b.name,
  state: b.state, snapshotTime: b.snapshotTime, expireTime: b.expireTime })), null, 2));
console.log(matching.some(b => b.state === 'READY' && Date.parse(b.expireTime) > Date.now())
  ? 'A ready backup exists; content and restore acceptance still require verification.'
  : 'WAITING: no unexpired READY backup for the current database identity. Do not attempt restore.');
if (process.argv.includes('--apply-daily-7-days')) {
  const daily = (schedules.backupSchedules ?? []).filter(s => s.dailyRecurrence !== undefined);
  if (daily.length > 1 || daily.some(s => s.retention !== '604800s')) {
    throw Error('Existing daily backup configuration differs; review it before making changes.');
  }
  if (!daily.length) {
    const created = await api(`${base}/backupSchedules`, { method: 'POST',
      body: { retention: '604800s', dailyRecurrence: {} } });
    console.log(`Created daily seven-day backup schedule: ${created.name}`);
  } else console.log('Matching daily schedule already exists; no change made.');
}
