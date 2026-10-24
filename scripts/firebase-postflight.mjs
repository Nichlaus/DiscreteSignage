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
assert.equal(auth.subtype, 'IDENTITY_PLATFORM');
assert.equal(auth.mfa.state, 'ENABLED');
assert.ok(auth.mfa.providerConfigs.some(p => p.state === 'ENABLED' && p.totpProviderConfig?.adjacentIntervals === 1));
console.log('PASS: Identity Platform authenticator MFA enabled with one adjacent interval.');
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
const submissionIndexes = await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/submissions/indexes`);
assert.ok(submissionIndexes.indexes?.some(index => index.state === 'READY' && index.queryScope === 'COLLECTION'
  && index.fields.some(field => field.fieldPath === 'advertiserId')
  && index.fields.some(field => field.fieldPath === 'status')));
console.log('PASS: submission advertiser/status index ready for tombstone-safe lists.');
const expected = ['provisionBusiness', 'updateBusinessMarket', 'getFoodMenu', 'saveFoodMenu', 'createLocation', 'getWorkspace', 'createInvitation', 'acceptInvitation', 'revokeInvitation',
  'beginPairing', 'claimScreen', 'completePairing', 'revokeScreen', 'updateScreenSettings',
  'beginMediaUpload', 'authorizeMediaUpload', 'completeMediaUpload', 'listMedia', 'cleanupMedia',
    'validateMedia', 'getScreenPlayback', 'reportPlayback', 'getMediaReport', 'getPlatformBusiness', 'listPlatformBusinesses',
    'createAdvertiser', 'listAdvertisers', 'setAdvertiserActive', 'inviteAdvertiser',
    'acceptAdvertiserInvitation', 'getAdvertiserWorkspace', 'beginClientSubmission', 'authorizeClientSubmission',
    'completeClientSubmission', 'listClientSubmissions', 'listAdvertiserSubmissions',
    'validateSubmission', 'previewSubmission', 'reviewSubmission', 'cleanupSubmission'];
const functions = (await api(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/australia-southeast1/functions`)).functions ?? [];
const quarantine = functions.find(fn => fn.name.endsWith('/quarantineMedia'));
assert.equal(quarantine?.state, 'ACTIVE', 'Media finalization trigger not active');
assert.equal(quarantine.serviceConfig.serviceAccountEmail, `discrete-platform@${project}.iam.gserviceaccount.com`);
assert.equal(quarantine.eventTrigger.eventType, 'google.cloud.storage.object.v1.finalized');
assert.ok(quarantine.eventTrigger.eventFilters.some(f => f.attribute === 'bucket' && f.value === `${project}.firebasestorage.app`));
assert.equal(quarantine.eventTrigger.serviceAccountEmail, `discrete-platform@${project}.iam.gserviceaccount.com`);
const workerPolicy = await api(`https://run.googleapis.com/v2/projects/${project}/locations/australia-southeast1/services/quarantinemedia:getIamPolicy`);
assert.ok(workerPolicy.bindings?.some(b => b.role === 'roles/run.invoker' && !b.condition
  && b.members.includes(`serviceAccount:discrete-platform@${project}.iam.gserviceaccount.com`)));
