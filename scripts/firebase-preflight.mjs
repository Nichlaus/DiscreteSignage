import { api, project } from './firebase-project.mjs';
const checks = {
  project: `https://firebase.googleapis.com/v1beta1/projects/${project}`,
  billing: `https://cloudbilling.googleapis.com/v1/projects/${project}/billingInfo`,
  databases: `https://firestore.googleapis.com/v1/projects/${project}/databases`,
  auth: `https://identitytoolkit.googleapis.com/admin/v2/projects/${project}/config`,
  hosting: `https://firebasehosting.googleapis.com/v1beta1/projects/${project}/sites`,
};
await Promise.all(Object.entries(checks).map(async ([name, url]) => {
  try {
    const result = await api(url);
    if (name === 'billing') console.log(name, JSON.stringify({ billingEnabled: result.billingEnabled }));
    else if (name === 'auth') console.log(name, JSON.stringify({
      signIn: { email: result.signIn?.email, anonymous: result.signIn?.anonymous },
      authorizedDomains: result.authorizedDomains,
      passwordPolicyConfig: result.passwordPolicyConfig, emailPrivacyConfig: result.emailPrivacyConfig,
    }));
    else console.log(name, JSON.stringify(result));
  } catch (error) { console.log(name, error.message); }
}));
