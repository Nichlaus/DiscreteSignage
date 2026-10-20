import { api, project } from './firebase-project.mjs';
if (process.argv[2] !== '--apply') throw Error('Use --apply to configure private trigger invocation.');
const service = `https://run.googleapis.com/v2/projects/${project}/locations/australia-southeast1/services/quarantinemedia`;
const policy = await api(`${service}:getIamPolicy?options.requestedPolicyVersion=3`);
policy.bindings ??= [];
let binding = policy.bindings.find(b => b.role === 'roles/run.invoker' && !b.condition);
if (!binding) { binding = { role: 'roles/run.invoker', members: [] }; policy.bindings.push(binding); }
const member = `serviceAccount:discrete-platform@${project}.iam.gserviceaccount.com`;
if (!binding.members.includes(member)) binding.members.push(member);
await api(`${service}:setIamPolicy`, { method: 'POST', body: { policy } });
console.log('Runtime trigger identity can invoke only the private media worker; no public invoker grant added.');
