import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { getProjectDefaultAccount, getAccessToken } = require('firebase-tools/lib/auth.js');
export const project = 'discretesignage';
export async function api(url, { method = 'GET', body } = {}) {
  const account = getProjectDefaultAccount(process.cwd());
  if (!account) throw Error('Firebase CLI login required.');
  const token = await getAccessToken(account.tokens.refresh_token, ['https://www.googleapis.com/auth/cloud-platform']);
  const response = await fetch(url, {
    method, headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(`${response.status}: ${data.error?.message ?? response.statusText}`);
  return data;
}
