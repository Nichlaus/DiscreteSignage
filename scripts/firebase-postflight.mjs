import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { api, project } from './firebase-project.mjs';
const configLine = readFileSync('.env.local', 'utf8').split('\n').find(line => line.startsWith('VITE_FIREBASE_CONFIG='));
const config = JSON.parse(configLine.slice('VITE_FIREBASE_CONFIG='.length));
const auth = await api(`https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`);
assert.equal(auth.signIn.email.enabled, true);
assert.equal(auth.signIn.email.passwordRequired, true);
assert.equal(auth.emailPrivacyConfig.enableImprovedEmailPrivacy, true);
assert.equal(auth.passwordPolicyConfig.passwordPolicyEnforcementState, 'ENFORCE');
assert.equal(auth.passwordPolicyConfig.passwordPolicyVersions[0].customStrengthOptions.minPasswordLength, 12);
console.log('PASS: Auth provider, password policy, and email privacy.');
const appCheck = await api(`https://firebaseappcheck.googleapis.com/v1/projects/203068976562/apps/${config.appId}/recaptchaEnterpriseConfig`);
assert.ok(appCheck.siteKey);
assert.equal(appCheck.tokenTtl, '3600s');
const key = await api(`https://recaptchaenterprise.googleapis.com/v1/projects/${project}/keys/${appCheck.siteKey}`);
assert.equal(key.webSettings.integrationType, 'SCORE');
assert.notEqual(key.webSettings.allowAllDomains, true);
assert.deepEqual([...key.webSettings.allowedDomains].sort(),
  [`${project}.web.app`, `${project}.firebaseapp.com`].sort());
console.log('PASS: reCAPTCHA Enterprise App Check provider configured.');
for (const service of ['identitytoolkit.googleapis.com', 'firestore.googleapis.com', 'firebasedatabase.googleapis.com']) {
  const config = await api(`https://firebaseappcheck.googleapis.com/v1/projects/203068976562/services/${service}`);
  assert.equal(config.enforcementMode, 'ENFORCED');
}
console.log('PASS: App Check enforced for Auth, Firestore, and Realtime Database.');
const db = await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)`);
assert.equal(db.locationId, 'australia-southeast1');
assert.equal(db.deleteProtectionState, 'DELETE_PROTECTION_ENABLED');
console.log('PASS: Sydney Firestore and deletion protection.');
const expected = ['provisionBusiness', 'createLocation', 'getWorkspace', 'createInvitation', 'acceptInvitation', 'revokeInvitation'];
const functions = (await api(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/australia-southeast1/functions`)).functions ?? [];
for (const name of expected) {
  const fn = functions.find(fn => fn.name.endsWith(`/${name}`));
  assert.equal(fn?.state, 'ACTIVE', `${name} not active`);
  assert.equal(fn.serviceConfig.serviceAccountEmail, `discrete-platform@${project}.iam.gserviceaccount.com`);
  const response = await fetch(`https://australia-southeast1-${project}.cloudfunctions.net/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }),
  });
  assert.equal(response.status, 401, `${name} did not reject missing credentials/App Check`);
  console.log(`PASS: ${name} active; unauthenticated request rejected.`);
}
const page = await fetch(`https://${project}.web.app`);
assert.equal(page.status, 200);
assert.equal(page.headers.get('x-frame-options'), 'DENY');
assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
const html = await page.text();
assert.ok(html.includes('Discrete Signage'));
for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  assert.equal((await fetch(`https://${project}.web.app${asset[1]}`)).status, 200);
}
console.log('PASS: Hosting, asset URLs, and security headers.');
const realtime = await fetch(`https://${project}-default-rtdb.firebaseio.com/.json`);
assert.equal(realtime.status, 401);
console.log('PASS: Realtime Database denies anonymous reads.');
