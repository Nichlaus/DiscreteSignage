// Explicit release actions only; never called by tests or application startup.
import { readFileSync, writeFileSync } from 'node:fs';
import { api, project } from './firebase-project.mjs';
const region = 'australia-southeast1';
const parent = `projects/${project}/locations/${region}`;
const service = `${parent}/services/discrete-video`;
const runtime = `discrete-video@${project}.iam.gserviceaccount.com`;
const action = process.argv[2];
if (action === 'build') {
  const files = Object.fromEntries(['Dockerfile', 'decode.mjs', 'server.mjs', 'decode.test.mjs', 'server.test.mjs']
    .map(name => [name, readFileSync(`video-worker/${name}`).toString('base64')]));
  const image = `${region}-docker.pkg.dev/${project}/gcf-artifacts/discrete-video:${process.argv[3]}`;
  if (!/^[a-z0-9-]{1,64}$/.test(process.argv[3] ?? '')) throw Error('Provide a release tag.');
  const result = await api(`https://cloudbuild.googleapis.com/v1/${parent}/builds`, { method: 'POST', body: {
    serviceAccount: `projects/${project}/serviceAccounts/203068976562-compute@developer.gserviceaccount.com`,
    options: { logging: 'CLOUD_LOGGING_ONLY' }, timeout: '1200s',
    steps: [{ name: 'node:24-trixie-slim', entrypoint: 'node', args: ['-e',
      "for(const item of process.argv.slice(1)){const [name,data]=JSON.parse(item);require('fs').writeFileSync(name,Buffer.from(data,'base64'))}",
      ...Object.entries(files).map(item => JSON.stringify(item))] },
    { name: 'gcr.io/cloud-builders/docker', args: ['build', '-t', image, '.'] }], images: [image],
  } });
  const id = result.metadata?.build?.id;
  if (!id) throw Error('Build accepted without an id; inspect regional builds before retrying.');
  writeFileSync('artifacts/video-build.json', JSON.stringify({ id, image }));
  console.log(JSON.stringify({ id, image }));
} else if (action === 'status') {
  const { id } = JSON.parse(readFileSync('artifacts/video-build.json'));
  const build = await api(`https://cloudbuild.googleapis.com/v1/${parent}/builds/${id}`);
  console.log(JSON.stringify({ id, status: build.status, images: build.results?.images, failure: build.failureInfo }));
} else if (action === 'logs') {
  const { id } = JSON.parse(readFileSync('artifacts/video-build.json'));
  const result = await api('https://logging.googleapis.com/v2/entries:list', { method: 'POST', body: {
    resourceNames: [`projects/${project}`], filter: `resource.type="build" AND resource.labels.build_id="${id}"`,
    orderBy: 'timestamp desc', pageSize: 20,
  } });
  console.log((result.entries ?? []).map(e => e.textPayload).reverse().join('\n'));
} else if (action === 'deploy') {
  const { id } = JSON.parse(readFileSync('artifacts/video-build.json'));
  const build = await api(`https://cloudbuild.googleapis.com/v1/${parent}/builds/${id}`);
  if (build.status !== 'SUCCESS' || !build.results?.images?.[0]?.digest) throw Error('Linux build/tests have not passed.');
  const built = build.results.images[0];
  const image = `${built.name.split(':')[0]}@${built.digest}`;
  try { await api(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${runtime}`); }
  catch (error) {
    if (!error.message.startsWith('404:')) throw error;
    await api(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`, { method: 'POST',
      body: { accountId: 'discrete-video', serviceAccount: { displayName: 'Private video decoder (no data roles)' } } });
  }
  const result = await api(`https://run.googleapis.com/v2/${parent}/services?serviceId=discrete-video`, {
    method: 'POST', body: { ingress: 'INGRESS_TRAFFIC_ALL', invokerIamDisabled: false,
      template: { serviceAccount: runtime, timeout: '150s', maxInstanceRequestConcurrency: 1,
        scaling: { minInstanceCount: 0, maxInstanceCount: 2 }, containers: [{ image,
          resources: { limits: { cpu: '2', memory: '2Gi' } }, ports: [{ containerPort: 8080 }] }] } },
  });
  console.log(JSON.stringify({ operation: result.name, image }));
} else if (action === 'grant-invoker') {
  const url = `https://run.googleapis.com/v2/${service}`;
  const policy = await api(`${url}:getIamPolicy`);
  const member = `serviceAccount:discrete-platform@${project}.iam.gserviceaccount.com`;
  if (policy.bindings?.some(b => b.members?.some(m => ['allUsers', 'allAuthenticatedUsers'].includes(m)))) {
    throw Error('Unexpected public policy; review before proceeding.');
  }
  policy.bindings ??= [];
  let binding = policy.bindings.find(b => b.role === 'roles/run.invoker' && !b.condition);
  if (!binding) { binding = { role: 'roles/run.invoker', members: [] }; policy.bindings.push(binding); }
  if (!binding.members.includes(member)) binding.members.push(member);
  await api(`${url}:setIamPolicy`, { method: 'POST', body: { policy } });
  console.log('Granted backend invocation on discrete-video only.');
} else if (action === 'retain-images') {
  const url = `https://artifactregistry.googleapis.com/v1/${parent}/repositories/gcf-artifacts`;
  const repo = await api(url);
  const cleanupPolicies = { ...repo.cleanupPolicies, 'discrete-video-keep': {
    id: 'discrete-video-keep', action: 'KEEP', mostRecentVersions: { packageNamePrefixes: ['discrete-video'], keepCount: 2 },
  } };
  await api(`${url}?updateMask=cleanupPolicies`, { method: 'PATCH', body: { cleanupPolicies } });
  console.log('Preserved the two latest video images alongside existing cleanup policies.');
} else if (action === 'configure') {
  const worker = await api(`https://run.googleapis.com/v2/${service}`);
  if (worker.terminalCondition?.state !== 'CONDITION_SUCCEEDED' || worker.invokerIamDisabled) throw Error('Worker not privately ready.');
  const url = worker.urls.find(url => url.endsWith('.australia-southeast1.run.app'));
  if (!url) throw Error('Regional worker URL missing.');
  const envPath = `functions/.env.${project}`;
  let env = '';
  try { env = readFileSync(envPath, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  env = env.split(/\r?\n/).filter(line => !line.startsWith('VIDEO_WORKER_URL=')).join('\n').trimEnd();
  writeFileSync(envPath, `${env ? `${env}\n` : ''}VIDEO_WORKER_URL=${url}\n`);
  const bucketUrl = `https://storage.googleapis.com/storage/v1/b/${project}.firebasestorage.app`;
  const bucket = await api(bucketUrl);
  if (bucket.cors?.length !== 1 || JSON.stringify(bucket.cors[0].origin) !== JSON.stringify([
    `https://${project}.web.app`, `https://${project}.firebaseapp.com`])) throw Error('Unexpected CORS; review first.');
  bucket.cors[0].method = ['PUT', 'GET'];
  await api(`${bucketUrl}?ifMetagenerationMatch=${bucket.metageneration}`, { method: 'PATCH', body: { cors: bucket.cors } });
  console.log('Configured worker URL locally and signed-GET CORS on existing portal origins.');
} else throw Error('Use build <tag>, status, logs, deploy, grant-invoker, retain-images, or configure.');
