import { readFileSync } from 'node:fs';
import { api } from './firebase-project.mjs';

// Client identifiers are shipped in the APK; restrict their API scope instead
// of treating source-code removal as credential protection. Never print keys.
const xml = readFileSync('android-display/app/src/main/res/values/firebase.xml', 'utf8');
const value = xml.match(/name="google_api_key"[^>]*>([^<]+)/)?.[1];
if (!value) throw Error('Android Firebase configuration missing.');
const root = 'https://apikeys.googleapis.com/v2/';
const services = [
  'firebaseappcheck.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
];
const { keys = [] } = await api(root + 'projects/203068976562/locations/global/keys');
let match;
for (const key of keys) {
  const result = await api(root + key.name + '/keyString');
  if (result.keyString === value) match = key;
}
if (!match) throw Error('Configured Android key not found in this project.');
if (process.argv.includes('--apply')) {
  let operation = await api(root + match.name + '?updateMask=restrictions', {
    method: 'PATCH', body: { name: match.name, etag: match.etag,
      restrictions: { ...match.restrictions, apiTargets: services.map(service => ({ service })) } },
  });
  for (let i = 0; !operation.done && i < 20; i++) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    operation = await api(root + operation.name);
  }
  if (!operation.done || operation.error) throw Error('Restriction update unconfirmed; inspect key metadata.');
}
const current = await api(root + match.name);
const targets = current.restrictions?.apiTargets ?? [];
const expected = targets.length === services.length && targets.every(t => services.includes(t.service) && !t.methods?.length);
console.log(JSON.stringify({ displayName: current.displayName, expectedApiScope: expected,
  restrictions: current.restrictions }, null, 2));
if (!expected) process.exitCode = 1;
