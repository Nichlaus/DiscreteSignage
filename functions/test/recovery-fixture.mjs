import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc } from 'firebase/firestore';
import { ref, getMetadata } from 'firebase/storage';

const projectId = 'demo-discretesignage';
for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST', 'FIREBASE_STORAGE_EMULATOR_HOST']) {
  assert.match(process.env[key] ?? '', /^127\.0\.0\.1:\d+$/, `Local emulator required: ${key}`);
}
assert.equal(process.env.GCLOUD_PROJECT, projectId);
const phase = process.argv[2];
assert.ok(['seed', 'verify'].includes(phase));
const app = initializeApp({ projectId, storageBucket: `${projectId}.appspot.com` });
const db = getFirestore(app), auth = getAuth(app), bucket = getStorage(app).bucket();
const bytes = Buffer.from('Synthetic recovery fixture; no customer content.\n');
const digest = createHash('sha256').update(bytes).digest('hex');
const path = `businesses/recovery-a/media/${digest}/original`;
const file = bucket.file(path);
const records = {
  'businesses/recovery-a': { name: 'Synthetic recovery business' },
  'businesses/recovery-a/members/recovery-owner': { active: true, role: 'owner' },
  'businesses/recovery-b': { name: 'Other synthetic tenant' },
  'businesses/recovery-a/devices/recovery-device': { active: false, locationId: 'main', screenId: 'recovery-device' },
  'businesses/recovery-a/locations/main/screens/recovery-device': { active: false, deviceId: 'recovery-device', version: 3 },
  'businesses/recovery-a/entitlements/current': { source: 'trial', trialModules: ['screens'], trialEndsAt: Timestamp.fromMillis(1700000000000) },
};
try {
  if (phase === 'seed') {
    await auth.createUser({ uid: 'recovery-owner', email: 'recovery-owner@example.test', emailVerified: true });
    await auth.createUser({ uid: 'recovery-device', disabled: true });
    await auth.setCustomUserClaims('recovery-device', { device: true, businessId: 'recovery-a' });
    await file.save(bytes, { resumable: false, contentType: 'application/octet-stream' });
    const [metadata] = await file.getMetadata();
    records[`businesses/recovery-a/media/${digest}`] = { path, generation: metadata.generation, sha256: digest, size: bytes.length, status: 'uploaded' };
    for (const [path, data] of Object.entries(records)) await db.doc(path).set(data);
    console.log('PASS: seeded synthetic identity, revoked screen, trial and private media records.');
  } else {
    for (const [path, expected] of Object.entries(records)) assert.deepEqual((await db.doc(path).get()).data(), expected, path);
    assert.equal((await auth.getUser('recovery-owner')).emailVerified, true);
    const device = await auth.getUser('recovery-device');
    assert.equal(device.disabled, true);
    assert.deepEqual(device.customClaims, { device: true, businessId: 'recovery-a' });
    const record = (await db.doc(`businesses/recovery-a/media/${digest}`).get()).data();
    const [restored] = await file.download(), [metadata] = await file.getMetadata();
    assert.equal(createHash('sha256').update(restored).digest('hex'), record.sha256);
    assert.equal(restored.length, record.size);
    assert.equal(metadata.generation, record.generation, 'Stored object generation must match the restored media reference');
    const env = await initializeTestEnvironment({ projectId,
      firestore: { rules: readFileSync('firestore.rules', 'utf8') },
      storage: { rules: readFileSync('storage.rules', 'utf8') } });
    try {
      const owner = env.authenticatedContext('recovery-owner');
      await assertSucceeds(getDoc(doc(owner.firestore(), 'businesses/recovery-a')));
      await assertFails(getDoc(doc(owner.firestore(), 'businesses/recovery-b')));
      const revoked = env.authenticatedContext('recovery-device', { device: true, businessId: 'recovery-a' });
      await assertFails(getDoc(doc(revoked.firestore(), 'businesses/recovery-a/locations/main/screens/recovery-device')));
      await assertFails(getMetadata(ref(env.unauthenticatedContext().storage(), path)));
    } finally { await env.cleanup(); }
    console.log('PASS: restored records, Auth flags/claims, media bytes/generation, tenant isolation and revoked-device denial.');
  }
} finally { await deleteApp(app); }
