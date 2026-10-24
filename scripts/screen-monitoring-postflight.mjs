import assert from 'node:assert/strict';
import { api, project } from './firebase-project.mjs';
const region = 'australia-southeast1';
const identity = `discrete-platform@${project}.iam.gserviceaccount.com`;
const fn = await api(`https://cloudfunctions.googleapis.com/v2/projects/${project}/locations/${region}/functions/monitorScreenHealth`);
assert.equal(fn.state, 'ACTIVE');
assert.equal(fn.serviceConfig.serviceAccountEmail, identity);
assert.equal(fn.serviceConfig.maxInstanceCount, 1);
assert.equal(fn.serviceConfig.maxInstanceRequestConcurrency, 1);
assert.equal(fn.serviceConfig.timeoutSeconds, 240);
const job = await api(`https://cloudscheduler.googleapis.com/v1/projects/${project}/locations/${region}/jobs/firebase-schedule-monitorScreenHealth-${region}`);
assert.equal(job.state, 'ENABLED');
assert.equal(job.schedule, 'every 5 minutes');
assert.equal(job.timeZone, 'Australia/Sydney');
assert.equal(job.httpTarget.oidcToken.serviceAccountEmail, identity);
assert.equal(job.httpTarget.uri, `https://${region}-${project}.cloudfunctions.net/monitorScreenHealth`);
assert.equal(job.httpTarget.oidcToken.audience, job.httpTarget.uri);
const iam = await api(`https://run.googleapis.com/v2/projects/${project}/locations/${region}/services/monitorscreenhealth:getIamPolicy`);
assert.ok(iam.bindings?.some(b => b.role === 'roles/run.invoker' && !b.condition && b.members.includes(`serviceAccount:${identity}`)));
assert.ok(!iam.bindings?.some(b => b.members.some(m => ['allUsers', 'allAuthenticatedUsers'].includes(m))));
console.log('PASS: active worker, bounded concurrency and private scheduled invocation.');
const policies = (await api(`https://monitoring.googleapis.com/v3/projects/${project}/alertPolicies`)).alertPolicies;
for (const name of ['Discrete Signage screen not reporting', 'Discrete Signage screen monitoring stalled']) {
  const matches = policies.filter(p => p.displayName === name);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].enabled, true);
  assert.deepEqual(matches[0].notificationChannels, [`projects/${project}/notificationChannels/11111903878732052963`]);
  assert.deepEqual(matches[0].alertStrategy.notificationPrompts, ['OPENED', 'CLOSED']);
}
console.log('PASS: unique enabled screen policies use the operational channel for opening and closing.');
const query = new URLSearchParams({ filter: 'metric.type="custom.googleapis.com/discrete_signage/screen_scan_complete"',
  'interval.startTime': new Date(Date.now() - 900000).toISOString(), 'interval.endTime': new Date().toISOString() });
const samples = await api(`https://monitoring.googleapis.com/v3/projects/${project}/timeSeries?${query}`);
assert.ok(samples.timeSeries?.some(s => s.points?.some(p => p.value.doubleValue === 1)), 'No completed scan in the past 15 minutes');
console.log('PASS: recent completed scan metric observed. This does not prove email receipt.');
