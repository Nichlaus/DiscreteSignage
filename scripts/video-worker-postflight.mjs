import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { api, project } from './firebase-project.mjs';
const base = `https://run.googleapis.com/v2/projects/${project}/locations/australia-southeast1/services/discrete-video`;
const service = await api(base);
assert.equal(service.terminalCondition?.state, 'CONDITION_SUCCEEDED');
assert.ok(!service.invokerIamDisabled);
assert.equal(service.template.serviceAccount, `discrete-video@${project}.iam.gserviceaccount.com`);
assert.equal(service.template.maxInstanceRequestConcurrency, 1);
assert.equal(service.template.timeout, '150s');
assert.equal(service.template.scaling.maxInstanceCount, 2);
assert.equal(service.template.scaling.minInstanceCount ?? 0, 0);
assert.deepEqual(service.template.containers[0].resources.limits, { cpu: '2', memory: '2Gi' });
const policy = await api(`${base}:getIamPolicy`);
assert.deepEqual(policy.bindings, [{ role: 'roles/run.invoker', members: [
  `serviceAccount:discrete-platform@${project}.iam.gserviceaccount.com`,
] }]);
const projectPolicy = await api(`https://cloudresourcemanager.googleapis.com/v1/projects/${project}:getIamPolicy`,
  { method: 'POST', body: { options: { requestedPolicyVersion: 3 } } });
assert.ok(!projectPolicy.bindings.some(b => b.members?.includes(`serviceAccount:${service.template.serviceAccount}`)));
const bucketPolicy = await api(`https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app/iam?optionsRequestedPolicyVersion=3`);
assert.ok(!bucketPolicy.bindings.some(b => b.members?.includes(`serviceAccount:${service.template.serviceAccount}`)));
for (const url of service.urls) {
  const response = await fetch(`${url}/validate`, { method: 'POST', headers: { 'Content-Type': 'video/mp4' }, body: Buffer.alloc(12) });
  await response.arrayBuffer();
  assert.ok([401, 403].includes(response.status), 'Anonymous worker invocation allowed');
}
console.log('PASS: private worker ready, resource limits correct, only backend invocation granted, runtime has no project/bucket roles.');
const { id } = JSON.parse(readFileSync('artifacts/video-build.json'));
const build = await api(`https://cloudbuild.googleapis.com/v1/projects/${project}/locations/australia-southeast1/builds/${id}`);
assert.equal(build.status, 'SUCCESS');
assert.ok(service.template.containers[0].image.endsWith(`@${build.results.images[0].digest}`));
console.log('PASS: deployed immutable image matches successful Linux test/build.');
const repo = await api(`https://artifactregistry.googleapis.com/v1/projects/${project}/locations/australia-southeast1/repositories/gcf-artifacts`);
assert.deepEqual(repo.cleanupPolicies['discrete-video-keep'], { id: 'discrete-video-keep', action: 'KEEP',
  mostRecentVersions: { packageNamePrefixes: ['discrete-video'], keepCount: 2 } });
console.log('PASS: latest two worker images retained for deployment and rollback.');
