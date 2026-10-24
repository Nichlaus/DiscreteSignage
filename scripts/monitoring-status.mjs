import { api, project } from './firebase-project.mjs';
const base = `https://monitoring.googleapis.com/v3/projects/${project}`;
for (const [collection, key] of [['uptimeCheckConfigs', 'uptimeCheckConfigs'], ['alertPolicies', 'alertPolicies'], ['notificationChannels', 'notificationChannels']]) {
  const data = await api(`${base}/${collection}`);
  console.log(collection, JSON.stringify((data[key] ?? []).map(item => ({ name: item.name,
    displayName: item.displayName, enabled: item.enabled, disabled: item.disabled,
    verificationStatus: item.verificationStatus })), null, 2));
}
const query = new URLSearchParams({ filter: 'metric.type="monitoring.googleapis.com/uptime_check/check_passed"',
  'interval.startTime': new Date(Date.now() - 1800000).toISOString(), 'interval.endTime': new Date().toISOString() });
const data = await api(`${base}/timeSeries?${query}`);
console.log('Latest uptime samples', JSON.stringify((data.timeSeries ?? []).map(series => ({
  check: series.metric.labels.check_id, location: series.metric.labels.checker_location,
  at: series.points?.[0]?.interval.endTime, passed: series.points?.[0]?.value.boolValue,
})), null, 2));
if (data.nextPageToken) console.log('More time series exist; this status view shows the first page only.');
