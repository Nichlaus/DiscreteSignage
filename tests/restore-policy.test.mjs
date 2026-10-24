import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRestore } from '../scripts/restore-policy.mjs';
const now = Date.parse('2026-10-24T10:00:00Z');
const source = { name: 'projects/discretesignage/databases/(default)', uid: 'source-uid', locationId: 'australia-southeast1' };
const backup = { name: 'projects/discretesignage/locations/australia-southeast1/backups/backup-id',
  database: source.name, databaseUid: source.uid, state: 'READY',
  snapshotTime: '2026-10-24T09:00:00Z', expireTime: '2026-10-31T09:00:00Z' };
test('ready backup can target only the isolated rehearsal namespace', () => {
  assert.deepEqual(validateRestore(backup, source, 'recovery-check-20261024', now),
    { databaseId: 'recovery-check-20261024', backup: backup.name });
  for (const target of ['(default)', 'production', '../default', '', undefined]) {
    assert.throws(() => validateRestore(backup, source, target, now));
  }
});
test('rejects wrong identity, region, incomplete and expired backups', () => {
  for (const changes of [{ databaseUid: 'old-uid' }, { database: 'other' }, { state: 'CREATING' },
    { state: 'NOT_AVAILABLE' }, { expireTime: '2026-10-24T10:00:00Z' },
    { snapshotTime: '2027-01-01T00:00:00Z' }, { snapshotTime: 'invalid' },
    { name: 'projects/other/locations/australia-southeast1/backups/backup-id' }]) {
    assert.throws(() => validateRestore({ ...backup, ...changes }, source, 'recovery-check-test', now));
  }
});
