import { test } from 'node:test';
import assert from 'node:assert/strict';
import { screenHealth, dashboardView } from '../web/dashboard.js';

test('stale, future, loading or errored reports cannot be presented as recently applied', () => {
  const now = 200000;
  const ready = { active: true, version: 2, appliedVersion: 2, deviceState: 'ready', reportedAt: now - 1000 };
  assert.equal(screenHealth(ready, now).kind, 'ready');
  for (const change of [{ reportedAt: now - 120000 }, { reportedAt: now + 6000 },
    { reportedAt: null }, { deviceState: 'error' }, { deviceState: 'downloading' },
    { appliedVersion: 1 }, { deviceState: null }]) {
    assert.equal(screenHealth({ ...ready, ...change }, now).kind, 'attention');
  }
  assert.equal(screenHealth({ ...ready, active: false }, now).kind, 'inactive');
});

test('scoped staff overview omits owner shortcuts and revoked screens from attention', () => {
  const html = dashboardView({ role: 'staff', locations: [], screens: [{ id: 'old', name: 'Revoked screen', active: false }] }, 200000, String);
  assert.ok(!html.includes('href="#media-section"'));
  assert.ok(!html.includes('href="#reports-section"'));
  assert.ok(!html.includes('Revoked screen'));
  assert.ok(html.includes('Ask the owner'));
});
