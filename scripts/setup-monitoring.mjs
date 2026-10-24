import assert from 'node:assert/strict';
import { api, project } from './firebase-project.mjs';
import { monitoredPages, uptimeConfig, uptimePolicy, backendPolicy } from './monitoring-config.mjs';

const email = process.argv[2];
assert.match(email ?? '', /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Supply the authorized alert email');
const base = `https://monitoring.googleapis.com/v3/projects/${project}`;
async function list(collection, key) {
  const items = []; let pageToken = '';
  do {
    const result = await api(`${base}/${collection}${pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : ''}`);
    items.push(...(result[key] ?? [])); pageToken = result.nextPageToken ?? '';
  } while (pageToken);
  return items;
}
async function ensure(collection, key, config) {
  const existing = (await list(collection, key)).filter(item => item.displayName === config.displayName);
  assert.ok(existing.length <= 1, `Duplicate ${config.displayName}; inspect manually`);
  if (existing.length) {
    // A rerun never silently changes an existing operator configuration.
    function matches(actual, desired) {
      if (Array.isArray(desired)) return Array.isArray(actual) && actual.length === desired.length && desired.every((v, i) => matches(actual[i], v));
      if (desired && typeof desired === 'object') return Object.entries(desired).every(([k, v]) => matches(actual?.[k], v));
      return actual === desired;
    }
    assert.ok(matches(existing[0], config), `${config.displayName} differs; review before updating`);
    return existing[0];
  }
  return api(`${base}/${collection}`, { method: 'POST', body: config });
}

const channel = await ensure('notificationChannels', 'notificationChannels', {
  type: 'email', displayName: 'Discrete Signage operational email',
  labels: { email_address: email }, enabled: true,
});
console.log(`Channel ${channel.name}; verification ${channel.verificationStatus ?? 'not required/unspecified'}`);
const checks = [];
for (const page of monitoredPages) {
  const check = await ensure('uptimeCheckConfigs', 'uptimeCheckConfigs', uptimeConfig(page));
  checks.push(check); console.log(`Check ${check.name}`);
}
for (const config of [uptimePolicy(checks, channel.name), backendPolicy(channel.name)]) {
  const result = await ensure('alertPolicies', 'alertPolicies', config);
  console.log(`Policy ${result.name}; enabled ${result.enabled}`);
}
