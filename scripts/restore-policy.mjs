import assert from 'node:assert/strict';

export function validateRestore(backup, source, destination, now = Date.now()) {
  assert.match(destination ?? '', /^recovery-check-[a-z0-9][a-z0-9-]{0,40}[a-z0-9]$/,
    'Destination must be a new recovery-check-* database, never the live database');
  assert.equal(source.name, 'projects/discretesignage/databases/(default)');
  assert.equal(source.locationId, 'australia-southeast1');
  assert.ok(source.uid, 'Source database identity missing');
  assert.equal(backup.database, source.name);
  assert.equal(backup.databaseUid, source.uid, 'Backup belongs to a different database incarnation');
  assert.match(backup.name, /^projects\/discretesignage\/locations\/australia-southeast1\/backups\/[a-zA-Z0-9-]+$/);
  assert.equal(backup.state, 'READY');
  assert.ok(Date.parse(backup.snapshotTime) <= now, 'Invalid backup snapshot time');
  assert.ok(Date.parse(backup.expireTime) > now, 'Backup expired');
  return { databaseId: destination, backup: backup.name };
}
