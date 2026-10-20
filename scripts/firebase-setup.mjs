import { writeFileSync } from 'node:fs';
import { api, project } from './firebase-project.mjs';
const number = '203068976562';
async function complete(origin, operation) {
  for (let attempt = 0; !operation.done && attempt < 36; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await api(`${origin}/${operation.name}`);
  }
  if (operation.error) throw Error(JSON.stringify(operation.error));
  if (!operation.done) throw Error(`Operation still pending: ${operation.name}`);
  return operation.response;
}
const action = process.argv[2];
if (action === 'services') {
  const operation = await api(`https://serviceusage.googleapis.com/v1/projects/${number}/services:batchEnable`, {
    method: 'POST', body: { serviceIds: [
      'firestore.googleapis.com', 'firebaseappcheck.googleapis.com',
      'recaptchaenterprise.googleapis.com', 'cloudfunctions.googleapis.com',
      'cloudbuild.googleapis.com', 'artifactregistry.googleapis.com', 'run.googleapis.com',
    ] },
  });
  await complete('https://serviceusage.googleapis.com/v1', operation);
  console.log('Required services enabled.');
} else if (action === 'pairing-identity') {
  await complete('https://serviceusage.googleapis.com/v1', await api(
    `https://serviceusage.googleapis.com/v1/projects/${number}/services/iamcredentials.googleapis.com:enable`,
    { method: 'POST', body: {} }));
  const roleId = 'discreteDeviceSigner';
  const roleName = `projects/${project}/roles/${roleId}`;
  const rolesUrl = `https://iam.googleapis.com/v1/projects/${project}/roles`;
  const existing = (await api(rolesUrl)).roles?.find(role => role.name === roleName);
  if (!existing) {
    await api(rolesUrl, { method: 'POST', body: { roleId, role: {
      title: 'Discrete device token signer', description: 'Sign Firebase display authentication tokens.',
      includedPermissions: ['iam.serviceAccounts.signBlob'], stage: 'GA',
    } } });
  } else {
    const role = await api(`https://iam.googleapis.com/v1/${roleName}`);
    if (role.deleted || JSON.stringify(role.includedPermissions) !== JSON.stringify(['iam.serviceAccounts.signBlob'])) {
      throw Error('Existing signer role differs from the expected single permission; inspect before changing.');
    }
  }
  const email = `discrete-platform@${project}.iam.gserviceaccount.com`;
  const target = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts/${email}`;
  const policy = await api(`${target}:getIamPolicy?options.requestedPolicyVersion=3`, { method: 'POST' });
  policy.bindings ??= [];
  let binding = policy.bindings.find(b => b.role === roleName && !b.condition);
  if (!binding) { binding = { role: roleName, members: [] }; policy.bindings.push(binding); }
  const member = `serviceAccount:${email}`;
  if (!binding.members.includes(member)) binding.members.push(member);
  await api(`${target}:setIamPolicy`, { method: 'POST', body: { policy } });
  console.log('Runtime can sign device tokens using only its own service account; no private key created.');
} else if (action === 'database') {
  const list = await api(`https://firestore.googleapis.com/v1/projects/${project}/databases`);
  const existing = list.databases?.find(db => db.name.endsWith('/(default)'));
  if (existing) console.log('Existing database:', existing.locationId, existing.type);
  else {
    await complete('https://firestore.googleapis.com/v1', await api(
      `https://firestore.googleapis.com/v1/projects/${project}/databases?databaseId=(default)`,
      { method: 'POST', body: { locationId: 'australia-southeast1', type: 'FIRESTORE_NATIVE', deleteProtectionState: 'DELETE_PROTECTION_ENABLED' } }));
    console.log('Firestore created in australia-southeast1 with deletion protection.');
  }
} else if (action === 'web') {
  const base = `https://firebase.googleapis.com/v1beta1/projects/${project}`;
  let apps = (await api(`${base}/webApps`)).apps ?? [];
  let app = apps.find(a => a.displayName === 'Discrete Signage Portal');
  if (!app) {
    app = await complete('https://firebase.googleapis.com/v1beta1',
      await api(`${base}/webApps`, { method: 'POST', body: { displayName: 'Discrete Signage Portal' } }));
  }
  const config = await api(`${base}/webApps/${app.appId}/config`);
  const keyBase = `https://recaptchaenterprise.googleapis.com/v1/projects/${project}/keys`;
  const keys = (await api(keyBase)).keys ?? [];
  let key = keys.find(k => k.displayName === 'Discrete Signage Portal App Check');
  if (!key) key = await api(keyBase, { method: 'POST', body: {
    displayName: 'Discrete Signage Portal App Check',
    webSettings: { allowedDomains: [`${project}.web.app`, `${project}.firebaseapp.com`],
      allowAllDomains: false, integrationType: 'SCORE' },
  } });
  const siteKey = key.name.split('/').at(-1);
  const name = `projects/${number}/apps/${app.appId}/recaptchaEnterpriseConfig`;
  await api(`https://firebaseappcheck.googleapis.com/v1/${name}?updateMask=siteKey,tokenTtl`, {
    method: 'PATCH', body: { name, siteKey, tokenTtl: '3600s' },
  });
  writeFileSync('.env.local', `VITE_FIREBASE_CONFIG=${JSON.stringify(config)}\nVITE_RECAPTCHA_ENTERPRISE_SITE_KEY=${siteKey}\n`);
  console.log('Web app and App Check configured; public build configuration saved to ignored .env.local.');
  console.log('App ID:', app.appId);
} else if (action === 'repair-invoker') {
  // The first create failed before Firebase set the standard callable invoker.
  // Auth and App Check remain mandatory inside the callable handler.
  const service = `https://run.googleapis.com/v2/projects/${project}/locations/australia-southeast1/services/acceptinvitation`;
  const policy = await api(`${service}:getIamPolicy?options.requestedPolicyVersion=3`);
  policy.bindings ??= [];
  let binding = policy.bindings.find(b => b.role === 'roles/run.invoker' && !b.condition);
  if (!binding) { binding = { role: 'roles/run.invoker', members: [] }; policy.bindings.push(binding); }
  if (!binding.members.includes('allUsers')) binding.members.push('allUsers');
  await api(`${service}:setIamPolicy`, { method: 'POST', body: { policy } });
  console.log('Restored standard callable invocation policy on acceptInvitation.');
} else if (action === 'enforce') {
  for (const service of ['identitytoolkit.googleapis.com', 'firestore.googleapis.com', 'firebasedatabase.googleapis.com']) {
    const name = `projects/${number}/services/${service}`;
    await api(`https://firebaseappcheck.googleapis.com/v1/${name}?updateMask=enforcementMode`, {
      method: 'PATCH', body: { name, enforcementMode: 'ENFORCED' },
    });
    console.log('App Check enforced:', service);
  }
} else if (action === 'identity') {
  const email = `discrete-platform@${project}.iam.gserviceaccount.com`;
  const base = `https://iam.googleapis.com/v1/projects/${project}/serviceAccounts`;
  const existing = (await api(base)).accounts ?? [];
  if (!existing.some(account => account.email === email)) {
    await api(base, { method: 'POST', body: {
      accountId: 'discrete-platform',
      serviceAccount: { displayName: 'Discrete Signage platform runtime' },
    } });
  }
  const iamUrl = `https://cloudresourcemanager.googleapis.com/v1/projects/${project}`;
  const policy = await api(`${iamUrl}:getIamPolicy`, {
    method: 'POST', body: { options: { requestedPolicyVersion: 3 } },
  });
  policy.bindings ??= [];
  for (const role of ['roles/datastore.user', 'roles/firebaseauth.viewer']) {
    let binding = policy.bindings.find(binding => binding.role === role && !binding.condition);
    if (!binding) { binding = { role, members: [] }; policy.bindings.push(binding); }
    const member = `serviceAccount:${email}`;
    if (!binding.members.includes(member)) binding.members.push(member);
  }
  await api(`${iamUrl}:setIamPolicy`, { method: 'POST', body: { policy } });
  console.log('Dedicated runtime identity configured for Firestore data and Auth reads.');
} else if (action === 'auth') {
  const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`;
  const config = await api(url);
  const mask = 'signIn.email,signIn.anonymous,emailPrivacyConfig,passwordPolicyConfig,authorizedDomains';
  await api(`${url}?updateMask=${mask}`, { method: 'PATCH', body: {
    signIn: { email: { enabled: true, passwordRequired: true }, anonymous: { enabled: false } },
    emailPrivacyConfig: { enableImprovedEmailPrivacy: true },
    passwordPolicyConfig: { passwordPolicyEnforcementState: 'ENFORCE',
      passwordPolicyVersions: [{ customStrengthOptions: { minPasswordLength: 12 } }] },
    authorizedDomains: [...new Set([...(config.authorizedDomains ?? []),
      `${project}.web.app`, `${project}.firebaseapp.com`])],
  } });
  console.log('Email/password Auth enabled; 12-character policy and email privacy enforced.');
} else throw Error('Choose services, database, web, identity, pairing-identity, auth, enforce, or repair-invoker.');
