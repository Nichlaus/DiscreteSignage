import assert from 'node:assert/strict';
import { api, project } from './firebase-project.mjs';
const bucket = `${project}.firebasestorage.app`;
const base = `https://storage.googleapis.com/storage/v1/b/${bucket}`;
const meta = await api(base);
assert.equal(meta.location.toLowerCase(), 'australia-southeast1');
assert.equal(String(meta.projectNumber), '203068976562');
assert.equal(meta.iamConfiguration.uniformBucketLevelAccess.enabled, true);
assert.equal(meta.iamConfiguration.publicAccessPrevention, 'enforced');
assert.deepEqual(meta.cors, [{
  origin: [`https://${project}.web.app`, `https://${project}.firebaseapp.com`],
  method: ['PUT', 'GET'], responseHeader: ['Content-Type', 'ETag', 'x-goog-content-length-range',
    'x-goog-if-generation-match', 'x-goog-meta-reservation'], maxAgeSeconds: 300,
}]);
const policy = await api(`${base}/iam?optionsRequestedPolicyVersion=3`);
assert.ok(!policy.bindings.some(b => b.members.some(m => ['allUsers', 'allAuthenticatedUsers'].includes(m))));
const roleName = `projects/${project}/roles/discreteMediaObjects`;
assert.ok(policy.bindings.some(b => b.role === roleName && !b.condition
  && b.members.includes(`serviceAccount:discrete-platform@${project}.iam.gserviceaccount.com`)));
const role = await api(`https://iam.googleapis.com/v1/${roleName}`);
assert.deepEqual([...role.includedPermissions].sort(),
  ['storage.objects.create', 'storage.objects.delete', 'storage.objects.get', 'storage.objects.update']);
const check = await api(`https://firebaseappcheck.googleapis.com/v1/projects/203068976562/services/firebasestorage.googleapis.com`);
assert.equal(check.enforcementMode, 'ENFORCED');
for (const origin of [`https://${project}.web.app`, 'https://untrusted.example']) {
 for (const method of ['PUT', 'GET']) {
  const response = await fetch(`https://storage.googleapis.com/${bucket}/acceptance/cors-check`, {
    method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': method,
      'Access-Control-Request-Headers': 'content-type,x-goog-content-length-range,x-goog-if-generation-match,x-goog-meta-reservation' },
  });
  assert.equal(response.headers.get('access-control-allow-origin'),
    origin.endsWith('.example') ? null : origin);
  await response.arrayBuffer();
 }
}
console.log('PASS: Sydney bucket, blocked public access, restricted PUT/GET CORS, narrow runtime role and Storage App Check.');
