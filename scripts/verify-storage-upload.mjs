// Explicit live acceptance: creates one synthetic object and deletes it afterward.
// Never print signed URLs, bearer tokens or object contents.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { api, project } from './firebase-project.mjs';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { Storage } = require('@google-cloud/storage');
if (process.argv[2] !== '--run') throw Error('Use --run for the synthetic live upload acceptance.');
const email = `discrete-platform@${project}.iam.gserviceaccount.com`;
const rootRequire = createRequire(import.meta.url);
const { getProjectDefaultAccount } = rootRequire('firebase-tools/lib/auth.js');
const operator = getProjectDefaultAccount(process.cwd())?.user?.email;
if (!operator) throw Error('Authenticated CLI account required.');
const iam = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`;
const title = `media-acceptance-${randomUUID()}`;
// Test-only signing, on this service account alone, with automatic ten-minute
// expiry as a backstop. Always remove the binding, including failed checks.
const policy = await api(`${iam}:getIamPolicy?options.requestedPolicyVersion=3`, { method: 'POST' });
policy.version = 3;
policy.bindings ??= [];
policy.bindings.push({ role: `projects/${project}/roles/discreteDeviceSigner`,
  members: [`user:${operator}`], condition: { title,
    expression: `request.time < timestamp("${new Date(Date.now() + 600000).toISOString()}")` } });
await api(`${iam}:setIamPolicy`, { method: 'POST', body: { policy } });
try {
const storage = new Storage({ projectId: project });
storage.authClient = {
  getCredentials: async () => ({ client_email: email }),
  sign: async value => {
    for (let attempt = 0; ; attempt++) {
      try {
        return (await api(`https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${email}:signBlob`, {
          method: 'POST', body: { payload: Buffer.from(value).toString('base64') },
        })).signedBlob;
      } catch (error) {
        if (attempt >= 30 || !error.message.startsWith('403:')) throw error;
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  },
};
const bucket = `${project}.firebasestorage.app`;
const path = `acceptance/upload-${randomUUID()}`;
const file = storage.bucket(bucket).file(path);
async function inspect(target) {
  const [readUrl] = await target.getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 120000 });
  return fetch(readUrl);
}
async function remove(target) {
  const response = await inspect(target);
  if (response.status === 404) return;
  assert.equal(response.status, 200, 'Test object inspection failed');
  const generation = response.headers.get('x-goog-generation');
  assert.ok(generation);
  await response.arrayBuffer();
  const headers = { 'x-goog-if-generation-match': generation };
  const [deleteUrl] = await target.getSignedUrl({ version: 'v4', action: 'delete',
    expires: Date.now() + 120000, extensionHeaders: headers });
  assert.equal((await fetch(deleteUrl, { method: 'DELETE', headers })).status, 204, 'Test cleanup failed');
}
const recovery = process.argv.find(a => a.startsWith('--cleanup='))?.slice('--cleanup='.length);
if (recovery) {
  assert.match(recovery, /^acceptance\/upload-[a-f0-9-]{36}$/);
  await remove(storage.bucket(bucket).file(recovery));
  console.log('Previous synthetic acceptance object removed.');
}
const headers = { 'Content-Type': 'image/png', 'x-goog-content-length-range': '12,12',
  'x-goog-if-generation-match': '0', 'x-goog-meta-reservation': 'acceptance' };
const [url] = await file.getSignedUrl({ version: 'v4', action: 'write', expires: Date.now() + 120000,
  contentType: headers['Content-Type'],
  extensionHeaders: Object.fromEntries(Object.entries(headers).filter(([k]) => k.startsWith('x-goog-'))) });
const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
try {
  const preflight = await fetch(url, { method: 'OPTIONS', headers: {
    Origin: `https://${project}.web.app`, 'Access-Control-Request-Method': 'PUT',
    'Access-Control-Request-Headers': Object.keys(headers).join(','),
  } });
  assert.equal(preflight.headers.get('access-control-allow-origin'), `https://${project}.web.app`);
  const foreign = await fetch(url, { method: 'OPTIONS', headers: {
    Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'PUT',
  } });
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
  const injected = await fetch(url, { method: 'PUT',
    headers: { ...headers, 'x-goog-meta-firebasestoragedownloadtokens': 'not-a-secret-test-value' }, body: bytes });
  assert.ok([400, 403].includes(injected.status), 'Unsigned token metadata must be rejected');
  const wrongSize = await fetch(url, { method: 'PUT', headers, body: Buffer.alloc(13) });
  assert.equal(wrongSize.status, 400, 'Size restriction must be enforced by GCS');
  const wrongType = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'text/html' }, body: bytes });
  assert.equal(wrongType.status, 403, 'Content type must be signed');
  const upload = await fetch(url, { method: 'PUT', headers, body: bytes });
  assert.equal(upload.status, 200, 'Valid synthetic upload must succeed');
  const object = await inspect(file);
  assert.equal(object.status, 200);
  assert.equal(object.headers.get('x-goog-meta-reservation'), 'acceptance');
  assert.ok(![...object.headers.keys()].some(k => k.toLowerCase().includes('firebasestoragedownloadtokens')));
  assert.deepEqual(Buffer.from(await object.arrayBuffer()), bytes);
  assert.equal((await fetch(url, { method: 'PUT', headers, body: bytes })).status, 412, 'No overwrite');
  assert.ok([400, 403].includes((await fetch(url, { headers })).status), 'Upload credential cannot read');
  const anonymous = await fetch(`https://storage.googleapis.com/${bucket}/${path}`);
  assert.ok([401, 403].includes(anonymous.status), 'Object must be private');
  console.log('PASS: signed size/type/metadata constraints, private token-free upload, replay and read denial.');
} finally {
  await remove(file);
  console.log('Synthetic acceptance object removed.');
}
} finally {
  const current = await api(`${iam}:getIamPolicy?options.requestedPolicyVersion=3`, { method: 'POST' });
  current.bindings = current.bindings.filter(b => b.condition?.title !== title);
  await api(`${iam}:setIamPolicy`, { method: 'POST', body: { policy: current } });
  console.log('Temporary operator signing permission removed.');
}
