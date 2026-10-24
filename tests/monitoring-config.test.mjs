import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monitoredPages, uptimeConfig, uptimePolicy, backendPolicy } from '../scripts/monitoring-config.mjs';

test('public probes require TLS, exact 200 and distinct page content without credentials', () => {
  assert.equal(monitoredPages.length, 4);
  assert.equal(new Set(monitoredPages.map(page => page[1])).size, 4);
  for (const page of monitoredPages) {
    const config = uptimeConfig(page);
    assert.equal(config.period, '300s');
    assert.equal(config.httpCheck.validateSsl, true);
    assert.equal(config.httpCheck.useSsl, true);
    assert.equal(config.httpCheck.authInfo, undefined);
    assert.deepEqual(config.httpCheck.acceptedResponseStatusCodes, [{ statusValue: 200 }]);
    assert.equal(config.contentMatchers[0].content, page[2]);
  }
});

test('uptime alert groups each page separately and requires multiple failed locations', () => {
  const checks = monitoredPages.map((page, i) => ({ name: `projects/discretesignage/uptimeCheckConfigs/check-${i}`, displayName: page[0] }));
  const policy = uptimePolicy(checks, 'channel');
  assert.equal(policy.conditions.length, 4);
  for (const [i, condition] of policy.conditions.entries()) {
    const threshold = condition.conditionThreshold;
    assert.ok(threshold.filter.includes(`check_id="check-${i}"`));
    assert.equal(threshold.comparison, 'COMPARISON_GT');
    assert.equal(threshold.thresholdValue, 1);
    assert.equal(threshold.duration, '300s');
    assert.equal(threshold.aggregations[0].crossSeriesReducer, 'REDUCE_COUNT_FALSE');
  }
  assert.deepEqual(policy.notificationChannels, ['channel']);
});

test('backend alert counts only 5xx and preserves service identity across revisions', () => {
  const threshold = backendPolicy('channel').conditions[0].conditionThreshold;
  assert.match(threshold.filter, /response_code_class="5xx"/);
  assert.match(threshold.filter, /project_id="discretesignage"/);
  assert.equal(threshold.thresholdValue, 4);
  assert.deepEqual(threshold.aggregations[0].groupByFields, ['resource.label.service_name']);
  assert.equal(threshold.aggregations[0].alignmentPeriod, '300s');
});
