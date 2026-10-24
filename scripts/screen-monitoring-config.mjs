import { SCREEN_HEALTH_METRIC, SCAN_METRIC } from '../functions/src/screen-health.js';

export const screenMetricDescriptors = [
  { type: SCREEN_HEALTH_METRIC, displayName: 'Discrete Signage screen not reporting',
    metricKind: 'GAUGE', valueType: 'DOUBLE', unit: '1',
    labels: ['business_id', 'location_id', 'screen_id', 'device_id'].map(key => ({ key, valueType: 'STRING' })) },
  { type: SCAN_METRIC, displayName: 'Discrete Signage completed screen scan',
    metricKind: 'GAUGE', valueType: 'DOUBLE', unit: '1' },
];

export function screenPolicies(channel) {
  const base = { enabled: true, combiner: 'OR', notificationChannels: [channel],
    userLabels: { managed_by: 'discrete-signage', purpose: 'pilot' },
    alertStrategy: { autoClose: '86400s', notificationPrompts: ['OPENED', 'CLOSED'] } };
  const filter = type => `metric.type="${type}" AND resource.type="global" AND resource.label.project_id="discretesignage"`;
  return [
    { ...base, displayName: 'Discrete Signage screen not reporting',
      documentation: { mimeType: 'text/markdown', content: 'A paired screen has not reported for at least 15 minutes. Identify it using business_id, location_id and screen_id in the incident. Check power and network through the owner portal or MFA admin diagnostics. Cached playback may still be running. A closed incident can mean reconnection, revocation or trial expiry, not necessarily resumed playback. See docs/SCREEN_ALERTS.md. No customer media is included.' },
      conditions: [{ displayName: 'Screen heartbeat overdue', conditionThreshold: {
        filter: filter(SCREEN_HEALTH_METRIC), comparison: 'COMPARISON_GT', thresholdValue: 0,
        duration: '0s', trigger: { count: 1 },
        aggregations: [{ alignmentPeriod: '300s', perSeriesAligner: 'ALIGN_NEXT_OLDER' }],
      } }] },
    { ...base, displayName: 'Discrete Signage screen monitoring stalled',
      documentation: { mimeType: 'text/markdown', content: 'No completed screen scan for 30 minutes. Inspect monitorScreenHealth, Cloud Scheduler, metric-writer permission and pilot scan limits. Do not interpret absent metrics or auto-closed incidents as healthy screens. See docs/SCREEN_ALERTS.md.' },
      conditions: [{ displayName: 'No completed scan for 30 minutes', conditionAbsent: {
        filter: filter(SCAN_METRIC), duration: '1800s', trigger: { count: 1 },
        aggregations: [{ alignmentPeriod: '300s', perSeriesAligner: 'ALIGN_NEXT_OLDER' }],
      } }] },
  ];
}
