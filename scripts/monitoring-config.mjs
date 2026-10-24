export const monitoredPages = [
  ['portal', '/index.html', 'Your business, connected'],
  ['display', '/display.html', 'Discrete Signage · Display'],
  ['admin', '/admin.html', 'Developer diagnostics'],
  ['client', '/client.html', 'Client workspace'],
];

export function uptimeConfig([label, path, title]) {
  return {
    displayName: `Discrete Signage ${label} availability`,
    monitoredResource: { type: 'uptime_url', labels: { project_id: 'discretesignage', host: 'discretesignage.web.app' } },
    httpCheck: { path, port: 443, useSsl: true, validateSsl: true,
      requestMethod: 'GET', acceptedResponseStatusCodes: [{ statusValue: 200 }] },
    period: '300s', timeout: '10s', checkerType: 'STATIC_IP_CHECKERS',
    selectedRegions: ['USA', 'EUROPE', 'ASIA_PACIFIC'],
    contentMatchers: [{ content: title, matcher: 'CONTAINS_STRING' }],
  };
}

export function uptimePolicy(checks, channel) {
  return policy('Discrete Signage public pages unavailable', channel, checks.map(check => ({
    displayName: `${check.displayName}: at least two failing checker locations`,
    conditionThreshold: {
      filter: `metric.type="monitoring.googleapis.com/uptime_check/check_passed" AND resource.type="uptime_url" AND metric.label.check_id="${check.name.split('/').at(-1)}"`,
      comparison: 'COMPARISON_GT', thresholdValue: 1, duration: '300s', trigger: { count: 1 },
      aggregations: [{ alignmentPeriod: '600s', perSeriesAligner: 'ALIGN_NEXT_OLDER', crossSeriesReducer: 'REDUCE_COUNT_FALSE' }],
    },
  })), 'Check public delivery and recent Hosting releases. Run scripts/check-public-site.mjs. Follow docs/PILOT_SUPPORT.md and docs/HOSTING_ROLLBACK.md. This alert does not establish playback failure.');
}

export function backendPolicy(channel) {
  return policy('Discrete Signage backend 5xx errors', channel, [{
    displayName: 'At least five server errors per service in five minutes',
    conditionThreshold: {
      filter: 'metric.type="run.googleapis.com/request_count" AND resource.type="cloud_run_revision" AND resource.label.project_id="discretesignage" AND metric.label.response_code_class="5xx"',
      comparison: 'COMPARISON_GT', thresholdValue: 4, duration: '0s', trigger: { count: 1 },
      aggregations: [{ alignmentPeriod: '300s', perSeriesAligner: 'ALIGN_SUM', crossSeriesReducer: 'REDUCE_SUM', groupByFields: ['resource.label.service_name'] }],
    },
  }], 'Inspect the affected Cloud Run service and recent changes. Includes Functions v2 and private video worker HTTP 5xx responses. Do not disable Auth/App Check or broaden IAM. Business-level errors returned as HTTP 200 are not covered. See docs/PILOT_SUPPORT.md.');
}

function policy(displayName, channel, conditions, content) {
  return { displayName, enabled: true, combiner: 'OR', conditions,
    userLabels: { managed_by: 'discrete-signage', purpose: 'pilot' },
    notificationChannels: [channel], documentation: { mimeType: 'text/markdown', content },
    alertStrategy: { autoClose: '3600s', notificationPrompts: ['OPENED', 'CLOSED'] },
  };
}