assert.ok(!workerPolicy.bindings?.some(b => b.members?.some(m => ['allUsers', 'allAuthenticatedUsers'].includes(m))));
console.log('PASS: private media finalization trigger active on the expected bucket.');
for (const name of expected) {
  const fn = functions.find(fn => fn.name.endsWith(`/${name}`));
  assert.equal(fn?.state, 'ACTIVE', `${name} not active`);
  assert.equal(fn.serviceConfig.serviceAccountEmail, `discrete-platform@${project}.iam.gserviceaccount.com`);
  if (['validateMedia', 'validateSubmission'].includes(name)) {
    assert.match(fn.serviceConfig.environmentVariables?.VIDEO_WORKER_URL ?? '', /^https:\/\/[a-z0-9-]+\.australia-southeast1\.run\.app$/);
    assert.ok(['1Gi', '1024Mi'].includes(fn.serviceConfig.availableMemory));
    assert.equal(fn.serviceConfig.timeoutSeconds, 180);
    assert.equal(fn.serviceConfig.maxInstanceCount, 2);
    assert.equal(fn.serviceConfig.maxInstanceRequestConcurrency, 1);
  }
  const response = await fetch(`https://australia-southeast1-${project}.cloudfunctions.net/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: {} }),
  });
  assert.equal(response.status, 401, `${name} did not reject missing credentials/App Check`);
  await response.arrayBuffer();
  console.log(`PASS: ${name} active; unauthenticated request rejected.`);
}
const page = await fetch(`https://${project}.web.app`);
assert.equal(page.status, 200);
assert.equal(page.headers.get('x-frame-options'), 'DENY');
assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
const html = await page.text();
assert.ok(html.includes('Discrete Signage'));
for (const asset of html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
  const response = await fetch(`https://${project}.web.app${asset[1]}`);
  assert.equal(response.status, 200);
  await response.arrayBuffer();
}
console.log('PASS: Hosting, asset URLs, and security headers.');
const display = await fetch(`https://${project}.web.app/display.html`);
assert.equal(display.status, 200);
assert.equal(display.headers.get('cache-control'), 'no-cache');
const displayHtml = await display.text();
assert.ok(displayHtml.includes('Connect your display'));
const admin = await fetch(`https://${project}.web.app/admin.html`);
assert.equal(admin.status, 200);
assert.equal(admin.headers.get('cache-control'), 'no-cache');
const adminHtml = await admin.text();
assert.ok(adminHtml.includes('Developer diagnostics'));
const client = await fetch(`https://${project}.web.app/client.html`);
assert.equal(client.status, 200);
assert.equal(client.headers.get('cache-control'), 'no-cache');
const clientHtml = await client.text();
assert.ok(clientHtml.includes('Client workspace'));
for (const [path, deployed] of [['index.html', html], ['display.html', displayHtml], ['admin.html', adminHtml], ['client.html', clientHtml]]) {
  assert.equal(deployed, readFileSync(`dist/${path}`, 'utf8'), `${path} does not match the local release build`);
  for (const asset of deployed.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)) {
    const response = await fetch(`https://${project}.web.app${asset[1]}`);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), readFileSync(`dist${asset[1]}`),
      `${asset[1]} does not match the release build`);
  }
}
console.log('PASS: Live portal/display/admin/client HTML and entry assets match the local release.');
console.log('PASS: Display page served without stale HTML caching.');
for (const group of ['pairingSessions', 'pairingLimits']) {
  const field = await api(`https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/collectionGroups/${group}/fields/expiresAt`);
  if (field.ttlConfig?.state === 'CREATING') {
    console.log(`PENDING: ${group} expiry cleanup is still activating.`);
    process.exitCode = 2;
  } else {
    assert.equal(field.ttlConfig?.state, 'ACTIVE', `${group} expiry cleanup not active`);
    console.log(`PASS: ${group} expiry cleanup active.`);
  }
}
const signerRole = `projects/${project}/roles/discreteDeviceSigner`;
const role = await api(`https://iam.googleapis.com/v1/${signerRole}`);
assert.deepEqual(role.includedPermissions, ['iam.serviceAccounts.signBlob']);
const runtimeEmail = `discrete-platform@${project}.iam.gserviceaccount.com`;
const signerPolicy = await api(`https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${runtimeEmail}:getIamPolicy?options.requestedPolicyVersion=3`, { method: 'POST' });
assert.ok(signerPolicy.bindings?.some(b => b.role === signerRole && !b.condition
  && b.members.includes(`serviceAccount:${runtimeEmail}`)));
console.log('PASS: Runtime has narrowly scoped self-signing permission.');
const realtime = await fetch(`https://${project}-default-rtdb.firebaseio.com/.json`, { method: 'HEAD' });
assert.equal(realtime.status, 401);
console.log('PASS: Realtime Database denies anonymous HEAD requests.');
