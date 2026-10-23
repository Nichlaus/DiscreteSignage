import { writeFileSync } from 'node:fs';
import { api, project } from './firebase-project.mjs';
const origin = 'https://firebase.googleapis.com/v1beta1';
const parent = `projects/${project}`;
const packageName = 'com.discretesignage.display';
let app = (await api(`${origin}/${parent}/androidApps`)).apps?.find(a => a.packageName === packageName);
if (!app) {
  let operation = await api(`${origin}/${parent}/androidApps`, { method: 'POST',
    body: { packageName, displayName: 'Discrete Signage Display' } });
  for (let i = 0; !operation.done && i < 24; i++) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    operation = await api(`${origin}/${operation.name}`);
  }
  if (operation.error || !operation.done) throw Error('Android registration incomplete; inspect Firebase before retrying.');
  app = operation.response;
}
const response = await api(`${origin}/${app.name}/config`);
const config = JSON.parse(Buffer.from(response.configFileContents, 'base64').toString());
const client = config.client.find(c => c.client_info.android_client_info.package_name === packageName);
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const values = { google_app_id: client.client_info.mobilesdk_app_id, google_api_key: client.api_key[0].current_key,
  project_id: config.project_info.project_id, gcm_defaultSenderId: config.project_info.project_number };
writeFileSync('android-display/app/src/main/res/values/firebase.xml',
  '<resources>\n' + Object.entries(values).map(([key,value]) => `    <string name="${key}" translatable="false">${escape(value)}</string>`).join('\n') + '\n</resources>\n');
console.log(`Android app configured: ${app.appId}. App Check provider registration remains separate.`);
