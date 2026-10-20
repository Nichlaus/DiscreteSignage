// Explicit infrastructure setup; never invoked by builds or automated tests.
import { api, project } from './firebase-project.mjs';
if (process.argv[2] !== '--apply') throw Error('Use --apply for the reviewed Storage setup.');
const number = '203068976562';
const bucket = `${project}.firebasestorage.app`;
const email = `discrete-platform@${project}.iam.gserviceaccount.com`;
let operation = await api(`https://serviceusage.googleapis.com/v1/projects/${number}/services:batchEnable`, {
  method: 'POST', body: { serviceIds: ['firebasestorage.googleapis.com', 'storage.googleapis.com', 'eventarc.googleapis.com', 'pubsub.googleapis.com'] },
});
for (let i = 0; !operation.done && i < 12; i++) {
  await new Promise(resolve => setTimeout(resolve, 3000));
  operation = await api(`https://serviceusage.googleapis.com/v1/${operation.name}`);
}
if (!operation.done || operation.error) throw Error('Service enablement incomplete; retry setup.');
const base = `https://storage.googleapis.com/storage/v1/b/${bucket}`;
let metadata;
try { metadata = await api(base); } catch (error) {
  if (!error.message.startsWith('404:')) throw error;
  await api(`https://firebasestorage.googleapis.com/v1alpha/projects/${project}/defaultBucket`, {
    method: 'POST', body: { location: 'australia-southeast1' },
  });
  metadata = await api(base);
}
if (metadata.location.toLowerCase() !== 'australia-southeast1'
  || String(metadata.projectNumber) !== number) throw Error('Unexpected bucket location or project.');
await api(`${base}?ifMetagenerationMatch=${metadata.metageneration}`, { method: 'PATCH', body: {
  iamConfiguration: { uniformBucketLevelAccess: { enabled: true }, publicAccessPrevention: 'enforced' },
  cors: [{
    origin: [`https://${project}.web.app`, `https://${project}.firebaseapp.com`],
    method: ['PUT'], responseHeader: ['Content-Type', 'ETag', 'x-goog-content-length-range',
      'x-goog-if-generation-match', 'x-goog-meta-reservation'], maxAgeSeconds: 300,
  }],
} });
const roleId = 'discreteMediaObjects';
const roleName = `projects/${project}/roles/${roleId}`;
const permissions = ['storage.objects.create', 'storage.objects.delete', 'storage.objects.get', 'storage.objects.update'];
let role;
try { role = await api(`https://iam.googleapis.com/v1/${roleName}`); } catch (error) {
  if (!error.message.startsWith('404:')) throw error;
  role = await api(`https://iam.googleapis.com/v1/projects/${project}/roles`, {
    method: 'POST', body: { roleId, role: { title: 'Discrete media object access',
      description: 'Constrained upload signing, validation and orphan cleanup on the media bucket.',
      includedPermissions: permissions, stage: 'GA' } },
  });
}
if (role.deleted || JSON.stringify([...role.includedPermissions].sort()) !== JSON.stringify(permissions)) {
  throw Error('Existing media role differs; inspect before changing.');
}
const policy = await api(`${base}/iam?optionsRequestedPolicyVersion=3`);
policy.bindings ??= [];
if (policy.bindings.some(b => b.members?.some(m => ['allUsers', 'allAuthenticatedUsers'].includes(m)))) {
  throw Error('Unexpected public bucket policy; review before continuing.');
}
let binding = policy.bindings.find(b => b.role === roleName && !b.condition);
if (!binding) { binding = { role: roleName, members: [] }; policy.bindings.push(binding); }
if (!binding.members.includes(`serviceAccount:${email}`)) binding.members.push(`serviceAccount:${email}`);
for (let attempt = 0; ; attempt++) {
  try { await api(`${base}/iam`, { method: 'PUT', body: policy }); break; }
  catch (error) {
    if (attempt >= 3 || !error.message.includes("does not exist in the resource's hierarchy")) throw error;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
const service = `projects/${number}/services/firebasestorage.googleapis.com`;
// The custom runtime is also the Storage trigger identity. Firebase CLI grants
// this to the default compute identity, so configure the custom identity explicitly.
const projectIam = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
const projectPolicy = await api(`${projectIam}:getIamPolicy`, {
  method: 'POST', body: { options: { requestedPolicyVersion: 3 } },
});
projectPolicy.bindings ??= [];
let receiver = projectPolicy.bindings.find(b => b.role === 'roles/eventarc.eventReceiver' && !b.condition);
if (!receiver) { receiver = { role: 'roles/eventarc.eventReceiver', members: [] }; projectPolicy.bindings.push(receiver); }
if (!receiver.members.includes(`serviceAccount:${email}`)) receiver.members.push(`serviceAccount:${email}`);
await api(`${projectIam}:setIamPolicy`, { method: 'POST', body: { policy: projectPolicy } });
await api(`https://firebaseappcheck.googleapis.com/v1/${service}?updateMask=enforcementMode`, {
  method: 'PATCH', body: { name: service, enforcementMode: 'ENFORCED' },
});
console.log('Sydney media bucket secured; runtime bucket-scoped role and restricted PUT CORS configured.');
console.log('Firebase Storage App Check enforced. Signed PUTs use their own short-lived authorization.');
console.log('Next: deploy deny-all Storage rules and verify the signed upload contract against GCS.');
