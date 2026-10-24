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
